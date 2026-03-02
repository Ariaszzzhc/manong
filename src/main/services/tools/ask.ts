import { z } from 'zod';
import { defineTool, type ToolContext } from '../../../shared/tool';
import { toolRegistry } from './registry';
import { IPC_CHANNELS } from '../../../shared/ipc';
import type { QuestionInfo, QuestionAnswer, QuestionRequest } from '../../../shared/types';
import type { BrowserWindow } from 'electron';
import { createLogger } from '../logger';

const log = createLogger('ask_tool');

export class QuestionSkippedError extends Error {
  constructor() {
    super('The user skipped this question');
    this.name = 'QuestionSkippedError';
  }
}

export class QuestionCancelledError extends Error {
  constructor() {
    super('The question was cancelled');
    this.name = 'QuestionCancelledError';
  }
}

interface PendingQuestion {
  resolve: (answers: QuestionAnswer[]) => void;
  reject: (error: Error) => void;
}

const pendingQuestions = new Map<string, PendingQuestion>();

let mainWindow: BrowserWindow | null = null;

export function setQuestionWindow(window: BrowserWindow): void {
  mainWindow = window;
}

export function resolveQuestion(requestId: string, answers: QuestionAnswer[]): void {
  const pending = pendingQuestions.get(requestId);
  if (pending) {
    pending.resolve(answers);
    pendingQuestions.delete(requestId);
  }
}

export function skipQuestion(requestId: string): void {
  const pending = pendingQuestions.get(requestId);
  if (pending) {
    pending.reject(new QuestionSkippedError());
    pendingQuestions.delete(requestId);
  }
}

export function cancelPendingQuestions(): void {
  for (const [_id, { reject }] of pendingQuestions) {
    reject(new QuestionCancelledError());
  }
  pendingQuestions.clear();
}

const AskSchema = z.object({
  questions: z.array(z.object({
    question: z.string().describe('Complete question to ask'),
    header: z.string().describe('Very short label (max 30 chars)'),
    options: z.array(z.object({
      label: z.string().describe('Display text'),
      description: z.string().describe('Explanation of choice'),
    })).describe('Available choices'),
    multiple: z.boolean().optional().describe('Allow multiple selections'),
  })).describe('Questions to ask the user'),
});

export const askTool = defineTool({
  name: 'ask',
  description: `Use this tool when you need to ask the user questions during execution. This allows you to gather user preferences or requirements, clarify ambiguous instructions, or get decisions on implementation choices.

Usage notes:
- Users will always be able to select "Other" to provide custom text input
- Use multiSelect: true to allow multiple answers to be selected for a question
- Provide clear, specific questions and options
- After receiving the answer, continue with your task based on the user's response`,
  parameters: AskSchema,
  execute: async (params: z.infer<typeof AskSchema>, _context: ToolContext) => {
    if (!mainWindow) {
      return {
        success: false,
        output: 'Error: Main window not available for questions',
        error: 'Main window not set',
      };
    }

    const questionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const questions: QuestionInfo[] = params.questions.map((q) => ({
      question: q.question,
      header: q.header.slice(0, 30),
      options: q.options,
      multiple: q.multiple,
    }));

    const request: QuestionRequest = {
      id: questionId,
      sessionId: '',
      questions,
    };

    try {
      const answers = await new Promise<QuestionAnswer[]>((resolve, reject) => {
        pendingQuestions.set(questionId, { resolve, reject });

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.QUESTION_ASK, request);
        }

        log.debug('Question sent to renderer:', questionId);
      });

      const formattedAnswers = answers.map((answer, idx) => {
        const question = params.questions[idx];
        return `**${question.header}**: ${answer.join(', ')}`;
      }).join('\n');

      return {
        success: true,
        output: `User responses:\n${formattedAnswers}`,
      };
    } catch (error) {
      if (error instanceof QuestionSkippedError) {
        return {
          success: true,
          output: 'The user chose to skip this question. You can proceed with default assumptions or ask follow-up questions.',
        };
      }
      if (error instanceof QuestionCancelledError) {
        return {
          success: false,
          output: 'The question was cancelled (agent stopped or session changed).',
          error: 'Question cancelled',
        };
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error in ask tool:', errorMsg);
      return {
        success: false,
        output: `Error: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
});

toolRegistry.register(askTool);
