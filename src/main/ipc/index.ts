import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import type {
  Session,
  StreamEvent,
  AppConfig,
  QuestionAnswer,
  ImagePart,
} from '../../shared/types';
import type { MCPConfig, MCPServerStatus, LayeredMCPConfig } from '../../shared/mcp-types';
import type { LSPServerStatus } from '../../shared/lsp-types';
import type { PermissionMode, PermissionConfig, PermissionDecision } from '../../shared/permission-types';
import { AgentLoop } from '../services/agent/loop';
import { storageService } from '../services/storage';
import { skillService } from '../services/skill';
import { mcpManager } from '../services/mcp';
import { lspManager } from '../services/lsp';
import { fullCompact } from '../services/agent/compact';
import {
  setQuestionWindow,
  resolveQuestion,
  skipQuestion,
} from '../services/tools/ask';
import { setTodoWindow } from '../services/tools/todo';
import { permissionService } from '../services/permission';
import { subagentManager } from '../services/agent/subagent';
import '../services/tools';

const agentLoops = new Map<string, AgentLoop>();

export function setupIPC(mainWindow: BrowserWindow): void {
  const agentLoop = new AgentLoop(mainWindow);
  agentLoops.set('default', agentLoop);

  // Set the window reference for question tool
  setQuestionWindow(mainWindow);

  // Set the window reference for todo tool
  setTodoWindow(mainWindow);

  // Set the window reference for permission service
  permissionService.setWindow(mainWindow);

  // Set the window reference for subagent manager
  subagentManager.setMainWindow(mainWindow);

  // =====================
  // Workspace Management
  // =====================

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_OPEN, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });

    const path = result.filePaths[0];
    if (!path) return null;

    // Get existing workspace or create new one
    let data = storageService.getWorkspace(path);
    if (!data) {
      data = storageService.createWorkspace(path);
    } else {
      // Update last opened time
      storageService.addRecentWorkspace(path, data.workspace.name);
      storageService.setCurrentWorkspacePath(path);
    }

    // Set workspace for MCP manager to load project-specific config
    await mcpManager.setWorkspace(path);

    // Set workspace for LSP manager
    await lspManager.setWorkspace(path);

    // Load permission config for workspace
    await permissionService.load(path);

    return data;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_OPEN_PATH, async (_event, path: string) => {
    // Get existing workspace or create new one
    let data = storageService.getWorkspace(path);
    if (!data) {
      data = storageService.createWorkspace(path);
    } else {
      // Update last opened time
      storageService.addRecentWorkspace(path, data.workspace.name);
      storageService.setCurrentWorkspacePath(path);
    }

    // Set workspace for MCP manager to load project-specific config
    await mcpManager.setWorkspace(path);

    // Set workspace for LSP manager
    await lspManager.setWorkspace(path);

    // Load permission config for workspace
    await permissionService.load(path);

    return data;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_CURRENT, () => {
    const path = storageService.getCurrentWorkspacePath();
    if (!path) return null;
    return storageService.getWorkspace(path) || null;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_RECENT, () => {
    return storageService.getRecentWorkspaces();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REMOVE_RECENT, (_event, path: string) => {
    storageService.removeRecentWorkspace(path);
  });

  // =====================
  // Session Management
  // =====================

  ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, () => {
    const workspacePath = storageService.getCurrentWorkspacePath();
    if (!workspacePath) {
      throw new Error('No workspace selected');
    }
    return storageService.createSession(workspacePath);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, () => {
    const workspacePath = storageService.getCurrentWorkspacePath();
    if (!workspacePath) return [];
    return storageService.getSessions(workspacePath);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_GET, (_event, sessionId: string) => {
    const workspacePath = storageService.getCurrentWorkspacePath();
    if (!workspacePath) return undefined;
    return storageService.getSession(workspacePath, sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, (_event, sessionId: string) => {
    const workspacePath = storageService.getCurrentWorkspacePath();
    if (!workspacePath) return;
    storageService.deleteSession(workspacePath, sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_UPDATE, (_event, session: Session) => {
    const workspacePath = storageService.getCurrentWorkspacePath();
    if (!workspacePath) {
      throw new Error('No workspace selected');
    }
    storageService.saveSession(workspacePath, session);
    return session;
  });

  // =====================
  // Agent Control
  // =====================

  ipcMain.on(
    IPC_CHANNELS.AGENT_START,
    (
      _event,
      { sessionId, message, providerConfig, workspacePath, images = [] }: {
        sessionId: string;
        message: string;
        providerConfig: AppConfig['providers'][0];
        workspacePath: string;
        images: ImagePart[];
      }
    ) => {
      const session = storageService.getSession(workspacePath, sessionId);
      if (!session) return;

      if (providerConfig) {
        agentLoop.setProvider(providerConfig);
      }

      agentLoop.start(session, workspacePath, message, images, (event: StreamEvent) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.AGENT_STREAM, event);
        }
      });
    }
  );

  ipcMain.on(IPC_CHANNELS.AGENT_STOP, () => {
    agentLoop.stop();
  });

  // =====================
  // Config Management
  // =====================

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => {
    return storageService.getConfig();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_event, config: Partial<AppConfig>) => {
    storageService.setConfig(config);
  });

  // =====================
  // File System
  // =====================

  ipcMain.handle(IPC_CHANNELS.FS_OPEN_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.filePaths[0] || null;
  });

  ipcMain.handle(IPC_CHANNELS.FS_READ_FILE, async (_event, filePath: string) => {
    const fs = await import('fs/promises');
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle(
    IPC_CHANNELS.FS_WRITE_FILE,
    async (_event, filePath: string, content: string) => {
      const fs = await import('fs/promises');
      return fs.writeFile(filePath, content, 'utf-8');
    }
  );

  ipcMain.handle(IPC_CHANNELS.FS_LIST_DIR, async (_event, dirPath: string) => {
    const fs = await import('fs/promises');
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
    }));
  });

  // =====================
  // Window Controls
  // =====================

  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    mainWindow.minimize();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => {
    mainWindow.close();
  });

  // =====================
  // Skills
  // =====================

  ipcMain.handle(IPC_CHANNELS.SKILL_LIST, async () => {
    const workspacePath = storageService.getCurrentWorkspacePath();
    return skillService.loadSkills(workspacePath || undefined);
  });

  ipcMain.handle(IPC_CHANNELS.SKILL_GET, async (_event, name: string) => {
    const workspacePath = storageService.getCurrentWorkspacePath();
    return skillService.getSkill(name, workspacePath || undefined);
  });

  ipcMain.handle(IPC_CHANNELS.SKILL_EXECUTE, async (_event, name: string, args: string) => {
    const workspacePath = storageService.getCurrentWorkspacePath();
    return skillService.executeSkill(name, args, workspacePath || undefined);
  });

  // =====================
  // Questions
  // =====================

  ipcMain.handle(
    IPC_CHANNELS.QUESTION_ANSWER,
    (_event, requestId: string, answers: QuestionAnswer[]) => {
      resolveQuestion(requestId, answers);
    }
  );

  ipcMain.handle(IPC_CHANNELS.QUESTION_SKIP, (_event, requestId: string) => {
    skipQuestion(requestId);
  });

  // =====================
  // MCP (Model Context Protocol)
  // =====================

  ipcMain.handle(IPC_CHANNELS.MCP_GET_STATUS, async (): Promise<MCPServerStatus[]> => {
    return mcpManager.getStatuses();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_CONNECT, async (_event, name: string): Promise<void> => {
    await mcpManager.connect(name);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_DISCONNECT, async (_event, name: string): Promise<void> => {
    await mcpManager.disconnect(name);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_GET_CONFIG, async (): Promise<MCPConfig> => {
    return mcpManager.getConfig();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_SAVE_CONFIG, async (_event, config: MCPConfig): Promise<void> => {
    await mcpManager.saveConfig(config);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_GET_LAYERED_CONFIG, async (): Promise<LayeredMCPConfig> => {
    return mcpManager.getLayeredConfig();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_SAVE_GLOBAL_CONFIG, async (_event, config: MCPConfig): Promise<void> => {
    await mcpManager.saveGlobalConfig(config);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_SAVE_PROJECT_CONFIG, async (_event, config: MCPConfig, workspacePath: string): Promise<void> => {
    await mcpManager.saveProjectConfig(config, workspacePath);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_SET_WORKSPACE, async (_event, workspacePath: string | null): Promise<void> => {
    await mcpManager.setWorkspace(workspacePath);
  });

  ipcMain.on(IPC_CHANNELS.MCP_STATUS_CHANGED, (_event, statuses: MCPServerStatus[]) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.MCP_STATUS_CHANGED, statuses);
    }
  });

  mcpManager.onStatusChange((statuses) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.MCP_STATUS_CHANGED, statuses);
    }
  });

  // =====================
  // Permission Management
  // =====================

  ipcMain.handle(
    IPC_CHANNELS.PERMISSION_RESPOND,
    (_event, requestId: string, decision: PermissionDecision) => {
      permissionService.resolvePermission(requestId, decision);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PERMISSION_SET_MODE,
    (_event, mode: PermissionMode) => {
      permissionService.setMode(mode);
    }
  );

  ipcMain.handle(IPC_CHANNELS.PERMISSION_GET_CONFIG, () => {
    return permissionService.getLayeredConfig();
  });

  ipcMain.handle(
    IPC_CHANNELS.PERMISSION_SAVE_CONFIG,
    async (_event, scope: string, config: PermissionConfig) => {
      await permissionService.saveConfig(scope, config);
    }
  );

  // =====================
  // Context Compact
  // =====================

  ipcMain.handle(
    IPC_CHANNELS.SESSION_COMPACT,
    async (_event, sessionId: string, workspacePath: string, focus?: string) => {
      const session = storageService.getSession(workspacePath, sessionId);
      if (!session || session.messages.length === 0) {
        return { success: false, error: 'No session or empty conversation' };
      }

      const config = storageService.getConfig();
      const providerName = config.defaultProvider;
      const providerConfig = config.providers.find(p => p.name === providerName);
      if (!providerConfig) {
        return { success: false, error: 'No provider configured' };
      }

      const result = await fullCompact(session.messages, workspacePath, providerConfig, focus);
      session.messages = result.messages;
      session.updatedAt = Date.now();
      storageService.saveSession(workspacePath, session);

      return {
        success: true,
        messages: result.messages,
        transcriptPath: result.transcriptPath,
      };
    }
  );

  // =====================
  // LSP (Language Server Protocol)
  // =====================

  ipcMain.handle(IPC_CHANNELS.LSP_GET_STATUS, async (): Promise<LSPServerStatus[]> => {
    return lspManager.getStatuses();
  });

  ipcMain.handle(IPC_CHANNELS.LSP_SET_WORKSPACE, async (_event, workspacePath: string | null): Promise<void> => {
    await lspManager.setWorkspace(workspacePath);
  });

  lspManager.onStatusChange((statuses) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.LSP_STATUS_CHANGED, statuses);
    }
  });

  // =====================
  // Subagent Management
  // =====================

  ipcMain.handle(IPC_CHANNELS.SUBAGENT_GET_SESSION, async (_event, sessionId: string) => {
    const workspacePath = storageService.getCurrentWorkspacePath();
    if (!workspacePath) return undefined;
    return storageService.getSession(workspacePath, sessionId);
  });
}
