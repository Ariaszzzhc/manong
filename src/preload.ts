import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/ipc';
import type { Session, StreamEvent, AppConfig, Workspace, WorkspaceData, Skill, SkillExecuteResult, QuestionRequest, QuestionAnswer, Todo, ImagePart } from './shared/types';
import type { MCPConfig, MCPServerStatus, LayeredMCPConfig } from './shared/mcp-types';
import type { PermissionMode, PermissionRequest, PermissionDecision, PermissionConfig, LayeredPermissionConfig } from './shared/permission-types';

const api = {
  platform: process.platform,

  agent: {
    start: (
      sessionId: string,
      message: string,
      providerConfig: AppConfig['providers'][0] | undefined,
      workspacePath: string,
      images: ImagePart[] = []
    ) => {
      ipcRenderer.send(IPC_CHANNELS.AGENT_START, {
        sessionId,
        message,
        providerConfig,
        workspacePath,
        images,
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

  question: {
    answer: (requestId: string, answers: QuestionAnswer[]): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.QUESTION_ANSWER, requestId, answers);
    },
    skip: (requestId: string): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.QUESTION_SKIP, requestId);
    },
    onAsk: (callback: (request: QuestionRequest) => void) => {
      const handler = (_event: unknown, request: QuestionRequest) => callback(request);
      ipcRenderer.on(IPC_CHANNELS.QUESTION_ASK, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.QUESTION_ASK, handler);
      };
    },
  },

  mcp: {
    getStatus: (): Promise<MCPServerStatus[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.MCP_GET_STATUS);
    },
    connect: (name: string): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.MCP_CONNECT, name);
    },
    disconnect: (name: string): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.MCP_DISCONNECT, name);
    },
    getConfig: (): Promise<MCPConfig> => {
      return ipcRenderer.invoke(IPC_CHANNELS.MCP_GET_CONFIG);
    },
    saveConfig: (config: MCPConfig): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.MCP_SAVE_CONFIG, config);
    },
    getLayeredConfig: (): Promise<LayeredMCPConfig> => {
      return ipcRenderer.invoke(IPC_CHANNELS.MCP_GET_LAYERED_CONFIG);
    },
    saveGlobalConfig: (config: MCPConfig): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.MCP_SAVE_GLOBAL_CONFIG, config);
    },
    saveProjectConfig: (config: MCPConfig, workspacePath: string): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.MCP_SAVE_PROJECT_CONFIG, config, workspacePath);
    },
    setWorkspace: (workspacePath: string | null): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.MCP_SET_WORKSPACE, workspacePath);
    },
    onStatusChanged: (callback: (statuses: MCPServerStatus[]) => void) => {
      const handler = (_event: unknown, statuses: MCPServerStatus[]) => callback(statuses);
      ipcRenderer.on(IPC_CHANNELS.MCP_STATUS_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.MCP_STATUS_CHANGED, handler);
      };
    },
  },

  todo: {
    onUpdate: (callback: (data: { sessionId: string; todos: Todo[] }) => void) => {
      const handler = (_event: unknown, data: { sessionId: string; todos: Todo[] }) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.TODO_UPDATE, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.TODO_UPDATE, handler);
      };
    },
  },

  permission: {
    respond: (requestId: string, decision: PermissionDecision): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSION_RESPOND, requestId, decision),
    onAsk: (callback: (request: PermissionRequest) => void) => {
      const handler = (_event: unknown, data: PermissionRequest) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.PERMISSION_ASK, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.PERMISSION_ASK, handler);
      };
    },
    setMode: (mode: PermissionMode): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSION_SET_MODE, mode),
    getConfig: (): Promise<LayeredPermissionConfig> =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSION_GET_CONFIG),
    saveConfig: (scope: string, config: PermissionConfig): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSION_SAVE_CONFIG, scope, config),
  },

  menu: {
    onNewSession: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('menu:new-session', handler);
      return () => {
        ipcRenderer.removeListener('menu:new-session', handler);
      };
    },
    onOpenFolder: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('menu:open-folder', handler);
      return () => {
        ipcRenderer.removeListener('menu:open-folder', handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('manong', api);

// Type declaration for renderer
export type ManongAPI = typeof api;
