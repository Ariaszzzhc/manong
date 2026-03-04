export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions';

export type ToolRiskLevel = 'read' | 'write' | 'execute';

export const BUILTIN_TOOL_RISK: Record<string, ToolRiskLevel> = {
  read_file: 'read',
  list_dir: 'read',
  search_file: 'read',
  write_file: 'write',
  edit_file: 'write',
  run_shell: 'execute',
  skill: 'read',
  ask: 'read',
  todo: 'read',
};

export const DEFAULT_MCP_TOOL_RISK: ToolRiskLevel = 'execute';

export interface PermissionRule {
  action: 'allow' | 'deny';
  pattern: string;
}

export interface PermissionConfig {
  mode?: PermissionMode;
  rules: PermissionRule[];
}

export const DEFAULT_PERMISSION_CONFIG: PermissionConfig = {
  mode: 'default',
  rules: [],
};

export interface PermissionRequest {
  id: string;
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  riskLevel: ToolRiskLevel;
  description: string;
  diff?: string;
}

export type PermissionDecision = 'allow' | 'deny' | 'always-allow';

export interface LayeredPermissionConfig {
  global: PermissionConfig;
  project: PermissionConfig | null;
  local: PermissionConfig | null;
  merged: PermissionConfig;
}
