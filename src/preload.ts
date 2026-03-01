import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/ipc';
import type { Session, StreamEvent, AppConfig, Workspace, WorkspaceData, Skill, SkillExecuteResult } from './shared/types';

const api = {
  agent: {
    start: (
      sessionId: string,
      message: string,
      providerConfig: AppConfig['providers'][0] | undefined,
      workspacePath: string
    ) => {
      ipcRenderer.send(IPC_CHANNELS.AGENT_START, {
        sessionId,
        message,
        providerConfig,
        workspacePath,
      });
    },
    stop: () => {
      ipcRenderer.send(IPC_CHANNELS.AGENT_STOP);
    },
    onStream: (callback: (event: StreamEvent) => void) => {
      const handler = (_event: unknown, data: StreamEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.AGENT_STREAM, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.AGENT_STREAM, handler);
      };
    },
  },

  workspace: {
    open: (): Promise<WorkspaceData | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_OPEN);
    },
    openPath: (path: string): Promise<WorkspaceData | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_OPEN_PATH, path);
    },
    getCurrent: (): Promise<WorkspaceData | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_CURRENT);
    },
    getRecent: (): Promise<Workspace[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_RECENT);
    },
    removeRecent: (path: string): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_REMOVE_RECENT, path);
    },
  },

  session: {
    create: (): Promise<Session> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE);
    },
    list: (): Promise<Session[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST);
    },
    get: (sessionId: string): Promise<Session | undefined> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_GET, sessionId);
    },
    delete: (sessionId: string): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, sessionId);
    },
    update: (session: Session): Promise<Session> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_UPDATE, session);
    },
  },

  fs: {
    openFolder: (): Promise<string | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.FS_OPEN_FOLDER);
    },
    readFile: (filePath: string): Promise<string> => {
      return ipcRenderer.invoke(IPC_CHANNELS.FS_READ_FILE, filePath);
    },
    writeFile: (filePath: string, content: string): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.FS_WRITE_FILE, filePath, content);
    },
    listDir: (
      dirPath: string
    ): Promise<Array<{ name: string; isDirectory: boolean }>> => {
      return ipcRenderer.invoke(IPC_CHANNELS.FS_LIST_DIR, dirPath);
    },
  },

  config: {
    get: (): Promise<AppConfig> => {
      return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET);
    },
    set: (config: Partial<AppConfig>): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, config);
    },
  },

  window: {
    minimize: () => {
      ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE);
    },
    maximize: () => {
      ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE);
    },
    close: () => {
      ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE);
    },
  },

  skill: {
    list: (): Promise<Skill[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SKILL_LIST);
    },
    get: (name: string): Promise<Skill | undefined> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SKILL_GET, name);
    },
    execute: (name: string, args: string): Promise<SkillExecuteResult> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SKILL_EXECUTE, name, args);
    },
  },
};

contextBridge.exposeInMainWorld('manong', api);

// Type declaration for renderer
export type ManongAPI = typeof api;
