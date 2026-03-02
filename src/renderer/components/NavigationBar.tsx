import React from 'react';
import { MessageSquare, FolderOpen, Link2, Bug, Settings, Server } from 'lucide-react';

interface NavigationBarProps {
  onOpenSettings?: () => void;
  onOpenMCPConfig?: () => void;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({ onOpenSettings, onOpenMCPConfig }) => {
  const navItems = [
    { icon: MessageSquare, label: 'Chat', active: true },
    { icon: FolderOpen, label: 'Files' },
    { icon: Link2, label: 'Connections' },
    { icon: Bug, label: 'Debug' },
  ];

  return (
    <nav className="w-12 bg-surface-elevated border-r border-border flex flex-col items-center py-3 shrink-0">
      {navItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={index}
            className={`w-8 h-8 mb-3 flex items-center justify-center relative group rounded-md transition-colors ${
              item.active
                ? 'text-primary bg-transparent hover:bg-hover'
                : 'text-text-secondary hover:text-text-primary hover:bg-hover'
            }`}
            title={item.label}
          >
            <Icon size={20} strokeWidth={1.5} />
            {item.active && (
              <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-full" />
            )}
          </button>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* MCP Servers */}
      <button
        onClick={onOpenMCPConfig}
        className="w-8 h-8 mb-3 flex items-center justify-center text-text-secondary hover:text-text-primary relative group rounded-md hover:bg-hover transition-colors"
        title="MCP Servers"
      >
        <Server size={20} strokeWidth={1.5} />
      </button>

      {/* Settings at bottom */}
      <button
        onClick={onOpenSettings}
        className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary relative group rounded-md hover:bg-hover transition-colors"
        title="Settings"
      >
        <Settings size={20} strokeWidth={1.5} />
      </button>
    </nav>
  );
};
