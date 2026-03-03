import React from 'react';
import { MessageSquare, Settings, Server } from 'lucide-react';
import { useTranslation } from '../i18n';

export type ActiveView = 'chat' | 'mcp' | 'settings';

interface NavigationBarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({ activeView, onViewChange }) => {
  const t = useTranslation();
  return (
    <nav className="w-12 bg-surface border-r border-border flex flex-col items-center py-4 shrink-0">
      {/* Chat */}
      <button
        onClick={() => onViewChange('chat')}
        className={`w-9 h-9 mb-2 flex items-center justify-center relative group rounded-lg transition-all ${
          activeView === 'chat'
            ? 'text-text-primary bg-surface-elevated shadow-sm border border-border'
            : 'text-text-secondary hover:text-text-primary hover:bg-hover border border-transparent'
        }`}
        title={t['nav.chat']}
      >
        <MessageSquare size={18} strokeWidth={1.5} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* MCP Servers */}
      <button
        onClick={() => onViewChange('mcp')}
        className={`w-9 h-9 mb-2 flex items-center justify-center relative group rounded-lg transition-all ${
          activeView === 'mcp'
            ? 'text-text-primary bg-surface-elevated shadow-sm border border-border'
            : 'text-text-secondary hover:text-text-primary hover:bg-hover border border-transparent'
        }`}
        title={t['nav.mcpServers']}
      >
        <Server size={18} strokeWidth={1.5} />
      </button>

      {/* Settings */}
      <button
        onClick={() => onViewChange('settings')}
        className={`w-9 h-9 flex items-center justify-center relative group rounded-lg transition-all ${
          activeView === 'settings'
            ? 'text-text-primary bg-surface-elevated shadow-sm border border-border'
            : 'text-text-secondary hover:text-text-primary hover:bg-hover border border-transparent'
        }`}
        title={t['nav.settings']}
      >
        <Settings size={18} strokeWidth={1.5} />
      </button>
    </nav>
  );
};
