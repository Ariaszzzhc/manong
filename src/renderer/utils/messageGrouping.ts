import type { Message, ToolResultPart, ImagePart, TimelineBlock } from '../../shared/types';

/**
 * Convert messages into a flat timeline of display blocks.
 *
 * Each text, thinking, and tool-call part becomes its own block.
 * Tool-call blocks are paired with their corresponding tool-result
 * from the following user message via a toolCallId lookup.
 *
 * Compatible with both old sessions (where assistant messages may
 * contain mixed parts) and new sessions (properly alternating messages).
 */
export function messagesToTimeline(
  messages: Message[],
  streamingMessage?: Message | null,
): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];

  // Build toolCallId → ToolResultPart map from all user messages
  const resultMap = new Map<string, ToolResultPart>();
  const allMessages = streamingMessage
    ? [...messages, streamingMessage]
    : messages;

  for (const msg of allMessages) {
    if (msg.role === 'user') {
      for (const part of msg.parts) {
        if (part.type === 'tool-result') {
          resultMap.set(part.toolCallId, part);
        }
      }
    }
  }

  const isStreaming = !!streamingMessage;
  const streamingId = streamingMessage?.id;

  for (const msg of allMessages) {
    if (msg.hidden) continue;
    const msgIsStreaming = isStreaming && msg.id === streamingId;

    if (msg.role === 'user') {
      // Check if this user message has real user content (text/image)
      const textParts = msg.parts.filter((p) => p.type === 'text');
      const imageParts = msg.parts.filter((p) => p.type === 'image') as ImagePart[];
      const hasUserContent = textParts.length > 0 || imageParts.length > 0;

      if (hasUserContent) {
        const text = textParts
          .map((p) => (p.type === 'text' ? p.text : ''))
          .join('\n');
        blocks.push({
          type: 'user-input',
          id: `${msg.id}-user`,
          text,
          images: imageParts,
          createdAt: msg.createdAt,
        });
      }
      // User messages with only tool-results are consumed via the resultMap — skip them
    } else {
      // Assistant message — emit blocks in part order
      let textCounter = 0;
      let thinkingCounter = 0;
      let toolCounter = 0;

      for (const part of msg.parts) {
        if (part.type === 'thinking') {
          blocks.push({
            type: 'thinking',
            id: `${msg.id}-thinking-${thinkingCounter++}`,
            text: part.text,
            createdAt: msg.createdAt,
            isStreaming: msgIsStreaming,
          });
        } else if (part.type === 'text') {
          blocks.push({
            type: 'assistant-text',
            id: `${msg.id}-text-${textCounter++}`,
            text: part.text,
            createdAt: msg.createdAt,
            isStreaming: msgIsStreaming,
          });
        } else if (part.type === 'tool-call') {
          blocks.push({
            type: 'tool-pair',
            id: `${msg.id}-tool-${toolCounter++}`,
            call: part,
            result: resultMap.get(part.toolCallId),
            createdAt: msg.createdAt,
          });
        }
      }
    }
  }

  return blocks;
}
