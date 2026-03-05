export interface LSPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  extensions: string[];
  rootMarkers?: string[];
  initializationOptions?: Record<string, unknown>;
  enabled?: boolean;
}

export interface LSPConfig {
  lspServers: Record<string, LSPServerConfig>;
}

export type LSPConnectionStatus = 'stopped' | 'starting' | 'running' | 'error';

export type LSPInstallStatus = 'installing' | 'installed' | 'failed' | 'cooldown';

export interface LSPServerStatus {
  name: string;
  status: LSPConnectionStatus;
  root?: string;
  languages: string[];
  error?: string;
  installStatus?: LSPInstallStatus;
  installError?: string;
  installCooldownUntil?: number;
}

export const DEFAULT_LSP_CONFIG: LSPConfig = {
  lspServers: {},
};
