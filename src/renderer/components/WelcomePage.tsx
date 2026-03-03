import React, { useEffect, useState } from 'react';
import { FolderOpen, Clock } from 'lucide-react';
import { useAppStore } from '../stores/app';
import type { Workspace } from '../../shared/types';
import { useTranslation } from '../i18n';

export const WelcomePage: React.FC = () => {
  const { setWorkspace } = useAppStore();
  const [recentWorkspaces, setRecentWorkspaces] = useState<Workspace[]>([]);
  const t = useTranslation();

  useEffect(() => {
    window.manong.workspace.getRecent().then(setRecentWorkspaces);
  }, []);

  const handleOpenFolder = async () => {
    const data = await window.manong.workspace.open();
    if (data) {
      setWorkspace(data);
    }
  };

  const handleOpenRecent = async (path: string) => {
    const data = await window.manong.workspace.openPath(path);
    if (data) {
      setWorkspace(data);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-background text-text-primary">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-2 text-text-primary">{t['welcome.title']}</h1>
        <p className="text-text-secondary mb-8">{t['welcome.subtitle']}</p>

        <button
          onClick={handleOpenFolder}
          className="w-full py-3 px-6 bg-primary hover:bg-primary-hover rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2 mb-6"
        >
          <FolderOpen size={20} strokeWidth={1.5} />
          {t['welcome.openFolder']}
        </button>

        {recentWorkspaces.length > 0 && (
          <div className="text-left">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              {t['welcome.recent']}
            </h2>
            <div className="space-y-1">
              {recentWorkspaces.map((workspace) => (
                <button
                  key={workspace.path}
                  onClick={() => handleOpenRecent(workspace.path)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface transition-colors text-left border border-transparent hover:border-border"
                >
                  <Clock size={18} className="text-text-secondary" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-text-primary">
                      {workspace.name}
                    </div>
                    <div className="text-xs text-text-secondary truncate font-mono">
                      {workspace.path}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
