import { create } from 'zustand';
import type { Session, Message, Part, AppConfig, StreamEvent, Workspace, WorkspaceData, Skill, QuestionRequest } from '../../shared/types';
import type { MCPServerStatus, MCPConfig, LayeredMCPConfig } from '../../shared/mcp-types';

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
  pendingMessageId: string | null;
  pendingParts: Part[];

  // Question state
  pendingQuestion: QuestionRequest | null;

  // MCP state
  mcpStatuses: MCPServerStatus[];
  mcpConfig: MCPConfig | null;
  mcpLayeredConfig: LayeredMCPConfig | null;

  // Config
  config: AppConfig | null;

  // Skills
  skills: Skill[];
  commandPaletteOpen: boolean;

  // Workspace Actions
  setWorkspace: (data: WorkspaceData | null) => void;
  clearWorkspace: () => void;

  // Session Actions
  setSessions: (sessions: Session[]) => void;
  setCurrentSession: (session: Session | null) => void;
  addSession: (session: Session) => void;
  updateSession: (session: Session) => void;
  deleteSession: (sessionId: string) => void;

  // Config Actions
  setConfig: (config: AppConfig) => void;

  // Streaming Actions
  startStreaming: (messageId: string) => void;
  handleStreamEvent: (event: StreamEvent) => void;
  stopStreaming: () => void;

  // Message Actions
  addMessage: (sessionId: string, message: Message) => void;

  // Skill Actions
  setSkills: (skills: Skill[]) => void;
  loadSkills: () => Promise<void>;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  // Question Actions
  setPendingQuestion: (question: QuestionRequest | null) => void;

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
  pendingMessageId: null,
  pendingParts: [],
  pendingQuestion: null,
  mcpStatuses: [],
  mcpConfig: null,
  mcpLayeredConfig: null,
  config: null,
  skills: [],
  commandPaletteOpen: false,

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
      });
      return;
    }

    set({
      currentWorkspace: data.workspace,
      currentWorkspacePath: data.workspace.path,
      sessions: data.sessions,
      currentSession: data.sessions[0] || null,
      currentSessionId: data.sessions[0]?.id || null,
    });
  },

  clearWorkspace: () => {
    set({
      currentWorkspace: null,
      currentWorkspacePath: null,
      sessions: [],
      currentSession: null,
      currentSessionId: null,
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
    }),

  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
      currentSession: session,
      currentSessionId: session.id,
    })),

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

  startStreaming: (messageId) =>
    set({
      isStreaming: true,
      pendingMessageId: messageId,
      pendingParts: [],
    }),

  handleStreamEvent: (event) => {
    const state = get();

    if (event.type === 'message-start') {
      set({
        isStreaming: true,
        pendingMessageId: event.messageId,
        pendingParts: [],
      });
    } else if (event.type === 'message-continue') {
      set({
        isStreaming: true,
        pendingMessageId: event.messageId,
      });
    } else if (event.type === 'text-delta') {
      set((state) => {
        const parts = [...state.pendingParts];
        const textPartIdx = parts.findIndex((p) => p.type === 'text');
        if (textPartIdx >= 0) {
          const tp = parts[textPartIdx];
          if (tp.type === 'text') {
            parts[textPartIdx] = { ...tp, text: tp.text + event.delta };
          }
        } else {
          parts.unshift({ type: 'text', text: event.delta! });
        }
        return { pendingParts: parts };
      });
    } else if (event.type === 'thinking-delta') {
      set((state) => {
        const parts = [...state.pendingParts];
        const thinkingPartIdx = parts.findIndex((p) => p.type === 'thinking');
        if (thinkingPartIdx >= 0) {
          const tp = parts[thinkingPartIdx];
          if (tp.type === 'thinking') {
            parts[thinkingPartIdx] = { ...tp, text: tp.text + event.delta };
          }
        } else {
          parts.unshift({ type: 'thinking', text: event.delta! });
        }
        return { pendingParts: parts };
      });
    } else if (event.type === 'tool-call') {
      set((state) => ({
        pendingParts: [
          ...state.pendingParts,
          {
            type: 'tool-call',
            toolCallId: event.toolCallId!,
            toolName: event.toolName!,
            args: event.args!,
          },
        ],
      }));
    } else if (event.type === 'tool-result') {
      set((state) => ({
        pendingParts: [
          ...state.pendingParts,
          {
            type: 'tool-result',
            toolCallId: event.toolCallId!,
            toolName: event.toolName!,
            result: event.result,
            isError: event.isError,
          },
        ],
      }));
    } else if (event.type === 'message-complete') {
      const session = state.currentSession;
      if (session && state.pendingMessageId) {
        const message: Message = {
          id: state.pendingMessageId,
          role: 'assistant',
          parts: state.pendingParts,
          createdAt: Date.now(),
        };

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
          messages: [...session.messages, message],
          updatedAt: Date.now(),
        };

        window.manong.session.update(updatedSession);

        set({
          isStreaming: false,
          pendingMessageId: null,
          pendingParts: [],
          currentSession: updatedSession,
          sessions: state.sessions.map((s) =>
            s.id === updatedSession.id ? updatedSession : s
          ),
        });
      }
    } else if (event.type === 'error') {
      set({
        isStreaming: false,
        pendingMessageId: null,
        pendingParts: [],
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
      pendingMessageId: null,
      pendingParts: [],
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

  openCommandPalette: () => set({ commandPaletteOpen: true }),

  closeCommandPalette: () => set({ commandPaletteOpen: false }),

  // =====================
  // Question Actions
  // =====================

  setPendingQuestion: (question) => set({ pendingQuestion: question }),

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
