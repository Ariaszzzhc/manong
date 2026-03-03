import React, { useState, useMemo } from 'react';
import { ChevronRight, Wrench } from 'lucide-react';
import type { Part, ToolCallPart, ToolResultPart } from '../../shared/types';
import { ToolPartView } from './ToolPartView';

interface ToolGroupCollapseProps {
  parts: Part[];
}

/**
 * Pair tool calls with their corresponding results
 */
const pairToolCallsWithResults = (parts: Part[]): Array<{ call: ToolCallPart; result?: ToolResultPart }> => {
  const pairs: Array<{ call: ToolCallPart; result?: ToolResultPart }> = [];
  const resultMap = new Map<string, ToolResultPart>();

  // First pass: collect all results by toolCallId
  for (const part of parts) {
    if (part.type === 'tool-result') {
      resultMap.set(part.toolCallId, part);
    }
  }

  // Second pass: pair calls with results
  for (const part of parts) {
    if (part.type === 'tool-call') {
      pairs.push({
        call: part,
        result: resultMap.get(part.toolCallId),
      });
    }
  }

  return pairs;
};

export const ToolGroupCollapse: React.FC<ToolGroupCollapseProps> = ({ parts }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toolPairs = useMemo(() => pairToolCallsWithResults(parts), [parts]);
  const toolCallCount = toolPairs.length;
  
  // Check if any tool is currently running
  const isRunning = toolPairs.some(pair => !pair.result);

  return (
    <div className="mb-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors bg-transparent border-none p-0 cursor-pointer w-full text-left"
      >
        <Wrench 
          size={13} 
          strokeWidth={2} 
          className={isExpanded ? "text-text-primary" : "text-text-secondary"} 
        />
        <span className="text-[12px] font-medium tracking-wide">
          {toolCallCount} Tool{toolCallCount !== 1 ? 's' : ''} Used
        </span>
        <ChevronRight
          size={12}
          className={`transition-transform opacity-50 ${isExpanded ? 'rotate-90' : ''}`}
          strokeWidth={2}
        />
        {isRunning && (
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
          </span>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-2.5 ml-[6px] pl-4 border-l-2 border-border/50">
          {toolPairs.map((pair, idx) => (
            <ToolPartView key={pair.call.toolCallId || idx} toolCall={pair.call} toolResult={pair.result} />
          ))}
        </div>
      )}
    </div>
  );
};
