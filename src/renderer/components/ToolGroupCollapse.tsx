import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import type { Part } from '../../shared/types';
import { ToolPartView } from './ToolPartView';

interface ToolGroupCollapseProps {
  parts: Part[];
}

export const ToolGroupCollapse: React.FC<ToolGroupCollapseProps> = ({ parts }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count unique tool calls (each tool has a call and a result)
  const toolCallCount = parts.filter(p => p.type === 'tool-call').length;

  return (
    <div className="my-3 border border-border rounded-md overflow-hidden">
      {/* Header - clickable */}
      <div
        className="bg-surface px-3 py-2 text-sm flex items-center gap-2 cursor-pointer hover:bg-hover transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-text-secondary" strokeWidth={1.5} />
        ) : (
          <ChevronRight size={14} className="text-text-secondary" strokeWidth={1.5} />
        )}
        <Wrench size={14} className="text-text-secondary" strokeWidth={1.5} />
        <span className="font-mono text-text-secondary text-xs">
          {toolCallCount} tool calls
        </span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="bg-surface-elevated px-3 py-2 space-y-1 border-t border-border">
          {parts.map((part, idx) => (
            <ToolPartView key={idx} part={part} />
          ))}
        </div>
      )}
    </div>
  );
};
