import { app } from 'electron';
import type {
  MCPConfig,
  MCPServerStatus,
  LayeredMCPConfig,
} from '../../../shared/mcp-types';
import { mcpConfigService } from './config';
import { MCPConnection } from './connection';
import { MCPToolAdapter } from './tool-adapter';
import { toolRegistry } from '../tools';
import { createLogger } from '../logger';

const log = createLogger('MCPManager');

type StatusChangeCallback = (statuses: MCPServerStatus[]) => void;

class MCPManager {
  private connections = new Map<string, MCPConnection>();
  private statusChangeCallbacks: StatusChangeCallback[] = [];
  private initialized = false;
  private currentWorkspacePath: string | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    log.info('Initializing MCP Manager');
    await mcpConfigService.load();
    this.initialized = true;

    app.on('will-quit', () => this.disconnectAll());
  }

  /**
   * Set workspace and reload configurations.
   * This will disconnect all servers and reconnect with the new config.
   */
  async setWorkspace(workspacePath: string | null): Promise<void> {
    if (this.currentWorkspacePath === workspacePath) {
      log.debug(`Workspace unchanged: ${workspacePath}`);
      return;
    }

    log.info(`Switching workspace to: ${workspacePath || 'none'}`);
    this.currentWorkspacePath = workspacePath;

    await this.disconnectAll();
    await mcpConfigService.load(workspacePath || undefined);
    await this.connectAll();
  }

  async connectAll(): Promise<void> {
    const config = mcpConfigService.getConfig();
    const serverNames = Object.keys(config.mcpServers);

    log.info(`Connecting to ${serverNames.length} MCP servers`);

    await Promise.allSettled(
      serverNames.map((name) => this.connect(name))
    );

    this.notifyStatusChange();
  }

  async connect(name: string): Promise<void> {
    const config = mcpConfigService.getServerConfig(name);
    if (!config) {
      throw new Error(`Server "${name}" not found in config`);
    }

    if (this.connections.has(name)) {
      await this.disconnect(name);
    }

    const connection = new MCPConnection(name, config);
    this.connections.set(name, connection);

    try {
      await connection.connect();
      this.registerTools(name, connection);
      this.notifyStatusChange();
    } catch (error) {
      this.notifyStatusChange();
      throw error;
    }
  }

  async disconnect(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (!connection) return;

    this.unregisterTools(name);
    await connection.disconnect();
    this.connections.delete(name);
    this.notifyStatusChange();
  }

  async disconnectAll(): Promise<void> {
    log.info('Disconnecting all MCP servers');

    for (const name of this.connections.keys()) {
      await this.disconnect(name);
    }
  }

  async reload(): Promise<void> {
    await this.disconnectAll();
    await mcpConfigService.load(this.currentWorkspacePath || undefined);
    await this.connectAll();
  }

  getStatuses(): MCPServerStatus[] {
    const statuses: MCPServerStatus[] = [];
    const config = mcpConfigService.getConfig();

    for (const name of Object.keys(config.mcpServers)) {
      const connection = this.connections.get(name);
      const source = mcpConfigService.getServerSource(name);
      statuses.push({
        name,
        status: connection?.getStatus() ?? 'disconnected',
        toolCount: connection?.getTools().length ?? 0,
        error: connection?.getError(),
        source,
      });
    }

    return statuses;
  }

  getConfig(): MCPConfig {
    return mcpConfigService.getConfig();
  }

  getLayeredConfig(): LayeredMCPConfig {
    return mcpConfigService.getLayeredConfig();
  }

  async saveGlobalConfig(config: MCPConfig): Promise<void> {
    await mcpConfigService.saveGlobal(config);
    await this.reload();
  }

  async saveProjectConfig(config: MCPConfig, workspacePath: string): Promise<void> {
    await mcpConfigService.saveProject(config, workspacePath);
    await this.reload();
  }

  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusChangeCallbacks.push(callback);
    return () => {
      const idx = this.statusChangeCallbacks.indexOf(callback);
      if (idx >= 0) {
        this.statusChangeCallbacks.splice(idx, 1);
      }
    };
  }

  private registerTools(serverName: string, connection: MCPConnection): void {
    const tools = connection.getTools();
    log.info(`Registering ${tools.length} tools from ${serverName}`);

    for (const toolInfo of tools) {
      try {
        const toolDef = MCPToolAdapter.toToolDefinition(
          toolInfo,
          serverName,
          (args) => connection.callTool(toolInfo.name, args)
        );

        toolRegistry.registerMCPTool(toolDef, serverName);
        log.debug(`Registered MCP tool: ${toolDef.name}`);
      } catch (error) {
        log.error(`Failed to register tool ${toolInfo.name}:`, error);
      }
    }
  }

  private unregisterTools(serverName: string): void {
    const prefix = `mcp__${serverName}__`;
    const tools = toolRegistry.getAll();
    const mcpTools = tools.filter((t) => t.name.startsWith(prefix));

    for (const tool of mcpTools) {
      toolRegistry.unregister(tool.name);
      log.debug(`Unregistered MCP tool: ${tool.name}`);
    }
  }

  private notifyStatusChange(): void {
    const statuses = this.getStatuses();
    for (const callback of this.statusChangeCallbacks) {
      try {
        callback(statuses);
      } catch (error) {
        log.error('Status change callback error:', error);
      }
    }
  }
}

export const mcpManager = new MCPManager();
