import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../logger';
import { computeFileDiff } from './diff-utils';

const log = createLogger('edit_file');

const EditFileSchema = z.object({
  file_path: z.string().describe('The path to the file to edit'),
  old_string: z.string().describe('The text to replace'),
  new_string: z.string().describe('The text to replace it with'),
  replace_all: z
    .boolean()
    .optional()
    .describe('Replace all occurrences (default false)'),
});

export const editFileTool = defineTool({
  name: 'edit_file',
  description:
    'Edit a file by replacing specific text. Use this for making targeted changes to existing files.',
  parameters: EditFileSchema,
  execute: async (
    params: z.infer<typeof EditFileSchema>,
    context: ToolContext
  ) => {
    // Validate parameters
    if (!params.file_path || params.file_path.trim() === '') {
      return {
        success: false,
        output: 'Error: No file path provided. Please specify a file to edit.',
        error: 'Missing file_path parameter',
      };
    }
    if (!params.old_string) {
      return {
        success: false,
        output: 'Error: No old_string provided. Please specify text to replace.',
        error: 'Missing old_string parameter',
      };
    }
    if (params.new_string === undefined || params.new_string === null) {
      return {
        success: false,
        output: 'Error: No new_string provided. Please specify replacement text.',
        error: 'Missing new_string parameter',
      };
    }

    try {
      const filePath = path.isAbsolute(params.file_path)
        ? params.file_path
        : path.join(context.workingDir, params.file_path);

      const content = await fs.readFile(filePath, 'utf-8');

      const occurrences = content.split(params.old_string).length - 1;

      if (occurrences === 0) {
        return {
          success: false,
          output: `Error: Text not found in file: "${params.old_string.slice(0, 50)}..."`,
          error: `Text not found in file`,
        };
      }

      if (occurrences > 1 && !params.replace_all) {
        return {
          success: false,
          output: `Error: old_string matches ${occurrences} locations in the file. Either provide more surrounding context to make old_string unique, or set replace_all=true to replace all occurrences.`,
          error: 'Ambiguous edit: multiple matches',
        };
      }

      const newContent = params.replace_all
        ? content.split(params.old_string).join(params.new_string)
        : content.replace(params.old_string, params.new_string);

      await fs.writeFile(filePath, newContent, 'utf-8');

      const diff = computeFileDiff(params.file_path, content, newContent);

      return {
        success: true,
        output: `File edited successfully: ${filePath}`,
        diff,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error editing file:', errorMsg);
      return {
        success: false,
        output: `Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
});

toolRegistry.register(editFileTool);
