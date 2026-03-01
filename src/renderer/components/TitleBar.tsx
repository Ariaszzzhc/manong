import React from 'react';
import { FolderOpen } from 'lucide-react';
import { useAppStore } from '../stores/app';

export const TitleBar: React.FC = () => {
  const { currentWorkspace, setWorkspace, isStreaming } = useAppStore();

  const handleSwitchWorkspace = async () => {
    const data = await window.manong.workspace.open();
    if (data) {
      setWorkspace(data);
    }
  };

  return (
    <header className="title-bar h-10 border-b border-border bg-surface-elevated flex items-center justify-between px-4 shrink-0 z-20">
      {/* Left - Traffic lights + AGENT label + folder */}
      <div className="flex items-center gap-3">
        {/* Traffic lights space */}
        <div className="flex gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
          <div className="w-2.5 h-2.5 rounded-full bg-active" />
          <div className="w-2.5 h-2.5 rounded-full bg-active" />
          <div className="w-2.5 h-2.5 rounded-full bg-active" />
        </div>

        {/* AGENT label + folder */}
        <div className="flex items-center text-xs gap-2">
          <span className="font-semibold tracking-tight text-text-primary">
            AGENT
          </span>
          <span className="text-text-secondary">/</span>
          {currentWorkspace ? (
            <button
              onClick={handleSwitchWorkspace}
              className="flex items-center gap-1.5 text-text-secondary hover:text-primary cursor-pointer transition-colors font-mono text-[11px]"
              title="Switch workspace"
            >
              <FolderOpen size={14} strokeWidth={1.5} />
              <span>{currentWorkspace.name}</span>
            </button>
          ) : (
            <button
              onClick={handleSwitchWorkspace}
              className="flex items-center gap-1.5 text-text-secondary hover:text-primary cursor-pointer transition-colors font-mono text-[11px]"
            >
              <FolderOpen size={14} strokeWidth={1.5} />
              <span>Open Folder</span>
            </button>
          )}
        </div>
      </div>

      {/* Right - Status only */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-text-secondary uppercase">
          {isStreaming ? 'Processing' : 'Idle'}
        </span>
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            isStreaming ? 'bg-primary streaming-indicator' : 'bg-green-500'
          }`}
        />
      </div>
    </header>
  );
};
