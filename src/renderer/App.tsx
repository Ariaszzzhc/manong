import React, { useEffect, useState, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { NavigationBar } from './components/NavigationBar';
import type { ActiveView } from './components/NavigationBar';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { WelcomePage } from './components/WelcomePage';
import { SettingsView } from './components/SettingsModal';
import { MCPConfigView } from './components/MCPConfigModal';
import { useAppStore } from './stores/app';
import { themes, applyTheme } from './themes';
import type { ThemeName } from './themes';
import { detectLocale } from './i18n';

export const App: React.FC = () => {
  const { currentWorkspace, currentWorkspacePath, setWorkspace, config, setConfig, loadSkills, mcpStatuses, setMCPStatuses, setTodos, currentSessionId } = useAppStore();
  const [activeView, setActiveView] = useState<ActiveView>('chat');

  useEffect(() => {
    if (config?.theme) {
      const themeName = config.theme as ThemeName;
      if (themes[themeName]) {
        applyTheme(themes[themeName]);
      }
    }
  }, [config?.theme]);

  // Initialization effect - runs once on mount
  useEffect(() => {
    window.manong.config.get().then((loadedConfig) => {
      if (loadedConfig && loadedConfig.language === undefined) {
        const detected = detectLocale();
        const withLang = { ...loadedConfig, language: detected };
        window.manong.config.set(withLang);
        setConfig(withLang);
      } else {
        setConfig(loadedConfig);
      }
    });

    window.manong.workspace.getCurrent().then((data) => {
      if (data) {
        setWorkspace(data);
        loadSkills();
      }
    });

    const unsubscribe = window.manong.mcp.onStatusChanged((statuses) => {
      setMCPStatuses(statuses);
    });

    window.manong.mcp.getStatus().then(setMCPStatuses);

    return () => {
      unsubscribe();
    };
  }, []);

  // Todo listener - resubscribes when currentSessionId changes
  useEffect(() => {
    const unsubscribeTodo = window.manong.todo.onUpdate((data) => {
      if (data.sessionId === useAppStore.getState().currentSessionId) {
        setTodos(data.todos);
      }
    });

    return () => {
      unsubscribeTodo();
    };
  }, [currentSessionId, setTodos]);

  const handleMCPConnect = useCallback(async (name: string) => {
    try {
      await window.manong.mcp.connect(name);
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
    }
  }, []);

  const handleMCPDisconnect = useCallback(async (name: string) => {
    try {
      await window.manong.mcp.disconnect(name);
    } catch (error) {
      console.error('Failed to disconnect from MCP server:', error);
    }
  }, []);

  const handleMCPRefresh = useCallback(() => {
    window.manong.mcp.getStatus().then(setMCPStatuses);
  }, [setMCPStatuses]);

  const renderMainContent = () => {
    switch (activeView) {
      case 'mcp':
        return (
          <MCPConfigView
            statuses={mcpStatuses}
            currentWorkspacePath={currentWorkspacePath}
            onConnect={handleMCPConnect}
            onDisconnect={handleMCPDisconnect}
            onRefresh={handleMCPRefresh}
          />
        );
      case 'settings':
        return <SettingsView />;
      case 'chat':
      default:
        return (
          <>
            <Sidebar />
            <ChatPanel />
          </>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background text-text-primary font-display antialiased">
      <TitleBar />
      <div className="flex flex-1 h-[calc(100vh-2.5rem)] overflow-hidden">
        {currentWorkspace ? (
          <>
            <NavigationBar
              activeView={activeView}
              onViewChange={setActiveView}
            />
            {renderMainContent()}
          </>
        ) : (
          <WelcomePage />
        )}
      </div>
    </div>
  );
};
