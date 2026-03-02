import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type {
  MCPConfig,
  MCPServerConfig,
  MCPServerSource,
  LayeredMCPConfig,
} from '../../../shared/mcp-types';
import { DEFAULT_MCP_CONFIG } from '../../../shared/mcp-types';
import { createLogger } from '../logger';

const log = createLogger('MCPConfig');

export class MCPConfigService {
  private globalConfigPath: string;
  private globalConfig: MCPConfig;
  private projectConfig: MCPConfig | null = null;
  private projectConfigPath: string | null = null;
  private mergedConfig: MCPConfig;

  constructor() {
    const configDir = path.join(os.homedir(), '.manong');
    this.globalConfigPath = path.join(configDir, 'mcp.json');
    this.globalConfig = { ...DEFAULT_MCP_CONFIG };
    this.mergedConfig = { ...DEFAULT_MCP_CONFIG };
  }

  async load(workspacePath?: string): Promise<MCPConfig> {
    await this.loadGlobal();

    if (workspacePath) {
      await this.loadProject(workspacePath);
    } else {
      this.projectConfig = null;
      this.projectConfigPath = null;
    }

    this.mergeConfigs();
    return this.mergedConfig;
  }

  async loadGlobal(): Promise<MCPConfig> {
    try {
      await fs.mkdir(path.dirname(this.globalConfigPath), { recursive: true });
      const content = await fs.readFile(this.globalConfigPath, 'utf-8');
      this.globalConfig = JSON.parse(content);
      log.info(`Loaded global MCP config from ${this.globalConfigPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info('No global MCP config found, using defaults');
        this.globalConfig = { ...DEFAULT_MCP_CONFIG };
      } else {
        log.error('Failed to load global MCP config:', error);
        throw error;
      }
    }
    return this.globalConfig;
  }

  async loadProject(workspacePath: string): Promise<MCPConfig | null> {
    const configDir = path.join(workspacePath, '.manong');
    this.projectConfigPath = path.join(configDir, 'mcp.json');

    try {
      const content = await fs.readFile(this.projectConfigPath, 'utf-8');
      this.projectConfig = JSON.parse(content);
      log.info(`Loaded project MCP config from ${this.projectConfigPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info(`No project MCP config found at ${workspacePath}`);
        this.projectConfig = null;
        this.projectConfigPath = null;
      } else {
        log.error('Failed to load project MCP config:', error);
        this.projectConfig = null;
        this.projectConfigPath = null;
      }
    }
    return this.projectConfig;
  }

  async saveGlobal(config: MCPConfig): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.globalConfigPath), { recursive: true });
      await fs.writeFile(this.globalConfigPath, JSON.stringify(config, null, 2), 'utf-8');
      this.globalConfig = config;
      this.mergeConfigs();
      log.info(`Saved global MCP config to ${this.globalConfigPath}`);
    } catch (error) {
      log.error('Failed to save global MCP config:', error);
      throw error;
    }
  }

  async saveProject(config: MCPConfig, workspacePath: string): Promise<void> {
    const configDir = path.join(workspacePath, '.manong');
    const configPath = path.join(configDir, 'mcp.json');

    try {
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.projectConfig = config;
      this.projectConfigPath = configPath;
      this.mergeConfigs();
      log.info(`Saved project MCP config to ${configPath}`);
    } catch (error) {
      log.error('Failed to save project MCP config:', error);
      throw error;
    }
  }

  getConfig(): MCPConfig {
    return this.mergedConfig;
  }

  getGlobalConfig(): MCPConfig {
    return this.globalConfig;
  }

  getProjectConfig(): MCPConfig | null {
    return this.projectConfig;
  }

  getLayeredConfig(): LayeredMCPConfig {
    return {
      global: this.globalConfig,
      project: this.projectConfig,
      merged: this.mergedConfig,
    };
  }

  getServerConfig(name: string): MCPServerConfig | undefined {
    return this.mergedConfig.mcpServers[name];
  }

  getServerNames(): string[] {
    return Object.keys(this.mergedConfig.mcpServers);
  }

  getServerSource(name: string): MCPServerSource {
    if (this.projectConfig?.mcpServers[name]) {
      return 'project';
    }
    return 'global';
  }

  /**
   * Merge global and project configs.
   * Rules:
   * 1. Project config can add new servers
   * 2. Project config can override global server properties
   * 3. Project config can disable global servers with enabled: false
   */
  private mergeConfigs(): void {
    const merged: MCPConfig = {
      mcpServers: { ...this.globalConfig.mcpServers },
    };

    if (this.projectConfig) {
      for (const [name, config] of Object.entries(this.projectConfig.mcpServers)) {
        if (config.enabled === false) {
          // Disable/remove inherited server
          delete merged.mcpServers[name];
          log.debug(`Server "${name}" disabled by project config`);
        } else if (merged.mcpServers[name]) {
          // Merge with global config (project overrides)
          merged.mcpServers[name] = {
            ...merged.mcpServers[name],
            ...config,
          };
          log.debug(`Server "${name}" merged with project config`);
        } else {
          // Add new project-only server
          merged.mcpServers[name] = config;
          log.debug(`Server "${name}" added from project config`);
        }
      }
    }

    this.mergedConfig = merged;
    log.info(`Merged config has ${Object.keys(merged.mcpServers).length} servers`);
  }
}

export const mcpConfigService = new MCPConfigService();
