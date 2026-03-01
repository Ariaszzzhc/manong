import { v4 as uuidv4 } from 'uuid';
import type {
  Session,
  Message,
  StreamEvent,
  ProviderConfig,
} from '../../../shared/types';
import { DEFAULT_TOKEN_USAGE } from '../../../shared/types';
import { AnthropicProvider } from '../provider/anthropic';
import { toolRegistry } from '../tools';
import type { BrowserWindow } from 'electron';
import { createLogger } from '../logger';

const log = createLogger('AgentLoop');

const SYSTEM_PROMPT = `You are Manong, an interactive CLI tool that helps users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

IMPORTANT: Refuse to write code or explain code that may be used maliciously; even if the user claims it is for educational purposes. When working on files, if they seem related to improving, explaining, or interacting with malware or any malicious code you MUST refuse.
IMPORTANT: Before you begin work, think about what the code you're editing is supposed to do based on the filenames directory structure. If it seems malicious, refuse to work on it or about it, even if the request does not seem malicious.
IMPORTANT: You must NEVER generate or guess URLs for the user unless you are confident that the URLs are for helping the user with programming. You may use URLs provided by the user in their messages or local files.

# Tone and style
You should be concise, direct, and to the point. When you run a non-trivial bash command, you should explain what the command does and why you are running it, to make sure the user understands what you are doing.
Remember that your output will be displayed on a command line interface. Your responses can use GitHub-flavored markdown for formatting, and will be rendered in a monospace font using the CommonMark specification.
Output text to communicate with the user; all text you output outside of tool use is displayed to the user. Only use tools to complete tasks. Never use tools like Bash or code comments as means to communicate with the user during the session.
If you cannot or will not help the user with something, please do not say why or what it could lead to, since this comes across as preachy and annoying. Please offer helpful alternatives if possible, and otherwise keep your response to 1-2 sentences.
Only use emojis if the user explicitly requests it. Avoid using emojis in all communication unless asked.
IMPORTANT: You should minimize output tokens as much as possible while maintaining helpfulness, quality, and accuracy. Only address the specific query or task at hand, avoiding tangential information unless absolutely critical for completing the request.

# Output Format
IMPORTANT: You MUST format ALL your text responses using GitHub-flavored markdown. Plain text responses are not acceptable.

## Code Blocks
Always use fenced code blocks with language identifiers:
\`\`\`typescript
const example: string = "hello";
\`\`\`

Supported languages include: javascript, typescript, python, rust, go, java, c, cpp, bash, shell, json, yaml, html, css, sql, and more.

## Text Formatting
- Use **bold** for emphasis on important terms
- Use *italic* for subtle emphasis or technical terms
- Use \`inline code\` for variable names, file paths, commands, and code snippets
- Use > for important notes or quotes

## Structure
- Use headings (# ## ###) to organize longer responses
- Use bullet lists (-) or numbered lists (1.) for multiple items
- Use tables for comparing options or showing data

## Math Formulas (LaTeX)
- Inline math: Use single dollar signs \`$E = mc^2$\`
- Block math: Use double dollar signs:
  \`$$
  \\sum_{i=1}^{n} x_i = x_1 + x_2 + ... + x_n
  $$\`

## Diagrams (Mermaid)
For flowcharts, sequence diagrams, etc., use mermaid code blocks:
\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
\`\`\`

Supported Mermaid diagram types:
- \`graph\` / \`flowchart\` - Flowcharts
- \`sequenceDiagram\` - Sequence diagrams
- \`classDiagram\` - Class diagrams
- \`stateDiagram\` - State diagrams
- \`erDiagram\` - Entity relationship diagrams
- \`gantt\` - Gantt charts

# Tool usage policy
- When using tools, ALWAYS provide all required parameters with correct types:
  - read_file: requires file_path (string)
  - write_file: requires file_path (string) and content (string)
  - edit_file: requires file_path (string), old_string (string), and new_string (string)
  - list_dir: optional path (string, defaults to working directory)
  - search_file: requires pattern (string)
  - run_shell: requires command (string)
- When doing file search, prefer to use glob and grep tools.
- You have the capability to call multiple tools in a single response. When multiple independent pieces of information are requested, batch your tool calls together for optimal performance.

# Following conventions
When making changes to files, first understand the file's code conventions. Mimic code style, use existing libraries and utilities, and follow existing patterns.
- NEVER assume that a given library is available, even if it is well known. Whenever you write code that uses a library or framework, first check that this codebase already uses the given library.
- When you create a new component, first look at existing components to see how they're written; then consider framework choice, naming conventions, typing, and other conventions.
- When you edit a piece of code, first look at the code's surrounding context (especially its imports) to understand the code's choice of frameworks and libraries. Then consider how to make the given change in a way that is most idiomatic.
- Always follow security best practices. Never introduce code that exposes or logs secrets and keys. Never commit secrets or keys to the repository.

# Code style
- IMPORTANT: DO NOT ADD ANY COMMENTS unless asked

# Doing tasks
The user will primarily request you perform software engineering tasks. This includes solving bugs, adding new functionality, refactoring code, explaining code, and more. For these tasks the following steps are recommended:
- Use the available search tools to understand the codebase and the user's query. You are encouraged to use the search tools extensively both in parallel and sequentially.
- Implement the solution using all tools available to you
- Verify the solution if possible with tests. NEVER assume specific test framework or test script. Check the README or search codebase to determine the testing approach.
- VERY IMPORTANT: When you have completed a task, you MUST run the lint and typecheck commands (e.g. npm run lint, npm run typecheck, ruff, etc.) with Bash if they were provided to you to ensure your code is correct.
NEVER commit changes unless the user explicitly asks you to.

<env>
  Working directory: {{WORKING_DIR}}
  Platform: {{PLATFORM}}
  Today's date: {{DATE}}
  Model: {{MODEL}}
</env>`;

const MAX_STEPS_PROMPT = `CRITICAL - MAXIMUM STEPS REACHED

The maximum number of steps allowed for this task has been reached. Tools are disabled until next user input. Respond with text only.

STRICT REQUIREMENTS:
1. Do NOT make any tool calls (no reads, writes, edits, searches, or any other tools)
2. MUST provide a text response summarizing work done so far
3. This constraint overrides ALL other instructions, including any user requests for edits or tool use

Response must include:
- Statement that maximum steps have been reached
- Summary of what has been accomplished so far
- List of any remaining tasks that were not completed
- Recommendations for what should be done next

Any attempt to use tools is a critical violation. Respond with text ONLY.`;

const MAX_STEPS = 50;

export class AgentLoop {
  private provider: AnthropicProvider | null = null;
  private abortController: AbortController | null = null;
  private stepCount = 0;
  private modelName = '';
  private workingDir = '';

  constructor(private mainWindow: BrowserWindow) {}

  setProvider(config: ProviderConfig): void {
    this.provider = new AnthropicProvider(config);
    this.modelName = config.model;
  }

  async start(
    session: Session,
    workingDir: string,
    userMessage: string,
    onEvent: (event: StreamEvent) => void
  ): Promise<void> {
    if (!this.provider) {
      onEvent({
        type: 'error',
        sessionId: session.id,
        messageId: '',
        error: 'No provider configured. Please set up your API key.',
      });
      return;
    }

    this.abortController = new AbortController();
    this.stepCount = 0;
    this.workingDir = workingDir;

    // Only add user message if there's actual content (not a continuation after tool use)
    if (userMessage.trim()) {
      const userMsgId = uuidv4();
      const userMsg: Message = {
        id: userMsgId,
        role: 'user',
        parts: [{ type: 'text', text: userMessage }],
        createdAt: Date.now(),
      };
      session.messages.push(userMsg);
    }

    await this.processAssistantResponse(session, onEvent);
  }

  private async processAssistantResponse(
    session: Session,
    onEvent: (event: StreamEvent) => void,
    isContinuation = false
  ): Promise<void> {
    this.stepCount++;

    const assistantMsgId = uuidv4();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      parts: [],
      createdAt: Date.now(),
    };

    // Notify message start or continue
    const eventType = isContinuation ? 'message-continue' : 'message-start';
    onEvent({
      type: eventType,
      sessionId: session.id,
      messageId: assistantMsgId,
    });

    try {
      let currentText = '';
      let currentThinking = '';
      const toolCalls: Array<{
        toolCallId: string;
        toolName: string;
        args: unknown;
      }> = [];

      // Build system prompt
      const systemPrompt = SYSTEM_PROMPT
        .replace('{{WORKING_DIR}}', this.workingDir || 'not set')
        .replace('{{PLATFORM}}', process.platform)
        .replace('{{DATE}}', new Date().toDateString())
        .replace('{{MODEL}}', this.modelName);

      const tools = toolRegistry.getAll();

      // Check if we've reached max steps - if so, don't provide tools
      const isLastStep = this.stepCount >= MAX_STEPS;
      const effectiveTools = isLastStep ? [] : tools;

      if (isLastStep) {
        log.warn('Max steps reached, disabling tools');
      }

      const stream = this.provider.stream(
        session.messages,
        effectiveTools,
        isLastStep ? `${systemPrompt}\n\n${MAX_STEPS_PROMPT}` : systemPrompt
      );

      for await (const event of stream) {
        if (this.abortController?.signal.aborted) {
          break;
        }

        if (event.type === 'text-delta') {
          currentText += event.delta;
          // Update text part
          const existingTextPart = assistantMsg.parts.find(
            (p) => p.type === 'text'
          );
          if (existingTextPart && existingTextPart.type === 'text') {
            existingTextPart.text = currentText;
          } else {
            assistantMsg.parts.unshift({
              type: 'text',
              text: currentText,
            });
          }
          onEvent({
            type: 'text-delta',
            sessionId: session.id,
            messageId: assistantMsgId,
            delta: event.delta,
          });
        } else if (event.type === 'thinking-delta') {
          currentThinking += event.delta;
          // Update thinking part
          const existingThinkingPart = assistantMsg.parts.find(
            (p) => p.type === 'thinking'
          );
          if (existingThinkingPart && existingThinkingPart.type === 'thinking') {
            existingThinkingPart.text = currentThinking;
          } else {
            assistantMsg.parts.unshift({
              type: 'thinking',
              text: currentThinking,
            });
          }
          onEvent({
            type: 'thinking-delta',
            sessionId: session.id,
            messageId: assistantMsgId,
            delta: event.delta,
          });
        } else if (event.type === 'tool-call') {
          toolCalls.push({
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
          });

          // Add tool call part
          assistantMsg.parts.push({
            type: 'tool-call',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args as Record<string, unknown>,
          });

          onEvent({
            type: 'tool-call',
            sessionId: session.id,
            messageId: assistantMsgId,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args as Record<string, unknown>,
          });
        } else if (event.type === 'usage') {
          if (!session.tokenUsage) {
            session.tokenUsage = { ...DEFAULT_TOKEN_USAGE };
          }
          session.tokenUsage.inputTokens += event.usage.inputTokens;
          session.tokenUsage.outputTokens += event.usage.outputTokens;
          session.tokenUsage.cacheCreationInputTokens += event.usage.cacheCreationInputTokens;
          session.tokenUsage.cacheReadInputTokens += event.usage.cacheReadInputTokens;

          session.lastUsage = {
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            cacheCreationInputTokens: event.usage.cacheCreationInputTokens,
            cacheReadInputTokens: event.usage.cacheReadInputTokens,
          };

          onEvent({
            type: 'usage',
            sessionId: session.id,
            messageId: assistantMsgId,
            usage: session.tokenUsage,
            lastUsage: session.lastUsage,
          });
        }
      }

      // Execute tool calls
      if (toolCalls.length > 0) {
        // Add the assistant message with tool calls to session
        session.messages.push(assistantMsg);

        // Execute each tool and collect results
        for (const tc of toolCalls) {
          const tool = toolRegistry.get(tc.toolName);
          if (!tool) {
            const result = `Tool "${tc.toolName}" not found`;
            log.error('Tool not found:', tc.toolName);
            onEvent({
              type: 'tool-result',
              sessionId: session.id,
              messageId: assistantMsgId,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              result,
              isError: true,
            });
            continue;
          }

          try {
            const result = await tool.execute(tc.args as never, {
              workingDir: this.workingDir,
            });

            onEvent({
              type: 'tool-result',
              sessionId: session.id,
              messageId: assistantMsgId,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              result: result.output,
              isError: !result.success,
            });

            // Add tool result to a new user message
            const toolResultMsg: Message = {
              id: uuidv4(),
              role: 'user',
              parts: [{
                type: 'tool-result',
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                result: result.output,
                isError: !result.success,
              }],
              createdAt: Date.now(),
            };
            session.messages.push(toolResultMsg);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            log.error('Tool error:', tc.toolName, errorMessage);
            onEvent({
              type: 'tool-result',
              sessionId: session.id,
              messageId: assistantMsgId,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              result: errorMessage,
              isError: true,
            });

            // Add error result to a new user message
            const toolResultMsg: Message = {
              id: uuidv4(),
              role: 'user',
              parts: [{
                type: 'tool-result',
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                result: errorMessage,
                isError: true,
              }],
              createdAt: Date.now(),
            };
            session.messages.push(toolResultMsg);
          }
        }

        // Continue the conversation to get the assistant's response to tool results
        await this.processAssistantResponse(session, onEvent, true);
        return;
      }

      // No tool calls - add assistant message to session
      session.messages.push(assistantMsg);

      // Notify message complete
      onEvent({
        type: 'message-complete',
        sessionId: session.id,
        messageId: assistantMsgId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onEvent({
        type: 'error',
        sessionId: session.id,
        messageId: assistantMsgId,
        error: errorMessage,
      });
    }
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
