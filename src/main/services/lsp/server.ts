import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import type { LSPServerConfig } from '../../../shared/lsp-types';
import { createLogger } from '../logger';

const log = createLogger('LSPServer');

const MANONG_BIN_DIR = path.join(os.homedir(), '.config', 'manong', 'bin');
const MANONG_NODE_BIN_DIR = path.join(MANONG_BIN_DIR, 'node_modules', '.bin');
const MANONG_GO_BIN_DIR = path.join(MANONG_BIN_DIR, 'go', 'bin');
const INSTALL_TIMEOUT_MS = 120_000;

type BuiltinServerId = 'typescript' | 'pyright' | 'gopls';

type InstallStrategy = 'npm' | 'go';

export type InstallFailureReason =
  | 'command_not_found'
  | 'timeout'
  | 'network'
  | 'permission'
  | 'not_found'
  | 'unknown';

interface BuiltinServerInstallManifestItem {
  strategy: InstallStrategy;
  packageOrModule: string;
  expectedBin: string;
  version: 'latest';
}

interface CommandExecutionResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  reason?: InstallFailureReason;
  error?: string;
}

export interface EnsureServerInstallOptions {
  allowInstall?: boolean;
}

export type EnsureServerInstalledResult =
  | { ok: true; command: string; source: 'path' | 'manong-bin' | 'installed' }
  | {
      ok: false;
      reason: InstallFailureReason;
      error: string;
      attemptedInstall: boolean;
    };

const BUILTIN_SERVER_INSTALL_MANIFEST: Record<BuiltinServerId, BuiltinServerInstallManifestItem> = {
  typescript: {
    strategy: 'npm',
    packageOrModule: 'typescript-language-server',
    expectedBin: 'typescript-language-server',
    version: 'latest',
  },
  pyright: {
    strategy: 'npm',
    packageOrModule: 'pyright',
    expectedBin: 'pyright-langserver',
    version: 'latest',
  },
  gopls: {
    strategy: 'go',
    packageOrModule: 'golang.org/x/tools/gopls',
    expectedBin: 'gopls',
    version: 'latest',
  },
};

const ALLOWED_INSTALL_ENV_KEYS = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'TMP',
  'TEMP',
  'TMPDIR',
  'SystemRoot',
  'ComSpec',
  'PATHEXT',
  'APPDATA',
  'LOCALAPPDATA',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'NPM_CONFIG_REGISTRY',
  'npm_config_registry',
  'GOPATH',
  'GOROOT',
  'GOPROXY',
  'GOSUMDB',
  'GONOSUMDB',
  'GONOPROXY',
] as const;

export const BUILTIN_SERVERS: Record<string, LSPServerConfig> = {
  typescript: {
    command: 'typescript-language-server',
    args: ['--stdio'],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    rootMarkers: ['tsconfig.json', 'jsconfig.json', 'package.json'],
  },
  pyright: {
    command: 'pyright-langserver',
    args: ['--stdio'],
    extensions: ['.py'],
    rootMarkers: ['pyproject.toml', 'setup.py', 'requirements.txt', 'pyrightconfig.json'],
  },
  gopls: {
    command: 'gopls',
    args: ['serve'],
    extensions: ['.go'],
    rootMarkers: ['go.mod'],
  },
};

function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isBuiltinServer(serverId: string): serverId is BuiltinServerId {
  return serverId in BUILTIN_SERVER_INSTALL_MANIFEST;
}

function getExecutableCandidates(name: string): string[] {
  if (!isWindows()) {
    return [name];
  }

  const normalized = name.toLowerCase();
  if (normalized.endsWith('.cmd') || normalized.endsWith('.exe') || normalized.endsWith('.bat')) {
    return [name];
  }

  return [`${name}.cmd`, `${name}.exe`, `${name}.bat`, name];
}

async function hasExecutableAccess(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, isWindows() ? fs.constants.F_OK : fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findExecutableInPath(name: string): Promise<string | null> {
  const locator = isWindows() ? 'where' : 'which';

  return new Promise((resolve) => {
    const proc = spawn(locator, [name], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    proc.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.on('close', () => {
      void (async () => {
        const candidates = output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        for (const candidate of candidates) {
          if (await hasExecutableAccess(candidate)) {
            resolve(candidate);
            return;
          }
        }

        resolve(null);
      })();
    });

    proc.on('error', () => resolve(null));
  });
}

async function findInManongBin(name: string): Promise<string | null> {
  const candidates = getExecutableCandidates(name);

  for (const candidate of candidates) {
    const nodePath = path.join(MANONG_NODE_BIN_DIR, candidate);
    if (await hasExecutableAccess(nodePath)) {
      return nodePath;
    }

    const goPath = path.join(MANONG_GO_BIN_DIR, candidate);
    if (await hasExecutableAccess(goPath)) {
      return goPath;
    }
  }

  return null;
}

function buildInstallEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};

  for (const key of ALLOWED_INSTALL_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }

  return { ...env, ...overrides };
}

function classifyInstallFailure(output: string): InstallFailureReason {
  if (/(network|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN)/i.test(output)) {
    return 'network';
  }

  if (/(EACCES|EPERM|permission denied)/i.test(output)) {
    return 'permission';
  }

  if (/(404|not found)/i.test(output)) {
    return 'not_found';
  }

  return 'unknown';
}

async function runCommandWithTimeout(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv }
): Promise<CommandExecutionResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const proc = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, INSTALL_TIMEOUT_MS);

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (error: NodeJS.ErrnoException) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      resolve({
        ok: false,
        code: null,
        stdout,
        stderr,
        reason: error.code === 'ENOENT' ? 'command_not_found' : 'unknown',
        error: error.message,
      });
    });

    proc.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);

      if (timedOut) {
        resolve({
          ok: false,
          code,
          stdout,
          stderr,
          reason: 'timeout',
          error: `${command} install command timed out`,
        });
        return;
      }

      if (code === 0) {
        resolve({ ok: true, code, stdout, stderr });
        return;
      }

      const combined = `${stdout}\n${stderr}`;
      resolve({
        ok: false,
        code,
        stdout,
        stderr,
        reason: classifyInstallFailure(combined),
        error: `${command} exited with code ${code}`,
      });
    });
  });
}

function formatInstallFailure(
  target: string,
  commandResult: CommandExecutionResult
): EnsureServerInstalledResult {
  const output = `${commandResult.stdout}\n${commandResult.stderr}`.trim();
  const suffix = output ? ` Output: ${output.slice(0, 500)}` : '';

  return {
    ok: false,
    reason: commandResult.reason ?? 'unknown',
    error: `Failed to install ${target}. ${commandResult.error ?? 'Unknown error.'}${suffix}`,
    attemptedInstall: true,
  };
}

async function installNpmPackage(
  packageName: string,
  expectedBin: string,
  version: 'latest'
): Promise<EnsureServerInstalledResult> {
  log.info(`Installing ${packageName}@${version} via npm`);

  try {
    await fs.mkdir(MANONG_BIN_DIR, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: 'permission',
      error: `Failed to prepare install directory: ${message}`,
      attemptedInstall: true,
    };
  }

  const commandResult = await runCommandWithTimeout(
    'npm',
    ['install', `${packageName}@${version}`, '--no-audit', '--no-fund'],
    {
      cwd: MANONG_BIN_DIR,
      env: buildInstallEnv(),
    }
  );

  if (!commandResult.ok) {
    return formatInstallFailure(packageName, commandResult);
  }

  const installed = await findInManongBin(expectedBin);
  if (!installed) {
    return {
      ok: false,
      reason: 'not_found',
      error: `Installed ${packageName}@${version}, but executable ${expectedBin} was not found`,
      attemptedInstall: true,
    };
  }

  log.info(`Installed ${packageName}@${version} at ${installed}`);
  return { ok: true, command: installed, source: 'installed' };
}

async function installGoModule(
  moduleName: string,
  expectedBin: string,
  version: 'latest'
): Promise<EnsureServerInstalledResult> {
  log.info(`Installing ${moduleName}@${version} via go install`);

  try {
    await fs.mkdir(MANONG_GO_BIN_DIR, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: 'permission',
      error: `Failed to prepare go bin directory: ${message}`,
      attemptedInstall: true,
    };
  }

  const baseEnv = buildInstallEnv();
  const pathValue = baseEnv.PATH
    ? `${MANONG_GO_BIN_DIR}${path.delimiter}${baseEnv.PATH}`
    : MANONG_GO_BIN_DIR;

  const commandResult = await runCommandWithTimeout('go', ['install', `${moduleName}@${version}`], {
    cwd: MANONG_BIN_DIR,
    env: buildInstallEnv({
      GOBIN: MANONG_GO_BIN_DIR,
      PATH: pathValue,
    }),
  });

  if (!commandResult.ok) {
    return formatInstallFailure(moduleName, commandResult);
  }

  const localInstalled = await findInManongBin(expectedBin);
  if (localInstalled) {
    log.info(`Installed ${moduleName}@${version} at ${localInstalled}`);
    return { ok: true, command: localInstalled, source: 'installed' };
  }

  const pathInstalled = await findExecutableInPath(expectedBin);
  if (pathInstalled) {
    log.info(`Installed ${moduleName}@${version} and found in PATH at ${pathInstalled}`);
    return { ok: true, command: pathInstalled, source: 'installed' };
  }

  return {
    ok: false,
    reason: 'not_found',
    error: `Installed ${moduleName}@${version}, but executable ${expectedBin} was not found`,
    attemptedInstall: true,
  };
}

export async function ensureServerInstalled(
  serverId: string,
  serverConfig?: LSPServerConfig,
  options: EnsureServerInstallOptions = {}
): Promise<EnsureServerInstalledResult> {
  const allowInstall = options.allowInstall ?? true;
  const config = BUILTIN_SERVERS[serverId];

  if (!config) {
    if (!serverConfig) {
      return {
        ok: false,
        reason: 'not_found',
        error: `No config provided for custom server: ${serverId}`,
        attemptedInstall: false,
      };
    }

    const systemPath = await findExecutableInPath(serverConfig.command);
    if (systemPath) {
      log.debug(`Found custom server ${serverConfig.command} in PATH: ${systemPath}`);
      return { ok: true, command: systemPath, source: 'path' };
    }

    return {
      ok: false,
      reason: 'command_not_found',
      error: `Custom server command not found in PATH: ${serverConfig.command}`,
      attemptedInstall: false,
    };
  }

  const systemPath = await findExecutableInPath(config.command);
  if (systemPath) {
    log.debug(`Found ${config.command} in system PATH: ${systemPath}`);
    return { ok: true, command: systemPath, source: 'path' };
  }

  const localPath = await findInManongBin(config.command);
  if (localPath) {
    log.debug(`Found ${config.command} in manong bin: ${localPath}`);
    return { ok: true, command: localPath, source: 'manong-bin' };
  }

  if (!allowInstall) {
    return {
      ok: false,
      reason: 'not_found',
      error: `LSP server executable not found: ${config.command}`,
      attemptedInstall: false,
    };
  }

  if (!isBuiltinServer(serverId)) {
    return {
      ok: false,
      reason: 'not_found',
      error: `No install manifest for server: ${serverId}`,
      attemptedInstall: false,
    };
  }

  const manifest = BUILTIN_SERVER_INSTALL_MANIFEST[serverId];

  if (manifest.strategy === 'npm') {
    return installNpmPackage(manifest.packageOrModule, manifest.expectedBin, manifest.version);
  }

  return installGoModule(manifest.packageOrModule, manifest.expectedBin, manifest.version);
}

export function getServerIdForExtension(ext: string, servers?: Record<string, LSPServerConfig>): string | undefined {
  const allServers = servers || BUILTIN_SERVERS;
  for (const [id, config] of Object.entries(allServers)) {
    if (config.extensions.includes(ext.toLowerCase())) {
      return id;
    }
  }
  return undefined;
}
