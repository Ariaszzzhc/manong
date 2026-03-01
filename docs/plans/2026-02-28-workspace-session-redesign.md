# Workspace & Session Redesign

## Overview

重新设计 Workspace 和 Session 的概念关系，将 Workspace 与窗口绑定（类似 IDE），所有 Session 共享同一个 Workspace。

## Goals

1. Workspace 与窗口绑定，打开应用时引导选择目录
2. Session 是全新上下文，归属于当前 Workspace
3. Workspace 和 Session 全部持久化
4. 切换 Workspace 时替换加载对应的 Sessions

## Design Decisions

### Workspace Selection
- **模式**: 可选 + 提示
- **UI**: 欢迎页（类似 VS Code）
- 无 workspace 时显示欢迎页，引导用户选择目录
- 显示最近使用的 workspace 列表，点击可直接打开

### Persistence
- 使用 `electron-store` 持久化
- Workspace 和 Session 全部保存
- 关闭应用后重新打开，恢复上次状态

### Workspace Switching
- 切换时替换加载（保存当前，加载新的）
- 不保留之前 workspace 的 sessions 在内存中

## Data Structures

### Types

```typescript
// 新增 Workspace 类型
export interface Workspace {
  path: string;           // 目录路径，作为唯一标识
  name: string;           // 显示名称（目录名）
  lastOpenedAt: number;   // 最后打开时间
}

// Session 修改 - 移除 workingDir
export interface Session {
  id: string;
  title: string;
  messages: Message[];
  // workingDir: 已删除，从 workspace 继承
  createdAt: number;
  updatedAt: number;
}

// Workspace 数据（包含 workspace 信息和其下的 sessions）
export interface WorkspaceData {
  workspace: Workspace;
  sessions: Session[];
}
```

### Storage Structure (electron-store)

```typescript
interface AppStoreData {
  config: AppConfig;
  currentWorkspacePath: string | null;
  workspaces: Record<string, WorkspaceData>;
  recentWorkspacePaths: string[];  // 最多保留 10 个
}
```

### Runtime State (Zustand)

```typescript
interface AppState {
  // Workspace
  currentWorkspace: Workspace | null;
  currentWorkspacePath: string | null;

  // Sessions (当前 workspace 的)
  sessions: Session[];
  currentSessionId: string | null;
  currentSession: Session | null;

  // ... 其他现有状态 ...
}
```

## IPC Changes

### New Channels

```typescript
export const IPC_CHANNELS = {
  // ... 现有的 ...

  // Workspace 管理
  WORKSPACE_OPEN: 'workspace:open',
  WORKSPACE_GET_CURRENT: 'workspace:get-current',
  WORKSPACE_GET_RECENT: 'workspace:get-recent',
  WORKSPACE_REMOVE_RECENT: 'workspace:remove-recent',
};
```

### Preload API

```typescript
// window.manong.workspace
workspace: {
  open: () => Promise<WorkspaceData | null>;
  getCurrent: () => Promise<WorkspaceData | null>;
  getRecent: () => Promise<Workspace[]>;
  removeRecent: (path: string) => Promise<void>;
}
```

### Session API Changes

```typescript
// 移除 workingDir 参数
session: {
  create: () => Promise<Session>;  // 不再需要 workingDir 参数
  // ... 其他保持不变 ...
}
```

## UI Changes

### Welcome Page (New)

当没有 workspace 时显示欢迎页：

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                      Manong                            │
│                                                        │
│              ┌─────────────────────┐                   │
│              │    打开文件夹       │                   │
│              └─────────────────────┘                   │
│                                                        │
│              最近使用                                  │
│              ├─ 📁 my-project                         │
│              ├─ 📁 another-project                    │
│              └─ 📁 test-app                           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Title Bar

显示当前 workspace 名称和切换按钮：

```
┌────────────────────────────────────────────────────────┐
│  Manong              📁 my-project  [切换]     [设置]  │
└────────────────────────────────────────────────────────┘
```

### Sidebar

- "New Chat" → "New Session"
- 其他保持不变

### Chat Panel

- 移除 "Open Folder" 按钮
- 从 store 获取 workspace path

## File Changes

### New Files

| File | Description |
|------|-------------|
| `src/renderer/components/WelcomePage.tsx` | Welcome page component |
| `src/main/services/storage.ts` | Storage service for workspace/session |

### Modified Files

| File | Changes |
|------|---------|
| `src/shared/types.ts` | Add `Workspace`, `WorkspaceData`; Remove `workingDir` from `Session` |
| `src/shared/ipc.ts` | Add workspace IPC channels |
| `src/preload.ts` | Add `window.manong.workspace` API |
| `src/main/ipc/index.ts` | Add workspace handlers; Modify session handlers |
| `src/renderer/stores/app.ts` | Add workspace state; Modify session management |
| `src/renderer/App.tsx` | Conditional render based on workspace |
| `src/renderer/components/TitleBar.tsx` | Show workspace name and switch button |
| `src/renderer/components/Sidebar.tsx` | Change button text to "New Session" |
| `src/renderer/components/ChatPanel.tsx` | Remove "Open Folder" button |

## Implementation Order

1. **Data Layer** - Update types and storage service
2. **IPC Layer** - Add workspace channels and handlers
3. **State Layer** - Update Zustand store
4. **UI Layer** - Welcome page, TitleBar, Sidebar, ChatPanel changes
5. **Integration** - Connect all layers, test full flow
