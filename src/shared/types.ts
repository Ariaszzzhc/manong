// Core message types shared between main and renderer processes

export interface FileDiffInfo {
  filePath: string;
  changeType: 'modified' | 'created';
  diff: string;           // Unified diff string
  linesAdded: number;
  linesRemoved: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export const DEFAULT_TOKEN_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
  diff?: FileDiffInfo;
}

export interface ThinkingPart {
  type: 'thinking';
  text: string;
}

export interface ImagePart {
  type: 'image';
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  data: string;
  thumbnailData: string;
  filename?: string;
}

export type Part = TextPart | ToolCallPart | ToolResultPart | ThinkingPart | ImagePart;

// Timeline display types
export type TimelineBlock =
  | { type: 'user-input'; id: string; text: string; images: ImagePart[]; createdAt: number }
  | { type: 'assistant-text'; id: string; text: string; createdAt: number; isStreaming?: boolean }
  | { type: 'thinking'; id: string; text: string; createdAt: number; isStreaming?: boolean }
  | { type: 'tool-pair'; id: string; call: ToolCallPart; result?: ToolResultPart; createdAt: number };

export interface UserMessage {
  id: string;
  role: 'user';
  parts: Part[];
  createdAt: number;
  hidden?: boolean;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  parts: Part[];
  createdAt: number;
  hidden?: boolean;
}

export type Message = UserMessage | AssistantMessage;

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  tokenUsage: TokenUsage;
  lastUsage?: TokenUsage;
  todos?: Todo[];
  parentSessionId?: string;
  agentType?: string;
  subagentHistory?: SubagentInfo[];
}

// Workspace - represents a working directory context
export interface Workspace {
  path: string;           // Directory path, acts as unique identifier
  name: string;           // Display name (directory name)
  lastOpenedAt: number;   // Last opened timestamp
}

// WorkspaceData - workspace with its sessions
export interface WorkspaceData {
  workspace: Workspace;
  sessions: Session[];
}

// Stream events for IPC communication
export type StreamEventType =
  | 'text-delta'
  | 'thinking-delta'
  | 'tool-call'
  | 'tool-result'
  | 'message-start'
  | 'message-continue'
  | 'message-complete'
  | 'usage'
  | 'error'
  | 'compact';

export interface StreamEvent {
  type: StreamEventType;
  sessionId: string;
  messageId: string;
  // For text-delta and thinking-delta
  delta?: string;
  // For tool-call
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  // For tool-result
  result?: unknown;
  isError?: boolean;
  diff?: FileDiffInfo;
  // For usage event
  usage?: TokenUsage;
  lastUsage?: TokenUsage;
  // For error
  error?: string;
  // For compact
  compactType?: 'micro' | 'auto' | 'manual';
  compactInfo?: string;
  messages?: Message[];
}

// Provider configuration
export interface ProviderConfig {
  type: 'anthropic-compatible' | 'openai-compatible';
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  enableThinking?: boolean;
}

// App configuration
export interface AppConfig {
  providers: ProviderConfig[];
  defaultProvider: string;
  theme: 'light' | 'dark';
  language?: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  providers: [],
  defaultProvider: '',
  theme: 'dark',
};

// Skill types
export interface Skill {
  name: string
  description: string
  template: string
  source: 'builtin' | 'global' | 'project'
  agent?: string
  hints: string[]
}

export interface SkillExecuteResult {
  success: boolean
  prompt?: string
  error?: string
}

// Question types for ask tool
export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionInfo {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
}

export interface QuestionRequest {
  id: string;
  sessionId: string;
  questions: QuestionInfo[];
}

export type QuestionAnswer = string[];

// Todo types
export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export type TodoPriority = 'high' | 'medium' | 'low';

export interface Todo {
  content: string;
  status: TodoStatus;
  priority: TodoPriority;
}

export type AgentMode = 'primary' | 'subagent';

export interface AgentType {
  name: string;
  description: string;
  mode: AgentMode;
  prompt?: string;
  allowedTools?: string[];
  deniedTools?: string[];
  model?: string;
  color?: string;
}

export interface TaskToolParams {
  description: string;
  prompt: string;
  subagent_type: string;
  task_id?: string;
}

export interface TaskToolResult {
  taskId: string;
  summary: string;
}

export type SubagentStatus = 'pending' | 'running' | 'completed' | 'error';

export interface SubagentInfo {
  id: string;
  parentSessionId: string;
  agentType: string;
  taskDescription: string;
  status: SubagentStatus;
  startTime: number;
  endTime?: number;
  tokenUsage?: TokenUsage;
  error?: string;
}
