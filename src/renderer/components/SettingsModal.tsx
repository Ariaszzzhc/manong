import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useAppStore } from '../stores/app';
import type { AppConfig } from '../../shared/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { config, setConfig } = useAppStore();
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('claude-sonnet-4-20250514');
  const [baseURL, setBaseURL] = useState('https://api.anthropic.com');
  const [enableThinking, setEnableThinking] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (config) {
      if (config.providers.length > 0) {
        setApiKey(config.providers[0].apiKey);
        setModelName(config.providers[0].model);
        setBaseURL(config.providers[0].baseURL);
        setEnableThinking(config.providers[0].enableThinking ?? false);
      }
      setTheme(config.theme);
    }
  }, [config]);

  const handleSaveConfig = async () => {
    const newConfig: AppConfig = {
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
      theme,
    };
    await window.manong.config.set(newConfig);
    setConfig(newConfig);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-surface-elevated text-text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Base URL
            </label>
            <input
              type="text"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://api.anthropic.com"
              className="w-full bg-surface-elevated text-text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Model
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="claude-sonnet-4-20250514"
              className="w-full bg-surface-elevated text-text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableThinking"
              checked={enableThinking}
              onChange={(e) => setEnableThinking(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-surface-elevated text-primary focus:ring-primary"
            />
            <label htmlFor="enableThinking" className="text-sm text-text-secondary">
              Enable Thinking (for models like GLM-4.7)
            </label>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Theme
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
              className="w-full bg-surface-elevated text-text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveConfig}
            className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded transition-colors flex items-center gap-2"
          >
            <Check size={16} strokeWidth={1.5} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
