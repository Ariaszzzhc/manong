import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../logger';

const log = createLogger('grep');

const IGNORE_DIRS = ['.git', 'node_modules', 'dist', 'build', '__pycache__', '.next'];

const GrepSchema = z.object({
  pattern: z.string().describe('Regular expression pattern to search for'),
  path: z
    .string()
    .optional()
    .describe('Directory to search in (defaults to working directory)'),
  glob: z
    .string()
    .optional()
    .describe('File glob filter (e.g. "*.ts", "*.{js,jsx}")'),
  include_context: z
    .number()
    .optional()
    .describe('Number of context lines before and after each match (default 0)'),
  max_results: z
    .number()
    .optional()
    .describe('Maximum number of matching lines to return (default 100)'),
});

async function isRgAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('rg', ['--version']);
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function searchWithRg(
  pattern: string,
  searchPath: string,
  glob?: string,
  contextLines?: number,
  maxResults?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const limit = maxResults ?? 100;
    const args = [
      '--line-number',
      '--no-heading',
      '--color', 'never',
    ];

    if (glob) {
      args.push('--glob', glob);
    }

    if (contextLines && contextLines > 0) {
      args.push('-C', String(contextLines));
    }

    args.push(pattern, searchPath);

    const proc = spawn('rg', args);
    let output = '';
    let lineCount = 0;
    let truncated = false;

    proc.stdout.on('data', (data: Buffer) => {
      if (truncated) return;
      const chunk = data.toString();
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (lineCount >= limit) {
          truncated = true;
          break;
        }
        if (line) lineCount++;
        output += line + '\n';
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      log.debug('rg stderr:', data.toString());
    });

    proc.on('close', (code) => {
      if (code === 1) {
        resolve('');
      } else if (code !== 0 && code !== null) {
        reject(new Error(`rg exited with code ${code}`));
      } else {
        resolve(output.trimEnd());
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

async function searchWithNode(
  pattern: string,
  searchPath: string,
  globFilter?: string,
  contextLines?: number,
  maxResults?: number
): Promise<string> {
  const limit = maxResults ?? 100;
  const regex = new RegExp(pattern);
  const results: string[] = [];
  let totalMatches = 0;

  function matchGlob(filePath: string, globPattern: string): boolean {
    const ext = globPattern.replace(/^\*\.?/, '.');
    if (globPattern.startsWith('*.') && !globPattern.includes('/')) {
      return filePath.endsWith(ext);
    }
    if (globPattern.startsWith('*.{') && globPattern.endsWith('}')) {
      const exts = globPattern.slice(3, -1).split(',').map((e) => '.' + e.trim());
      return exts.some((e) => filePath.endsWith(e));
    }
    return filePath.includes(globPattern);
  }

  async function walkDir(dir: string): Promise<void> {
    if (totalMatches >= limit) return;

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (totalMatches >= limit) break;

      if (entry.isDirectory()) {
        if (IGNORE_DIRS.includes(entry.name)) continue;
        await walkDir(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const filePath = path.join(dir, entry.name);
        const relativePath = path.relative(searchPath, filePath);

        if (globFilter && !matchGlob(relativePath, globFilter)) continue;

        try {
          const buf = await fs.readFile(filePath);
          if (buf.includes(0x00)) continue;

          const content = buf.toString('utf-8');
          const lines = content.split('\n');
          const ctx = contextLines ?? 0;

          for (let i = 0; i < lines.length; i++) {
            if (totalMatches >= limit) break;
            if (regex.test(lines[i])) {
              totalMatches++;
              const start = Math.max(0, i - ctx);
              const end = Math.min(lines.length - 1, i + ctx);
              for (let j = start; j <= end; j++) {
                const sep = j === i ? ':' : '-';
                results.push(`${relativePath}:${j + 1}${sep}${lines[j]}`);
              }
              if (ctx > 0) results.push('--');
            }
          }
        } catch {
          continue;
        }
      }
    }
  }

  await walkDir(searchPath);
  return results.join('\n');
}

export const grepTool = defineTool({
  name: 'grep',
  description:
    'Search file contents using regular expressions. Uses ripgrep if available, otherwise falls back to Node.js implementation.',
  parameters: GrepSchema,
  execute: async (
    params: z.infer<typeof GrepSchema>,
    context: ToolContext
  ) => {
    if (!params.pattern || params.pattern.trim() === '') {
      return {
        success: false,
        output: 'Error: No search pattern provided. Please specify a regex pattern.',
        error: 'Missing pattern parameter',
      };
    }

    try {
      const searchPath = params.path
        ? path.isAbsolute(params.path)
          ? params.path
          : path.join(context.workingDir, params.path)
        : context.workingDir;

      const limit = params.max_results ?? 100;
      let output: string;

      if (await isRgAvailable()) {
        output = await searchWithRg(
          params.pattern,
          searchPath,
          params.glob,
          params.include_context,
          limit
        );
      } else {
        output = await searchWithNode(
          params.pattern,
          searchPath,
          params.glob,
          params.include_context,
          limit
        );
      }

      if (!output) {
        return {
          success: true,
          output: 'No matches found.',
        };
      }

      const matchLines = output.split('\n').filter((l) => l.includes(':')).length;
      let result = output;
      if (matchLines >= limit) {
        result += `\n\n... (results truncated at ${limit} matches)`;
      }

      return {
        success: true,
        output: result,
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

toolRegistry.register(grepTool);
