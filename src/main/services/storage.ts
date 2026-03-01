import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import type { Workspace, WorkspaceData, Session, AppConfig } from '../../shared/types';
import { DEFAULT_CONFIG, DEFAULT_TOKEN_USAGE } from '../../shared/types';

// Storage schema
interface AppStoreData {
  config: AppConfig;
  currentWorkspacePath: string | null;
  workspaces: Record<string, WorkspaceData>;
  recentWorkspaces: Workspace[];
}

const MAX_RECENT_WORKSPACES = 10;

class StorageService {
  private store = new Store<AppStoreData>({
    defaults: {
      config: DEFAULT_CONFIG,
      currentWorkspacePath: null,
      workspaces: {},
      recentWorkspaces: [],
    },
  });

  // =====================
  // Workspace Methods
  // =====================

  getCurrentWorkspacePath(): string | null {
    return this.store.get('currentWorkspacePath');
  }

  setCurrentWorkspacePath(path: string | null): void {
    this.store.set('currentWorkspacePath', path);
  }

  getWorkspace(path: string): WorkspaceData | undefined {
    return this.store.get('workspaces')[path];
  }

  saveWorkspace(data: WorkspaceData): void {
    const workspaces = this.store.get('workspaces');
    workspaces[data.workspace.path] = data;
    this.store.set('workspaces', workspaces);
  }

  getRecentWorkspaces(): Workspace[] {
    return this.store.get('recentWorkspaces');
  }

  addRecentWorkspace(path: string, name: string): void {
    let recent = this.store.get('recentWorkspaces');

    // Remove existing entry for this path
    recent = recent.filter((w) => w.path !== path);

    // Add to front
    const workspace: Workspace = {
      path,
      name,
      lastOpenedAt: Date.now(),
    };
    recent.unshift(workspace);

    // Keep only last N
    if (recent.length > MAX_RECENT_WORKSPACES) {
      recent = recent.slice(0, MAX_RECENT_WORKSPACES);
    }

    this.store.set('recentWorkspaces', recent);
  }

  removeRecentWorkspace(path: string): void {
    const recent = this.store.get('recentWorkspaces').filter((w) => w.path !== path);
    this.store.set('recentWorkspaces', recent);
  }

  createWorkspace(path: string): WorkspaceData {
    const name = path.split(/[/\\]/).pop() || path;
    const workspace: Workspace = {
      path,
      name,
      lastOpenedAt: Date.now(),
    };

    const data: WorkspaceData = {
      workspace,
      sessions: [],
    };

    this.saveWorkspace(data);
    this.addRecentWorkspace(path, name);
    this.setCurrentWorkspacePath(path);

    return data;
  }

  // =====================
  // Session Methods
  // =====================

  getSessions(workspacePath: string): Session[] {
    const data = this.getWorkspace(workspacePath);
    return data?.sessions || [];
  }

  getSession(workspacePath: string, sessionId: string): Session | undefined {
    const sessions = this.getSessions(workspacePath);
    return sessions.find((s) => s.id === sessionId);
  }

  createSession(workspacePath: string): Session {
    const data = this.getWorkspace(workspacePath);
    if (!data) {
      throw new Error(`Workspace not found: ${workspacePath}`);
    }

    const session: Session = {
      id: uuidv4(),
      title: 'New Session',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tokenUsage: { ...DEFAULT_TOKEN_USAGE },
    };

    data.sessions.unshift(session);
    this.saveWorkspace(data);

    return session;
  }

  saveSession(workspacePath: string, session: Session): void {
    const data = this.getWorkspace(workspacePath);
    if (!data) {
      throw new Error(`Workspace not found: ${workspacePath}`);
    }

    const index = data.sessions.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      session.updatedAt = Date.now();
      data.sessions[index] = session;
    } else {
      data.sessions.unshift(session);
    }

    this.saveWorkspace(data);
  }

  deleteSession(workspacePath: string, sessionId: string): void {
    const data = this.getWorkspace(workspacePath);
    if (!data) {
      throw new Error(`Workspace not found: ${workspacePath}`);
    }

    data.sessions = data.sessions.filter((s) => s.id !== sessionId);
    this.saveWorkspace(data);
  }

  // =====================
  // Config Methods
  // =====================

  getConfig(): AppConfig {
    return this.store.get('config');
  }

  setConfig(config: Partial<AppConfig>): void {
    const current = this.store.get('config');
    this.store.set('config', { ...current, ...config });
  }
}

export const storageService = new StorageService();
