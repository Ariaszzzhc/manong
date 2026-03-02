// IPC channel constants shared between main and renderer

export const IPC_CHANNELS = {
  // Agent streams
  AGENT_START: 'agent:start',
  AGENT_STOP: 'agent:stop',
  AGENT_STREAM: 'agent:stream',

  // Workspace management
  WORKSPACE_OPEN: 'workspace:open',
  WORKSPACE_OPEN_PATH: 'workspace:open-path',
  WORKSPACE_GET_CURRENT: 'workspace:get-current',
  WORKSPACE_GET_RECENT: 'workspace:get-recent',
  WORKSPACE_REMOVE_RECENT: 'workspace:remove-recent',

  // Session management
  SESSION_CREATE: 'session:create',
  SESSION_LIST: 'session:list',
  SESSION_GET: 'session:get',
  SESSION_DELETE: 'session:delete',
  SESSION_UPDATE: 'session:update',

  // File system
  FS_OPEN_FOLDER: 'fs:openFolder',
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',
  FS_LIST_DIR: 'fs:listDir',

  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',

  // Window controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // Skills
  SKILL_LIST: 'skill:list',
  SKILL_GET: 'skill:get',
  SKILL_EXECUTE: 'skill:execute',

  // Questions (ask tool)
  QUESTION_ASK: 'question:ask',
  QUESTION_ANSWER: 'question:answer',
  QUESTION_SKIP: 'question:skip',

  // MCP (Model Context Protocol)
  MCP_GET_STATUS: 'mcp:get-status',
  MCP_CONNECT: 'mcp:connect',
  MCP_DISCONNECT: 'mcp:disconnect',
  MCP_GET_CONFIG: 'mcp:get-config',
  MCP_SAVE_CONFIG: 'mcp:save-config',
  MCP_GET_LAYERED_CONFIG: 'mcp:get-layered-config',
  MCP_SAVE_GLOBAL_CONFIG: 'mcp:save-global-config',
  MCP_SAVE_PROJECT_CONFIG: 'mcp:save-project-config',
  MCP_SET_WORKSPACE: 'mcp:set-workspace',
  MCP_STATUS_CHANGED: 'mcp:status-changed',
} as const;
