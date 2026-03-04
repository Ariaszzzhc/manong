import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Loader2, ChevronRight, ChevronDown, BrainCircuit } from 'lucide-react';
import type { TimelineBlock, ImagePart, ToolCallPart, ToolResultPart } from '../../shared/types';
import { ToolPartView } from './ToolPartView';
import { CodeBlock } from './MessageItem';
import { MermaidBlock } from './MermaidBlock';
import { useTranslation } from '../i18n';

interface TimelineBlockViewProps {
  block: TimelineBlock;
}

export const TimelineBlockView: React.FC<TimelineBlockViewProps> = ({ block }) => {
  switch (block.type) {
    case 'user-input':
      return <UserInputBlock text={block.text} images={block.images} />;
    case 'assistant-text':
      return <AssistantTextBlock text={block.text} isStreaming={block.isStreaming} />;
    case 'thinking':
      return <ThinkingBlock text={block.text} isStreaming={block.isStreaming} />;
    case 'tool-pair':
      return <ToolPairBlock call={block.call} result={block.result} />;
    default:
      return null;
  }
};

// --- Sub-components ---

const UserInputBlock: React.FC<{ text: string; images: ImagePart[] }> = ({ text, images }) => (
  <div className="py-5">
    {images.length > 0 && (
      <div className="flex flex-wrap gap-2 mb-3">
        {images.map((img, idx) => (
          <img
            key={idx}
            src={`data:${img.mediaType};base64,${img.thumbnailData}`}
            alt={img.filename ?? 'image'}
            className="max-w-[300px] max-h-[200px] object-contain rounded-lg border border-border"
          />
        ))}
      </div>
    )}
    {text && (
      <div className="prose prose-invert max-w-none text-[14px] leading-relaxed text-text-secondary">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
          {text}
        </ReactMarkdown>
      </div>
    )}
  </div>
);

const AssistantTextBlock: React.FC<{ text: string; isStreaming?: boolean }> = ({ text, isStreaming }) => {
  const t = useTranslation();

  if (!text && isStreaming) {
    return (
      <div className="py-3 border-l-2 border-border/30 pl-4 ml-2">
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <Loader2 size={14} className="animate-spin text-text-secondary" />
          <span className="text-[13px]">{t['message.thinking']}</span>
        </div>
      </div>
    );
  }

  if (!text) return null;

  return (
    <div className="py-3 border-l-2 border-border/30 pl-4 ml-2">
      <div className="prose prose-invert max-w-none text-[14px] leading-relaxed text-text-primary">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            pre: ({ children }) => {
              const codeElement = React.Children.toArray(children).find(
                (child) => React.isValidElement(child) && child.type === 'code'
              ) as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;

              if (!codeElement) {
                return <pre>{children}</pre>;
              }

              const className = codeElement.props.className || '';
              const match = /language-(\w+)/.exec(className);
              const lang = match ? match[1] : '';

              const extractText = (node: React.ReactNode): string => {
                if (typeof node === 'string') return node;
                if (typeof node === 'number') return String(node);
                if (Array.isArray(node)) return node.map(extractText).join('');
                if (React.isValidElement(node)) {
                  const props = node.props as { children?: React.ReactNode };
                  if (props.children) return extractText(props.children);
                }
                return '';
              };
              const codeString = extractText(codeElement.props.children).replace(/\n$/, '');

              if (lang === 'mermaid') {
                // An unclosed fenced code block extends to end-of-document in CommonMark.
                // If the source text ends with the code content, the closing ``` hasn't arrived yet.
                const isBlockIncomplete = isStreaming &&
                  (!codeString.trim() || text.trimEnd().endsWith(codeString.trimEnd()));
                return <MermaidBlock code={codeString} isStreaming={isBlockIncomplete} />;
              }

              return <CodeBlock code={codeString} language={lang} />;
            },
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    </div>
  );
};

const ThinkingBlock: React.FC<{ text: string; isStreaming?: boolean }> = ({ text, isStreaming }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const t = useTranslation();

  if (!text.trim()) return null;

  return (
    <div className="py-1 ml-2 pl-4 border-l-2 border-border/30">
      <div className="mb-3 group relative">
        <div
          className="flex items-center gap-2 cursor-pointer transition-colors bg-transparent hover:bg-hover rounded px-2 py-1 -ml-2"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-surface border border-border shadow-sm">
            {isStreaming ? (
              <Loader2 size={11} className="text-text-secondary animate-spin" strokeWidth={2} />
            ) : (
              <BrainCircuit size={11} className={isExpanded ? 'text-text-primary' : 'text-text-secondary'} strokeWidth={2} />
            )}
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="font-mono text-[12px] text-text-primary opacity-90 truncate">
              {t['thinking.process']}
            </span>
          </div>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            {isExpanded ? (
              <ChevronDown size={12} className="text-text-secondary" strokeWidth={2} />
            ) : (
              <ChevronRight size={12} className="text-text-secondary" strokeWidth={2} />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-2.5 ml-[6px] pl-4 border-l-2 border-border/50 max-h-60 overflow-y-auto">
            <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed text-text-secondary opacity-80 italic">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {text}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ToolPairBlock: React.FC<{
  call: ToolCallPart;
  result?: ToolResultPart;
}> = ({ call, result }) => (
  <div className="py-1 ml-2 pl-4 border-l-2 border-border/30">
    <ToolPartView toolCall={call} toolResult={result} />
  </div>
);
