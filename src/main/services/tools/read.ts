import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../logger';

const log = createLogger('read_file');

const DEFAULT_LINE_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const BINARY_CHECK_BYTES = 8192;

const ReadFileSchema = z.object({
  file_path: z.string().describe('The path to the file to read'),
  offset: z.number().optional().describe('Line number to start reading from'),
  limit: z.number().optional().describe('Number of lines to read'),
});

export const readFileTool = defineTool({
  name: 'read_file',
  description:
    'Read a file from the local filesystem. Returns file contents with line numbers.',
  parameters: ReadFileSchema,
  execute: async (
    params: z.infer<typeof ReadFileSchema>,
    context: ToolContext
  ) => {
    if (!params.file_path || params.file_path.trim() === '') {
      return {
        success: false,
        output: 'Error: No file path provided. Please specify a file to read.',
        error: 'Missing file_path parameter',
      };
    }

    try {
      const filePath = path.isAbsolute(params.file_path)
        ? params.file_path
        : path.join(context.workingDir, params.file_path);

      const handle = await fs.open(filePath, 'r');
      try {
        const checkBuf = Buffer.alloc(BINARY_CHECK_BYTES);
        const { bytesRead } = await handle.read(checkBuf, 0, BINARY_CHECK_BYTES, 0);
        if (bytesRead > 0 && checkBuf.subarray(0, bytesRead).includes(0x00)) {
          return {
            success: false,
            output: 'Error: File appears to be binary. Use bash tool to inspect binary files.',
            error: 'Binary file detected',
          };
        }
      } finally {
        await handle.close();
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const totalLines = lines.length;

      const offset = params.offset ?? 1;
      const userProvidedLimit = params.limit !== undefined;
      const limit = userProvidedLimit ? (params.limit as number) : DEFAULT_LINE_LIMIT;

      const selectedLines = lines.slice(offset - 1, offset - 1 + limit);
      const numberedContent = selectedLines
        .map((line, idx) => {
          const lineNum = offset + idx;
          if (line.length > MAX_LINE_LENGTH) {
            return `${lineNum}\t${line.slice(0, MAX_LINE_LENGTH)}... [truncated, line has ${line.length} chars]`;
          }
          return `${lineNum}\t${line}`;
        })
        .join('\n');

      let output = numberedContent;

      if (!userProvidedLimit && totalLines > DEFAULT_LINE_LIMIT && offset === 1) {
        output += `\n\n[File has ${totalLines} lines total, showing first ${DEFAULT_LINE_LIMIT}. Use offset/limit to read more.]`;
      }

      return {
        success: true,
        output,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error reading file:', errorMsg);
      return {
        success: false,
        output: `Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
});

toolRegistry.register(readFileTool);
