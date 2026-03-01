import React, { useState, useEffect } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ThinkingCollapseProps {
  text: string;
  isStreaming?: boolean;
}

export const ThinkingCollapse: React.FC<ThinkingCollapseProps> = ({
  text,
  isStreaming,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-expand when streaming starts with content
  useEffect(() => {
    if (isStreaming && text.trim() && !isOpen) {
      setIsOpen(true);
    }
  }, [isStreaming, text, isOpen]);

  if (!text.trim()) {
    return null;
  }

  return (
    <div className="thinking-collapse mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ChevronRight
          size={12}
          className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
          strokeWidth={1.5}
        />
        {isStreaming && (
          <Loader2 size={12} className="text-primary animate-spin" strokeWidth={1.5} />
        )}
        <span className="font-mono text-xs">Thinking</span>
      </button>
      {isOpen && (
        <div className="mt-2 pl-4 text-sm text-text-secondary italic border-l-2 border-primary/30">
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {text}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};
