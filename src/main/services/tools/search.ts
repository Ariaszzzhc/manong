import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../logger';

const log = createLogger('glob');

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/__pycache__/**',
  '**/.next/**',
];

const GlobSchema = z.object({
  pattern: z
    .string()
    .describe('Glob pattern to match files (e.g. "**/*.ts", "src/**/*.tsx")'),
  path: z
    .string()
    .optional()
    .describe('Directory to search in (defaults to working directory)'),
  max_results: z
    .number()
    .optional()
    .describe('Maximum number of results (default 200)'),
});

async function loadGitignore(dir: string): Promise<string[]> {
  try {
    const content = await fs.readFile(path.join(dir, '.gitignore'), 'utf-8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((pattern) => {
        if (pattern.startsWith('/')) pattern = pattern.slice(1);
        if (!pattern.includes('/') && !pattern.startsWith('*')) {
          return `**/${pattern}/**`;
        }
        return pattern.endsWith('/') ? `${pattern}**` : pattern;
      });
  } catch {
    return [];
  }
}

export const globTool = defineTool({
  name: 'glob',
  description:
    'Search for files matching a glob pattern. Returns matching file paths sorted by modification time (newest first).',
  parameters: GlobSchema,
  execute: async (
    params: z.infer<typeof GlobSchema>,
    context: ToolContext
  ) => {
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

      const gitignorePatterns = await loadGitignore(searchPath);
      const ignoreList = [...DEFAULT_IGNORE, ...gitignorePatterns];

      const files = await glob(params.pattern, {
        cwd: searchPath,
        nodir: true,
        ignore: ignoreList,
      });

      if (files.length === 0) {
        return {
          success: true,
          output: 'No files found matching pattern.',
        };
      }

      const withStats = await Promise.all(
        files.map(async (file) => {
          try {
            const stat = await fs.stat(path.join(searchPath, file));
            return { file, mtime: stat.mtimeMs };
          } catch {
            return { file, mtime: 0 };
          }
        })
      );

      withStats.sort((a, b) => b.mtime - a.mtime);

      const limit = params.max_results ?? 200;
      const truncated = withStats.length > limit;
      const result = withStats.slice(0, limit).map((s) => s.file);

      let output = result.join('\n');
      if (truncated) {
        output += `\n\n... (${withStats.length - limit} more files not shown)`;
      }

      return {
        success: true,
        output,
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

toolRegistry.register(globTool);
