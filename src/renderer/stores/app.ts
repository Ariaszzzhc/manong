import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Session, Message, AppConfig, StreamEvent, Workspace, WorkspaceData, Skill, QuestionRequest, Todo } from '../../shared/types';
import type { MCPServerStatus, MCPConfig, LayeredMCPConfig } from '../../shared/mcp-types';
import type { PermissionMode, PermissionRequest, PermissionDecision } from '../../shared/permission-types';

interface AppState {
  // Workspace
  currentWorkspace: Workspace | null;
  currentWorkspacePath: string | null;

  // Sessions (current workspace's)
  sessions: Session[];
  currentSessionId: string | null;
  currentSession: Session | null;

  // Streaming state
  isStreaming: boolean;
  pendingMessages: Message[];
  streamingMessage: Message | null;

  // Question state
  pendingQuestion: QuestionRequest | null;

  // Permission state
  permissionMode: PermissionMode;
  pendingPermission: PermissionRequest | null;

  // Todo state
  todos: Todo[];

  // MCP state
  mcpStatuses: MCPServerStatus[];
  mcpConfig: MCPConfig | null;
  mcpLayeredConfig: LayeredMCPConfig | null;

  // Config
  config: AppConfig | null;

  // Skills
  skills: Skill[];

  // Workspace Actions
  setWorkspace: (data: WorkspaceData | null) => void;
  clearWorkspace: () => void;

  // Session Actions
  setSessions: (sessions: Session[]) => void;
  setCurrentSession: (session: Session | null) => void;
  addSession: (session: Session) => void;
  ensureSession: () => Promise<Session>;
  updateSession: (session: Session) => void;
  deleteSession: (sessionId: string) => void;

  // Config Actions
  setConfig: (config: AppConfig) => void;

  // Streaming Actions
  startStreaming: () => void;
  handleStreamEvent: (event: StreamEvent) => void;
  stopStreaming: () => void;

  // Message Actions
  addMessage: (sessionId: string, message: Message) => void;

  // Skill Actions
  setSkills: (skills: Skill[]) => void;
  loadSkills: () => Promise<void>;

  // Question Actions
  setPendingQuestion: (question: QuestionRequest | null) => void;

  // Permission Actions
  setPermissionMode: (mode: PermissionMode) => void;
  setPendingPermission: (request: PermissionRequest | null) => void;
  respondPermission: (requestId: string, decision: PermissionDecision) => void;

  // Todo Actions
  setTodos: (todos: Todo[]) => void;

  // MCP Actions
  setMCPStatuses: (statuses: MCPServerStatus[]) => void;
  setMCPConfig: (config: MCPConfig) => void;
  setMCPLayeredConfig: (config: LayeredMCPConfig) => void;
  loadMCPStatus: () => Promise<void>;
  loadMCPLayeredConfig: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentWorkspace: null,
  currentWorkspacePath: null,
  sessions: [],
  currentSessionId: null,
  currentSession: null,
  isStreaming: false,
  pendingMessages: [],
  streamingMessage: null,
  pendingQuestion: null,
  permissionMode: 'default',
  pendingPermission: null,
  todos: [],
  mcpStatuses: [],
  mcpConfig: null,
  mcpLayeredConfig: null,
  config: null,
  skills: [],

  // =====================
  // Workspace Actions
  // =====================

  setWorkspace: (data) => {
    if (!data) {
      set({
        currentWorkspace: null,
        currentWorkspacePath: null,
        sessions: [],
        currentSession: null,
        currentSessionId: null,
        todos: [],
      });
      return;
    }

    set({
      currentWorkspace: data.workspace,
      currentWorkspacePath: data.workspace.path,
      sessions: data.sessions,
      currentSession: data.sessions[0] || null,
      currentSessionId: data.sessions[0]?.id || null,
      todos: data.sessions[0]?.todos || [],
    });
  },

  clearWorkspace: () => {
    set({
      currentWorkspace: null,
      currentWorkspacePath: null,
      sessions: [],
      currentSession: null,
      currentSessionId: null,
      todos: [],
    });
  },

  // =====================
  // Session Actions
  // =====================

  setSessions: (sessions) => set({ sessions }),

  setCurrentSession: (session) =>
    set({
      currentSession: session,
      currentSessionId: session?.id ?? null,
      todos: session?.todos || [],
    }),

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
      currentSession: session,
      currentSessionId: session.id,
    })),

  ensureSession: async () => {
    const state = get();
    if (state.currentSession) return state.currentSession;
    const session = await window.manong.session.create();
    set((s) => ({
      sessions: [session, ...s.sessions],
      currentSession: session,
      currentSessionId: session.id,
    }));
    return session;
  },

  updateSession: (session) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === session.id ? session : s
      ),
      currentSession:
        state.currentSessionId === session.id ? session : state.currentSession,
    })),

  deleteSession: (sessionId) =>
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== sessionId);
      const wasCurrent = state.currentSessionId === sessionId;
      return {
        sessions: newSessions,
        currentSession: wasCurrent ? newSessions[0] ?? null : state.currentSession,
        currentSessionId: wasCurrent ? newSessions[0]?.id ?? null : state.currentSessionId,
      };
    }),

  // =====================
  // Config Actions
  // =====================

  setConfig: (config) => set({ config }),

  // =====================
  // Streaming Actions
  // =====================

  startStreaming: () =>
    set({
      isStreaming: true,
      pendingMessages: [],
      streamingMessage: null,
    }),

  handleStreamEvent: (event) => {
    const state = get();

    if (event.type === 'message-start') {
      set({
        isStreaming: true,
        pendingMessages: [],
        streamingMessage: {
          id: event.messageId,
          role: 'assistant',
          parts: [],
          createdAt: Date.now(),
        },
      });
    } else if (event.type === 'message-continue') {
      // Flush current streamingMessage, start a new assistant message
      const pending = [...state.pendingMessages];
      if (state.streamingMessage && state.streamingMessage.parts.length > 0) {
        pending.push(state.streamingMessage);
      }
      set({
        isStreaming: true,
        pendingMessages: pending,
        streamingMessage: {
          id: event.messageId,
          role: 'assistant',
          parts: [],
          createdAt: Date.now(),
        },
      });
    } else if (event.type === 'text-delta') {
      set((s) => {
        if (!s.streamingMessage) return s;
        const parts = [...s.streamingMessage.parts];
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart.type === 'text') {
          parts[parts.length - 1] = { ...lastPart, text: lastPart.text + event.delta };
        } else {
          parts.push({ type: 'text', text: event.delta ?? '' });
        }
        return { streamingMessage: { ...s.streamingMessage, parts } };
      });
    } else if (event.type === 'thinking-delta') {
      set((s) => {
        if (!s.streamingMessage) return s;
        const parts = [...s.streamingMessage.parts];
        const thinkingIdx = parts.findIndex((p) => p.type === 'thinking');
        if (thinkingIdx >= 0) {
          const tp = parts[thinkingIdx];
          if (tp.type === 'thinking') {
            parts[thinkingIdx] = { ...tp, text: tp.text + event.delta };
          }
        } else {
          // Insert thinking at the beginning
          parts.unshift({ type: 'thinking', text: event.delta ?? '' });
        }
        return { streamingMessage: { ...s.streamingMessage, parts } };
      });
    } else if (event.type === 'tool-call') {
      set((s) => {
        if (!s.streamingMessage) return s;
        return {
          streamingMessage: {
            ...s.streamingMessage,
            parts: [
              ...s.streamingMessage.parts,
              {
                type: 'tool-call',
                toolCallId: event.toolCallId ?? '',
                toolName: event.toolName ?? '',
                args: event.args ?? {},
              },
            ],
          },
        };
      });
    } else if (event.type === 'tool-result') {
      set((s) => {
        // Flush streamingMessage to pendingMessages, then add user message with tool-result
        const pending = [...s.pendingMessages];
        if (s.streamingMessage && s.streamingMessage.parts.length > 0) {
          pending.push(s.streamingMessage);
        }
        pending.push({
          id: uuidv4(),
          role: 'user',
          parts: [
            {
              type: 'tool-result',
              toolCallId: event.toolCallId ?? '',
              toolName: event.toolName ?? '',
              result: event.result,
              isError: event.isError,
              diff: event.diff,
            },
          ],
          createdAt: Date.now(),
        });
        return {
          pendingMessages: pending,
          streamingMessage: null,
        };
      });
    } else if (event.type === 'message-complete') {
      const session = state.currentSession;
      if (session) {
        // Flush streamingMessage
        const pending = [...state.pendingMessages];
        if (state.streamingMessage && state.streamingMessage.parts.length > 0) {
          pending.push(state.streamingMessage);
        }

        let title = session.title;
        if (session.title === 'New Session' && session.messages.length > 0) {
          const firstUserMsg = session.messages.find((m) => m.role === 'user');
          if (firstUserMsg) {
            const textPart = firstUserMsg.parts.find((p) => p.type === 'text');
            if (textPart && textPart.type === 'text') {
              title = textPart.text.replace(/\n/g, ' ').slice(0, 30).trim();
              if (textPart.text.length > 30) title += '...';
            }
          }
        }

        const updatedSession = {
          ...session,
          title,
          messages: [...session.messages, ...pending],
          updatedAt: Date.now(),
        };

        window.manong.session.update(updatedSession);

        set({
          isStreaming: false,
          pendingMessages: [],
          streamingMessage: null,
          currentSession: updatedSession,
          sessions: state.sessions.map((s) =>
            s.id === updatedSession.id ? updatedSession : s
          ),
        });
      }
    } else if (event.type === 'compact') {
      if ((event.compactType === 'auto' || event.compactType === 'manual') && event.messages) {
        const compactedMessages = event.messages;
        set((s) => ({
          currentSession: s.currentSession ? {
            ...s.currentSession,
            messages: compactedMessages,
          } : null,
          pendingMessages: [],
        }));
      }
    } else if (event.type === 'error') {
      set({
        isStreaming: false,
        pendingMessages: [],
        streamingMessage: null,
      });
    } else if (event.type === 'usage') {
      const session = state.currentSession;
      if (session && event.usage) {
        const updatedSession = {
          ...session,
          tokenUsage: event.usage,
          lastUsage: event.lastUsage,
        };

        set({
          currentSession: updatedSession,
          sessions: state.sessions.map((s) =>
            s.id === updatedSession.id ? updatedSession : s
          ),
        });
      }
    }
  },

  stopStreaming: () =>
    set({
      isStreaming: false,
      pendingMessages: [],
      streamingMessage: null,
    }),

  // =====================
  // Message Actions
  // =====================

  addMessage: (sessionId, message) =>
    set((state) => {
      const updatedSession = state.sessions.find((s) => s.id === sessionId);
      if (!updatedSession) return state;

      const newSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, message],
        updatedAt: Date.now(),
      };

      return {
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? newSession : s
        ),
        currentSession:
          state.currentSessionId === sessionId ? newSession : state.currentSession,
      };
    }),

  // =====================
  // Skill Actions
  // =====================

  setSkills: (skills) => set({ skills }),

  loadSkills: async () => {
    try {
      const skills = await window.manong.skill.list();
      set({ skills });
    } catch (error) {
      console.error('Failed to load skills:', error);
    }
  },

  // =====================
  // Question Actions
  // =====================

  setPendingQuestion: (question) => set({ pendingQuestion: question }),

  // =====================
  // Permission Actions
  // =====================

  setPermissionMode: (mode) => {
    set({ permissionMode: mode });
    window.manong.permission.setMode(mode);
  },

  setPendingPermission: (request) => set({ pendingPermission: request }),

  respondPermission: (requestId, decision) => {
    window.manong.permission.respond(requestId, decision);
    set({ pendingPermission: null });
  },

  // =====================
  // Todo Actions
  // =====================

  setTodos: (todos) => set({ todos }),

  // =====================
  // MCP Actions
  // =====================

  setMCPStatuses: (statuses) => set({ mcpStatuses: statuses }),

  setMCPConfig: (config) => set({ mcpConfig: config }),

  setMCPLayeredConfig: (config) => set({ mcpLayeredConfig: config }),

  loadMCPStatus: async () => {
    try {
      const statuses = await window.manong.mcp.getStatus();
      set({ mcpStatuses: statuses });
    } catch (error) {
      console.error('Failed to load MCP status:', error);
    }
  },

  loadMCPLayeredConfig: async () => {
    try {
      const config = await window.manong.mcp.getLayeredConfig();
      set({ mcpLayeredConfig: config, mcpConfig: config.merged });
    } catch (error) {
      console.error('Failed to load MCP layered config:', error);
    }
  },
}));
