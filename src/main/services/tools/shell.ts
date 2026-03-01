import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import { spawn } from 'child_process';
import { createLogger } from '../logger';

const log = createLogger('run_shell');

const RunShellSchema = z.object({
  command: z.string().describe('The shell command to execute'),
  timeout: z
    .number()
    .optional()
    .default(60000)
    .describe('Timeout in milliseconds (default 60s)'),
});

export const runShellTool = defineTool({
  name: 'run_shell',
  description:
    'Execute a shell command. Use with caution. Returns stdout and stderr.',
  parameters: RunShellSchema,
  execute: async (
    params: z.infer<typeof RunShellSchema>,
    context: ToolContext
  ) => {
    // Validate command parameter
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
        const output =
          stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
        resolve({
          success: code === 0,
          output: output || `Process exited with code ${code}`,
          error: code !== 0 ? `Exit code: ${code}` : undefined,
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

toolRegistry.register(runShellTool);
