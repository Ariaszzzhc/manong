import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import * as path from 'path';
import { lspManager } from '../lsp';
import { createLogger } from '../logger';

const log = createLogger('LSPTool');

const LSPOperationSchema = z.enum([
  'hover',
  'goToDefinition',
  'findReferences',
  'documentSymbol',
  'workspaceSymbol',
]);

const LSPToolSchema = z.object({
  operation: LSPOperationSchema.describe(
    'LSP operation to perform: hover (type info), goToDefinition, findReferences, documentSymbol (file symbols), workspaceSymbol (search all symbols)'
  ),
  filePath: z.string().describe('Absolute path to the file (must be inside current workspace)'),
  line: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Line number (1-based). Required for hover, goToDefinition, findReferences'),
  character: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Character position (1-based). Required for hover, goToDefinition, findReferences'),
  query: z
    .string()
    .optional()
    .describe('Search query. Required for workspaceSymbol operation'),
});

export const lspTool = defineTool({
  name: 'lsp',
  description: `Query language servers for code intelligence (hover info, go-to-definition, find references, symbols).

Operations:
- hover: Get type information and documentation at cursor position
- goToDefinition: Find where a symbol is defined
- findReferences: Find all references to a symbol
- documentSymbol: List all symbols in a file (functions, classes, variables)
- workspaceSymbol: Search for symbols across the entire project

You must provide an absolute filePath for all operations.
For hover, goToDefinition, and findReferences, you must provide line and character (1-based positions).
For workspaceSymbol, you must provide a query string.`,
  parameters: LSPToolSchema,
  execute: async (params: z.infer<typeof LSPToolSchema>, context: ToolContext) => {
    const positionOps = ['hover', 'goToDefinition', 'findReferences'];

    if (positionOps.includes(params.operation)) {
      if (!params.line || !params.character) {
        return {
          success: false,
          output: `Error: ${params.operation} requires line and character parameters.`,
          error: 'Missing position parameters',
        };
      }
    }

    if (params.operation === 'workspaceSymbol' && !params.query) {
      return {
        success: false,
        output: 'Error: workspaceSymbol requires a query parameter.',
        error: 'Missing query parameter',
      };
    }

    try {
      if (!path.isAbsolute(params.filePath)) {
        return {
          success: false,
          output: `LSP requires an absolute file path. Received: ${params.filePath}`,
          error: 'filePath must be absolute',
        };
      }

      const workspacePath = path.resolve(context.workingDir);
      const normalizedPath = path.resolve(params.filePath);
      const relativePath = path.relative(workspacePath, normalizedPath);

      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return {
          success: false,
          output: `LSP only supports files inside the current workspace: ${params.filePath}`,
          error: 'File outside workspace',
        };
      }

      const clients = await lspManager.getClientsForFile(normalizedPath);

      if (clients.length === 0) {
        return {
          success: false,
          output: `No LSP server available for file: ${params.filePath}`,
          error: 'No LSP server',
        };
      }

      const client = clients[0];

      await client.touchFile(normalizedPath);

      let result: string;

      switch (params.operation) {
        case 'hover':
          result = await client.hover(normalizedPath, params.line as number, params.character as number);
          break;
        case 'goToDefinition':
          result = await client.goToDefinition(normalizedPath, params.line as number, params.character as number);
          break;
        case 'findReferences':
          result = await client.findReferences(normalizedPath, params.line as number, params.character as number);
          break;
        case 'documentSymbol':
          result = await client.documentSymbol(normalizedPath);
          break;
        case 'workspaceSymbol':
          result = await client.workspaceSymbol(params.query as string);
          break;
        default:
          return {
            success: false,
            output: `Unknown operation: ${params.operation}`,
            error: 'Unknown operation',
          };
      }

      return {
        success: true,
        output: result,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      log.error('LSP tool error:', errorMsg);
      return {
        success: false,
        output: `Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
});

toolRegistry.register(lspTool);
