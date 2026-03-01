import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import { glob } from 'glob';
import * as path from 'path';
import { createLogger } from '../logger';

const log = createLogger('search_file');

const SearchFileSchema = z.object({
  pattern: z.string().describe('Glob pattern to search for files'),
  path: z
    .string()
    .optional()
    .describe('Directory to search in (defaults to working directory)'),
});

export const searchFileTool = defineTool({
  name: 'search_file',
  description: 'Search for files matching a glob pattern.',
  parameters: SearchFileSchema,
  execute: async (
    params: z.infer<typeof SearchFileSchema>,
    context: ToolContext
  ) => {
    // Validate pattern parameter
    if (!params.pattern || params.pattern.trim() === '') {
      return {
        success: false,
        output: 'Error: No search pattern provided. Please specify a glob pattern.',
        error: 'Missing pattern parameter',
      };
    }

    try {
      const searchPath = params.path
        ? path.isAbsolute(params.path)
          ? params.path
          : path.join(context.workingDir, params.path)
        : context.workingDir;

      const files = await glob(params.pattern, {
        cwd: searchPath,
        nodir: true,
      });

      if (files.length === 0) {
        return {
          success: true,
          output: 'No files found matching pattern.',
        };
      }

      return {
        success: true,
        output: files.slice(0, 100).join('\n'),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error searching files:', errorMsg);
      return {
        success: false,
        output: `Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
});

toolRegistry.register(searchFileTool);
