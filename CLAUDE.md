# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Manong is a desktop AI coding assistant built with Electron Forge, Vite, React, and TypeScript. It uses the Anthropic API for AI capabilities.

## Commands

```bash
pnpm start          # Run the app in development mode
pnpm run lint       # Run ESLint on .ts/.tsx files
pnpm run package    # Package the app for distribution
pnpm run make       # Create distributable installers
```

## Architecture

### Electron Multi-Process

- **Main Process** (`src/main.ts`) - Node.js environment, handles window creation, IPC, agent loop, and tool execution
- **Preload Script** (`src/preload.ts`) - Bridge between main and renderer with contextBridge API exposing `window.manong`
- **Renderer Process** (`src/renderer/`) - React UI with Zustand state management and Tailwind CSS

### Workspace-Centric Data Model

The app is organized around workspaces (directories), not sessions:

```
Workspace (directory path)
├── path: string           # Unique identifier
├── name: string           # Display name
├── lastOpenedAt: number
└── sessions: Session[]    # Sessions belong to workspaces
```

- `StorageService` persists workspaces and sessions via electron-store
- Recent workspaces are tracked (max 10) for quick access
- Sessions are scoped to workspaces, not global

### Core Modules

```
src/
├── shared/           # Types shared between processes
│   ├── types.ts      # Message, Part, Session, StreamEvent, AppConfig, Workspace
│   ├── tool.ts       # ToolDefinition interface, defineTool()
│   └── ipc.ts        # IPC_CHANNELS constants
│
├── main/
│   ├── ipc/          # IPC handlers for renderer communication
│   └── services/
│       ├── agent/    # AgentLoop - streaming + tool execution (max 50 steps)
│       ├── provider/ # AnthropicProvider - API integration
│       ├── storage.ts # StorageService - electron-store persistence
│       └── tools/    # 6 tools: read, write, edit, list_dir, search, shell
│
├── preload.ts        # Exposes window.manong API
│
└── renderer/
    ├── App.tsx       # Root component with three-column layout
    ├── components/   # UI components
    ├── stores/       # Zustand state management (app.ts)
    └── themes/       # Light/dark theme tokens via CSS variables
```

### Tool Definition Pattern

Tools are defined using Zod schemas and registered with the toolRegistry:

```typescript
const MySchema = z.object({
  param: z.string().describe('Description'),
});

export const myTool = defineTool({
  name: 'tool_name',
  description: 'What the tool does',
  parameters: MySchema,
  execute: async (params, context: ToolContext) => {
    // context.workingDir is the current workspace path
    return { success: true, output: 'result' };
  },
});

toolRegistry.register(myTool);
```

### IPC API (window.manong)

```typescript
// Agent
window.manong.agent.start(sessionId, message, providerConfig, workspacePath)
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

// File System
window.manong.fs.openFolder()
window.manong.fs.readFile(path)
window.manong.fs.writeFile(path, content)
window.manong.fs.listDir(path)

// Config
window.manong.config.get()
window.manong.config.set(partialConfig)

// Window
window.manong.window.minimize/maximize/close()
```

## Build Configuration

Three separate Vite configs:
- `vite.main.config.ts` - Main process
- `vite.preload.config.ts` - Preload script
- `vite.renderer.config.ts` - Renderer with esbuild JSX transformation

## Tech Stack

- **UI**: React 19 + Zustand + Tailwind CSS 3
- **AI**: @anthropic-ai/sdk for streaming API
- **Storage**: electron-store for config persistence
- **Markdown**: react-markdown + remark-gfm + remark-math + rehype-katex
- **Diagrams**: mermaid for rendering flowcharts, sequence diagrams, etc.
- **Code Highlighting**: highlight.js

## Theme System

Themes are managed via CSS variables defined in `src/renderer/themes/tokens.ts`:
- `lightTokens` and `darkTokens` define all colors
- `applyTheme()` sets CSS variables on `:root`
- Variables: `--background`, `--surface`, `--text-primary`, `--border`, etc.

## Packaging

Configured in `forge.config.ts`. Supports:
- Windows (Squirrel)
- macOS (ZIP)
- Linux (deb, rpm)
