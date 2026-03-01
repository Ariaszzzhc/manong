import React, { useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { InfoPanel } from './components/InfoPanel';
import { WelcomePage } from './components/WelcomePage';
import { useAppStore } from './stores/app';

export const App: React.FC = () => {
  const { currentWorkspace, setWorkspace, setConfig } = useAppStore();

  useEffect(() => {
    // Load config
    window.manong.config.get().then(setConfig);

    // Try to restore last workspace
    window.manong.workspace.getCurrent().then((data) => {
      if (data) {
        setWorkspace(data);
      }
    });
  }, [setConfig, setWorkspace]);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        {currentWorkspace ? (
          <>
            <Sidebar />
            <ChatPanel />
            <InfoPanel />
          </>
        ) : (
          <WelcomePage />
        )}
      </div>
    </div>
  );
};
