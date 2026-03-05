import { app } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import type {
  LSPServerStatus,
  LSPInstallStatus,
} from "../../../shared/lsp-types";
import { lspConfigService } from "./config";
import { LSPClient } from "./client";
import {
  ensureServerInstalled,
  getServerIdForExtension,
  isBuiltinServer,
  type EnsureServerInstalledResult,
} from "./server";
import { permissionService } from "../permission";
import { createLogger } from "../logger";

const log = createLogger("LSPManager");
const INSTALL_FAILURE_COOLDOWN_MS = 90_000;

type StatusChangeCallback = (statuses: LSPServerStatus[]) => void;

interface InstallState {
  status: LSPInstallStatus;
  error?: string;
  cooldownUntil?: number;
}

type FailedEnsureServerInstalledResult = Extract<
  EnsureServerInstalledResult,
  { ok: false }
>;

function isEnsureServerInstallFailure(
  result: EnsureServerInstalledResult,
): result is FailedEnsureServerInstalledResult {
  return result.ok === false;
}

class LSPManager {
  private clients = new Map<string, LSPClient>();
  private statusChangeCallbacks: StatusChangeCallback[] = [];
  private initialized = false;
  private currentWorkspacePath: string | null = null;
  private installInFlight = new Map<
    string,
    Promise<EnsureServerInstalledResult>
  >();
  private installStates = new Map<string, InstallState>();

  async initialize(workspacePath?: string): Promise<void> {
    if (this.initialized) return;

    log.info("Initializing LSP Manager");
    this.currentWorkspacePath = workspacePath || null;
    await lspConfigService.load(workspacePath || undefined);
    this.initialized = true;

    app.on("will-quit", () => this.shutdownAll());
  }

  async setWorkspace(workspacePath: string | null): Promise<void> {
    if (this.currentWorkspacePath === workspacePath) {
      log.debug(`Workspace unchanged: ${workspacePath}`);
      return;
    }

    log.info(`Switching workspace to: ${workspacePath || "none"}`);
    this.currentWorkspacePath = workspacePath;

    await this.shutdownAll();
    await lspConfigService.load(workspacePath || undefined);
  }

  private makeClientKey(serverId: string, rootPath: string): string {
    return `${serverId}:${rootPath}`;
  }

  private isInsideWorkspace(filePath: string): boolean {
    if (!this.currentWorkspacePath) {
      return false;
    }

    const workspacePath = path.resolve(this.currentWorkspacePath);
    const absoluteFilePath = path.resolve(filePath);
    const relative = path.relative(workspacePath, absoluteFilePath);

    return (
      relative === "" ||
      (!relative.startsWith("..") && !path.isAbsolute(relative))
    );
  }

  private async findProjectRoot(
    filePath: string,
    rootMarkers: string[],
  ): Promise<string> {
    let currentDir = path.dirname(filePath);

    while (currentDir !== path.dirname(currentDir)) {
      if (
        this.currentWorkspacePath &&
        currentDir === this.currentWorkspacePath
      ) {
        return currentDir;
      }

      for (const marker of rootMarkers) {
        const markerPath = path.join(currentDir, marker);
        try {
          await fs.access(markerPath);
          return currentDir;
        } catch {
          // Continue searching
        }
      }

      currentDir = path.dirname(currentDir);
    }

    return this.currentWorkspacePath || path.dirname(filePath);
  }

  private setInstallState(serverId: string, nextState: InstallState): void {
    this.installStates.set(serverId, nextState);
    this.notifyStatusChange();
  }

  private getInstallState(serverId: string): InstallState | undefined {
    const state = this.installStates.get(serverId);
    if (!state) {
      return undefined;
    }

    if (
      state.status === "cooldown" &&
      state.cooldownUntil &&
      state.cooldownUntil <= Date.now()
    ) {
      const expiredState: InstallState = {
        status: "failed",
        error: state.error,
      };
      this.installStates.set(serverId, expiredState);
      return expiredState;
    }

    return state;
  }

  private isInInstallCooldown(serverId: string): boolean {
    const state = this.getInstallState(serverId);
    return Boolean(
      state?.status === "cooldown" &&
      state.cooldownUntil &&
      state.cooldownUntil > Date.now(),
    );
  }

  private async installServerWithLock(
    serverId: string,
    config: NonNullable<ReturnType<typeof lspConfigService.getServerConfig>>,
  ): Promise<EnsureServerInstalledResult> {
    const existing = this.installInFlight.get(serverId);
    if (existing) {
      log.debug(`Reusing in-flight install promise for ${serverId}`);
      return existing;
    }

    const promise = (async () => {
      this.setInstallState(serverId, { status: "installing" });

      const result = await ensureServerInstalled(serverId, config, {
        allowInstall: true,
      });

      if (!isEnsureServerInstallFailure(result)) {
        this.setInstallState(serverId, { status: "installed" });
        return result;
      }

      if (result.attemptedInstall) {
        const cooldownUntil = Date.now() + INSTALL_FAILURE_COOLDOWN_MS;
        this.setInstallState(serverId, {
          status: "cooldown",
          error: result.error,
          cooldownUntil,
        });
      } else {
        this.setInstallState(serverId, {
          status: "failed",
          error: result.error,
        });
      }

      return result;
    })().finally(() => {
      this.installInFlight.delete(serverId);
    });

    this.installInFlight.set(serverId, promise);
    return promise;
  }

  async getClientsForFile(filePath: string): Promise<LSPClient[]> {
    if (!this.isInsideWorkspace(filePath)) {
      log.warn(`Skipping LSP for file outside workspace: ${filePath}`);
      return [];
    }

    const ext = path.extname(filePath).toLowerCase();
    const mergedServers = lspConfigService.getConfig().lspServers;
    const serverId = getServerIdForExtension(ext, mergedServers);

    if (!serverId) {
      log.debug(`No LSP server for extension: ${ext}`);
      return [];
    }

    const config = lspConfigService.getServerConfig(serverId);
    if (!config) {
      log.debug(`No config for server: ${serverId}`);
      return [];
    }

    if (config.enabled === false) {
      log.debug(`Server ${serverId} is disabled`);
      return [];
    }

    const rootMarkers = config.rootMarkers || [];
    const rootPath = await this.findProjectRoot(filePath, rootMarkers);
    const clientKey = this.makeClientKey(serverId, rootPath);

    let client = this.clients.get(clientKey);
    if (client && client.getStatus() === "running") {
      return [client];
    }

    if (this.isInInstallCooldown(serverId)) {
      const installState = this.getInstallState(serverId);
      log.warn(
        `Skipping install for ${serverId} due to cooldown until ${new Date(installState?.cooldownUntil ?? 0).toISOString()}`,
      );
      return [];
    }

    const resolvedWithoutInstall = await ensureServerInstalled(
      serverId,
      config,
      { allowInstall: false },
    );

    let resolvedCommand: string | null = null;

    if (!isEnsureServerInstallFailure(resolvedWithoutInstall)) {
      resolvedCommand = resolvedWithoutInstall.command;
    } else if (!isBuiltinServer(serverId)) {
      this.setInstallState(serverId, {
        status: "failed",
        error: resolvedWithoutInstall.error,
      });
      log.error(
        `Custom LSP server unavailable: ${resolvedWithoutInstall.error}`,
      );
      return [];
    } else {
      const installSpecifier = `LSPInstall(${serverId})`;
      const ruleDecision =
        permissionService.checkSpecifierRules(installSpecifier);
      if (ruleDecision === "deny") {
        const blockedMessage = `LSP install blocked by permission rules: ${installSpecifier}`;
        this.setInstallState(serverId, {
          status: "failed",
          error: blockedMessage,
        });
        log.warn(blockedMessage);
        return [];
      }

      const installResult = await this.installServerWithLock(serverId, config);
      if (isEnsureServerInstallFailure(installResult)) {
        log.error(
          `Could not install LSP server ${serverId}: ${installResult.error}`,
        );
        return [];
      }

      resolvedCommand = installResult.command;
    }

    if (!resolvedCommand) {
      log.error(`Could not resolve LSP command for server: ${serverId}`);
      return [];
    }

    client = new LSPClient(serverId, config, rootPath, resolvedCommand);
    this.clients.set(clientKey, client);

    try {
      await client.start();
      this.notifyStatusChange();
      return [client];
    } catch (err) {
      log.error(`Failed to start LSP client ${serverId}:`, err);
      this.notifyStatusChange();
      return [];
    }
  }

  getStatuses(): LSPServerStatus[] {
    const statuses: LSPServerStatus[] = [];
    const serverNames = lspConfigService.getServerNames();

    for (const name of serverNames) {
      const config = lspConfigService.getServerConfig(name);
      if (!config) continue;

      const installState = this.getInstallState(name);

      const clientEntries = Array.from(this.clients.entries()).filter(([key]) =>
        key.startsWith(`${name}:`),
      );

      if (clientEntries.length === 0) {
        statuses.push({
          name,
          status: "stopped",
          languages: config.extensions.map((e) => e.replace(".", "")),
          installStatus: installState?.status,
          installError: installState?.error,
          installCooldownUntil: installState?.cooldownUntil,
        });
      } else {
        for (const [, client] of clientEntries) {
          statuses.push({
            name,
            status: client.getStatus(),
            root: client.getRootPath(),
            languages: config.extensions.map((e) => e.replace(".", "")),
            error: client.getError(),
            installStatus: installState?.status,
            installError: installState?.error,
            installCooldownUntil: installState?.cooldownUntil,
          });
        }
      }
    }

    return statuses;
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

  async shutdownAll(): Promise<void> {
    log.info("Shutting down all LSP clients");

    const shutdownPromises = Array.from(this.clients.values()).map((client) =>
      client
        .shutdown()
        .catch((err) => log.error("Error shutting down client:", err)),
    );

    await Promise.all(shutdownPromises);
    this.clients.clear();
    this.notifyStatusChange();
  }

  private notifyStatusChange(): void {
    const statuses = this.getStatuses();
    for (const callback of this.statusChangeCallbacks) {
      try {
        callback(statuses);
      } catch (err) {
        log.error("Status change callback error:", err);
      }
    }
  }
}

export const lspManager = new LSPManager();
