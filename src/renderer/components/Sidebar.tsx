import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Code, ChevronRight, ChevronDown, Circle, CircleDot, CheckCircle, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAppStore } from '../stores/app';
import { useTranslation, tf } from '../i18n';
import { shortcutTitle } from '../hooks/useShortcutHint';
import type { FileDiffInfo, SubagentInfo } from '../../shared/types';
import { SubagentPanel } from './SubagentPanel';

const formatTokens = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

const CollapsibleContent: React.FC<{ expanded: boolean; children: ReactNode }> = ({ expanded, children }) => (
  <div
    className="grid transition-[grid-template-rows] duration-200 ease-out"
    style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
  >
    <div className="overflow-hidden">
      {children}
    </div>
  </div>
);

export const Sidebar: React.FC = () => {
  const {
    sessions,
    currentSessionId,
    setCurrentSession,
    deleteSession,
    todos,
    pendingMessages,
    subagentInfos,
    viewingSubagentId,
    setViewingSubagent,
    loadViewingSubagentSession,
    updateSubagentInfo,
  } = useAppStore();
  const t = useTranslation();
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [subagentsExpanded, setSubagentsExpanded] = useState(true);

  useEffect(() => {
    const unsubscribe = window.manong.subagent.onStatusUpdate((info) => {
      updateSubagentInfo(info);
    });
    return unsubscribe;
  }, [updateSubagentInfo]);

  const handleSelectSubagent = async (info: SubagentInfo) => {
    setViewingSubagent(info.id);
    await loadViewingSubagentSession(info.id);
  };

  const handleNewSession = async () => {
    const session = await window.manong.session.create();
    useAppStore.getState().addSession(session);
  };

  // Filter out empty sessions for history display
  const historySessions = useMemo(() => {
    return sessions.filter((s) => s.messages.length > 0 && !s.parentSessionId);
  }, [sessions]);

  // Calculate context usage
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const tokenUsage = currentSession?.tokenUsage;
  const totalTokens = tokenUsage
    ? tokenUsage.inputTokens + tokenUsage.outputTokens
    : 0;
  const maxContext = 200000; // Typical model context window
  const usagePercent = Math.min((totalTokens / maxContext) * 100, 100);

  // Collect file changes from current session messages + pending parts
  const fileChanges = useMemo(() => {
    const changesMap = new Map<string, FileDiffInfo>();

    // From committed messages
    if (currentSession) {
      for (const msg of currentSession.messages) {
        for (const part of msg.parts) {
          if (part.type === 'tool-result' && part.diff) {
            changesMap.set(part.diff.filePath, part.diff);
          }
        }
      }
    }

    // From streaming pending messages
    for (const msg of pendingMessages) {
      for (const part of msg.parts) {
        if (part.type === 'tool-result' && part.diff) {
          changesMap.set(part.diff.filePath, part.diff);
        }
      }
    }

    return Array.from(changesMap.values());
  }, [currentSession, pendingMessages]);

  const totalAdded = fileChanges.reduce((sum, c) => sum + c.linesAdded, 0);
  const totalRemoved = fileChanges.reduce((sum, c) => sum + c.linesRemoved, 0);

  // Split panels into expanded (scrollable) and collapsed (pinned to bottom)
  const { expandedPanels, collapsedPanels } = useMemo(() => {
    const defs: { key: string; visible: boolean; expanded: boolean }[] = [
      { key: 'tasks', visible: todos && todos.length > 0, expanded: tasksExpanded },
      { key: 'subagents', visible: subagentInfos.length > 0, expanded: subagentsExpanded },
      { key: 'files', visible: fileChanges.length > 0, expanded: filesExpanded },
      { key: 'history', visible: true, expanded: historyExpanded },
    ];
    const visible = defs.filter((p) => p.visible);
    return {
      expandedPanels: visible.filter((p) => p.expanded),
      collapsedPanels: visible.filter((p) => !p.expanded),
    };
  }, [todos, subagentInfos, fileChanges, tasksExpanded, subagentsExpanded, filesExpanded, historyExpanded]);

  const panelContent: Record<string, ReactNode> = {
    tasks: (
      <div className="px-3 py-2" key="tasks">
        <button
          onClick={() => setTasksExpanded(!tasksExpanded)}
          className="flex items-center gap-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 px-1 hover:text-text-primary transition-colors w-full text-left"
        >
          {tasksExpanded ? (
            <ChevronDown size={12} strokeWidth={2} />
          ) : (
            <ChevronRight size={12} strokeWidth={2} />
          )}
          {t['sidebar.tasks']} ({todos.length})
        </button>
        <CollapsibleContent expanded={tasksExpanded}>
          <div className="space-y-1">
            {todos.map((todo, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 text-xs py-1 ${
                  todo.status === 'completed'
                    ? 'text-text-secondary line-through'
                    : todo.status === 'in_progress'
                    ? 'text-primary'
                    : 'text-text-primary'
                }`}
              >
                {todo.status === 'completed' ? (
                  <CheckCircle size={12} className="text-success shrink-0" strokeWidth={1.5} />
                ) : todo.status === 'in_progress' ? (
                  <CircleDot size={12} className="text-primary shrink-0" strokeWidth={1.5} />
                ) : (
                  <Circle size={12} className="text-text-secondary shrink-0" strokeWidth={1.5} />
                )}
                <span className="truncate flex-1">
                  {todo.priority === 'high' && (
                    <span className="text-error mr-1">!</span>
                  )}
                  {todo.content}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    ),
    subagents: (
      <SubagentPanel
        key="subagents"
        subagentInfos={subagentInfos}
        expanded={subagentsExpanded}
        onToggle={() => setSubagentsExpanded(!subagentsExpanded)}
        viewingSubagentId={viewingSubagentId}
        onSelectSubagent={handleSelectSubagent}
      />
    ),
    files: (
      <div className="px-3 py-2" key="files">
        <button
          onClick={() => setFilesExpanded(!filesExpanded)}
          className="flex items-center gap-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 px-1 hover:text-text-primary transition-colors w-full text-left"
        >
          {filesExpanded ? (
            <ChevronDown size={12} strokeWidth={2} />
          ) : (
            <ChevronRight size={12} strokeWidth={2} />
          )}
          <span className="flex-1">{t['sidebar.filesChanged']} ({fileChanges.length})</span>
          <span className="text-[10px] font-mono font-normal normal-case tracking-normal">
            <span className="text-green-400">+{totalAdded}</span>
            {totalRemoved > 0 && (
              <span className="text-red-400 ml-1">-{totalRemoved}</span>
            )}
          </span>
        </button>
        <CollapsibleContent expanded={filesExpanded}>
          <div className="space-y-0.5">
            {fileChanges.map((change, idx) => {
              const fileName = change.filePath.split('/').pop() || change.filePath;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 text-[11px] font-mono py-0.5 text-text-secondary"
                >
                  <span className={change.changeType === 'created' ? 'text-green-400' : 'text-yellow-400'}>
                    {change.changeType === 'created' ? 'A' : 'M'}
                  </span>
                  <span className="flex-1 truncate" title={change.filePath}>
                    {fileName}
                  </span>
                  <span className="shrink-0 text-[10px]">
                    <span className="text-green-400">+{change.linesAdded}</span>
                    {change.linesRemoved > 0 && (
                      <span className="text-red-400 ml-1">-{change.linesRemoved}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    ),
    history: (
      <div className="px-3 py-2" key="history">
        <button
          onClick={() => setHistoryExpanded(!historyExpanded)}
          className="flex items-center gap-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 px-1 hover:text-text-primary transition-colors w-full text-left"
        >
          {historyExpanded ? (
            <ChevronDown size={12} strokeWidth={2} />
          ) : (
            <ChevronRight size={12} strokeWidth={2} />
          )}
          {t['sidebar.history']} ({historySessions.length})
        </button>
        <CollapsibleContent expanded={historyExpanded}>
          {historySessions.length > 0 ? (
            historySessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors mb-0.5 cursor-pointer ${
                  session.id === currentSessionId
                    ? 'bg-active text-text-primary'
                    : 'hover:bg-hover text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => setCurrentSession(session)}
              >
                <Code size={14} className="opacity-60 shrink-0" strokeWidth={1.5} />
                <span className="truncate flex-1">
                  {session.title || t['sidebar.newChat']}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                    window.manong.session.delete(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-active rounded transition-opacity"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                </button>
              </div>
            ))
          ) : (
            <div className="px-2 text-center text-text-secondary text-xs py-2">
              {t['sidebar.noHistory']}
            </div>
          )}
        </CollapsibleContent>
      </div>
    ),
  };

  return (
    <aside className="w-64 bg-surface-elevated border-r border-border flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border flex justify-between items-center">
        <span className="text-xs font-medium text-text-primary uppercase tracking-widest">
          {t['sidebar.workspace']}
        </span>
        <button
          onClick={handleNewSession}
          className="text-text-secondary hover:text-text-primary transition-colors"
          title={shortcutTitle(t['sidebar.newTask'], 'newSession')}
        >
          <Plus size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Main content area — expanded panels */}
      <div className="flex-1 overflow-y-auto py-2">
        {expandedPanels.map((p) => panelContent[p.key])}
      </div>

      {/* Collapsed panels pinned to bottom */}
      {collapsedPanels.length > 0 && (
        <div className="border-t border-border py-1">
          {collapsedPanels.map((p) => panelContent[p.key])}
        </div>
      )}

      {/* Context Usage Bar */}
      <div className="p-4 border-t border-border bg-surface">
        <div className="flex items-center justify-between text-[10px] text-text-secondary font-mono mb-1.5 uppercase tracking-wider">
          <span>{t['sidebar.contextUsage']}</span>
          <span>{usagePercent.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-surface-elevated h-[3px] rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 bg-primary"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        {totalTokens > 0 && (
          <div className="text-[10px] text-text-secondary mt-1.5 font-mono text-right opacity-70">
            {tf(t['sidebar.tokens'], { count: formatTokens(totalTokens) })}
          </div>
        )}
      </div>
    </aside>
  );
};
