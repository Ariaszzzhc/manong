import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Message, ProviderConfig } from '../../../shared/types';
import { AnthropicProvider } from '../provider/anthropic';
import { createLogger } from '../logger';

const log = createLogger('Compact');

// TODO: dynamically calculate based on model context window size (80%)
export const TOKEN_THRESHOLD = 160_000;

const KEEP_RECENT = 3;

export function estimateTokens(messages: Message[]): number {
  return JSON.stringify(messages).length / 4;
}

export function microCompact(messages: Message[]): { messages: Message[]; replacedCount: number } {
  const toolResultPositions: Array<{ msgIdx: number; partIdx: number; toolName: string; size: number }> = [];

  for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
    const msg = messages[msgIdx];
    for (let partIdx = 0; partIdx < msg.parts.length; partIdx++) {
      const part = msg.parts[partIdx];
      if (part.type === 'tool-result') {
        const resultStr = typeof part.result === 'string' ? part.result : JSON.stringify(part.result);
        toolResultPositions.push({ msgIdx, partIdx, toolName: part.toolName, size: resultStr.length });
      }
    }
  }

  const toReplace = toolResultPositions.slice(0, -KEEP_RECENT);
  const eligible = toReplace.filter(p => p.size > 100);

  if (eligible.length === 0) {
    return { messages, replacedCount: 0 };
  }

  const cloned: Message[] = JSON.parse(JSON.stringify(messages));

  for (const pos of eligible) {
    const part = cloned[pos.msgIdx].parts[pos.partIdx];
    if (part.type === 'tool-result') {
      part.result = `[Previous: used ${pos.toolName}]`;
      if (part.diff) {
        delete (part as Record<string, unknown>).diff;
      }
    }
  }

  return { messages: cloned, replacedCount: eligible.length };
}

const SUMMARY_PROMPT = `You are a conversation summarizer. Summarize the conversation so far in a way that preserves:
1. Key decisions and architectural choices made
2. Important file paths and code patterns discovered
3. Current task progress and remaining work
4. Any errors encountered and how they were resolved

Be concise but thorough. The summary will replace the conversation history, so include all context needed to continue working.`;

export async function fullCompact(
  messages: Message[],
  workingDir: string,
  providerConfig: ProviderConfig,
  focus?: string,
): Promise<{ messages: Message[]; transcriptPath: string }> {
  const transcriptsDir = path.join(workingDir, '.manong', 'transcripts');
  if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const transcriptPath = path.join(transcriptsDir, `transcript_${timestamp}.jsonl`);

  const lines = messages.map(m => JSON.stringify(m)).join('\n');
  fs.writeFileSync(transcriptPath, lines, 'utf-8');
  log.info('Transcript saved to:', transcriptPath);

  const provider = new AnthropicProvider(providerConfig);

  const focusInstruction = focus
    ? `\n\nPay special attention to and preserve details about: ${focus}`
    : '';

  const summaryMessages: Message[] = [
    ...messages,
    {
      id: uuidv4(),
      role: 'user',
      parts: [{ type: 'text', text: `Please summarize this conversation so I can continue working with a compressed context.${focusInstruction}` }],
      createdAt: Date.now(),
    },
  ];

  let summary = '';
  const stream = provider.stream(summaryMessages, [], SUMMARY_PROMPT);

  for await (const event of stream) {
    if (event.type === 'text-delta') {
      summary += event.delta;
    }
  }

  log.info('Compact summary generated, length:', summary.length);

  const replacementMessages: Message[] = [
    {
      id: uuidv4(),
      role: 'user',
      parts: [{
        type: 'text',
        text: `[Context Compact] The full conversation transcript has been saved to: ${transcriptPath}\n\nSummary of previous conversation:\n${summary}`,
      }],
      createdAt: Date.now(),
      hidden: true,
    },
    {
      id: uuidv4(),
      role: 'assistant',
      parts: [{ type: 'text', text: 'Understood. Continuing with the compressed context.' }],
      createdAt: Date.now(),
      hidden: true,
    },
  ];

  return { messages: replacementMessages, transcriptPath };
}
