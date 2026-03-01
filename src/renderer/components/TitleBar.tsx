import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/app';

export const TitleBar: React.FC = () => {
  const { config, setConfig, currentWorkspace, setWorkspace } = useAppStore();
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('claude-sonnet-4-20250514');
  const [baseURL, setBaseURL] = useState('https://api.anthropic.com');
  const [enableThinking, setEnableThinking] = useState(false);

  useEffect(() => {
    if (config && config.providers.length > 0) {
      setApiKey(config.providers[0].apiKey);
      setModelName(config.providers[0].model);
      setBaseURL(config.providers[0].baseURL);
      setEnableThinking(config.providers[0].enableThinking ?? false);
    }
  }, [config]);

  const handleSaveConfig = async () => {
    const newConfig = {
      ...config,
      providers: [
        {
          type: 'anthropic-compatible' as const,
          name: 'claude',
          apiKey,
          model: modelName,
          baseURL,
          enableThinking,
        },
      ],
      defaultProvider: 'claude',
    };
    await window.manong.config.set(newConfig);
    setConfig(newConfig);
    setShowSettings(false);
  };

  const handleSwitchWorkspace = async () => {
    const data = await window.manong.workspace.open();
    if (data) {
      setWorkspace(data);
    }
  };

  return (
    <>
      <div className="title-bar h-10 bg-zinc-900 flex items-center border-b border-zinc-800 relative">
        {/* Left - Space for macOS traffic lights */}
        <div className="absolute left-4 top-0 bottom-0 flex items-center">
          {/* Traffic light space */}
        </div>

        {/* Center - Workspace name or App name */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-zinc-300 font-semibold">Manong</span>
          {currentWorkspace && (
            <>
              <span className="text-zinc-600">/</span>
              <button
                onClick={handleSwitchWorkspace}
                className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Switch workspace"
              >
                <svg
                  className="w-4 h-4"
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
                <span className="text-sm">{currentWorkspace.name}</span>
              </button>
            </>
          )}
        </div>

        {/* Right - Settings */}
        <div className="absolute right-4 top-0 bottom-0 flex items-center">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-zinc-800 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Base URL
                </label>
                <input
                  type="text"
                  value={baseURL}
                  onChange={(e) => setBaseURL(e.target.value)}
                  placeholder="https://api.anthropic.com"
                  className="w-full bg-zinc-800 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="claude-sonnet-4-20250514"
                  className="w-full bg-zinc-800 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableThinking"
                  checked={enableThinking}
                  onChange={(e) => setEnableThinking(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-600 focus:ring-2 focus:ring-zinc-600"
                />
                <label htmlFor="enableThinking" className="text-sm text-zinc-400">
                  Enable Thinking (for models like GLM-4.7)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
