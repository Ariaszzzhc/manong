import { v4 as uuidv4 } from 'uuid';
import type { BrowserWindow } from 'electron';
import type { Session, Message, ProviderConfig, TokenUsage, AgentType, SubagentInfo, StreamEvent } from '../../../shared/types';
import { DEFAULT_TOKEN_USAGE } from '../../../shared/types';
import { IPC_CHANNELS } from '../../../shared/ipc';
import { AgentExecutor } from './executor';
import { agentTypeRegistry } from './agent-types';
import { toolRegistry } from '../tools/registry';
import { storageService } from '../storage';
import { createLogger } from '../logger';

const log = createLogger('SubagentManager');

const SUBAGENT_SYSTEM_PROMPT_BASE = `You are a subagent working on a specific task.

IMPORTANT INSTRUCTIONS:
1. Focus ONLY on the task given to you
2. Work autonomously until the task is complete
3. Return a clear summary of what you accomplished
4. If you cannot complete the task, explain why

Working directory: {{WORKING_DIR}}
Agent type: {{AGENT_TYPE}}

{{CUSTOM_PROMPT}}`;

export interface SubagentConfig {
  parentSessionId: string;
  workspacePath: string;
  provider: ProviderConfig;
  agentType: string;
  taskDescription: string;
  prompt: string;
  existingSessionId?: string;
}

export interface SubagentResult {
  taskId: string;
  summary: string;
  tokenUsage: TokenUsage;
}

class SubagentManager {
  private activeSubagents: Map<string, AbortController> = new Map();
  private subagentInfos: Map<string, SubagentInfo> = new Map();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  getSubagentInfos(parentSessionId?: string): SubagentInfo[] {
    const allInfos = Array.from(this.subagentInfos.values());
    if (parentSessionId) {
      return allInfos.filter(info => info.parentSessionId === parentSessionId);
    }
    return allInfos;
  }

  private sendStatusUpdate(info: SubagentInfo): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.SUBAGENT_STATUS_UPDATE, info);
    }
  }

  private sendStreamEvent(event: StreamEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.SUBAGENT_STREAM, event);
    }
  }

  async execute(config: SubagentConfig): Promise<SubagentResult> {
    const agentType = agentTypeRegistry.get(config.agentType);
    if (!agentType) {
      throw new Error(`Unknown agent type: ${config.agentType}`);
    }

    let session: Session;

    if (config.existingSessionId) {
      const existing = storageService.getSession(config.workspacePath, config.existingSessionId);
      if (existing) {
        session = existing;
        log.info(`Resuming subagent session: ${session.id}`);
      } else {
        log.warn(`Session ${config.existingSessionId} not found, creating new`);
        session = this.createSubagentSession(config);
      }
    } else {
      session = this.createSubagentSession(config);
    }

    const subagentInfo: SubagentInfo = {
      id: session.id,
      parentSessionId: config.parentSessionId,
      agentType: config.agentType,
      taskDescription: config.taskDescription,
      status: 'running',
      startTime: Date.now(),
    };
    this.subagentInfos.set(session.id, subagentInfo);
    this.sendStatusUpdate(subagentInfo);

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      parts: [{ type: 'text', text: config.prompt }],
      createdAt: Date.now(),
    };
    session.messages.push(userMessage);

    const systemPrompt = this.buildSystemPrompt(agentType, config);
    const toolFilter = agentTypeRegistry.getToolFilter(config.agentType);
    const filteredTools = this.getFilteredTools(toolFilter.allowed, toolFilter.denied);

    const abortController = new AbortController();
    this.activeSubagents.set(session.id, abortController);

    const executor = new AgentExecutor({
      provider: config.provider,
      systemPrompt,
      allowedTools: filteredTools,
      workingDir: config.workspacePath,
      sessionId: session.id,
      maxSteps: 30,
    });

    try {
      const result = await executor.execute(session.messages, (event: StreamEvent) => {
        const streamEvent: StreamEvent = {
          ...event,
          sessionId: session.id,
        };
        this.sendStreamEvent(streamEvent);
      });

      session.messages.length = 0;
      session.messages.push(...result.messages);
      session.tokenUsage = result.tokenUsage;
      session.updatedAt = Date.now();

      storageService.saveSession(config.workspacePath, session);

      subagentInfo.status = 'completed';
      subagentInfo.endTime = Date.now();
      subagentInfo.tokenUsage = result.tokenUsage;
      this.subagentInfos.set(session.id, subagentInfo);
      this.sendStatusUpdate(subagentInfo);

      this.saveSubagentToParentSession(config.workspacePath, config.parentSessionId, subagentInfo);

      const summary = this.formatResult(session.id, result.finalText);

      return {
        taskId: session.id,
        summary,
        tokenUsage: result.tokenUsage,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      subagentInfo.status = 'error';
      subagentInfo.endTime = Date.now();
      subagentInfo.error = errorMessage;
      this.subagentInfos.set(session.id, subagentInfo);
      this.sendStatusUpdate(subagentInfo);
      throw error;
    } finally {
      this.activeSubagents.delete(session.id);
    }
  }

  private saveSubagentToParentSession(workspacePath: string, parentSessionId: string, info: SubagentInfo): void {
    const parentSession = storageService.getSession(workspacePath, parentSessionId);
    if (parentSession) {
      if (!parentSession.subagentHistory) {
        parentSession.subagentHistory = [];
      }
      const existingIdx = parentSession.subagentHistory.findIndex(s => s.id === info.id);
      if (existingIdx >= 0) {
        parentSession.subagentHistory[existingIdx] = info;
      } else {
        parentSession.subagentHistory.push(info);
      }
      storageService.saveSession(workspacePath, parentSession);
    }
  }

  private createSubagentSession(config: SubagentConfig): Session {
    const session: Session = {
      id: uuidv4(),
      title: `${config.taskDescription} (@${config.agentType})`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tokenUsage: { ...DEFAULT_TOKEN_USAGE },
      parentSessionId: config.parentSessionId,
      agentType: config.agentType,
    };

    storageService.saveSession(config.workspacePath, session);
    log.info(`Created subagent session: ${session.id} (parent: ${config.parentSessionId})`);

    return session;
  }

  private buildSystemPrompt(agentType: AgentType, config: SubagentConfig): string {
    const prompt = SUBAGENT_SYSTEM_PROMPT_BASE
      .replace('{{WORKING_DIR}}', config.workspacePath)
      .replace('{{AGENT_TYPE}}', agentType.name)
      .replace('{{CUSTOM_PROMPT}}', agentType.prompt ?? '');

    return prompt;
  }

  private getFilteredTools(allowed: string[] | null, denied: string[]): string[] {
    const allTools = toolRegistry.getAll().map(t => t.name);

    if (allowed === null) {
      return allTools.filter(name => !denied.includes(name));
    }

    return allowed.filter(name => !denied.includes(name) && allTools.includes(name));
  }

  private formatResult(taskId: string, summary: string): string {
    return `task_id: ${taskId} (for resuming to continue this task if needed)

<task_result>
${summary}
</task_result>`;
  }

  abort(sessionId: string): void {
    const controller = this.activeSubagents.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeSubagents.delete(sessionId);
      log.info(`Aborted subagent: ${sessionId}`);
    }
  }

  abortAll(): void {
    for (const [id, controller] of this.activeSubagents) {
      controller.abort();
      log.info(`Aborted subagent: ${id}`);
    }
    this.activeSubagents.clear();
  }
}

export const subagentManager = new SubagentManager();
