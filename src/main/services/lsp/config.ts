import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type {
  LSPConfig,
  LSPServerConfig,
} from '../../../shared/lsp-types';
import { DEFAULT_LSP_CONFIG } from '../../../shared/lsp-types';
import { BUILTIN_SERVERS } from './server';
import { createLogger } from '../logger';

const log = createLogger('LSPConfig');

export class LSPConfigService {
  private globalConfigPath: string;
  private globalConfig: LSPConfig;
  private projectConfig: LSPConfig | null = null;
  private mergedConfig: LSPConfig;

  constructor() {
    const configDir = path.join(os.homedir(), '.config', 'manong');
    this.globalConfigPath = path.join(configDir, 'lsp.json');
    this.globalConfig = { ...DEFAULT_LSP_CONFIG };
    this.mergedConfig = { ...DEFAULT_LSP_CONFIG };
  }

  async load(workspacePath?: string): Promise<LSPConfig> {
    await this.loadGlobal();

    if (workspacePath) {
      await this.loadProject(workspacePath);
    } else {
      this.projectConfig = null;
    }

    this.mergeConfigs();
    return this.mergedConfig;
  }

  private async loadGlobal(): Promise<LSPConfig> {
    try {
      await fs.mkdir(path.dirname(this.globalConfigPath), { recursive: true });
      const content = await fs.readFile(this.globalConfigPath, 'utf-8');
      this.globalConfig = JSON.parse(content);
      log.info(`Loaded global LSP config from ${this.globalConfigPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info('No global LSP config found, using defaults');
        this.globalConfig = { ...DEFAULT_LSP_CONFIG };
      } else {
        log.error('Failed to load global LSP config:', error);
        throw error;
      }
    }
    return this.globalConfig;
  }

  private async loadProject(workspacePath: string): Promise<LSPConfig | null> {
    const configPath = path.join(workspacePath, '.manong', 'lsp.json');

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      this.projectConfig = JSON.parse(content);
      log.info(`Loaded project LSP config from ${configPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info(`No project LSP config found at ${workspacePath}`);
        this.projectConfig = null;
      } else {
        log.error('Failed to load project LSP config:', error);
        this.projectConfig = null;
      }
    }
    return this.projectConfig;
  }

  private mergeConfigs(): void {
    const merged: LSPConfig = {
      lspServers: { ...BUILTIN_SERVERS, ...this.globalConfig.lspServers },
    };

    if (this.projectConfig) {
      for (const [name, config] of Object.entries(this.projectConfig.lspServers)) {
        if (config.enabled === false) {
          delete merged.lspServers[name];
          log.debug(`Server "${name}" disabled by project config`);
        } else if (merged.lspServers[name]) {
          merged.lspServers[name] = {
            ...merged.lspServers[name],
            ...config,
          };
          log.debug(`Server "${name}" merged with project config`);
        } else {
          merged.lspServers[name] = config;
          log.debug(`Server "${name}" added from project config`);
        }
      }
    }

    this.mergedConfig = merged;
    log.info(`Merged LSP config has ${Object.keys(merged.lspServers).length} servers`);
  }

  getConfig(): LSPConfig {
    return this.mergedConfig;
  }

  getServerConfig(name: string): LSPServerConfig | undefined {
    return this.mergedConfig.lspServers[name];
  }

  getServerNames(): string[] {
    return Object.keys(this.mergedConfig.lspServers);
  }
}

export const lspConfigService = new LSPConfigService();
