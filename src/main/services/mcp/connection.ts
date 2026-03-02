import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { MCPServerConfig, MCPConnectionStatus, MCPToolInfo } from '../../../shared/mcp-types';
import { createLogger } from '../logger';

const log = createLogger('MCPConnection');

export class MCPConnection {
  private name: string;
  private config: MCPServerConfig;
  private client: Client | null = null;
  private transport: StdioClientTransport | StreamableHTTPClientTransport | null = null;
  private status: MCPConnectionStatus = 'disconnected';
  private tools: MCPToolInfo[] = [];
  private error: string | undefined;

  constructor(name: string, config: MCPServerConfig) {
    this.name = name;
    this.config = config;
  }

  async connect(): Promise<void> {
    this.status = 'connecting';
    this.error = undefined;

    try {
      this.client = new Client(
        { name: 'manong', version: '1.0.0' },
        { capabilities: {} }
      );

      const transportType = this.config.transport ?? 'stdio';

      if (transportType === 'http') {
        if (!this.config.url) {
          throw new Error('HTTP transport requires a URL');
        }
        this.transport = new StreamableHTTPClientTransport(new URL(this.config.url), {
          requestInit: {
            headers: this.config.headers,
          },
        });
      } else {
        if (!this.config.command) {
          throw new Error('Stdio transport requires a command');
        }
        this.transport = new StdioClientTransport({
          command: this.config.command,
          args: this.config.args || [],
          env: this.config.env ? { ...process.env, ...this.config.env } : process.env as Record<string, string>,
        });
      }

      this.client.onerror = (error) => {
        log.error(`Client error for ${this.name}:`, error);
        if (this.status === 'connected') {
          this.status = 'error';
          this.error = String(error);
        }
      };

      await this.client.connect(this.transport);

      const toolsResult = await this.client.listTools();
      this.tools = toolsResult.tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? undefined,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      }));

      this.status = 'connected';
      log.info(`Connected to ${this.name}, found ${this.tools.length} tools`);
    } catch (error) {
      this.status = 'error';
      this.error = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Failed to connect to ${this.name}:`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        log.error(`Error closing client for ${this.name}:`, error);
      }
      this.client = null;
    }
    this.transport = null;
    this.tools = [];
    this.status = 'disconnected';
    log.info(`Disconnected from ${this.name}`);
  }

  getStatus(): MCPConnectionStatus {
    return this.status;
  }

  getError(): string | undefined {
    return this.error;
  }

  getTools(): MCPToolInfo[] {
    return this.tools;
  }

  getTool(name: string): MCPToolInfo | undefined {
    return this.tools.find((t) => t.name === name);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string }> }> {
    if (!this.client) {
      throw new Error('Not connected');
    }

    log.debug(`Calling tool ${name} on ${this.name}`);
    const result = await this.client.callTool({ name, arguments: args });

    return {
      content: result.content.map((c) => {
        if (c.type === 'text') {
          return { type: 'text', text: c.text };
        }
        return { type: c.type };
      }),
    };
  }
}
