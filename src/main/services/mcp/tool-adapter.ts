import { z } from 'zod';
import type { ToolDefinition, ToolContext, ToolResult } from '../../../shared/tool';
import type { MCPToolInfo, MCPToolCallResult } from '../../../shared/mcp-types';
import { createLogger } from '../logger';

const log = createLogger('MCPToolAdapter');

export class MCPToolAdapter {
  static toToolDefinition(
    toolInfo: MCPToolInfo,
    serverName: string,
    executor: (args: Record<string, unknown>) => Promise<MCPToolCallResult>
  ): ToolDefinition {
    const zodSchema = MCPToolAdapter.jsonSchemaToZod(toolInfo.inputSchema);

    return {
      name: `mcp__${serverName}__${toolInfo.name}`,
      description: toolInfo.description || `MCP tool from ${serverName}`,
      parameters: zodSchema,
      execute: async (params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> => {
        try {
          const result = await executor(params);

          if (result.isError) {
            const errorText = result.content
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('\n');
            return {
              success: false,
              output: errorText || 'MCP tool returned an error',
            };
          }

          const output = result.content
            .map((c) => {
              if (c.type === 'text') return c.text;
              if (c.type === 'image') return `[Image: ${c.mimeType}]`;
              if (c.type === 'resource') return `[Resource: ${c.text}]`;
              return '';
            })
            .join('\n');

          return {
            success: true,
            output,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          log.error(`MCP tool execution failed: ${message}`);
          return {
            success: false,
            output: message,
          };
        }
      },
    };
  }

  private static jsonSchemaToZod(schema: Record<string, unknown>): z.ZodSchema {
    if (!schema || typeof schema !== 'object') {
      return z.record(z.unknown());
    }

    const type = schema.type as string | undefined;
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
    const required = schema.required as string[] | undefined;
    const items = schema.items as Record<string, unknown> | undefined;

    if (type === 'object' && properties) {
      const shape: Record<string, z.ZodSchema> = {};

      for (const [key, prop] of Object.entries(properties)) {
        const propSchema = MCPToolAdapter.jsonSchemaToZod(prop);
        const isRequired = required?.includes(key);

        shape[key] = isRequired ? propSchema : propSchema.optional();
      }

      return z.object(shape);
    }

    if (type === 'array' && items) {
      return z.array(MCPToolAdapter.jsonSchemaToZod(items));
    }

    if (type === 'string') {
      let schema = z.string();
      if (schema.description) {
        schema = schema.describe(schema.description);
      }
      return schema;
    }

    if (type === 'number' || type === 'integer') {
      return z.number();
    }

    if (type === 'boolean') {
      return z.boolean();
    }

    if (type === 'null') {
      return z.null();
    }

    return z.unknown();
  }
}
