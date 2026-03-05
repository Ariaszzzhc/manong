import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import { agentTypeRegistry } from '../agent/agent-types';
import { subagentManager } from '../agent/subagent';
import { storageService } from '../storage';
import { createLogger } from '../logger';

const log = createLogger('task');

const TaskSchema = z.object({
  description: z.string().describe('A short (3-5 words) description of the task'),
  prompt: z.string().describe('The detailed task for the subagent to perform'),
  subagent_type: z.string().describe('The type of specialized agent to use for this task'),
  task_id: z.string().optional().describe('Resume an existing task by providing its task_id'),
});

function getToolDescription(): string {
  const subagentDescriptions = agentTypeRegistry.getDescriptionForTool();

  return `Launch a specialized subagent to handle complex tasks autonomously.

Subagents run in ISOLATED context - they don't see your conversation history. This helps:
- Keep the main conversation clean and focused
- Reduce context token usage for large explorations
- Apply specialized behaviors and tool restrictions

Available subagent types:
${subagentDescriptions}

WHEN TO USE:
- Broad codebase exploration: "explore" type for finding files, understanding structure
- Implementation planning: "plan" type for analyzing and creating step-by-step plans
- Complex multi-step tasks: "general" type for autonomous execution

WHEN NOT TO USE:
- If you want to read a specific file path, use read_file directly
- If you are searching for a specific class like "class Foo", use glob directly
- If you are searching for code in specific files, use grep directly

USAGE NOTES:
1. Launch multiple agents concurrently for parallel work - use a single message with multiple task calls
2. Each agent starts with fresh context. Your prompt should contain complete instructions
3. Specify exactly what information the agent should return in its final message
4. The output includes task_id for resuming the session later if needed

<example>
user: Where are errors from the API client handled?
assistant: Uses the Task tool with "explore" type to find error handling code
</example>

<example>
user: Help me plan how to add authentication
assistant: Uses the Task tool with "plan" type to create an implementation plan
</example>`;
}

export const taskTool = defineTool({
  name: 'task',
  description: getToolDescription(),
  parameters: TaskSchema,
  execute: async (
    params: z.infer<typeof TaskSchema>,
    context: ToolContext
  ) => {
    const agent = agentTypeRegistry.get(params.subagent_type);
    if (!agent) {
      const availableTypes = agentTypeRegistry.listSubagents().map(a => a.name).join(', ');
      return {
        success: false,
        output: `Error: Unknown agent type "${params.subagent_type}". Available types: ${availableTypes}`,
        error: `Unknown agent type: ${params.subagent_type}`,
      };
    }

    if (agent.mode === 'primary') {
      return {
        success: false,
        output: `Error: "${params.subagent_type}" is a primary agent and cannot be used as a subagent. Use one of: ${agentTypeRegistry.listSubagents().map(a => a.name).join(', ')}`,
        error: 'Cannot use primary agent as subagent',
      };
    }

    const workspace = storageService.getCurrentWorkspacePath();
    if (!workspace) {
      return {
        success: false,
        output: 'Error: No workspace is currently open.',
        error: 'No workspace open',
      };
    }

    const workspaceData = storageService.getWorkspace(workspace);
    const providerConfig = workspaceData?.workspace
      ? storageService.getConfig().providers.find(
          p => p.name === storageService.getConfig().defaultProvider
        )
      : null;

    if (!providerConfig) {
      return {
        success: false,
        output: 'Error: No provider configured. Please set up your API key.',
        error: 'No provider configured',
      };
    }

    try {
      log.info(`Starting subagent task: ${params.description} (${params.subagent_type})`);

      const result = await subagentManager.execute({
        parentSessionId: context.sessionId ?? 'unknown',
        workspacePath: workspace,
        provider: providerConfig,
        agentType: params.subagent_type,
        taskDescription: params.description,
        prompt: params.prompt,
        existingSessionId: params.task_id,
      });

      log.info(`Subagent task completed: ${result.taskId}, tokens: ${result.tokenUsage.inputTokens + result.tokenUsage.outputTokens}`);

      return {
        success: true,
        output: result.summary,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error('Subagent execution failed:', errorMsg);
      return {
        success: false,
        output: `Error executing subagent task: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
});

toolRegistry.register(taskTool);
