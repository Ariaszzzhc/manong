import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import { spawn } from 'child_process';
import { createLogger } from '../logger';

const log = createLogger('bash');

const MAX_OUTPUT = 50000;
const HALF_MAX = 25000;

const BashSchema = z.object({
  command: z.string().describe('The shell command to execute'),
  timeout: z
    .number()
    .optional()
    .default(60000)
    .describe('Timeout in milliseconds (default 60s)'),
  description: z
    .string()
    .optional()
    .describe('Human-readable description of what the command does'),
});

function truncateOutput(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  const removed = text.length - HALF_MAX * 2;
  return (
    text.slice(0, HALF_MAX) +
    `\n\n... [truncated ${removed} characters] ...\n\n` +
    text.slice(-HALF_MAX)
  );
}

export const bashTool = defineTool({
  name: 'bash',
  description:
    'Execute a shell command. Returns stdout, stderr, and exit code. Use with caution.',
  parameters: BashSchema,
  execute: async (
    params: z.infer<typeof BashSchema>,
    context: ToolContext
  ) => {
    if (!params.command || params.command.trim() === '') {
      return {
        success: false,
        output: 'Error: No command provided. Please specify a command to execute.',
        error: 'Missing command parameter',
      };
    }

    return new Promise((resolve) => {
      const timeout = params.timeout ?? 60000;

      const proc = spawn('sh', ['-c', params.command], {
        cwd: context.workingDir,
        timeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        const exitCode = code ?? 1;
        let output = `[exit code: ${exitCode}]\n`;
        output += truncateOutput(stdout);
        if (stderr) {
          output += `\n[stderr]\n${truncateOutput(stderr)}`;
        }
        resolve({
          success: exitCode === 0,
          output,
          error: exitCode !== 0 ? `Exit code: ${exitCode}` : undefined,
        });
      });

      proc.on('error', (error) => {
        log.error('Error executing command:', error.message);
        resolve({
          success: false,
          output: `Error: ${error.message}`,
          error: error.message,
        });
      });
    });
  },
});

toolRegistry.register(bashTool);
