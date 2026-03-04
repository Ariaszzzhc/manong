# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Manong is a desktop AI coding assistant built with Electron Forge, Vite, React, and TypeScript. It uses the Anthropic API for AI capabilities and supports extending tools via Model Context Protocol (MCP).

## Commands

```bash
pnpm start          # Run the app in development mode
pnpm run lint       # Run ESLint on .ts/.tsx files
pnpm run package    # Package the app for distribution
pnpm run make       # Create distributable installers
```

No test framework is configured.

## Architecture

### Electron Multi-Process

- **Main Process** (`src/main.ts`) — Node.js environment; window creation, IPC, agent loop, tool execution, MCP management
- **Preload Script** (`src/preload.ts`) — contextBridge API exposing `window.manong`
- **Renderer Process** (`src/renderer/`) — React UI with Zustand state management and Tailwind CSS

### Workspace-Centric Data Model

The app is organized around workspaces (directories), not sessions:

- `StorageService` persists workspaces and sessions via electron-store
- Sessions are scoped to workspaces, not global
- Recent workspaces tracked (max 10)

### Core Modules

```
src/
├── shared/               # Types shared between processes
│   ├── types.ts          # Message, Part, Session, Workspace, StreamEvent, AppConfig, Todo, Skill
│   ├── mcp-types.ts      # MCP config, connection status, server status types
│   ├── agent-types.ts    # Agent status & state types
│   ├── permission-types.ts # PermissionMode, ToolRiskLevel, PermissionRequest
│   ├── tool.ts           # ToolDefinition interface, defineTool()
│   └── ipc.ts            # IPC_CHANNELS constants
│
├── main/
│   ├── ipc/              # IPC handlers (workspace, session, agent, config, MCP, skills, permissions)
│   └── services/
│       ├── agent/
│       │   ├── loop.ts       # AgentLoop — orchestrates agent with system prompt & streaming
│       │   └── executor.ts   # AgentExecutor — streaming + tool execution (max 50 steps)
│       ├── provider/
│       │   └── anthropic.ts  # AnthropicProvider — streaming API integration
│       ├── tools/            # Tool registry + builtin tools
│       ├── mcp/              # MCP integration (manager, connection, tool adapter, config)
│       ├── skill/            # Skill system (loader, parser, builtins)
│       ├── permission/       # Tool permission enforcement with risk levels
│       ├── persistence/      # Additional storage layer
│       └── storage.ts        # StorageService — electron-store persistence
│
├── preload.ts            # Exposes window.manong API
│
└── renderer/
    ├── App.tsx           # Root component with navigation-view layout
    ├── stores/app.ts     # Zustand store — all app state + actions
    ├── components/       # UI components (ChatPanel, Sidebar, NavigationBar, etc.)
    ├── hooks/            # useKeyboardShortcuts
    ├── i18n/             # Locale detection and translations (zh-CN, en)
    └── themes/           # Light/dark CSS variable token definitions
```

### Agent Loop

`AgentLoop` (`src/main/services/agent/loop.ts`) manages a single agent execution per window:
- Contains the system prompt (~110 lines) with instructions for tool use and output formatting
- Delegates streaming execution to `AgentExecutor` which handles the Anthropic API call loop
- Max 50 tool execution steps per run
- Supports extended thinking (streaming `thinking_delta` events) and image attachments
- Streams events to renderer: `text_delta`, `thinking_delta`, `tool_call`, `tool_result`, `usage`, `end`, `error`

### Tool System

Tools use a dual-source registry pattern (`src/main/services/tools/registry.ts`):

**Builtin tools (10):** `read_file`, `write_file`, `edit_file`, `list_dir`, `glob`, `grep`, `bash`, `skill`, `ask`, `todo`

**MCP tools:** Dynamically registered from connected MCP servers via `tool-adapter.ts`

Tools are defined with Zod schemas:

```typescript
export const myTool = defineTool({
  name: 'tool_name',
  description: 'What the tool does',
  parameters: z.object({ param: z.string().describe('Description') }),
  execute: async (params, context: ToolContext) => {
    // context.workingDir is the current workspace path
    return { success: true, output: 'result' };
  },
});
toolRegistry.register(myTool);
```

### Permission System

`src/main/services/permission/` enforces tool permissions before execution:

- **Risk levels:** `read` (read_file, list_dir, glob, grep, skill, ask, todo), `write` (write_file, edit_file), `execute` (bash, MCP tools)
- **Permission modes:** `default` (prompt for write/execute), `acceptEdits` (auto-allow writes), `bypassPermissions` (allow all)
- **Layered config:** global + project + local configs merged, with per-tool rules (allow/deny patterns)
- **Decisions:** `allow`, `deny`, `always-allow` — user responds via `PermissionCard` in the UI
- File edits include diff previews in permission requests (`DiffView` component)

### MCP Integration

`src/main/services/mcp/` provides Model Context Protocol support:

- **Layered configuration:** global (`~/.config/manong/`) + project (`.manong/`) configs merged together
- **MCPManager** — server lifecycle, tool registration, workspace-aware config switching
- **MCPConnection** — stdio and HTTP transports with auto-reconnect
- **Tool adapter** — converts MCP tool schemas to the internal `ToolDefinition` format

### Skill System

`src/main/services/skill/` loads markdown-based skill definitions from three sources: builtin, global (`~/.config/manong/skills/`), and project (`.manong/skills/`). Supports two patterns: top-level `.md` files, or subdirectories with `SKILL.md`. Skills are triggerable via the `skill` tool or slash commands in the chat input (`SlashCommandMenu` component).

### Navigation & UI

The renderer uses a navigation-view pattern (not a router):
- `activeView` state switches between `'chat'`, `'mcp'`, and `'settings'` views
- `NavigationBar` — vertical icon buttons on the left
- `Sidebar` — persistent workspace/session list (toggleable)
- `ChatPanel` — main content area with message stream, permission cards, question cards, and todo display
- `WelcomePage` — shown when no workspace is open

### IPC API (window.manong)

```typescript
// Agent
window.manong.agent.start(sessionId, message, providerConfig, workspacePath, images?)
window.manong.agent.stop()
window.manong.agent.onStream(callback)

// Workspace
window.manong.workspace.open()           // Opens folder picker
window.manong.workspace.openPath(path)   // Opens specific path
window.manong.workspace.getCurrent()
window.manong.workspace.getRecent()
window.manong.workspace.removeRecent(path)

// Session
window.manong.session.create()
window.manong.session.list()
window.manong.session.get(sessionId)
window.manong.session.delete(sessionId)
window.manong.session.update(session)

// MCP
window.manong.mcp.getStatus() / .connect(name) / .disconnect(name)
window.manong.mcp.getConfig() / .saveConfig(config)
window.manong.mcp.getLayeredConfig() / .saveGlobalConfig(config) / .saveProjectConfig(config, path)
window.manong.mcp.setWorkspace(path) / .onStatusChanged(callback)

// Permission
window.manong.permission.respond(requestId, decision)
window.manong.permission.onAsk(callback)
window.manong.permission.setMode(mode)
window.manong.permission.getConfig() / .saveConfig(scope, config)

// Todo
window.manong.todo.onUpdate(callback)  // { sessionId, todos }

// Config, File System, Window, Skills, Questions, Menu — see src/preload.ts
```

## Build Configuration

Three separate Vite configs (`vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`). Electron Forge configured in `forge.config.ts` with security fuses (RunAsNode disabled, ASAR integrity enabled, cookie encryption enabled).

## Tech Stack

- **UI**: React 19 + Zustand 5 + Tailwind CSS 3
- **AI**: @anthropic-ai/sdk (streaming), ai + @ai-sdk/anthropic
- **MCP**: @modelcontextprotocol/sdk
- **Storage**: electron-store
- **Schemas**: Zod 4
- **Markdown**: react-markdown + remark-gfm + remark-math + rehype-katex
- **Diagrams**: mermaid
- **Code Highlighting**: highlight.js
- **Diff**: diff (unified diffs for file edit previews)
- **State Machines**: xstate (skill execution)

## Theme System

CSS variables defined in `src/renderer/themes/tokens.ts`:
- `lightTokens` / `darkTokens` define all colors
- `applyTheme()` sets CSS variables on `:root`
- Variables: `--background`, `--surface`, `--text-primary`, `--border`, etc.
