import type { ToolDefinition } from '../../shared/tool';

export type ToolSource = 'builtin' | 'mcp';

interface ToolEntry {
  tool: ToolDefinition<unknown>;
  source: ToolSource;
  serverName?: string;
}

class ToolRegistry {
  private tools: Map<string, ToolEntry> = new Map();

  register(tool: ToolDefinition<unknown>, source: ToolSource = 'builtin'): void {
    this.tools.set(tool.name, { tool, source });
  }

  registerMCPTool(tool: ToolDefinition<unknown>, serverName: string): void {
    this.tools.set(tool.name, { tool, source: 'mcp', serverName });
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): ToolDefinition<unknown> | undefined {
    return this.tools.get(name)?.tool;
  }

  getEntry(name: string): ToolEntry | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition<unknown>[] {
    return Array.from(this.tools.values()).map((entry) => entry.tool);
  }

  getBySource(source: ToolSource): ToolDefinition<unknown>[] {
    return Array.from(this.tools.values())
      .filter((entry) => entry.source === source)
      .map((entry) => entry.tool);
  }

  getMCPTools(): Array<{ tool: ToolDefinition<unknown>; serverName: string }> {
    return Array.from(this.tools.values())
      .filter((entry) => entry.source === 'mcp')
      .map((entry) => ({ tool: entry.tool, serverName: entry.serverName! }));
  }

  getToolSchemas(): Array<{
    name: string;
    description: string;
    parameters: unknown;
  }> {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}

export const toolRegistry = new ToolRegistry();
