import { Anthropic } from '@anthropic-ai/sdk';
import type { ProviderConfig, Message, TokenUsage } from '../../../shared/types';
import type { ToolDefinition } from '../../../shared/tool';
import { z } from 'zod';
import { toJSONSchema } from 'zod/v4/core';
import { createLogger } from '../logger';

const log = createLogger('AnthropicProvider');

export class AnthropicProvider {
  private client: Anthropic;
  private model: string;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model;
    this.config = config;
  }

  async *stream(
    messages: Message[],
    tools: ToolDefinition<unknown>[],
    systemPrompt?: string
  ): AsyncGenerator<
    | { type: 'text-delta'; delta: string }
    | { type: 'thinking-delta'; delta: string }
    | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
    | { type: 'usage'; usage: TokenUsage }
  > {
    // Convert messages to Anthropic format
    const anthropicMessages = this.convertMessages(messages);

    // Convert tools to Anthropic format
    const anthropicTools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: zodToAnthropicSchema(tool.parameters),
    }));

    const requestOptions: Anthropic.Messages.MessageCreateParams = {
      model: this.model,
      max_tokens: 16384,
      messages: anthropicMessages,
      system: systemPrompt,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    };

    // Add thinking parameter if enabled (for models like GLM that support it)
    if (this.config.enableThinking) {
      (requestOptions as Record<string, unknown>).thinking = {
        type: 'enabled',
        clear_thinking: false,
      };
    }

    const stream = this.client.messages.stream(requestOptions);

    // Track content blocks being streamed
    const contentBlocks: Map<number, { type: 'text' | 'thinking' | 'tool_use'; id?: string; name?: string; jsonBuffer: string }> = new Map();

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const index = event.index;
        if (event.content_block.type === 'text') {
          contentBlocks.set(index, { type: 'text', jsonBuffer: '' });
        } else if (event.content_block.type === 'thinking') {
          contentBlocks.set(index, { type: 'thinking', jsonBuffer: '' });
        } else if (event.content_block.type === 'tool_use') {
          const block = event.content_block as Anthropic.Messages.ToolUseBlock;
          contentBlocks.set(index, {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            jsonBuffer: '',
          });
        }
      } else if (event.type === 'content_block_delta') {
        const index = event.index;
        const block = contentBlocks.get(index);

        if (event.delta.type === 'text_delta' && block?.type === 'text') {
          yield {
            type: 'text-delta',
            delta: event.delta.text,
          };
        } else if (event.delta.type === 'thinking_delta' && block?.type === 'thinking') {
          yield {
            type: 'thinking-delta',
            delta: event.delta.thinking,
          };
        } else if (event.delta.type === 'input_json_delta' && block?.type === 'tool_use') {
          // Accumulate JSON fragments for tool input
          block.jsonBuffer += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        const index = event.index;
        const block = contentBlocks.get(index);

        if (block?.type === 'tool_use') {
          // Parse complete JSON and yield tool call
          let args: unknown = {};
          let parseError = false;
          try {
            if (block.jsonBuffer.trim()) {
              args = JSON.parse(block.jsonBuffer);
            }
          } catch (e) {
            parseError = true;
            log.error('Failed to parse tool args (possibly truncated by max_tokens):', block.name, 'buffer length:', block.jsonBuffer.length);
          }

          if (!parseError) {
            yield {
              type: 'tool-call',
              toolCallId: block.id as string,
              toolName: block.name as string,
              args,
            };
          }
        }

        contentBlocks.delete(index);
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      type: 'usage',
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        cacheCreationInputTokens: finalMessage.usage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: finalMessage.usage.cache_read_input_tokens ?? 0,
      },
    };

  }

  private convertMessages(messages: Message[]): Anthropic.Messages.MessageParam[] {
    const result: Anthropic.Messages.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        // User message: can contain text and tool_result
        const content: Anthropic.Messages.ContentBlockParam[] = [];

        for (const part of msg.parts) {
          if (part.type === 'text') {
            content.push({ type: 'text', text: part.text });
          } else if (part.type === 'tool-result') {
            content.push({
              type: 'tool_result',
              tool_use_id: part.toolCallId,
              content: typeof part.result === 'string' ? part.result : JSON.stringify(part.result),
              is_error: part.isError,
            });
          }
        }

        if (content.length > 0) {
          result.push({ role: 'user', content });
        }
      } else {
        // Assistant message: can contain text and tool-use
        const content: Anthropic.Messages.ContentBlockParam[] = [];

        for (const part of msg.parts) {
          if (part.type === 'text') {
            content.push({ type: 'text', text: part.text });
          } else if (part.type === 'tool-call') {
            content.push({
              type: 'tool_use',
              id: part.toolCallId,
              name: part.toolName,
              input: part.args,
            });
          }
        }

        if (content.length > 0) {
          result.push({ role: 'assistant', content });
        }
      }
    }

    return result;
  }
}

function zodToAnthropicSchema(zodSchema: z.ZodSchema): Anthropic.Messages.Tool['input_schema'] {
  const schema = toJSONSchema(zodSchema) as Record<string, unknown>;
  // Remove $schema field - it's metadata not needed for API calls
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema: _, ...inputSchema } = schema;
  return inputSchema as Anthropic.Messages.Tool['input_schema'];
}
