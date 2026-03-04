import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../logger';

const log = createLogger('list_dir');

const IGNORE_ENTRIES = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  '__pycache__',
  '.next',
  'dist',
  'build',
  '.cache',
  'Thumbs.db',
]);

const ListDirSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Directory path (defaults to working directory)'),
  recursive: z
    .boolean()
    .optional()
    .describe('List recursively with tree structure (default false, max depth 3)'),
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

async function listRecursive(dir: string, depth: number, maxDepth: number): Promise<string[]> {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return lines;
  }

  const dirs = entries.filter((e) => e.isDirectory() && !IGNORE_ENTRIES.has(e.name)).sort((a, b) => a.name.localeCompare(b.name));
  const files = entries.filter((e) => !e.isDirectory() && !IGNORE_ENTRIES.has(e.name)).sort((a, b) => a.name.localeCompare(b.name));

  for (const d of dirs) {
    lines.push(`${indent}📁 ${d.name}/`);
    if (depth < maxDepth) {
      const children = await listRecursive(path.join(dir, d.name), depth + 1, maxDepth);
      lines.push(...children);
    } else {
      lines.push(`${indent}  ...`);
    }
  }

  for (const f of files) {
    try {
      const stat = await fs.stat(path.join(dir, f.name));
      lines.push(`${indent}📄 ${f.name}    ${formatSize(stat.size)}`);
    } catch {
      lines.push(`${indent}📄 ${f.name}`);
    }
  }

  return lines;
}

export const listDirTool = defineTool({
  name: 'list_dir',
  description:
    'List contents of a directory. Shows directories and files with sizes. Common noise directories are filtered out.',
  parameters: ListDirSchema,
  execute: async (
    params: z.infer<typeof ListDirSchema>,
    context: ToolContext
  ) => {
    try {
      const dirPath = params.path
        ? path.isAbsolute(params.path)
          ? params.path
          : path.join(context.workingDir, params.path)
        : context.workingDir;

      if (params.recursive) {
        const lines = await listRecursive(dirPath, 0, 3);
        return {
          success: true,
          output: lines.join('\n') || '(empty directory)',
        };
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const filtered = entries.filter((e) => !IGNORE_ENTRIES.has(e.name));

      const dirs = filtered.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
      const files = filtered.filter((e) => !e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));

      const lines: string[] = [];

      for (const d of dirs) {
        lines.push(`📁 ${d.name}/`);
      }

      for (const f of files) {
        try {
          const stat = await fs.stat(path.join(dirPath, f.name));
          lines.push(`📄 ${f.name}    ${formatSize(stat.size)}`);
        } catch {
          lines.push(`📄 ${f.name}`);
        }
      }

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
