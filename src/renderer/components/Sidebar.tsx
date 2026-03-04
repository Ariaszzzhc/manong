import React, { useMemo } from 'react';
import { Plus, Terminal, Code, ChevronRight, Circle, CircleDot, CheckCircle } from 'lucide-react';
import { useAppStore } from '../stores/app';
import { useTranslation, tf } from '../i18n';
import { shortcutTitle } from '../hooks/useShortcutHint';
import type { FileDiffInfo } from '../../shared/types';

const formatTokens = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

export const Sidebar: React.FC = () => {
  const { sessions, currentSessionId, setCurrentSession, deleteSession, todos, pendingParts } =
    useAppStore();
  const t = useTranslation();

  const handleNewSession = async () => {
    const session = await window.manong.session.create();
    useAppStore.getState().addSession(session);
  };

  // Group sessions into Current (active) and History (all others)
  const groupedSessions = React.useMemo(() => {
    const current = sessions.find((s) => s.id === currentSessionId);
    const history = sessions.filter((s) => s.id !== currentSessionId);

    return {
      current: current ? [current] : [],
      history,
    };
  }, [sessions, currentSessionId]);

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

    // From streaming pending parts
    for (const part of pendingParts) {
      if (part.type === 'tool-result' && part.diff) {
        changesMap.set(part.diff.filePath, part.diff);
      }
    }

    return Array.from(changesMap.values());
  }, [currentSession, pendingParts]);

  const totalAdded = fileChanges.reduce((sum, c) => sum + c.linesAdded, 0);
  const totalRemoved = fileChanges.reduce((sum, c) => sum + c.linesRemoved, 0);

  return (
    <aside className="w-64 bg-surface-elevated border-r border-border flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border flex justify-between items-center">
        <span className="text-xs font-medium text-text-primary uppercase tracking-widest">
          {t['sidebar.sessions']}
        </span>
        <button
          onClick={handleNewSession}
          className="text-text-secondary hover:text-text-primary transition-colors"
          title={shortcutTitle(t['sidebar.newSession'], 'newSession')}
        >
          <Plus size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Current session */}
        {groupedSessions.current.length > 0 && (
          <div className="px-2 mb-4">
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2 px-2">
              {t['sidebar.current']}
            </div>
            {groupedSessions.current.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-elevated text-text-primary text-[13px] group transition-all cursor-pointer shadow-sm border border-border"
              >
                <Terminal size={14} className="text-text-primary opacity-80" strokeWidth={1.5} />
                <span className="truncate font-medium flex-1">
                  {session.title || t['sidebar.newChat']}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* History sessions */}
        {groupedSessions.history.length > 0 && (
          <div className="px-2">
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2 px-2">
              {t['sidebar.history']}
            </div>
            {groupedSessions.history.map((session) => (
              <div
                key={session.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-hover text-text-secondary hover:text-text-primary text-[13px] transition-colors mb-0.5 cursor-pointer"
                onClick={() => setCurrentSession(session)}
              >
                <Code size={14} className="opacity-60" strokeWidth={1.5} />
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
                  <ChevronRight size={12} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="p-4 text-center text-text-secondary text-xs">
            {t['sidebar.noConversations']}
          </div>
        )}
      </div>

      {/* File Changes */}
      {fileChanges.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              {t['sidebar.filesChanged']} ({fileChanges.length})
            </div>
            <span className="text-[10px] font-mono">
              <span className="text-green-400">+{totalAdded}</span>
              {totalRemoved > 0 && (
                <span className="text-red-400 ml-1">-{totalRemoved}</span>
              )}
            </span>
          </div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
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
        </div>
      )}

      {/* Todo List */}
      {todos && todos.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">
            {t['sidebar.tasks']}
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
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
