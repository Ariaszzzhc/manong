import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import type {
  Session,
  StreamEvent,
  AppConfig,
} from '../../shared/types';
import { AgentLoop } from '../services/agent/loop';
import { storageService } from '../services/storage';
import { skillService } from '../services/skill';
import '../services/tools'; // Register tools

const agentLoops = new Map<string, AgentLoop>();

export function setupIPC(mainWindow: BrowserWindow): void {
  const agentLoop = new AgentLoop(mainWindow);
  agentLoops.set('default', agentLoop);

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
      { sessionId, message, providerConfig, workspacePath }: {
        sessionId: string;
        message: string;
        providerConfig: AppConfig['providers'][0];
        workspacePath: string;
      }
    ) => {
      const session = storageService.getSession(workspacePath, sessionId);
      if (!session) return;

      if (providerConfig) {
        agentLoop.setProvider(providerConfig);
      }

      agentLoop.start(session, workspacePath, message, (event: StreamEvent) => {
        mainWindow.webContents.send(IPC_CHANNELS.AGENT_STREAM, event);
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
}
