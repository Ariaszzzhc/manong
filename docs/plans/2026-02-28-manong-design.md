# Manong - 桌面版 Code Agent 设计文档

## 概述

Manong 是一款桌面版 AI Code Agent，对标 opencode、Claude Code、Codex、Gemini CLI 等竞品。

## 技术栈

- **桌面框架**: Electron Forge + Vite
- **语言**: TypeScript
- **UI**: React + Zustand + Tailwind CSS
- **AI SDK**: Vercel AI SDK (`ai` package)
- **Provider**: 支持 OpenAI-compatible 和 Anthropic-compatible

## 架构

采用 Client/Server 架构，Electron Main Process 作为 Core Engine：

```
┌─────────────────────────────────────────────────────┐
│                  Electron Shell                      │
├─────────────────────────────────────────────────────┤
│  React UI (Renderer Process)                        │
│  - 三栏布局                                          │
│  - 聊天界面                                          │
│  - 信息面板                                          │
└───────────────────┬─────────────────────────────────┘
                    │ IPC
┌───────────────────▼─────────────────────────────────┐
│  Core Engine (Main Process)                         │
│  - Agent 系统                                        │
│  - Provider 管理                      │
│  - Tool 执行                                        │
│  - MCP Client                                       │
│  - 文件系统操作                                      │
└─────────────────────────────────────────────────────┘
```

## 模块划分

```
src/
├── main/                    # Electron Main Process
│   ├── index.ts            # 入口
│   ├── ipc/                # IPC 处理器
│   └── services/           # 后端服务
│       ├── agent/          # Agent 核心
│       │   ├── loop.ts     # Agent 循环
│       │   ├── tools/      # 工具定义
│       │   └── prompts/    # 系统提示词
│       ├── provider/       # AI Provider 管理
│       ├── mcp/            # MCP 客户端
│       └── fs/             # 文件系统操作
│
├── preload/                # Preload Script
│   └── index.ts            # contextBridge API
│
└── renderer/               # React UI
    ├── App.tsx
    ├── components/
    ├── hooks/
    └── stores/
```

## Agent 系统

### Streaming 循环

```
User Message ──▶ LLM Stream ──▶ UI (实时渲染)
                      │
                      ▼
              Tool Call Detected?
                   │        │
                  Yes       No ──▶ Continue Stream
                   │
                   ▼
             Execute Tool
                   │
                   ▼
             Tool Result ──▶ Next LLM Stream
```

### Tool 定义

```typescript
interface Tool<T = unknown> {
  name: string
  description: string
  parameters: JSONSchema
  execute: (params: T, context: ToolContext) => Promise<ToolResult>
}

interface ToolContext {
  workingDir: string
  permission: PermissionManager
  fs: FileSystem
}

interface ToolResult {
  success: boolean
  output: string
  error?: string
}
```

### 首批 Tools (MVP)

- `read_file` - 读取文件
- `write_file` - 写入文件
- `edit_file` - 编辑文件（diff 模式）
- `list_dir` - 列出目录
- `search_file` - 搜索文件
- `run_shell` - 执行命令（带权限）

## Provider 系统

### 配置方式

支持两种兼容协议，用户通过配置文件自定义：

```typescript
type ProviderType = 'openai-compatible' | 'anthropic-compatible'

interface ProviderConfig {
  type: ProviderType
  name: string           // 用户自定义名称
  apiKey: string
  baseURL: string        // API 端点
  model: string          // 模型 ID
}
```

### 配置文件示例

`~/.manong/config.json`:

```json
{
  "providers": [
    {
      "type": "anthropic-compatible",
      "name": "claude",
      "apiKey": "sk-ant-xxx",
      "baseURL": "https://api.anthropic.com",
      "model": "claude-sonnet-4-6"
    },
    {
      "type": "openai-compatible",
      "name": "deepseek",
      "apiKey": "sk-xxx",
      "baseURL": "https://api.deepseek.com",
      "model": "deepseek-chat"
    }
  ],
  "defaultProvider": "claude"
}
```

## IPC 通信

### Preload API

```typescript
const api = {
  agent: {
    start: (message: string) => void,
    stop: () => void,
    onStream: (callback: (event: StreamEvent) => void) => () => void,
  },
  fs: {
    openFolder: () => Promise<string | null>,
    readFile: (path: string) => Promise<string>,
    writeFile: (path: string, content: string) => Promise<void>,
    listDir: (path: string) => Promise<FileInfo[]>,
  },
  config: {
    get: () => Promise<Config>,
    set: (config: Partial<Config>) => Promise<void>,
  },
  window: {
    minimize: () => void,
    maximize: () => void,
    close: () => void,
  }
}
```

## UI 设计

### 三栏布局

```
┌───────────────────────────────────────────────────────────────┐
│  Title Bar (项目名 + Provider 选择 + 窗口控制)                  │
├─────────────┬─────────────────────────┬───────────────────────┤
│   Sidebar   │      Main Chat          │     Info Panel        │
│             │                         │                       │
│  对话历史   │   User/Assistant 消息   │  Changes (文件变更)   │
│  (按日期)   │   Tool Calls 展示       │  MCP Servers 状态     │
│             │   流式输出              │  Token Usage          │
│  [+ New]    │                         │                       │
│             │   Input Area            │                       │
├─────────────┴─────────────────────────┴───────────────────────┤
```

### 栏位功能

| 栏位 | 功能 |
|-----|-----|
| 左侧栏 | 对话历史列表（按日期分组）、新建对话 |
| 中间区 | 对话主体（消息流、Tool 调用展示）、输入框 |
| 右侧栏 | 文件变更列表、MCP 服务器状态、Token 统计 |

## 依赖

### 核心依赖

| 类别 | 包名 | 用途 |
|-----|-----|-----|
| UI 框架 | `react` + `react-dom` | UI 渲染 |
| 状态管理 | `zustand` | 轻量状态管理 |
| 样式方案 | `tailwindcss` | 原子化 CSS |
| Markdown | `react-markdown` + `remark-gfm` | 渲染 markdown |
| 代码高亮 | `shiki` | 语法高亮 |
| AI SDK | `ai` (Vercel AI SDK) | 统一 AI 接口 |
| Provider | `@ai-sdk/anthropic` `@ai-sdk/openai` | AI Provider |
| 文件监听 | `chokidar` | 文件变化监听 |
| 配置管理 | `electron-store` | 持久化配置 |

## 渐进式开发计划

### Phase 1 (MVP)
- 基础对话界面
- 单个 Provider（Anthropic-compatible）
- 基本文件操作工具
- 简单的 Agent 循环
- Streaming 输出

### Phase 2
- 多 Provider 支持
- MCP 协议
- 权限系统
- 配置管理

### Phase 3
- Skills 系统
- LSP 集成
- 高级功能
