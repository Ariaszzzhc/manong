import type { BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IPC_CHANNELS } from '../../../shared/ipc';
import type {
  PermissionMode,
  ToolRiskLevel,
  PermissionRequest,
  PermissionDecision,
  PermissionConfig,
  LayeredPermissionConfig,
} from '../../../shared/permission-types';
import {
  BUILTIN_TOOL_RISK,
  DEFAULT_MCP_TOOL_RISK,
} from '../../../shared/permission-types';
import { PermissionConfigService } from './config';
import { createLogger } from '../logger';
import { computeFileDiff } from '../tools/diff-utils';

const log = createLogger('PermissionService');

export class PermissionCancelledError extends Error {
  constructor() {
    super('Permission request was cancelled');
    this.name = 'PermissionCancelledError';
  }
}

interface PendingRequest {
  resolve: (decision: 'allow' | 'deny') => void;
  reject: (error: Error) => void;
}

export class PermissionService {
  private configService: PermissionConfigService;
  private mode: PermissionMode = 'default';
  private sessionAllowedTools = new Set<string>();
  private mainWindow: BrowserWindow | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private workspacePath: string | null = null;

  constructor() {
    this.configService = new PermissionConfigService();
  }

  async load(workspacePath?: string): Promise<void> {
    this.workspacePath = workspacePath ?? null;
    const config = await this.configService.load(workspacePath);
    this.mode = config.mode ?? 'default';
    log.info(`Permission mode: ${this.mode}`);
  }

  setWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
    log.info(`Permission mode changed to: ${mode}`);
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  resetSession(): void {
    this.sessionAllowedTools.clear();
    log.info('Session permission memory cleared');
  }

  async check(
    toolName: string,
    args: Record<string, unknown>,
    sessionId: string,
    workingDir?: string
  ): Promise<'allow' | 'deny'> {
    if (this.mode === 'bypassPermissions') {
      return 'allow';
    }

    const riskLevel = this.getToolRisk(toolName);

    if (riskLevel === 'read') {
      return 'allow';
    }

    if (this.mode === 'acceptEdits' && riskLevel === 'write') {
      return 'allow';
    }

    const specifier = this.toSpecifier(toolName, args);

    if (this.sessionAllowedTools.has(specifier)) {
      return 'allow';
    }

    const ruleResult = this.evaluateRules(specifier);
    if (ruleResult !== null) {
      return ruleResult;
    }

    return this.promptUser(toolName, args, riskLevel, specifier, sessionId, workingDir);
  }

  resolvePermission(requestId: string, decision: PermissionDecision): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      log.warn(`No pending permission request: ${requestId}`);
      return;
    }

    this.pendingRequests.delete(requestId);

    if (decision === 'always-allow') {
      const request = this.findRequestById(requestId);
      if (request) {
        const riskLevel = this.getToolRisk(request.toolName);
        const specifier = this.toSpecifier(request.toolName, request.args);

        if (riskLevel === 'execute' && this.workspacePath) {
          this.configService.addLocalRule(
            { action: 'allow', pattern: specifier },
            this.workspacePath
          );
        } else {
          this.sessionAllowedTools.add(specifier);
        }
      }
      pending.resolve('allow');
    } else {
      pending.resolve(decision);
    }
  }

  cancelPendingPermissions(): void {
    for (const [, { reject }] of this.pendingRequests) {
      reject(new PermissionCancelledError());
    }
    this.pendingRequests.clear();
  }

  getLayeredConfig(): LayeredPermissionConfig {
    return this.configService.getLayeredConfig();
  }

  async saveConfig(scope: string, config: PermissionConfig): Promise<void> {
    if (scope === 'global') {
      await this.configService.saveGlobal(config);
    } else if (scope === 'project' && this.workspacePath) {
      await this.configService.saveProject(config, this.workspacePath);
    } else if (scope === 'local' && this.workspacePath) {
      await this.configService.saveLocal(config, this.workspacePath);
    }
  }

  private getToolRisk(toolName: string): ToolRiskLevel {
    return BUILTIN_TOOL_RISK[toolName] ?? DEFAULT_MCP_TOOL_RISK;
  }

  private toSpecifier(toolName: string, args: Record<string, unknown>): string {
    switch (toolName) {
      case 'run_shell':
        return `Bash(${args.command ?? ''})`;
      case 'write_file':
        return `Write(${args.file_path ?? ''})`;
      case 'edit_file':
        return `Edit(${args.file_path ?? ''})`;
      case 'read_file':
        return `Read(${args.file_path ?? ''})`;
      default:
        return toolName;
    }
  }

  private buildDescription(toolName: string, args: Record<string, unknown>): string {
    switch (toolName) {
      case 'run_shell':
        return `${args.command ?? ''}`;
      case 'write_file':
        return `Write to ${args.file_path ?? ''}`;
      case 'edit_file':
        return `Edit ${args.file_path ?? ''}`;
      default:
        return `${toolName}(${JSON.stringify(args).slice(0, 100)})`;
    }
  }

  private evaluateRules(specifier: string): 'allow' | 'deny' | null {
    const config = this.configService.getConfig();
    const rules = config.rules || [];

    for (const rule of rules) {
      if (rule.action === 'deny' && this.matchPattern(rule.pattern, specifier)) {
        log.info(`Rule denied: ${rule.pattern} matched ${specifier}`);
        return 'deny';
      }
    }

    for (const rule of rules) {
      if (rule.action === 'allow' && this.matchPattern(rule.pattern, specifier)) {
        log.info(`Rule allowed: ${rule.pattern} matched ${specifier}`);
        return 'allow';
      }
    }

    return null;
  }

  private matchPattern(pattern: string, specifier: string): boolean {
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '§DOUBLESTAR§')
      .replace(/\*/g, '[^/]*')
      .replace(/§DOUBLESTAR§/g, '.*');

    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(specifier);
  }

  private pendingRequestDetails = new Map<string, { toolName: string; args: Record<string, unknown> }>();

  private findRequestById(requestId: string): { toolName: string; args: Record<string, unknown> } | null {
    return this.pendingRequestDetails.get(requestId) ?? null;
  }

  private async promptUser(
    toolName: string,
    args: Record<string, unknown>,
    riskLevel: ToolRiskLevel,
    _specifier: string,
    sessionId: string,
    workingDir?: string
  ): Promise<'allow' | 'deny'> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      log.warn('No window available for permission prompt, denying');
      return 'deny';
    }

    const requestId = `perm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.pendingRequestDetails.set(requestId, { toolName, args });

    const previewDiff = await this.computePreviewDiff(toolName, args, workingDir);

    const request: PermissionRequest = {
      id: requestId,
      sessionId,
      toolName,
      args,
      riskLevel,
      description: this.buildDescription(toolName, args),
      diff: previewDiff,
    };

    try {
      const win = this.mainWindow;
      const decision = await new Promise<'allow' | 'deny'>((resolve, reject) => {
        this.pendingRequests.set(requestId, { resolve, reject });
        if (win && !win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.PERMISSION_ASK, request);
        }
        log.debug('Permission request sent to renderer:', requestId);
      });
      return decision;
    } catch (error) {
      if (error instanceof PermissionCancelledError) {
        return 'deny';
      }
      throw error;
    } finally {
      this.pendingRequestDetails.delete(requestId);
    }
  }

  private async computePreviewDiff(
    toolName: string,
    args: Record<string, unknown>,
    workingDir?: string
  ): Promise<string | undefined> {
    try {
      const resolveFilePath = (filePath: string): string => {
        if (path.isAbsolute(filePath)) return filePath;
        if (workingDir) return path.join(workingDir, filePath);
        return filePath;
      };

      if (toolName === 'edit_file') {
        const filePath = String(args.file_path || '');
        const oldString = String(args.old_string || '');
        const newString = String(args.new_string ?? '');
        const replaceAll = Boolean(args.replace_all);
        if (!filePath || !oldString) return undefined;

        const absPath = resolveFilePath(filePath);
        const content = await fs.readFile(absPath, 'utf-8');
        if (!content.includes(oldString)) return undefined;

        const newContent = replaceAll
          ? content.split(oldString).join(newString)
          : content.replace(oldString, newString);

        const info = computeFileDiff(filePath, content, newContent);
        return info.diff;
      }

      if (toolName === 'write_file') {
        const filePath = String(args.file_path || '');
        const newContent = String(args.content ?? '');
        if (!filePath) return undefined;

        let original = '';
        try {
          const absPath = resolveFilePath(filePath);
          original = await fs.readFile(absPath, 'utf-8');
        } catch {
          // File doesn't exist yet
        }

        const info = computeFileDiff(filePath, original, newContent);
        return info.diff;
      }

      return undefined;
    } catch (error) {
      log.debug('Failed to compute preview diff:', error);
      return undefined;
    }
  }
}

export const permissionService = new PermissionService();
