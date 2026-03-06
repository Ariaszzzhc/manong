import React from 'react';
import { ChevronRight, ChevronDown, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { SubagentInfo } from '../../shared/types';
import { useTranslation } from '../i18n';

const formatTokens = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

const formatDuration = (startTime: number, endTime?: number): string => {
  const end = endTime || Date.now();
  const seconds = Math.floor((end - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m${remainingSeconds}s`;
};

const getAgentTypeColor = (agentType: string): string => {
  const colors: Record<string, string> = {
    'explore': 'text-blue-400',
    'plan': 'text-purple-400',
    'general-purpose': 'text-green-400',
    'test-runner': 'text-yellow-400',
  };
  return colors[agentType] || 'text-primary';
};

interface SubagentPanelProps {
  subagentInfos: SubagentInfo[];
  expanded: boolean;
  onToggle: () => void;
  viewingSubagentId: string | null;
  onSelectSubagent: (info: SubagentInfo) => void;
}

export const SubagentPanel: React.FC<SubagentPanelProps> = ({
  subagentInfos,
  expanded,
  onToggle,
  viewingSubagentId,
  onSelectSubagent,
}) => {
  const t = useTranslation();

  if (subagentInfos.length === 0) return null;

  const runningCount = subagentInfos.filter(i => i.status === 'running').length;

  return (
    <div className="px-3 py-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 px-1 hover:text-text-primary transition-colors w-full text-left"
      >
        {expanded ? (
          <ChevronDown size={12} strokeWidth={2} />
        ) : (
          <ChevronRight size={12} strokeWidth={2} />
        )}
        <span className="flex-1">{t['sidebar.subagents']} ({subagentInfos.length})</span>
        {runningCount > 0 && (
          <span className="text-primary normal-case font-normal">
            {runningCount} {t['sidebar.subagentsRunning']}
          </span>
        )}
      </button>
      {expanded && (
        <div className="space-y-1">
          {subagentInfos.map((info) => (
            <button
              key={info.id}
              onClick={() => onSelectSubagent(info)}
              className={`w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded-md transition-colors text-left ${
                viewingSubagentId === info.id
                  ? 'bg-active text-text-primary'
                  : 'hover:bg-hover text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className={`shrink-0 ${getAgentTypeColor(info.agentType)}`}>
                {info.status === 'running' ? (
                  <Loader2 size={12} className="animate-spin" strokeWidth={2} />
                ) : info.status === 'completed' ? (
                  <CheckCircle size={12} strokeWidth={1.5} />
                ) : info.status === 'error' ? (
                  <XCircle size={12} strokeWidth={1.5} />
                ) : (
                  <Clock size={12} strokeWidth={1.5} />
                )}
              </span>
              <span className="truncate flex-1 font-mono text-[11px]">
                {info.taskDescription}
              </span>
              <span className="shrink-0 text-[10px] text-text-secondary font-mono flex items-center gap-2">
                {info.tokenUsage && (
                  <span>{formatTokens(info.tokenUsage.inputTokens + info.tokenUsage.outputTokens)}</span>
                )}
                <span>{formatDuration(info.startTime, info.endTime)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
