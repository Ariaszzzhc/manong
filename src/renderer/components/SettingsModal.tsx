import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useAppStore } from '../stores/app';
import type { AppConfig } from '../../shared/types';
import { useTranslation, SUPPORTED_LOCALES } from '../i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const useSettingsForm = () => {
  const { config, setConfig } = useAppStore();
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('claude-sonnet-4-20250514');
  const [baseURL, setBaseURL] = useState('https://api.anthropic.com');
  const [enableThinking, setEnableThinking] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [language, setLanguage] = useState('en');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      if (config.providers.length > 0) {
        setApiKey(config.providers[0].apiKey);
        setModelName(config.providers[0].model);
        setBaseURL(config.providers[0].baseURL);
        setEnableThinking(config.providers[0].enableThinking ?? false);
      }
      setTheme(config.theme);
      setLanguage(config.language ?? 'en');
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
      language,
    };
    await window.manong.config.set(newConfig);
    setConfig(newConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return { apiKey, setApiKey, modelName, setModelName, baseURL, setBaseURL, enableThinking, setEnableThinking, theme, setTheme, language, setLanguage, handleSaveConfig, saved };
};

const SettingsFormContent: React.FC<{ onSave: () => void; saved: boolean; apiKey: string; setApiKey: (v: string) => void; modelName: string; setModelName: (v: string) => void; baseURL: string; setBaseURL: (v: string) => void; enableThinking: boolean; setEnableThinking: (v: boolean) => void; theme: 'light' | 'dark'; setTheme: (v: 'light' | 'dark') => void; language: string; setLanguage: (v: string) => void }> = ({
  onSave, saved, apiKey, setApiKey, modelName, setModelName, baseURL, setBaseURL, enableThinking, setEnableThinking, theme, setTheme, language, setLanguage,
}) => {
  const t = useTranslation();
  return (
  <>
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-text-secondary mb-1">
          {t['settings.apiKey']}
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
          {t['settings.baseURL']}
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
          {t['settings.model']}
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
          {t['settings.enableThinking']}
        </label>
      </div>

      <div>
        <label className="block text-sm text-text-secondary mb-1">
          {t['settings.theme']}
        </label>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
          className="w-full bg-surface-elevated text-text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border"
        >
          <option value="dark">{t['settings.themeDark']}</option>
          <option value="light">{t['settings.themeLight']}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm text-text-secondary mb-1">
          {t['settings.language']}
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full bg-surface-elevated text-text-primary rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border"
        >
          {Object.entries(SUPPORTED_LOCALES).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </div>
    </div>

    <div className="flex justify-end gap-2 mt-6">
      <button
        onClick={onSave}
        className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded transition-colors flex items-center gap-2"
      >
        <Check size={16} strokeWidth={1.5} />
        {saved ? t['settings.saved'] : t['settings.save']}
      </button>
    </div>
  </>
);
};

export const SettingsView: React.FC = () => {
  const form = useSettingsForm();
  const t = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-md mx-auto">
        <h2 className="text-lg font-semibold text-text-primary mb-4">{t['settings.title']}</h2>
        <SettingsFormContent {...form} onSave={form.handleSaveConfig} />
      </div>
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const form = useSettingsForm();
  const t = useTranslation();

  const handleSave = async () => {
    await form.handleSaveConfig();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">{t['settings.title']}</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <SettingsFormContent
          {...form}
          onSave={handleSave}
        />

        <div className="flex justify-end mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {t['settings.cancel']}
          </button>
        </div>
      </div>
    </div>
  );
};
