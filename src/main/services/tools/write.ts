import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../logger';

const log = createLogger('write_file');

const WriteFileSchema = z.object({
  file_path: z.string().describe('The path to the file to write'),
  content: z.string().describe('The content to write to the file'),
});

export const writeFileTool = defineTool({
  name: 'write_file',
  description:
    'Write content to a file. Creates the file if it does not exist, overwrites if it does.',
  parameters: WriteFileSchema,
  execute: async (
    params: z.infer<typeof WriteFileSchema>,
    context: ToolContext
  ) => {
    // Validate parameters
    if (!params.file_path || params.file_path.trim() === '') {
      return {
        success: false,
        output: 'Error: No file path provided. Please specify a file path.',
        error: 'Missing file_path parameter',
      };
    }
    if (params.content === undefined || params.content === null) {
      return {
        success: false,
        output: 'Error: No content provided. Please specify content to write.',
        error: 'Missing content parameter',
      };
    }

    try {
      const filePath = path.isAbsolute(params.file_path)
        ? params.file_path
        : path.join(context.workingDir, params.file_path);

      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(filePath, params.content, 'utf-8');

      return {
        success: true,
        output: `File written successfully: ${filePath}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error writing file:', errorMsg);
      return {
        success: false,
        output: `Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
});

toolRegistry.register(writeFileTool);
