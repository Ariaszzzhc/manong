import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Wrench, CheckCircle, AlertCircle } from 'lucide-react';
import type { Part } from '../../shared/types';

interface ToolPartViewProps {
  part: Part;
}

export const ToolPartView: React.FC<ToolPartViewProps> = ({ part }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (part.type === 'text') {
    return null;
  }

  if (part.type === 'tool-call') {
    return (
      <div className="my-1 border border-border rounded overflow-hidden">
        <div
          className="bg-surface-elevated px-3 py-1.5 text-sm flex items-center gap-2 cursor-pointer hover:bg-hover transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown size={12} className="text-text-secondary" strokeWidth={1.5} />
          ) : (
            <ChevronRight size={12} className="text-text-secondary" strokeWidth={1.5} />
          )}
          <Wrench size={12} className="text-text-secondary" strokeWidth={1.5} />
          <span className="font-mono text-xs text-text-primary">{part.toolName}</span>
        </div>
        {isExpanded && (
          <div className="bg-surface-elevated px-3 py-2 border-t border-border">
            <pre className="text-[11px] text-text-secondary overflow-x-auto font-mono">
              {JSON.stringify(part.args, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (part.type === 'tool-result') {
    return (
      <div
        className={`my-1 border rounded overflow-hidden ${
          part.isError ? 'border-red-800/50' : 'border-border'
        }`}
      >
        <div
          className={`px-3 py-1.5 text-sm flex items-center gap-2 cursor-pointer transition-colors ${
            part.isError
              ? 'bg-red-900/20 hover:bg-red-900/30'
              : 'bg-surface-elevated hover:bg-hover'
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown size={12} className="text-text-secondary" strokeWidth={1.5} />
          ) : (
            <ChevronRight size={12} className="text-text-secondary" strokeWidth={1.5} />
          )}
          {part.isError ? (
            <AlertCircle size={12} className="text-accent-red" strokeWidth={1.5} />
          ) : (
            <CheckCircle size={12} className="text-accent-green" strokeWidth={1.5} />
          )}
          <span className="font-mono text-xs text-text-primary">Result: {part.toolName}</span>
        </div>
        {isExpanded && (
          <div className="bg-surface-elevated px-3 py-2 border-t border-border">
            <pre className="text-[11px] text-text-secondary overflow-x-auto max-h-40 font-mono">
              {typeof part.result === 'string'
                ? part.result
                : JSON.stringify(part.result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return null;
};
