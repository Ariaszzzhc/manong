import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../logger';

const log = createLogger('list_dir');

const ListDirSchema = z.object({
  path: z.string().optional().describe('The path to the directory to list. Defaults to current working directory.'),
});

export const listDirTool = defineTool({
  name: 'list_dir',
  description: 'List contents of a directory. If no path is provided, lists the current working directory.',
  parameters: ListDirSchema,
  execute: async (
    params: z.infer<typeof ListDirSchema>,
    context: ToolContext
  ) => {
    try {
      // Default to working directory if no path provided
      const dirPath = params.path
        ? (path.isAbsolute(params.path) ? params.path : path.join(context.workingDir, params.path))
        : context.workingDir;

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const lines = entries.map((entry) => {
        const prefix = entry.isDirectory() ? '📁 ' : '📄 ';
        return `${prefix}${entry.name}`;
      });

      return {
        success: true,
        output: lines.join('\n') || '(empty directory)',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error listing directory:', errorMsg);
      return {
        success: false,
        output: `Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
});

toolRegistry.register(listDirTool);
