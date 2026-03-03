import React from 'react';
import { Server, Circle, RefreshCw, Settings, Globe, Folder } from 'lucide-react';
import type { MCPServerStatus, MCPConnectionStatus } from '../../shared/mcp-types';

interface MCPStatusPanelProps {
  statuses: MCPServerStatus[];
  onConnect: (name: string) => void;
  onDisconnect: (name: string) => void; // eslint-disable-line @typescript-eslint/no-unused-vars
  onOpenConfig: () => void;
}

const getStatusColor = (status: MCPConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'text-success';
    case 'connecting':
      return 'text-warning';
    case 'error':
      return 'text-error';
    default:
      return 'text-text-secondary';
  }
};

const getStatusBgColor = (status: MCPConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'bg-success/10';
    case 'connecting':
      return 'bg-warning/10';
    case 'error':
      return 'bg-error/10';
    default:
      return 'bg-surface-elevated';
  }
};

export const MCPStatusPanel: React.FC<MCPStatusPanelProps> = ({
  statuses,
  onConnect,
  onDisconnect,
  onOpenConfig,
}) => {
  const connectedCount = statuses.filter((s) => s.status === 'connected').length;

  return (
    <div className="flex flex-col">
      <div className="p-3 border-b border-border flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Server size={14} className="text-text-secondary" strokeWidth={1.5} />
          <span className="text-xs font-medium text-text-primary">MCP Servers</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-secondary font-mono">
            {connectedCount}/{statuses.length}
          </span>
          <button
            onClick={onOpenConfig}
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-hover rounded transition-colors"
            title="Configure MCP"
          >
            <Settings size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="max-h-40 overflow-y-auto">
        {statuses.length === 0 ? (
          <div className="p-3 text-center text-text-secondary text-xs">
            No MCP servers configured
          </div>
        ) : (
          <div className="py-1">
            {statuses.map((server) => (
              <div
                key={server.name}
                className={`flex items-center gap-2 px-3 py-2 hover:bg-hover transition-colors ${getStatusBgColor(
                  server.status
                )}`}
              >
                <Circle
                  size={8}
                  className={`fill-current ${getStatusColor(server.status)}`}
                  strokeWidth={0}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-text-primary truncate">
                      {server.name}
                    </span>
                    {server.source === 'project' ? (
                      <div title="Project config">
                        <Folder size={10} className="text-primary" />
                      </div>
                    ) : (
                      <div title="Global config">
                        <Globe size={10} className="text-text-secondary" />
                      </div>
                    )}
                  </div>
                  {server.error && (
                    <div className="text-[10px] text-error truncate">
                      {server.error}
                    </div>
                  )}
                </div>
                {server.status === 'connected' && (
                  <span className="text-[10px] text-text-secondary font-mono">
                    {server.toolCount} tools
                  </span>
                )}
                {server.status === 'disconnected' && (
                  <button
                    onClick={() => onConnect(server.name)}
                    className="p-1 text-text-secondary hover:text-primary transition-colors"
                    title="Connect"
                  >
                    <RefreshCw size={12} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
