import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Copy, Check, Loader2 } from 'lucide-react';
import hljs from 'highlight.js';
import type { Message, Part } from '../../shared/types';
import { ToolGroupCollapse } from './ToolGroupCollapse';
import { ThinkingCollapse } from './ThinkingCollapse';
import { MermaidBlock } from './MermaidBlock';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  pendingParts?: Part[];
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isStreaming,
  pendingParts,
}) => {
  const parts = isStreaming && pendingParts ? pendingParts : message.parts;
  const isUser = message.role === 'user';

  // Separate thinking, tool, and text parts
  const thinkingParts = parts.filter((p) => p.type === 'thinking');
  const toolParts = parts.filter((p) => p.type !== 'text' && p.type !== 'thinking');
  const textParts = parts.filter((p) => p.type === 'text');

  // Get first thinking part text
  const thinkingText = thinkingParts.length > 0 && thinkingParts[0].type === 'thinking'
    ? thinkingParts[0].text
    : '';

  return (
    <div
      className={`py-4 px-6 ${
        isUser
          ? 'bg-transparent'
          : 'bg-surface/50 border-l-2 border-primary/50'
      }`}
    >
      <div className="max-w-3xl mx-auto">
        {/* Content */}
        <div>
          {/* Thinking section - collapsible */}
          {thinkingText && (
            <ThinkingCollapse text={thinkingText} isStreaming={isStreaming} />
          )}

          {/* Tool calls grouped in collapsible section */}
          {toolParts.length > 0 && <ToolGroupCollapse parts={toolParts} />}

          {/* Text content */}
          {textParts.map((part, idx) => {
            if (part.type === 'text') {
              return (
                <div key={idx} className={`prose prose-invert max-w-none ${
                  isUser ? 'text-text-primary' : 'text-text-primary'
                }`}>
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

                        // Extract code string from children
                        const extractText = (node: React.ReactNode): string => {
                          if (typeof node === 'string') return node;
                          if (typeof node === 'number') return String(node);
                          if (Array.isArray(node)) return node.map(extractText).join('');
                          if (React.isValidElement(node) && node.props.children) {
                            return extractText(node.props.children);
                          }
                          return '';
                        };
                        const codeString = extractText(codeElement.props.children).replace(/\n$/, '');

                        // Mermaid diagram
                        if (lang === 'mermaid') {
                          return <MermaidBlock code={codeString} />;
                        }

                        // Code block with copy button
                        return <CodeBlock code={codeString} language={lang} />;
                      },
                    }}
                  >
                    {part.text}
                  </ReactMarkdown>
                </div>
              );
            }
            return null;
          })}

          {/* Show typing indicator if streaming with no text/thinking yet */}
          {isStreaming && !thinkingText && parts.every((p) => p.type !== 'text' || !p.text) && (
            <div className="flex items-center gap-2 text-text-secondary text-sm">
              <Loader2 size={14} className="animate-spin text-primary" />
              <span>Waiting for response...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Code block component with copy button and syntax highlighting
interface CodeBlockProps {
  filename?: string;
  code: string;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ filename, code, language }) => {
  const [copied, setCopied] = useState(false);

  const highlightedCode = useMemo(() => {
    if (language && hljs.getLanguage(language)) {
      try {
        return hljs.highlight(code, { language }).value;
      } catch {
        // Fall back to auto-detection
      }
    }
    try {
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  }, [code, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-4">
      {/* Copy button */}
      <div className="absolute right-2 top-2 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
        <button
          onClick={handleCopy}
          className="text-xs bg-surface text-text-secondary px-2 py-1 rounded border border-border hover:text-text-primary flex items-center gap-1"
        >
          {copied ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="bg-surface border border-border rounded-md overflow-hidden font-mono text-xs leading-5">
        {/* Header with language or filename */}
        {(filename || language) && (
          <div className="flex border-b border-border px-3 py-1.5 bg-surface text-text-secondary text-[10px]">
            <span>{filename || language}</span>
          </div>
        )}

        {/* Code content with syntax highlighting */}
        <div className="p-4 overflow-x-auto">
          <pre>
            <code
              className={language ? `language-${language}` : ''}
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          </pre>
        </div>
      </div>
    </div>
  );
};
