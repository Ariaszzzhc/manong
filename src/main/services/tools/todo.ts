import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import { IPC_CHANNELS } from '../../../shared/ipc';
import type { Todo, TodoStatus, TodoPriority } from '../../../shared/types';
import type { BrowserWindow } from 'electron';
import { storageService } from '../storage';
import { createLogger } from '../logger';

const log = createLogger('todo_tool');

let mainWindow: BrowserWindow | null = null;

export function setTodoWindow(window: BrowserWindow): void {
  mainWindow = window;
}

const MAX_TODOS = 100;
const MAX_TODO_CONTENT_LENGTH = 1000;

function normalizeTodoContent(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

const TodoWriteSchema = z.object({
  todos: z.array(z.object({
    content: z.string()
      .min(1)
      .max(MAX_TODO_CONTENT_LENGTH)
      .describe('Brief description of the task'),
    status: z.enum(['pending', 'in_progress', 'completed']),
    priority: z.enum(['high', 'medium', 'low']),
  })).max(MAX_TODOS).describe('The updated todo list (full list, will replace existing todos)'),
});

const TodoReadSchema = z.object({});

function sendTodoUpdate(sessionId: string, todos: Todo[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.TODO_UPDATE, { sessionId, todos });
    log.debug('Todo update sent to renderer:', sessionId, todos.length);
  }
}

export const todoWriteTool = defineTool({
  name: 'todowrite',
  description: `Use this tool to create and manage a structured task list for your current coding session.

This helps you:
- Track progress on complex multi-step tasks
- Provide visibility into your planned work
- Mark tasks as in_progress while working on them
- Mark tasks as completed when done

Usage notes:
- Use this proactively for complex, multi-step tasks
- Each call REPLACES the entire todo list (not a partial update)
- Mark tasks as "in_progress" when you start working on them
- Mark tasks as "completed" when finished
- Set appropriate priority levels (high/medium/low)`,
  parameters: TodoWriteSchema,
  execute: async (params: z.infer<typeof TodoWriteSchema>, context: ToolContext) => {
    const { sessionId, workingDir } = context;

    if (!sessionId) {
      return {
        success: false,
        output: 'Error: No active session',
        error: 'No sessionId in context',
      };
    }

    try {
      const session = storageService.getSession(workingDir, sessionId);
      if (!session) {
        return {
          success: false,
          output: 'Error: Session not found',
          error: 'Session not found',
        };
      }

      // Update todos
      const todos: Todo[] = [];
      for (let i = 0; i < params.todos.length; i++) {
        const t = params.todos[i];
        const normalizedContent = normalizeTodoContent(t.content);

        if (!normalizedContent) {
          return {
            success: false,
            output: `Error: Todo #${i + 1} content cannot be empty after normalization`,
            error: 'Invalid todo content',
          };
        }

        todos.push({
          content: normalizedContent,
          status: t.status as TodoStatus,
          priority: t.priority as TodoPriority,
        });
      }

      session.todos = todos;
      storageService.saveSession(workingDir, session);

      // Notify frontend
      sendTodoUpdate(sessionId, todos);

      const pending = todos.filter(t => t.status === 'pending').length;
      const inProgress = todos.filter(t => t.status === 'in_progress').length;
      const completed = todos.filter(t => t.status === 'completed').length;

      return {
        success: true,
        output: `Todo list updated: ${todos.length} tasks (${pending} pending, ${inProgress} in progress, ${completed} completed)`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error in todowrite tool:', errorMsg);
      return {
        success: false,
        output: `Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
});

export const todoReadTool = defineTool({
  name: 'todoread',
  description: `Use this tool to read the current todo list for the session.

Returns the list of todos with their status and priority. Use this to check the current state of tasks before updating them.`,
  parameters: TodoReadSchema,
  execute: async (_params: z.infer<typeof TodoReadSchema>, context: ToolContext) => {
    const { sessionId, workingDir } = context;

    if (!sessionId) {
      return {
        success: false,
        output: 'Error: No active session',
        error: 'No sessionId in context',
      };
    }

    try {
      const session = storageService.getSession(workingDir, sessionId);
      if (!session) {
        return {
          success: false,
          output: 'Error: Session not found',
          error: 'Session not found',
        };
      }

      const todos = session.todos || [];

      if (todos.length === 0) {
        return {
          success: true,
          output: 'No todos found for this session.',
        };
      }

      const formatted = todos.map((t, i) => {
        const statusIcon = t.status === 'completed' ? '[x]' : t.status === 'in_progress' ? '[>]' : '[ ]';
        const priorityIcon = t.priority === 'high' ? '!' : t.priority === 'medium' ? '-' : ' ';
        return `${i + 1}. ${statusIcon} (${priorityIcon}) ${t.content}`;
      }).join('\n');

      const pending = todos.filter(t => t.status === 'pending').length;
      const inProgress = todos.filter(t => t.status === 'in_progress').length;
      const completed = todos.filter(t => t.status === 'completed').length;

      return {
        success: true,
        output: `Current todos (${todos.length} tasks: ${pending} pending, ${inProgress} in progress, ${completed} completed):\n${formatted}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error in todoread tool:', errorMsg);
      return {
        success: false,
        output: `Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
});

toolRegistry.register(todoWriteTool);
toolRegistry.register(todoReadTool);
