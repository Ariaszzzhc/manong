import { ZodSchema, z } from 'zod';
import type { FileDiffInfo } from './types';

export interface ToolDefinition<T = unknown> {
  name: string;
  description: string;
  parameters: ZodSchema<T>;
  execute: (params: T, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  workingDir: string;
  sessionId?: string;
  agentId?: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  diff?: FileDiffInfo;
}

export function defineTool<T>(
  definition: ToolDefinition<T>
): ToolDefinition<T> {
  const originalExecute = definition.execute;

  definition.execute = async (params: T, context: ToolContext) => {
    try {
      definition.parameters.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(i => `"${i.path.join('.')}": ${i.message}`).join(', ');
        return {
          success: false,
          output: `Invalid arguments for ${definition.name}: ${issues}. Please provide valid arguments according to the tool schema.`,
          error: error.message,
        };
      }
      throw error;
    }
    return originalExecute(params, context);
  };

  return definition;
}
