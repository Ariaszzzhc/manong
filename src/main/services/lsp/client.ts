import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import { pathToFileURL, fileURLToPath } from 'url';
import {
  createMessageConnection,
  Logger,
  MessageConnection,
} from 'vscode-jsonrpc';
import {
  InitializeParams,
  InitializeResult,
  TextDocumentItem,
  Location,
  SymbolInformation,
  DocumentSymbol,
} from 'vscode-languageserver-protocol';
import type { LSPServerConfig, LSPConnectionStatus } from '../../../shared/lsp-types';
import { getLanguageId } from './language';
import { createLogger } from '../logger';

const log = createLogger('LSPClient');

const INIT_TIMEOUT_MS = 45000;
const FILE_IDLE_TTL_MS = 5 * 60 * 1000;

export class LSPClient {
  private process: ChildProcess | null = null;
  private connection: MessageConnection | null = null;
  private status: LSPConnectionStatus = 'stopped';
  private error: string | undefined;
  private openFiles = new Set<string>();
  private fileVersions = new Map<string, number>();
  private fileLastTouchedAt = new Map<string, number>();
  private initialized = false;
  private isShuttingDown = false;
  private isDisposed = false;

  constructor(
    private serverId: string,
    private config: LSPServerConfig,
    private rootPath: string,
    private resolvedCommand: string
  ) {}

  getStatus(): LSPConnectionStatus {
    return this.status;
  }

  getError(): string | undefined {
    return this.error;
  }

  getRootPath(): string {
    return this.rootPath;
  }

  getServerId(): string {
    return this.serverId;
  }

  async start(): Promise<void> {
    if (this.initialized) return;
    if (this.isDisposed) {
      throw new Error('LSP client has been disposed');
    }

    this.isShuttingDown = false;
    this.error = undefined;
    this.status = 'starting';
    log.info(`Starting LSP server ${this.serverId} for root ${this.rootPath}`);

    try {
      this.process = spawn(this.resolvedCommand, this.config.args || [], {
        cwd: this.rootPath,
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.process.stdin || !this.process.stdout) {
        throw new Error('Failed to create stdio streams');
      }

      const logger: Logger = {
        error: (msg) => log.error(msg),
        warn: (msg) => log.warn(msg),
        info: (msg) => log.info(msg),
        log: (msg) => log.debug(msg),
      };

      this.connection = createMessageConnection(
        this.process.stdout,
        this.process.stdin,
        logger
      );

      this.connection.listen();

      this.process.stderr?.on('data', (data: Buffer) => {
        log.debug(`[${this.serverId} stderr] ${data.toString().trim()}`);
      });

      this.process.on('exit', (code) => {
        if (this.isDisposed || this.isShuttingDown) {
          log.info(`LSP server ${this.serverId} exited during shutdown with code ${code}`);
          return;
        }

        log.warn(`LSP server ${this.serverId} exited unexpectedly with code ${code}`);
        this.status = 'stopped';
        this.initialized = false;
      });

      this.process.on('error', (err) => {
        if (this.isDisposed || this.isShuttingDown) {
          log.debug(`Ignored LSP server ${this.serverId} error during shutdown: ${err.message}`);
          return;
        }

        log.error(`LSP server ${this.serverId} error:`, err);
        this.error = err.message;
        this.status = 'error';
      });

      await this.initialize();
      this.initialized = true;
      this.status = 'running';
      log.info(`LSP server ${this.serverId} initialized successfully`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      log.error(`Failed to start LSP server ${this.serverId}:`, errorMsg);
      this.error = errorMsg;
      this.status = 'error';
      throw err;
    }
  }

  private async initialize(): Promise<InitializeResult> {
    const initParams: InitializeParams = {
      processId: this.process?.pid,
      rootUri: pathToFileURL(this.rootPath).toString(),
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['markdown', 'plaintext'] },
          definition: { linkSupport: true },
          references: {},
          documentSymbol: {
            hierarchicalSymbolSupport: true,
          },
        },
        workspace: {
          symbol: {},
        },
      },
      workspaceFolders: null,
    };

    if (this.config.initializationOptions) {
      initParams.initializationOptions = this.config.initializationOptions;
    }

    if (!this.connection) {
      throw new Error('Connection not established');
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const result = await Promise.race([
        this.connection.sendRequest('initialize', initParams),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Initialize timeout')), INIT_TIMEOUT_MS);
        }),
      ]);

      this.connection.sendNotification('initialized', {});
      return result;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async touchFile(filePath: string, content?: string): Promise<void> {
    if (!this.connection || !this.initialized) {
      throw new Error('LSP client not initialized');
    }

    let fileContent = content;
    if (fileContent === undefined) {
      try {
        fileContent = await fs.readFile(filePath, 'utf-8');
      } catch {
        log.warn(`Could not read file for LSP: ${filePath}`);
        return;
      }
    }

    const uri = pathToFileURL(filePath).toString();
    const version = (this.fileVersions.get(filePath) || 0) + 1;
    this.fileVersions.set(filePath, version);
    this.fileLastTouchedAt.set(filePath, Date.now());

    if (this.openFiles.has(filePath)) {
      this.connection.sendNotification('textDocument/didChange', {
        textDocument: { uri, version },
        contentChanges: [{ text: fileContent }],
      });
      this.closeIdleFiles(filePath);
      log.debug(`Updated file: ${filePath}`);
      return;
    }

    const textDoc: TextDocumentItem = {
      uri,
      languageId: getLanguageId(filePath) || 'plaintext',
      version,
      text: fileContent,
    };

    this.connection.sendNotification('textDocument/didOpen', {
      textDocument: textDoc,
    });
    this.openFiles.add(filePath);
    this.closeIdleFiles(filePath);
    log.debug(`Opened file: ${filePath}`);
  }

  private closeIdleFiles(currentFilePath?: string): void {
    if (!this.connection || !this.initialized) {
      return;
    }

    const now = Date.now();
    for (const openFilePath of this.openFiles) {
      if (openFilePath === currentFilePath) {
        continue;
      }

      const lastTouchedAt = this.fileLastTouchedAt.get(openFilePath) || 0;
      if (now - lastTouchedAt <= FILE_IDLE_TTL_MS) {
        continue;
      }

      this.closeFile(openFilePath);
    }
  }

  private closeFile(filePath: string): void {
    if (!this.connection || !this.openFiles.has(filePath)) {
      return;
    }

    this.connection.sendNotification('textDocument/didClose', {
      textDocument: { uri: pathToFileURL(filePath).toString() },
    });
    this.openFiles.delete(filePath);
    this.fileVersions.delete(filePath);
    this.fileLastTouchedAt.delete(filePath);
    log.debug(`Closed idle file: ${filePath}`);
  }

  async hover(filePath: string, line: number, character: number): Promise<string> {
    if (!this.connection || !this.initialized) {
      throw new Error('LSP client not initialized');
    }

    const result = await this.connection.sendRequest('textDocument/hover', {
      textDocument: { uri: pathToFileURL(filePath).toString() },
      position: { line: line - 1, character: character - 1 },
    });

    if (!result || !result.contents) {
      log.debug(`[${this.serverId}] hover returned empty for ${filePath}:${line}:${character}`);
      return 'No hover information available.';
    }

    return this.formatHoverResult(result.contents);
  }

  private formatHoverResult(contents: unknown): string {
    if (typeof contents === 'string') {
      return contents || 'No hover information available.';
    }

    if (Array.isArray(contents)) {
      return contents
        .map((item) => (typeof item === 'string' ? item : item.value || ''))
        .filter(Boolean)
        .join('\n\n');
    }

    if (typeof contents === 'object' && contents !== null) {
      const content = contents as { kind?: string; value?: string };
      if (content.kind === 'markdown' || content.kind === 'plaintext') {
        return content.value || 'No hover information available.';
      }
    }

    return 'No hover information available.';
  }

  async goToDefinition(filePath: string, line: number, character: number): Promise<string> {
    if (!this.connection || !this.initialized) {
      throw new Error('LSP client not initialized');
    }

    const result = await this.connection.sendRequest('textDocument/definition', {
      textDocument: { uri: pathToFileURL(filePath).toString() },
      position: { line: line - 1, character: character - 1 },
    });

    if (!result) {
      return 'No definition found.';
    }

    const locations = Array.isArray(result) ? result : [result];
    return this.formatLocations(locations, 'definition');
  }

  async findReferences(filePath: string, line: number, character: number): Promise<string> {
    if (!this.connection || !this.initialized) {
      throw new Error('LSP client not initialized');
    }

    const result = await this.connection.sendRequest('textDocument/references', {
      textDocument: { uri: pathToFileURL(filePath).toString() },
      position: { line: line - 1, character: character - 1 },
      context: { includeDeclaration: true },
    });

    if (!result || result.length === 0) {
      return 'No references found.';
    }

    return this.formatLocations(result, 'reference');
  }

  private async formatLocations(locations: Location[], type: string): Promise<string> {
    const results: string[] = [];

    for (const loc of locations.slice(0, 50)) {
      const filePath = fileURLToPath(loc.uri);
      const line = loc.range.start.line + 1;
      const col = loc.range.start.character + 1;

      let snippet = '';
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        if (lines[loc.range.start.line]) {
          snippet = lines[loc.range.start.line].trim();
        }
      } catch {
        // Ignore
      }

      results.push(`${filePath}:${line}:${col}\n  ${snippet}`);
    }

    if (locations.length > 50) {
      results.push(`\n... and ${locations.length - 50} more`);
    }

    return `Found ${locations.length} ${type}${locations.length !== 1 ? 's' : ''}:\n\n${results.join('\n\n')}`;
  }

  async documentSymbol(filePath: string): Promise<string> {
    if (!this.connection || !this.initialized) {
      throw new Error('LSP client not initialized');
    }

    const result = await this.connection.sendRequest('textDocument/documentSymbol', {
      textDocument: { uri: pathToFileURL(filePath).toString() },
    });

    if (!result || result.length === 0) {
      log.debug(`[${this.serverId}] documentSymbol returned empty for ${filePath}`);
      return 'No symbols found in document.';
    }

    log.debug(`[${this.serverId}] documentSymbol returned ${result.length} symbols for ${filePath}`);
    return this.formatDocumentSymbols(result);
  }

  private formatDocumentSymbols(symbols: (DocumentSymbol | SymbolInformation)[]): string {
    const formatSymbol = (symbol: DocumentSymbol | SymbolInformation, indent = 0): string => {
      const prefix = '  '.repeat(indent);
      const name = symbol.name;
      const kind = this.symbolKindToString(symbol.kind);

      if ('range' in symbol && 'children' in symbol) {
        const line = symbol.range.start.line + 1;
        let result = `${prefix}${name} (${kind}) - line ${line}`;
        if (symbol.children && symbol.children.length > 0) {
          for (const child of symbol.children) {
            result += '\n' + formatSymbol(child, indent + 1);
          }
        }
        return result;
      } else if ('location' in symbol) {
        const line = symbol.location.range.start.line + 1;
        return `${prefix}${name} (${kind}) - line ${line}`;
      }

      return `${prefix}${name} (${kind})`;
    };

    return symbols.map((s) => formatSymbol(s)).join('\n');
  }

  async workspaceSymbol(query: string): Promise<string> {
    if (!this.connection || !this.initialized) {
      throw new Error('LSP client not initialized');
    }

    const result = await this.connection.sendRequest('workspace/symbol', {
      query,
    });

    if (!result || result.length === 0) {
      log.debug(`[${this.serverId}] workspaceSymbol returned empty for query: ${query}`);
      return 'No symbols found matching query.';
    }

    log.debug(`[${this.serverId}] workspaceSymbol returned ${result.length} entries for query: ${query}`);
    const results = result.slice(0, 50).map((symbol) => {
      const name = symbol.name;
      const kind = this.symbolKindToString(symbol.kind);
      const filePath = fileURLToPath(symbol.location.uri);
      let location: string;

      if ('range' in symbol.location) {
        const line = symbol.location.range.start.line + 1;
        location = `${filePath}:${line}`;
      } else {
        location = filePath;
      }

      return `${name} (${kind}) - ${location}`;
    });

    let output = results.join('\n');
    if (result.length > 50) {
      output += `\n\n... and ${result.length - 50} more`;
    }

    return output;
  }

  private symbolKindToString(kind: number): string {
    const kinds = [
      'File', 'Module', 'Namespace', 'Package', 'Class', 'Method', 'Property',
      'Field', 'Constructor', 'Enum', 'Interface', 'Function', 'Variable',
      'Constant', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Key',
      'Null', 'EnumMember', 'Struct', 'Event', 'Operator', 'TypeParameter',
    ];
    return kinds[kind - 1] || 'Unknown';
  }

  async shutdown(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    this.isShuttingDown = true;

    if (this.connection && this.initialized) {
      try {
        await this.connection.sendRequest('shutdown', {});
        this.connection.sendNotification('exit', {});
      } catch {
        // Ignore errors during shutdown
      }
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    if (this.connection) {
      this.connection.dispose();
      this.connection = null;
    }

    this.initialized = false;
    this.status = 'stopped';
    this.openFiles.clear();
    this.fileVersions.clear();
    this.fileLastTouchedAt.clear();
    this.isDisposed = true;
    log.info(`LSP client ${this.serverId} shut down`);
  }
}
