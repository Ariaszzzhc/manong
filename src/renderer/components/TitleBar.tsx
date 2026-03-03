import React from 'react';
import { FolderOpen, Minus, Square, X } from 'lucide-react';
import { useAppStore } from '../stores/app';
import { useTranslation } from '../i18n';

const isMac = window.manong.platform === 'darwin';

export const TitleBar: React.FC = () => {
  const { currentWorkspace, setWorkspace } = useAppStore();
  const t = useTranslation();

  const handleSwitchWorkspace = async () => {
    const data = await window.manong.workspace.open();
    if (data) {
      setWorkspace(data);
    }
  };

  return (
    <header className="title-bar h-10 border-b border-border bg-surface-elevated flex items-center justify-between px-4 shrink-0 z-20">
      {/* Left - Traffic light spacer (macOS) + AGENT label + folder */}
      <div className="flex items-center gap-3">
        {/* macOS: spacer for native traffic lights */}
        {isMac && <div className="w-14" />}

        {/* AGENT label + folder */}
        <div className="flex items-center text-xs gap-2">
          <span className="font-semibold tracking-tight text-text-primary">
            {t['titlebar.agent']}
          </span>
          <span className="text-text-secondary">/</span>
          {currentWorkspace ? (
            <button
              onClick={handleSwitchWorkspace}
              className="flex items-center gap-1.5 text-text-secondary hover:text-primary cursor-pointer transition-colors font-mono text-[11px]"
              title={t['titlebar.switchWorkspace']}
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
              <span>{t['titlebar.openFolder']}</span>
            </button>
          )}
        </div>
      </div>

      {/* Right - Window controls (Windows/Linux) */}
      <div className="flex items-center gap-2">
        {/* Windows/Linux window controls */}
        {!isMac && (
          <div className="flex items-center ml-3">
            <button
              onClick={() => window.manong.window.minimize()}
              className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-hover transition-colors"
              title={t['titlebar.minimize']}
            >
              <Minus size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => window.manong.window.maximize()}
              className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-hover transition-colors"
              title={t['titlebar.maximize']}
            >
              <Square size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => window.manong.window.close()}
              className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-error/20 transition-colors"
              title={t['titlebar.close']}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
