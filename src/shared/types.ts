// Core message types shared between main and renderer processes

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
}

export interface ThinkingPart {
  type: 'thinking';
  text: string;
}

export type Part = TextPart | ToolCallPart | ToolResultPart | ThinkingPart;

export interface UserMessage {
  id: string;
  role: 'user';
  parts: Part[];
  createdAt: number;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  parts: Part[];
  createdAt: number;
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
  | 'error';

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
  // For usage event
  usage?: TokenUsage;
  lastUsage?: TokenUsage;
  // For error
  error?: string;
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
