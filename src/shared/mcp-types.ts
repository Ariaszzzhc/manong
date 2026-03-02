export type MCPTransportType = 'stdio' | 'http';

export interface MCPServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: MCPTransportType;
  url?: string;
  headers?: Record<string, string>;
  enabled?: boolean; // Allows disabling inherited servers in project config
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Source of the server configuration
export type MCPServerSource = 'global' | 'project';

export interface MCPServerStatus {
  name: string;
  status: MCPConnectionStatus;
  toolCount: number;
  error?: string;
  source: MCPServerSource; // Where this server config comes from
}

// Layered configuration structure for global/project separation
export interface LayeredMCPConfig {
  global: MCPConfig;
  project: MCPConfig | null;
  merged: MCPConfig;
}

export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPPromptInfo {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPResourceInfo {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: { listChanged?: boolean };
    prompts?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export const DEFAULT_MCP_CONFIG: MCPConfig = {
  mcpServers: {},
};

export interface MCPToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
