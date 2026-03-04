import { v4 as uuidv4 } from 'uuid';
import type { Message, TokenUsage, StreamEvent, ProviderConfig } from '../../../shared/types';
import { DEFAULT_TOKEN_USAGE } from '../../../shared/types';
import type { ToolContext } from '../../../shared/tool';
import { AnthropicProvider } from '../provider/anthropic';
import { toolRegistry } from '../tools';
import type { PermissionService } from '../permission/service';
import { createLogger } from '../logger';

const log = createLogger('AgentExecutor');

export interface ExecutorConfig {
  provider: ProviderConfig;
  systemPrompt: string;
  allowedTools?: string[];
  workingDir: string;
  sessionId: string;
  agentId?: string;
  maxSteps?: number;
  permissionService?: PermissionService;
}

export interface ExecutorResult {
  messages: Message[];
  finalText: string;
  tokenUsage: TokenUsage;
}

export class AgentExecutor {
  private provider: AnthropicProvider;
  private systemPrompt: string;
  private allowedTools: string[];
  private workingDir: string;
  private sessionId: string;
  private agentId: string;
  private maxSteps: number;
  private stepCount = 0;
  private abortController: AbortController | null = null;
  private isPaused = false;
  private pauseResolver: (() => void) | null = null;
  private permissionService: PermissionService | null;

  constructor(config: ExecutorConfig) {
    this.provider = new AnthropicProvider(config.provider);
    this.systemPrompt = config.systemPrompt;
    this.allowedTools = config.allowedTools || [];
    this.workingDir = config.workingDir;
    this.sessionId = config.sessionId;
    this.agentId = config.agentId || uuidv4();
    this.maxSteps = config.maxSteps ?? 50;
    this.permissionService = config.permissionService ?? null;
  }

  async execute(
    messages: Message[],
    onEvent?: (event: StreamEvent) => void
  ): Promise<ExecutorResult> {
    this.abortController = new AbortController();
    this.stepCount = 0;

    const tokenUsage: TokenUsage = { ...DEFAULT_TOKEN_USAGE };
    const allMessages = [...messages];

    await this.processResponse(allMessages, tokenUsage, onEvent);

    const lastAssistantMsg = [...allMessages].reverse().find(m => m.role === 'assistant');
    const finalText = lastAssistantMsg?.parts
      .filter(p => p.type === 'text')
      .map(p => p.type === 'text' ? p.text : '')
      .join('') || '';

    return {
      messages: allMessages,
      finalText,
      tokenUsage,
    };
  }

  private async processResponse(
    messages: Message[],
    tokenUsage: TokenUsage,
    onEvent?: (event: StreamEvent) => void,
    isContinuation = false
  ): Promise<void> {
    this.stepCount++;
    const isLastStep = this.stepCount >= this.maxSteps;

    const assistantMsgId = uuidv4();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      parts: [],
      createdAt: Date.now(),
    };

    if (onEvent) {
      const eventType = isContinuation ? 'message-continue' : 'message-start';
      onEvent({
        type: eventType,
        sessionId: this.sessionId,
        messageId: assistantMsgId,
      });
    }

    let currentText = '';
    let currentThinking = '';
    const toolCalls: Array<{
      toolCallId: string;
      toolName: string;
      args: unknown;
    }> = [];

    const tools = this.getFilteredTools();
    const effectiveTools = isLastStep ? [] : tools;

    let systemPrompt = this.systemPrompt;
    if (isLastStep) {
      systemPrompt += '\n\nCRITICAL - MAXIMUM STEPS REACHED\n\nThe maximum number of steps has been reached. Respond with text only summarizing what was accomplished.';
    }

    try {
      const stream = this.provider.stream(messages, effectiveTools, systemPrompt);

      for await (const event of stream) {
        if (this.abortController?.signal.aborted) {
          break;
        }

        await this.waitForResume();

        if (event.type === 'text-delta') {
          currentText += event.delta;
          this.updateTextPart(assistantMsg, currentText);
          onEvent?.({
            type: 'text-delta',
            sessionId: this.sessionId,
            messageId: assistantMsgId,
            delta: event.delta,
          });
        } else if (event.type === 'thinking-delta') {
          currentThinking += event.delta;
          this.updateThinkingPart(assistantMsg, currentThinking);
          onEvent?.({
            type: 'thinking-delta',
            sessionId: this.sessionId,
            messageId: assistantMsgId,
            delta: event.delta,
          });
        } else if (event.type === 'tool-call') {
          toolCalls.push({
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
          });

          assistantMsg.parts.push({
            type: 'tool-call',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args as Record<string, unknown>,
          });

          onEvent?.({
            type: 'tool-call',
            sessionId: this.sessionId,
            messageId: assistantMsgId,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args as Record<string, unknown>,
          });
        } else if (event.type === 'usage') {
          tokenUsage.inputTokens += event.usage.inputTokens;
          tokenUsage.outputTokens += event.usage.outputTokens;
          tokenUsage.cacheCreationInputTokens += event.usage.cacheCreationInputTokens;
          tokenUsage.cacheReadInputTokens += event.usage.cacheReadInputTokens;

          onEvent?.({
            type: 'usage',
            sessionId: this.sessionId,
            messageId: assistantMsgId,
            usage: tokenUsage,
            lastUsage: event.usage,
          });
        }
      }

      if (toolCalls.length > 0) {
        messages.push(assistantMsg);

        for (const tc of toolCalls) {
          const tool = toolRegistry.get(tc.toolName);
          if (!tool) {
            const result = `Tool "${tc.toolName}" not found`;
            log.error('Tool not found:', tc.toolName);
            this.addToolResult(messages, tc.toolCallId, tc.toolName, result, true);
            onEvent?.({
              type: 'tool-result',
              sessionId: this.sessionId,
              messageId: assistantMsgId,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              result,
              isError: true,
            });
            continue;
          }

          try {
            await this.waitForResume();

            if (this.permissionService) {
              const decision = await this.permissionService.check(
                tc.toolName,
                tc.args as Record<string, unknown>,
                this.sessionId,
                this.workingDir
              );
              if (decision === 'deny') {
                const result = `Permission denied: User rejected "${tc.toolName}" execution`;
                this.addToolResult(messages, tc.toolCallId, tc.toolName, result, true);
                onEvent?.({
                  type: 'tool-result',
                  sessionId: this.sessionId,
                  messageId: assistantMsgId,
                  toolCallId: tc.toolCallId,
                  toolName: tc.toolName,
                  result,
                  isError: true,
                });
                continue;
              }
            }

            const context: ToolContext = {
              workingDir: this.workingDir,
              sessionId: this.sessionId,
              agentId: this.agentId,
            };

            const result = await tool.execute(tc.args as never, context);

            onEvent?.({
              type: 'tool-result',
              sessionId: this.sessionId,
              messageId: assistantMsgId,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              result: result.output,
              isError: !result.success,
              diff: result.diff,
            });

            this.addToolResult(messages, tc.toolCallId, tc.toolName, result.output, !result.success);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log.error('Tool error:', tc.toolName, errorMessage);
            onEvent?.({
              type: 'tool-result',
              sessionId: this.sessionId,
              messageId: assistantMsgId,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              result: errorMessage,
              isError: true,
            });
            this.addToolResult(messages, tc.toolCallId, tc.toolName, errorMessage, true);
          }
        }

        await this.processResponse(messages, tokenUsage, onEvent, true);
        return;
      }

      messages.push(assistantMsg);

      onEvent?.({
        type: 'message-complete',
        sessionId: this.sessionId,
        messageId: assistantMsgId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('Executor error:', errorMessage);
      onEvent?.({
        type: 'error',
        sessionId: this.sessionId,
        messageId: assistantMsgId,
        error: errorMessage,
      });
      throw error;
    }
  }

  private getFilteredTools() {
    const allTools = toolRegistry.getAll();
    if (this.allowedTools.length === 0) {
      return allTools;
    }
    return allTools.filter(t => this.allowedTools.includes(t.name));
  }

  private updateTextPart(msg: Message, text: string) {
    const existingTextPart = msg.parts.find(p => p.type === 'text');
    if (existingTextPart && existingTextPart.type === 'text') {
      existingTextPart.text = text;
    } else {
      msg.parts.unshift({ type: 'text', text });
    }
  }

  private updateThinkingPart(msg: Message, text: string) {
    const existingThinkingPart = msg.parts.find(p => p.type === 'thinking');
    if (existingThinkingPart && existingThinkingPart.type === 'thinking') {
      existingThinkingPart.text = text;
    } else {
      msg.parts.unshift({ type: 'thinking', text });
    }
  }

  private addToolResult(
    messages: Message[],
    toolCallId: string,
    toolName: string,
    result: unknown,
    isError: boolean
  ) {
    const toolResultMsg: Message = {
      id: uuidv4(),
      role: 'user',
      parts: [{
        type: 'tool-result',
        toolCallId,
        toolName,
        result,
        isError,
      }],
      createdAt: Date.now(),
    };
    messages.push(toolResultMsg);
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  pause(): void {
    this.isPaused = true;
    log.info(`Executor ${this.agentId} paused`);
  }

  resume(): void {
    this.isPaused = false;
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
    log.info(`Executor ${this.agentId} resumed`);
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  private async waitForResume(): Promise<void> {
    if (!this.isPaused) return;

    return new Promise<void>((resolve) => {
      this.pauseResolver = resolve;
    });
  }
}
