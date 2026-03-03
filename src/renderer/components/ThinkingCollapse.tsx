import React, { useState, useEffect } from 'react';
import { ChevronRight, Loader2, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../i18n';

interface ThinkingCollapseProps {
  text: string;
  isStreaming?: boolean;
}

export const ThinkingCollapse: React.FC<ThinkingCollapseProps> = ({
  text,
  isStreaming,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslation();

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
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
      >
        {isStreaming ? (
          <Loader2 size={13} className="text-text-secondary animate-spin" strokeWidth={2} />
        ) : (
          <BrainCircuit size={13} strokeWidth={2} className={isOpen ? "text-text-primary" : "text-text-secondary"} />
        )}
        <span className="text-[12px] font-medium tracking-wide">{t['thinking.process']}</span>
        <ChevronRight
          size={12}
          className={`transition-transform opacity-50 ${isOpen ? 'rotate-90' : ''}`}
          strokeWidth={2}
        />
      </button>
      {isOpen && (
        <div className="mt-2.5 ml-[6px] pl-4 text-sm text-text-secondary italic border-l-2 border-border">
          <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed opacity-80">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {text}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};
