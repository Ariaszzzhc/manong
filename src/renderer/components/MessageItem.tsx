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
    <div className={`py-5 group/message relative ${!isUser && 'border-l-2 border-border/30 pl-4 ml-2'}`}>
      <div className="flex flex-col">
        {/* Content */}
        <div className="w-full min-w-0">
          {/* Thinking section - collapsible */}
          {thinkingText && (
            <ThinkingCollapse text={thinkingText} isStreaming={isStreaming} />
          )}

          {/* Tool calls grouped in collapsible section */}
          {toolParts.length > 0 && <ToolGroupCollapse parts={toolParts} />}

          {/* Text content */}
          <div className="space-y-4">
            {textParts.map((part, idx) => {
              if (part.type === 'text') {
                return (
                  <div key={idx} className={`prose prose-invert max-w-none text-[14px] leading-relaxed ${isUser ? 'text-text-secondary' : 'text-text-primary'}`}>
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
                            if (React.isValidElement(node)) {
                              const props = node.props as { children?: React.ReactNode };
                              if (props.children) {
                                return extractText(props.children);
                              }
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
          </div>

          {/* Show typing indicator if streaming with no text/thinking yet */}
          {isStreaming && !thinkingText && parts.every((p) => p.type !== 'text' || !p.text) && (
            <div className="flex items-center gap-2 text-text-secondary text-sm mt-2">
              <Loader2 size={14} className="animate-spin text-text-secondary" />
              <span className="text-[13px]">Thinking...</span>
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
      {/* Floating actions */}
      <div className="absolute top-3 right-3 flex items-center z-10">
        <div className="transition-opacity duration-200 group-hover/code:opacity-0 flex items-center">
          {(filename || language) && (
            <span className="text-text-secondary/50 text-[11px] font-mono lowercase tracking-wider select-none">
              {filename || language}
            </span>
          )}
        </div>
        
        <button
          onClick={handleCopy}
          className={`absolute right-0 text-[11px] px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all duration-200 backdrop-blur-md bg-surface/90 border border-border/50 shadow-sm ${
            copied 
              ? 'text-green-400 border-green-500/30 opacity-100 translate-y-0' 
              : 'text-text-secondary hover:text-text-primary opacity-0 translate-y-1 group-hover/code:opacity-100 group-hover/code:translate-y-0'
          }`}
        >
          {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.5} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="bg-code-bg border border-code-border rounded-lg overflow-hidden font-mono text-[13px] leading-relaxed">
        {/* Code content */}
        <div className="p-4 pt-5 overflow-x-auto">
          <pre className="!bg-transparent !border-none !p-0 !m-0">
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
