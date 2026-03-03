import React from 'react';
import { MessageSquare, Settings, Server } from 'lucide-react';

export type ActiveView = 'chat' | 'mcp' | 'settings';

interface NavigationBarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({ activeView, onViewChange }) => {
  return (
    <nav className="w-12 bg-surface-elevated border-r border-border flex flex-col items-center py-3 shrink-0">
      {/* Chat */}
      <button
        onClick={() => onViewChange('chat')}
        className={`w-8 h-8 mb-3 flex items-center justify-center relative group rounded-md transition-colors ${
          activeView === 'chat'
            ? 'text-primary bg-transparent hover:bg-hover'
            : 'text-text-secondary hover:text-text-primary hover:bg-hover'
        }`}
        title="Chat"
      >
        <MessageSquare size={20} strokeWidth={1.5} />
        {activeView === 'chat' && (
          <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-full" />
        )}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* MCP Servers */}
      <button
        onClick={() => onViewChange('mcp')}
        className={`w-8 h-8 mb-3 flex items-center justify-center relative group rounded-md transition-colors ${
          activeView === 'mcp'
            ? 'text-primary bg-transparent hover:bg-hover'
            : 'text-text-secondary hover:text-text-primary hover:bg-hover'
        }`}
        title="MCP Servers"
      >
        <Server size={20} strokeWidth={1.5} />
        {activeView === 'mcp' && (
          <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-full" />
        )}
      </button>

      {/* Settings */}
      <button
        onClick={() => onViewChange('settings')}
        className={`w-8 h-8 flex items-center justify-center relative group rounded-md transition-colors ${
          activeView === 'settings'
            ? 'text-primary bg-transparent hover:bg-hover'
            : 'text-text-secondary hover:text-text-primary hover:bg-hover'
        }`}
        title="Settings"
      >
        <Settings size={20} strokeWidth={1.5} />
        {activeView === 'settings' && (
          <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-full" />
        )}
      </button>
    </nav>
  );
};
