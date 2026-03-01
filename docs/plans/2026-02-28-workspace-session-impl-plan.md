# Workspace & Session Redesign - Implementation Plan

## Overview

将 session-centric 架构转换为 workspace-centric 架构。

---

## Phase 1: Data Layer

### Step 1.1: Update Types (`src/shared/types.ts`)

**添加:**
```typescript
export interface Workspace {
  path: string;
  name: string;
  lastOpenedAt: number;
}

export interface WorkspaceData {
  workspace: Workspace;
  sessions: Session[];
}
```

**修改 Session:** 移除 `workingDir` 字段

---

### Step 1.2: Add Storage Service (`src/main/services/storage.ts`)

**新建文件:** 封装 workspace/session 的持久化逻辑

```typescript
import Store from 'electron-store';
import type { Workspace, WorkspaceData, Session, AppConfig } from '../../shared/types';

interface AppStoreData {
  config: AppConfig;
  currentWorkspacePath: string | null;
  workspaces: Record<string, WorkspaceData>;
  recentWorkspacePaths: string[];
}

class StorageService {
  private store = new Store<AppStoreData>({
    defaults: {
      config: { providers: [], defaultProvider: '', theme: 'system' },
      currentWorkspacePath: null,
      workspaces: {},
      recentWorkspacePaths: [],
    },
  });

  // Workspace methods
  getCurrentWorkspacePath(): string | null;
  getWorkspace(path: string): WorkspaceData | undefined;
  saveWorkspace(data: WorkspaceData): void;
  getRecentWorkspaces(): Workspace[];
  addRecentWorkspace(path: string, name: string): void;
  removeRecentWorkspace(path: string): void;

  // Session methods
  getSessions(workspacePath: string): Session[];
  saveSession(workspacePath: string, session: Session): void;
  deleteSession(workspacePath: string, sessionId: string): void;

  // Config methods (迁移现有逻辑)
  getConfig(): AppConfig;
  setConfig(config: Partial<AppConfig>): void;
}

export const storageService = new StorageService();
```

---

### Step 1.3: Update IPC Channels (`src/shared/ipc.ts`)

**添加:**
```typescript
WORKSPACE_OPEN: 'workspace:open',
WORKSPACE_GET_CURRENT: 'workspace:get-current',
WORKSPACE_GET_RECENT: 'workspace:get-recent',
WORKSPACE_REMOVE_RECENT: 'workspace:remove-recent',
```

---

## Phase 2: IPC Layer

### Step 2.1: Update Preload (`src/preload.ts`)

**添加 workspace API:**
```typescript
workspace: {
  open: () => Promise<WorkspaceData | null>;
  getCurrent: () => Promise<WorkspaceData | null>;
  getRecent: () => Promise<Workspace[]>;
  removeRecent: (path: string) => Promise<void>;
}
```

**修改 session.create:** 移除 workingDir 参数

---

### Step 2.2: Update IPC Handlers (`src/main/ipc/index.ts`)

**重构:**
- 使用 `storageService` 替代直接操作 `sessions` Map
- 添加 workspace 相关 handlers
- 修改 session handlers 以支持 workspace 上下文

---

## Phase 3: State Layer

### Step 3.1: Update Store (`src/renderer/stores/app.ts`)

**添加:**
```typescript
currentWorkspace: Workspace | null;

setWorkspace: (data: WorkspaceData | null) => void;
```

**修改:**
- `addSession` / `updateSession` / `deleteSession` 需要 workspace 上下文
- 移除所有 `workingDir` 相关逻辑

---

## Phase 4: UI Layer

### Step 4.1: Create WelcomePage (`src/renderer/components/WelcomePage.tsx`)

**新建组件:**
- 显示 "打开文件夹" 按钮
- 显示最近使用的 workspace 列表
- 点击列表项直接打开对应 workspace

---

### Step 4.2: Update App (`src/renderer/App.tsx`)

**条件渲染:**
```tsx
{currentWorkspace ? (
  <>
    <Sidebar />
    <ChatPanel />
    <InfoPanel />
  </>
) : (
  <WelcomePage />
)}
```

---

### Step 4.3: Update TitleBar (`src/renderer/components/TitleBar.tsx`)

**添加:**
- 中间显示当前 workspace 名称
- "切换" 按钮

---

### Step 4.4: Update Sidebar (`src/renderer/components/Sidebar.tsx`)

**修改:**
- "New Chat" → "New Session"

---

### Step 4.5: Update ChatPanel (`src/renderer/components/ChatPanel.tsx`)

**移除:**
- "Open Folder" 按钮
- `handleOpenFolder` 函数
- `currentSession.workingDir` 相关逻辑

**修改:**
- 从 `currentWorkspace.path` 获取工作目录

---

## Phase 5: Integration

### Step 5.1: Initialize on App Load

**App.tsx useEffect:**
1. 调用 `workspace.getCurrent()`
2. 如果有，加载 workspace 和 sessions
3. 如果没有，显示 WelcomePage

### Step 5.2: Test Full Flow

1. 首次打开 → 显示欢迎页
2. 选择目录 → 创建 workspace，显示空 session 列表
3. 创建 session → 正常对话
4. 关闭应用 → 重新打开，恢复状态
5. 切换 workspace → 保存当前，加载新的

---

## File Summary

| Action | File |
|--------|------|
| Modify | `src/shared/types.ts` |
| Modify | `src/shared/ipc.ts` |
| Create | `src/main/services/storage.ts` |
| Modify | `src/main/ipc/index.ts` |
| Modify | `src/preload.ts` |
| Modify | `src/renderer/stores/app.ts` |
| Modify | `src/renderer/App.tsx` |
| Create | `src/renderer/components/WelcomePage.tsx` |
| Modify | `src/renderer/components/TitleBar.tsx` |
| Modify | `src/renderer/components/Sidebar.tsx` |
| Modify | `src/renderer/components/ChatPanel.tsx` |
