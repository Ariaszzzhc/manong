import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type {
  PermissionConfig,
  PermissionRule,
  LayeredPermissionConfig,
} from '../../../shared/permission-types';
import { DEFAULT_PERMISSION_CONFIG } from '../../../shared/permission-types';
import { createLogger } from '../logger';

const log = createLogger('PermissionConfig');

export class PermissionConfigService {
  private globalConfigPath: string;
  private globalConfig: PermissionConfig;
  private projectConfig: PermissionConfig | null = null;
  private projectConfigPath: string | null = null;
  private localConfig: PermissionConfig | null = null;
  private localConfigPath: string | null = null;
  private mergedConfig: PermissionConfig;

  constructor() {
    const configDir = path.join(os.homedir(), '.manong');
    this.globalConfigPath = path.join(configDir, 'permissions.json');
    this.globalConfig = { ...DEFAULT_PERMISSION_CONFIG, rules: [] };
    this.mergedConfig = { ...DEFAULT_PERMISSION_CONFIG, rules: [] };
  }

  async load(workspacePath?: string): Promise<PermissionConfig> {
    await this.loadGlobal();

    if (workspacePath) {
      await this.loadProject(workspacePath);
      await this.loadLocal(workspacePath);
    } else {
      this.projectConfig = null;
      this.projectConfigPath = null;
      this.localConfig = null;
      this.localConfigPath = null;
    }

    this.mergeConfigs();
    return this.mergedConfig;
  }

  private async loadGlobal(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.globalConfigPath), { recursive: true });
      const content = await fs.readFile(this.globalConfigPath, 'utf-8');
      this.globalConfig = JSON.parse(content);
      log.info(`Loaded global permission config from ${this.globalConfigPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info('No global permission config found, using defaults');
        this.globalConfig = { ...DEFAULT_PERMISSION_CONFIG, rules: [] };
      } else {
        log.error('Failed to load global permission config:', error);
        this.globalConfig = { ...DEFAULT_PERMISSION_CONFIG, rules: [] };
      }
    }
  }

  private async loadProject(workspacePath: string): Promise<void> {
    const configDir = path.join(workspacePath, '.manong');
    this.projectConfigPath = path.join(configDir, 'permissions.json');

    try {
      const content = await fs.readFile(this.projectConfigPath, 'utf-8');
      this.projectConfig = JSON.parse(content);
      log.info(`Loaded project permission config from ${this.projectConfigPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info(`No project permission config found at ${workspacePath}`);
      } else {
        log.error('Failed to load project permission config:', error);
      }
      this.projectConfig = null;
      this.projectConfigPath = null;
    }
  }

  private async loadLocal(workspacePath: string): Promise<void> {
    const configDir = path.join(workspacePath, '.manong');
    this.localConfigPath = path.join(configDir, 'permissions.local.json');

    try {
      const content = await fs.readFile(this.localConfigPath, 'utf-8');
      this.localConfig = JSON.parse(content);
      log.info(`Loaded local permission config from ${this.localConfigPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info(`No local permission config found at ${workspacePath}`);
      } else {
        log.error('Failed to load local permission config:', error);
      }
      this.localConfig = null;
      this.localConfigPath = null;
    }
  }

  private mergeConfigs(): void {
    const mode =
      this.localConfig?.mode ??
      this.projectConfig?.mode ??
      this.globalConfig.mode ??
      'default';

    const rules: PermissionRule[] = [
      ...(this.globalConfig.rules || []),
      ...(this.projectConfig?.rules || []),
      ...(this.localConfig?.rules || []),
    ];

    this.mergedConfig = { mode, rules };
    log.info(`Merged permission config: mode=${mode}, ${rules.length} rules`);
  }

  async addLocalRule(rule: PermissionRule, workspacePath: string): Promise<void> {
    const configDir = path.join(workspacePath, '.manong');
    const configPath = path.join(configDir, 'permissions.local.json');

    const config: PermissionConfig = this.localConfig
      ? { ...this.localConfig, rules: [...(this.localConfig.rules || []), rule] }
      : { rules: [rule] };

    try {
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.localConfig = config;
      this.localConfigPath = configPath;
      this.mergeConfigs();
      log.info(`Added local rule: ${rule.action} ${rule.pattern}`);
    } catch (error) {
      log.error('Failed to save local permission config:', error);
      throw error;
    }
  }

  async saveGlobal(config: PermissionConfig): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.globalConfigPath), { recursive: true });
      await fs.writeFile(this.globalConfigPath, JSON.stringify(config, null, 2), 'utf-8');
      this.globalConfig = config;
      this.mergeConfigs();
      log.info(`Saved global permission config`);
    } catch (error) {
      log.error('Failed to save global permission config:', error);
      throw error;
    }
  }

  async saveProject(config: PermissionConfig, workspacePath: string): Promise<void> {
    const configDir = path.join(workspacePath, '.manong');
    const configPath = path.join(configDir, 'permissions.json');

    try {
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.projectConfig = config;
      this.projectConfigPath = configPath;
      this.mergeConfigs();
      log.info(`Saved project permission config`);
    } catch (error) {
      log.error('Failed to save project permission config:', error);
      throw error;
    }
  }

  async saveLocal(config: PermissionConfig, workspacePath: string): Promise<void> {
    const configDir = path.join(workspacePath, '.manong');
    const configPath = path.join(configDir, 'permissions.local.json');

    try {
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.localConfig = config;
      this.localConfigPath = configPath;
      this.mergeConfigs();
      log.info(`Saved local permission config`);
    } catch (error) {
      log.error('Failed to save local permission config:', error);
      throw error;
    }
  }

  getConfig(): PermissionConfig {
    return this.mergedConfig;
  }

  getLayeredConfig(): LayeredPermissionConfig {
    return {
      global: this.globalConfig,
      project: this.projectConfig,
      local: this.localConfig,
      merged: this.mergedConfig,
    };
  }
}
