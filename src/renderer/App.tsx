import React, { useEffect, useState } from 'react';
import { TitleBar } from './components/TitleBar';
import { NavigationBar } from './components/NavigationBar';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { WelcomePage } from './components/WelcomePage';
import { SettingsModal } from './components/SettingsModal';
import { useAppStore } from './stores/app';
import { themes, applyTheme } from './themes';
import type { ThemeName } from './themes';

export const App: React.FC = () => {
  const { currentWorkspace, setWorkspace, config, setConfig } = useAppStore();
  const [showSettings, setShowSettings] = useState(false);

  // Apply theme when config changes
  useEffect(() => {
    if (config?.theme) {
      const themeName = config.theme as ThemeName;
      if (themes[themeName]) {
        applyTheme(themes[themeName]);
      }
    }
  }, [config?.theme]);

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
    <div className="h-screen flex flex-col bg-background text-text-primary font-display antialiased">
      <TitleBar />
      <div className="flex flex-1 h-[calc(100vh-2.5rem)] overflow-hidden">
        {currentWorkspace ? (
          <>
            <NavigationBar onOpenSettings={() => setShowSettings(true)} />
            <Sidebar />
            <ChatPanel />
          </>
        ) : (
          <WelcomePage />
        )}
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};
