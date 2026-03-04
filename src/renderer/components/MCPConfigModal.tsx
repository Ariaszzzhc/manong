import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, RefreshCw, Globe, Folder, ToggleLeft, ToggleRight } from 'lucide-react';
import type { MCPConfig, MCPServerConfig, MCPServerStatus, LayeredMCPConfig } from '../../shared/mcp-types';
import { useTranslation, tf } from '../i18n';

import type { Translations } from '../i18n/locales/en';

interface MCPConfigContentProps {
  statuses: MCPServerStatus[];
  currentWorkspacePath: string | null;
  onConnect: (name: string) => void;
  onDisconnect: (name: string) => void;
  onRefresh: () => void;
}

interface MCPConfigModalProps extends MCPConfigContentProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ServerFormData {
  name: string;
  command: string;
  args: string;
  env: string;
  transport: 'stdio' | 'http';
  url: string;
  headers: string;
  enabled: boolean;
}

const emptyFormData: ServerFormData = {
  name: '',
  command: 'npx',
  args: '',
  env: '{}',
  transport: 'stdio',
  url: '',
  headers: '{}',
  enabled: true,
};

type TabType = 'merged' | 'global' | 'project';

const useMCPConfig = (loadOnMount: boolean, currentWorkspacePath: string | null, onRefresh: () => void, t: Translations) => {
  const [layeredConfig, setLayeredConfig] = useState<LayeredMCPConfig>({
    global: { mcpServers: {} },
    project: null,
    merged: { mcpServers: {} },
  });
  const [activeTab, setActiveTab] = useState<TabType>('merged');
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [editingScope, setEditingScope] = useState<'global' | 'project'>('global');
  const [formData, setFormData] = useState<ServerFormData>(emptyFormData);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loadOnMount) {
      window.manong.mcp.getLayeredConfig().then(setLayeredConfig);
    }
  }, [loadOnMount]);

  const getActiveConfig = (): MCPConfig => {
    switch (activeTab) {
      case 'global':
        return layeredConfig.global;
      case 'project':
        return layeredConfig.project || { mcpServers: {} };
      default:
        return layeredConfig.merged;
    }
  };

  const resetForm = () => {
    setFormData(emptyFormData);
    setEditingServer(null);
    setEditingScope('global');
    setShowAddForm(false);
  };

  const handleEditServer = (name: string, scope: 'global' | 'project') => {
    const config = scope === 'global' ? layeredConfig.global : layeredConfig.project;
    const serverConfig = config?.mcpServers[name];
    if (!serverConfig) return;

    setEditingServer(name);
    setEditingScope(scope);
    setShowAddForm(true);
    setFormData({
      name,
      command: serverConfig.command || 'npx',
      args: (serverConfig.args || []).join(' '),
      env: JSON.stringify(serverConfig.env || {}, null, 2),
      transport: serverConfig.transport || 'stdio',
      url: serverConfig.url || '',
      headers: JSON.stringify(serverConfig.headers || {}, null, 2),
      enabled: serverConfig.enabled !== false,
    });
  };

  const handleDeleteServer = async (name: string, scope: 'global' | 'project') => {
    const config = scope === 'global' ? { ...layeredConfig.global } : { ...(layeredConfig.project ?? { mcpServers: {} }) };
    delete config.mcpServers[name];

    setSaving(true);
    try {
      if (scope === 'global') {
        await window.manong.mcp.saveGlobalConfig(config);
      } else if (currentWorkspacePath) {
        await window.manong.mcp.saveProjectConfig(config, currentWorkspacePath);
      }
      const newLayeredConfig = await window.manong.mcp.getLayeredConfig();
      setLayeredConfig(newLayeredConfig);
      onRefresh();
    } catch (error) {
      console.error('Failed to delete server:', error);
    }
    setSaving(false);
  };

  const handleToggleServer = async (name: string, scope: 'global' | 'project') => {
    if (scope !== 'project' || !currentWorkspacePath) return;

    const projectConfig = layeredConfig.project || { mcpServers: {} };
    const globalConfig = layeredConfig.global.mcpServers[name];

    if (!globalConfig) return;

    const isCurrentlyDisabled = projectConfig.mcpServers[name]?.enabled === false;
    const newProjectConfig: MCPConfig = {
      mcpServers: {
        ...projectConfig.mcpServers,
        [name]: {
          enabled: isCurrentlyDisabled ? true : false,
        },
      },
    };

    setSaving(true);
    try {
      await window.manong.mcp.saveProjectConfig(newProjectConfig, currentWorkspacePath);
      const newLayeredConfig = await window.manong.mcp.getLayeredConfig();
      setLayeredConfig(newLayeredConfig);
      onRefresh();
    } catch (error) {
      console.error('Failed to toggle server:', error);
    }
    setSaving(false);
  };

  const handleSaveServer = async () => {
    const serverConfig: MCPServerConfig = {
      command: formData.command || undefined,
      args: formData.args ? formData.args.split(' ').filter(Boolean) : undefined,
      env: formData.env ? JSON.parse(formData.env) : undefined,
      transport: formData.transport,
      url: formData.url || undefined,
      headers: formData.headers ? JSON.parse(formData.headers) : undefined,
      enabled: editingScope === 'project' && !formData.enabled ? false : undefined,
    };

    if (formData.transport === 'http' && !formData.url) {
      alert(t['mcp.config.urlRequired']);
      return;
    }

    if (formData.transport === 'stdio' && !formData.command) {
      alert(t['mcp.config.commandRequired']);
      return;
    }

    const serverName = editingServer || formData.name;
    if (!serverName.trim()) {
      alert(t['mcp.config.nameRequired']);
      return;
    }

    setSaving(true);
    try {
      if (editingScope === 'global') {
        const newConfig: MCPConfig = {
          ...layeredConfig.global,
          mcpServers: {
            ...layeredConfig.global.mcpServers,
            [serverName]: serverConfig,
          },
        };
        if (editingServer && editingServer !== formData.name) {
          delete newConfig.mcpServers[editingServer];
        }
        await window.manong.mcp.saveGlobalConfig(newConfig);
      } else if (currentWorkspacePath) {
        const projectConfig = layeredConfig.project || { mcpServers: {} };
        const newConfig: MCPConfig = {
          ...projectConfig,
          mcpServers: {
            ...projectConfig.mcpServers,
            [serverName]: serverConfig,
          },
        };
        if (editingServer && editingServer !== formData.name) {
          delete newConfig.mcpServers[editingServer];
        }
        await window.manong.mcp.saveProjectConfig(newConfig, currentWorkspacePath);
      }

      const newLayeredConfig = await window.manong.mcp.getLayeredConfig();
      setLayeredConfig(newLayeredConfig);
      resetForm();
      onRefresh();
    } catch (error) {
      console.error('Failed to save server:', error);
      alert(t['mcp.config.saveFailed']);
    }
    setSaving(false);
  };

  const isServerDisabled = (name: string): boolean => {
    return layeredConfig.project?.mcpServers[name]?.enabled === false;
  };

  return {
    layeredConfig, activeTab, setActiveTab, editingServer, editingScope, setEditingScope,
    formData, setFormData, showAddForm, setShowAddForm, saving,
    getActiveConfig, resetForm, handleEditServer, handleDeleteServer, handleToggleServer,
    handleSaveServer, isServerDisabled,
  };
};

const MCPConfigInner: React.FC<MCPConfigContentProps & { hook: ReturnType<typeof useMCPConfig> }> = ({
  statuses, currentWorkspacePath, onConnect, onDisconnect, hook,
}) => {
  const {
    layeredConfig, activeTab, setActiveTab, editingServer, editingScope, setEditingScope,
    formData, setFormData, showAddForm, setShowAddForm, saving,
    getActiveConfig, resetForm, handleEditServer, handleDeleteServer, handleToggleServer,
    handleSaveServer, isServerDisabled,
  } = hook;
  const t = useTranslation();

  const getStatusBadge = (name: string) => {
    const status = statuses.find((s) => s.name === name);
    if (!status) return null;

    const colorClass =
      status.status === 'connected'
        ? 'bg-success/20 text-success'
        : status.status === 'connecting'
        ? 'bg-warning/20 text-warning'
        : status.status === 'error'
        ? 'bg-error/20 text-error'
        : 'bg-surface-elevated text-text-secondary';

    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full ${colorClass}`}>
        {status.status}
      </span>
    );
  };

  const activeConfig = getActiveConfig();
  const hasProject = !!currentWorkspacePath;

  return (
    <>
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => { setActiveTab('merged'); resetForm(); }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'merged'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {t['mcp.config.allServers']}
        </button>
        <button
          onClick={() => { setActiveTab('global'); resetForm(); }}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
            activeTab === 'global'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Globe size={14} />
          {t['mcp.config.global']}
        </button>
        <button
          onClick={() => { setActiveTab('project'); resetForm(); }}
          disabled={!hasProject}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
            activeTab === 'project'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-secondary hover:text-text-primary'
          } ${!hasProject ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Folder size={14} />
          {t['mcp.config.project']}
          {!hasProject && <span className="text-[10px]">{t['mcp.config.noWorkspace']}</span>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">
              {tf(t['mcp.config.serversConfigured'], { count: Object.keys(activeConfig.mcpServers).length })}
              {activeTab === 'project' && !layeredConfig.project && t['mcp.config.noProjectConfig']}
            </span>
            {!showAddForm && activeTab !== 'merged' && (
              <button
                onClick={() => {
                  resetForm();
                  setEditingScope(activeTab === 'global' ? 'global' : 'project');
                  setShowAddForm(true);
                }}
                disabled={activeTab === 'project' && !hasProject}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary hover:bg-primary-hover text-on-primary rounded transition-colors disabled:opacity-50"
              >
                <Plus size={14} strokeWidth={1.5} />
                {t['mcp.config.addServer']}
              </button>
            )}
          </div>

          {showAddForm && (
            <div className="bg-surface-elevated rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
                  {editingServer ? t['mcp.config.editServer'] : t['mcp.config.addNewServer']}
                  {editingScope === 'global' ? (
                    <Globe size={12} className="text-text-secondary" />
                  ) : (
                    <Folder size={12} className="text-primary" />
                  )}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-text-secondary hover:text-text-primary"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      {t['mcp.config.serverName']}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="my-server"
                      disabled={!!editingServer}
                      className="w-full bg-surface text-text-primary rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      {t['mcp.config.transport']}
                    </label>
                    <select
                      value={formData.transport}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          transport: e.target.value as 'stdio' | 'http',
                        })
                      }
                      className="w-full bg-surface text-text-primary rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border"
                    >
                      <option value="stdio">{t['mcp.config.stdio']}</option>
                      <option value="http">{t['mcp.config.httpSse']}</option>
                    </select>
                  </div>
                </div>

                {formData.transport === 'stdio' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">
                          {t['mcp.config.command']}
                        </label>
                        <input
                          type="text"
                          value={formData.command}
                          onChange={(e) =>
                            setFormData({ ...formData, command: e.target.value })
                          }
                          placeholder="npx"
                          className="w-full bg-surface text-text-primary rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">
                          {t['mcp.config.arguments']}
                        </label>
                        <input
                          type="text"
                          value={formData.args}
                          onChange={(e) =>
                            setFormData({ ...formData, args: e.target.value })
                          }
                          placeholder="-y @anthropic/mcp-server-filesystem"
                          className="w-full bg-surface text-text-primary rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        {t['mcp.config.envVars']}
                      </label>
                      <textarea
                        value={formData.env}
                        onChange={(e) =>
                          setFormData({ ...formData, env: e.target.value })
                        }
                        placeholder='{"API_KEY": "xxx"}'
                        rows={2}
                        className="w-full bg-surface text-text-primary rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border font-mono"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        {t['mcp.config.url']}
                      </label>
                      <input
                        type="text"
                        value={formData.url}
                        onChange={(e) =>
                          setFormData({ ...formData, url: e.target.value })
                        }
                        placeholder="http://localhost:3000/mcp"
                        className="w-full bg-surface text-text-primary rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        {t['mcp.config.headers']}
                      </label>
                      <textarea
                        value={formData.headers}
                        onChange={(e) =>
                          setFormData({ ...formData, headers: e.target.value })
                        }
                        placeholder='{"Authorization": "Bearer token"}'
                        rows={2}
                        className="w-full bg-surface text-text-primary rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-border font-mono"
                      />
                    </div>
                  </>
                )}

                {editingScope === 'project' && editingServer && layeredConfig.global.mcpServers[editingServer] && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="rounded border-border"
                    />
                    <label htmlFor="enabled" className="text-xs text-text-secondary">
                      {t['mcp.config.enableServer']}
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={resetForm}
                    className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {t['mcp.config.cancel']}
                  </button>
                  <button
                    onClick={handleSaveServer}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-on-primary rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <Save size={14} strokeWidth={1.5} />
                    {saving ? t['mcp.config.saving'] : t['mcp.config.save']}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {Object.entries(activeConfig.mcpServers).map(([name, serverConfig]) => {
              const status = statuses.find((s) => s.name === name);
              const source = layeredConfig.project?.mcpServers[name] ? 'project' : 'global';
              const isDisabled = isServerDisabled(name);
              const isInheritedGlobal = activeTab === 'project' && layeredConfig.global.mcpServers[name];

              return (
                <div
                  key={name}
                  className={`flex items-center gap-3 p-3 bg-surface-elevated rounded-lg border border-border ${
                    isDisabled ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {name}
                      </span>
                      {getStatusBadge(name)}
                      {source === 'project' ? (
                        <div title={t['mcp.config.projectConfig']}>
                          <Folder size={12} className="text-primary" />
                        </div>
                      ) : (
                        <div title={t['mcp.config.globalConfig']}>
                          <Globe size={12} className="text-text-secondary" />
                        </div>
                      )}
                      {isDisabled && (
                        <span className="text-[10px] text-error">{t['mcp.config.disabled']}</span>
                      )}
                    </div>
                    <div className="text-xs text-text-secondary truncate mt-0.5">
                      {serverConfig.transport === 'http'
                        ? serverConfig.url
                        : `${serverConfig.command || 'npx'} ${(serverConfig.args || []).join(' ')}`}
                    </div>
                    {status?.status === 'connected' && !isDisabled && (
                      <div className="text-xs text-success mt-0.5">
                        {tf(t['mcp.config.toolsAvailable'], { count: status.toolCount })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!isDisabled && status?.status === 'connected' ? (
                      <button
                        onClick={() => onDisconnect(name)}
                        className="px-2 py-1 text-xs text-warning hover:bg-warning/20 rounded transition-colors"
                      >
                        {t['mcp.config.disconnect']}
                      </button>
                    ) : !isDisabled && status?.status === 'disconnected' ? (
                      <button
                        onClick={() => onConnect(name)}
                        className="px-2 py-1 text-xs text-success hover:bg-success/20 rounded transition-colors flex items-center gap-1"
                      >
                        <RefreshCw size={12} strokeWidth={1.5} />
                        {t['mcp.config.connect']}
                      </button>
                    ) : isDisabled ? null : (
                      <span className="text-xs text-text-secondary">
                        {status?.status}
                      </span>
                    )}
                    {activeTab !== 'merged' && (
                      <>
                        <button
                          onClick={() => handleEditServer(name, activeTab === 'global' ? 'global' : 'project')}
                          className="p-1 text-text-secondary hover:text-text-primary hover:bg-hover rounded transition-colors"
                        >
                          <span className="text-xs">{t['mcp.config.edit']}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteServer(name, activeTab === 'global' ? 'global' : 'project')}
                          className="p-1 text-text-secondary hover:text-error hover:bg-error/10 rounded transition-colors"
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      </>
                    )}
                    {activeTab === 'project' && isInheritedGlobal && (
                      <button
                        onClick={() => handleToggleServer(name, 'project')}
                        className="p-1 text-text-secondary hover:text-primary transition-colors"
                        title={isDisabled ? t['mcp.config.enableServerTitle'] : t['mcp.config.disableServerTitle']}
                      >
                        {isDisabled ? (
                          <ToggleLeft size={16} strokeWidth={1.5} />
                        ) : (
                          <ToggleRight size={16} className="text-success" strokeWidth={1.5} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export const MCPConfigView: React.FC<MCPConfigContentProps> = (props) => {
  const t = useTranslation();
  const hook = useMCPConfig(true, props.currentWorkspacePath, props.onRefresh, t);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary">
          {t['mcp.config.title']}
        </h2>
      </div>
      <MCPConfigInner {...props} hook={hook} />
    </div>
  );
};

export const MCPConfigModal: React.FC<MCPConfigModalProps> = ({
  isOpen,
  onClose,
  ...contentProps
}) => {
  const t = useTranslation();
  const hook = useMCPConfig(isOpen, contentProps.currentWorkspacePath, contentProps.onRefresh, t);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">
            {t['mcp.config.title']}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <MCPConfigInner {...contentProps} hook={hook} />

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {t['mcp.config.close']}
          </button>
        </div>
      </div>
    </div>
  );
};
