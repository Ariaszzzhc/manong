# Thinking 折叠显示功能设计

## 概述

为支持 thinking（思维链）的模型添加 thinking 内容的折叠显示功能。用户可以点击展开查看模型的思考过程。

## 需求

1. thinking 内容默认折叠，点击展开
2. thinking 显示在消息的单独头部区域（tool 和 text 之前）
3. 触发器为简洁的 "Thinking" 纯文字

## 设计方案

### 1. 类型定义

**文件**: `src/shared/types.ts`

```typescript
// 新增 ThinkingPart
export interface ThinkingPart {
  type: 'thinking';
  text: string;
}

// 更新 Part 联合类型
export type Part = TextPart | ToolCallPart | ToolResultPart | ThinkingPart;

// 新增流式事件类型
export type StreamEventType =
  | 'text-delta'
  | 'thinking-delta'  // 新增
  | 'tool-call'
  | 'tool-result'
  | 'message-start'
  | 'message-continue'
  | 'message-complete'
  | 'error';

// StreamEvent 添加 delta 字段用于 thinking
export interface StreamEvent {
  // ... 现有字段
  delta?: string;  // 用于 text-delta 和 thinking-delta
}
```

### 2. Provider 处理

**文件**: `src/main/services/provider/anthropic.ts`

- 处理 `thinking` 类型的 content block
- 监听 `content_block_start` 事件中 `type: 'thinking'` 的 block
- 监听 `content_block_delta` 事件中 `type: 'thinking_delta'` 的 delta
- yield `{ type: 'thinking-delta', delta: string }` 事件

### 3. Agent Loop

**文件**: `src/main/services/agent/loop.ts`

- 处理 `thinking-delta` 事件
- 累积 thinking 文本到 pending parts 中的 ThinkingPart

### 4. UI 组件

**新文件**: `src/renderer/components/ThinkingCollapse.tsx`

```tsx
interface ThinkingCollapseProps {
  text: string;
  isStreaming?: boolean;
}
```

功能：
- 默认折叠状态（使用 useState）
- 点击触发器展开/折叠
- 展开后显示 markdown 格式内容
- 流式输出时自动展开

**修改文件**: `src/renderer/components/MessageItem.tsx`

- 提取 thinking parts
- 在消息头部渲染 ThinkingCollapse
- thinking 显示在 tool 和 text 之前

### 5. 视觉设计

```
┌─────────────────────────────────────┐
│ M  Manong                           │
│    ┌─ Thinking ────────────────┐ ▼  │  <- 折叠状态触发器
│    │ [thinking content here]   │    │  <- 展开后的内容
│    └────────────────────────────┘    │
│    [Tool calls...]                   │
│    [Text response...]                │
└─────────────────────────────────────┘
```

样式：
- 触发器：`💭 Thinking` + 箭头图标
- 内容区：`text-zinc-400`，斜体
- 背景：略深于消息背景
- 动画：平滑展开/折叠过渡

## 实现步骤

1. 更新类型定义 (`types.ts`)
2. 修改 Provider 处理 thinking 事件 (`anthropic.ts`)
3. 修改 Agent Loop 处理 thinking-delta (`loop.ts`)
4. 创建 ThinkingCollapse 组件
5. 修改 MessageItem 渲染 thinking
6. 测试流式输出和折叠交互

## 兼容性

- 不支持 thinking 的模型：无影响，不会产生 ThinkingPart
- 现有 session：无影响，旧消息没有 thinking parts
