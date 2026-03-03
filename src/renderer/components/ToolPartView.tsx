import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Wrench,
  FileText,
  FileEdit,
  FolderOpen,
  Search,
  Terminal,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { ToolCallPart, ToolResultPart } from '../../shared/types';

interface ToolPartViewProps {
  toolCall: ToolCallPart;
  toolResult?: ToolResultPart;
}

const isMCPTool = (toolName: string): boolean => {
  return toolName.startsWith('mcp__');
};

const formatToolName = (toolName: string): { display: string; server?: string } => {
  if (isMCPTool(toolName)) {
    const parts = toolName.split('__');
    if (parts.length >= 3) {
      return {
        display: parts.slice(2).join('__'),
        server: parts[1],
      };
    }
  }
  return { display: toolName };
};

/**
 * Generate a human-readable action summary based on tool name and arguments
 */
const generateActionSummary = (
  toolName: string,
  args: Record<string, unknown>
): { summary: string; icon: LucideIcon } => {
  // Handle built-in tools
  switch (toolName) {
    case 'read_file': {
      const filePath = String(args.file_path || '');
      const fileName = filePath.split('/').pop() || filePath;
      const offset = args.offset as number | undefined;
      const limit = args.limit as number | undefined;

      if (offset !== undefined && limit !== undefined) {
        const endLine = offset + limit - 1;
        return { summary: `Read ${fileName} (L${offset}-${endLine})`, icon: FileText };
      }
      return { summary: `Read ${fileName}`, icon: FileText };
    }

    case 'write_file': {
      const filePath = String(args.file_path || '');
      const fileName = filePath.split('/').pop() || filePath;
      return { summary: `Write ${fileName}`, icon: FileEdit };
    }

    case 'edit_file': {
      const filePath = String(args.file_path || '');
      const fileName = filePath.split('/').pop() || filePath;
      return { summary: `Edit ${fileName}`, icon: FileEdit };
    }

    case 'list_dir': {
      const path = String(args.path || '');
      const dirName = path ? path.split('/').pop() || path : 'current directory';
      return { summary: `List ${dirName}`, icon: FolderOpen };
    }

    case 'search_file': {
      const pattern = String(args.pattern || '');
      return { summary: `Search "${pattern}"`, icon: Search };
    }

    case 'run_shell': {
      const command = String(args.command || '');
      // Truncate long commands
      const displayCommand = command.length > 40 ? command.slice(0, 40) + '...' : command;
      return { summary: `Run: ${displayCommand}`, icon: Terminal };
    }

    case 'ask': {
      const questions = args.questions as Array<{ header?: string; question?: string }> | undefined;
      if (questions && questions.length > 0) {
        const header = questions[0].header || questions[0].question || 'user';
        const truncatedHeader = header.length > 30 ? header.slice(0, 30) + '...' : header;
        return { summary: `Ask: ${truncatedHeader}`, icon: MessageCircle };
      }
      return { summary: 'Ask user', icon: MessageCircle };
    }

    case 'skill': {
      const skillName = String(args.skill || args.name || '');
      return { summary: `Skill: ${skillName}`, icon: Sparkles };
    }

    default: {
      // MCP tools or unknown tools
      if (isMCPTool(toolName)) {
        const { display } = formatToolName(toolName);
        return { summary: display, icon: Wrench };
      }
      return { summary: toolName, icon: Wrench };
    }
  }
};

export const ToolPartView: React.FC<ToolPartViewProps> = ({ toolCall, toolResult }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const { summary, icon: Icon } = generateActionSummary(toolCall.toolName, toolCall.args);
  const isMCP = isMCPTool(toolCall.toolName);
  const { server } = formatToolName(toolCall.toolName);
  const isError = toolResult?.isError;
  const isPending = !toolResult;

  return (
    <div className={`mb-3 group relative`}>
      <div
        className="flex items-center gap-2 cursor-pointer transition-colors bg-transparent hover:bg-hover rounded px-2 py-1 -ml-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-surface border border-border shadow-sm">
          <Icon size={11} className={isError ? 'text-red-400' : isPending ? 'text-yellow-400' : 'text-text-primary'} strokeWidth={2} />
        </div>
        
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-mono text-[12px] text-text-primary opacity-90 truncate">{summary}</span>
          {isMCP && server && (
            <span className="text-[9px] px-1 py-0.5 bg-surface-elevated border border-border text-text-secondary rounded font-mono uppercase tracking-wider">
              {server}
            </span>
          )}
        </div>
        
        {/* Toggle icon */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          {isExpanded ? (
            <ChevronDown size={12} className="text-text-secondary" strokeWidth={2} />
          ) : (
            <ChevronRight size={12} className="text-text-secondary" strokeWidth={2} />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 text-[11px] font-mono bg-code-bg border border-code-border rounded-lg p-3 space-y-3 shadow-sm">
          {/* Arguments */}
          <div className="flex gap-2">
            <span className="text-blue-400 shrink-0">$</span>
            <div className="overflow-x-auto whitespace-pre-wrap break-all">
              {Object.entries(toolCall.args).map(([k, v]) => (
                <span key={k} className="mr-2">
                  <span className="text-pink-400">--{k}</span>=
                  <span className="text-green-300">
                    {typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}
                  </span>
                </span>
              ))}
            </div>
          </div>
          
          {/* Result */}
          {toolResult && (
            <div className="flex gap-2 pt-2 border-t border-code-border/50">
              <span className="text-text-secondary shrink-0">{'>'}</span>
              <div className={`overflow-x-auto whitespace-pre-wrap break-all max-h-60 overflow-y-auto w-full ${isError ? 'text-red-400' : 'text-text-secondary'}`}>
                {typeof toolResult.result === 'string'
                  ? toolResult.result
                  : JSON.stringify(toolResult.result, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
