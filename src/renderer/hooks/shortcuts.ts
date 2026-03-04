import type { TranslationKey } from '../i18n';
import type { ActiveView } from '../components/NavigationBar';

export interface ShortcutContext {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  isStreaming: boolean;
  sessions: { id: string }[];
  currentSessionId: string | null;
}

export interface ShortcutDefinition {
  id: string;
  key: string;
  mod?: boolean;
  shift?: boolean;
  labelKey: TranslationKey;
  when?: (ctx: ShortcutContext) => boolean;
  action: (ctx: ShortcutContext) => void;
  allowInInput?: boolean;
}

export const SHORTCUTS: ShortcutDefinition[] = [
  // --- Session Management ---
  {
    id: 'newSession',
    key: 'n',
    mod: true,
    labelKey: 'shortcuts.newSession',
    action: async () => {
      const session = await window.manong.session.create();
      // Import dynamically avoided — dispatch event for App to handle
      const { useAppStore } = await import('../stores/app');
      useAppStore.getState().addSession(session);
    },
  },
  {
    id: 'prevSession',
    key: '[',
    mod: true,
    labelKey: 'shortcuts.prevSession',
    action: (ctx) => {
      const { sessions, currentSessionId } = ctx;
      if (sessions.length < 2) return;
      const idx = sessions.findIndex((s) => s.id === currentSessionId);
      if (idx < sessions.length - 1) {
        import('../stores/app').then(({ useAppStore }) => {
          useAppStore.getState().setCurrentSession(
            useAppStore.getState().sessions[idx + 1]
          );
        });
      }
    },
  },
  {
    id: 'nextSession',
    key: ']',
    mod: true,
    labelKey: 'shortcuts.nextSession',
    action: (ctx) => {
      const { sessions, currentSessionId } = ctx;
      if (sessions.length < 2) return;
      const idx = sessions.findIndex((s) => s.id === currentSessionId);
      if (idx > 0) {
        import('../stores/app').then(({ useAppStore }) => {
          useAppStore.getState().setCurrentSession(
            useAppStore.getState().sessions[idx - 1]
          );
        });
      }
    },
  },

  // --- Chat & Input ---
  {
    id: 'focusInput',
    key: 'l',
    mod: true,
    labelKey: 'shortcuts.focusInput',
    action: (ctx) => {
      if (ctx.activeView !== 'chat') ctx.setActiveView('chat');
      window.dispatchEvent(new CustomEvent('manong:focus-input'));
    },
  },
  {
    id: 'stopGeneration',
    key: 'Escape',
    labelKey: 'shortcuts.stopGeneration',
    allowInInput: true,
    when: (ctx) => ctx.isStreaming,
    action: () => {
      // Double-press logic is handled in useKeyboardShortcuts
      // This is a placeholder — the actual dispatch happens there
    },
  },
  {
    id: 'toggleSidebar',
    key: 'b',
    mod: true,
    labelKey: 'shortcuts.toggleSidebar',
    action: (ctx) => {
      ctx.setSidebarVisible(!ctx.sidebarVisible);
    },
  },

  // --- Navigation / Views ---
  {
    id: 'goToChat',
    key: '1',
    mod: true,
    labelKey: 'shortcuts.goToChat',
    action: (ctx) => ctx.setActiveView('chat'),
  },
  {
    id: 'goToMcp',
    key: '2',
    mod: true,
    labelKey: 'shortcuts.goToMcp',
    action: (ctx) => ctx.setActiveView('mcp'),
  },
  {
    id: 'goToSettings',
    key: '3',
    mod: true,
    labelKey: 'shortcuts.goToSettings',
    action: (ctx) => ctx.setActiveView('settings'),
  },

  // --- Workspace & Window ---
  {
    id: 'openFolder',
    key: 'o',
    mod: true,
    labelKey: 'shortcuts.openFolder',
    action: async () => {
      const data = await window.manong.workspace.open();
      if (data) {
        const { useAppStore } = await import('../stores/app');
        useAppStore.getState().setWorkspace(data);
      }
    },
  },
  {
    id: 'closeWindow',
    key: 'w',
    mod: true,
    labelKey: 'shortcuts.closeWindow',
    action: () => {
      window.manong.window.close();
    },
  },

  // --- Appearance ---
  {
    id: 'toggleTheme',
    key: 't',
    mod: true,
    shift: true,
    labelKey: 'shortcuts.toggleTheme',
    action: async () => {
      const { useAppStore } = await import('../stores/app');
      const config = useAppStore.getState().config;
      if (!config) return;
      const newTheme = config.theme === 'dark' ? 'light' : 'dark';
      const updated = { ...config, theme: newTheme };
      await window.manong.config.set(updated);
      useAppStore.getState().setConfig(updated);
    },
  },

  // --- Utility ---
  {
    id: 'copyLastResponse',
    key: 'c',
    mod: true,
    shift: true,
    labelKey: 'shortcuts.copyLastResponse',
    action: () => {
      window.dispatchEvent(new CustomEvent('manong:copy-last-response'));
    },
  },
  {
    id: 'scrollToBottom',
    key: 'ArrowDown',
    mod: true,
    labelKey: 'shortcuts.scrollToBottom',
    action: () => {
      window.dispatchEvent(new CustomEvent('manong:scroll-to-bottom'));
    },
  },

  // --- Permission ---
  {
    id: 'cyclePermissionMode',
    key: 'Tab',
    shift: true,
    labelKey: 'shortcuts.cyclePermissionMode',
    allowInInput: true,
    action: async () => {
      const { useAppStore } = await import('../stores/app');
      const state = useAppStore.getState();
      const modes = ['default', 'acceptEdits', 'bypassPermissions'] as const;
      const currentIdx = modes.indexOf(state.permissionMode);
      const nextMode = modes[(currentIdx + 1) % modes.length];
      state.setPermissionMode(nextMode);
    },
  },
];
