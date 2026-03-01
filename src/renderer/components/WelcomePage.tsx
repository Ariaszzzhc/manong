import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/app';
import type { Workspace } from '../../shared/types';

export const WelcomePage: React.FC = () => {
  const { setWorkspace } = useAppStore();
  const [recentWorkspaces, setRecentWorkspaces] = useState<Workspace[]>([]);

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
    <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-2">Manong</h1>
        <p className="text-zinc-400 mb-8">AI Coding Assistant</p>

        <button
          onClick={handleOpenFolder}
          className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2 mb-6"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          Open Folder
        </button>

        {recentWorkspaces.length > 0 && (
          <div className="text-left">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase mb-3">
              Recent
            </h2>
            <div className="space-y-1">
              {recentWorkspaces.map((workspace) => (
                <button
                  key={workspace.path}
                  onClick={() => handleOpenRecent(workspace.path)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-left"
                >
                  <svg
                    className="w-5 h-5 text-zinc-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {workspace.name}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
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
