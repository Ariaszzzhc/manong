import React from 'react';
import { Plus, Terminal, Code, ChevronRight } from 'lucide-react';
import { useAppStore } from '../stores/app';

const formatTokens = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

export const Sidebar: React.FC = () => {
  const { sessions, currentSessionId, setCurrentSession, deleteSession } =
    useAppStore();

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

  return (
    <aside className="w-64 bg-surface-elevated border-r border-border flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border flex justify-between items-center">
        <span className="text-xs font-medium text-text-primary uppercase tracking-widest">
          Sessions
        </span>
        <button
          onClick={handleNewSession}
          className="text-text-secondary hover:text-text-primary transition-colors"
          title="New Session"
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
              Current
            </div>
            {groupedSessions.current.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-2 px-2 py-2 rounded bg-hover text-text-primary text-xs group transition-all border-l-2 border-primary cursor-pointer"
              >
                <Terminal size={14} className="text-primary" strokeWidth={1.5} />
                <span className="truncate font-medium flex-1">
                  {session.title || 'New Chat'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* History sessions */}
        {groupedSessions.history.length > 0 && (
          <div className="px-2">
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2 px-2">
              History
            </div>
            {groupedSessions.history.map((session) => (
              <div
                key={session.id}
                className="group flex items-center gap-2 px-2 py-2 rounded hover:bg-hover text-text-secondary hover:text-text-primary text-xs transition-colors mb-0.5 cursor-pointer"
                onClick={() => setCurrentSession(session)}
              >
                <Code size={14} strokeWidth={1.5} />
                <span className="truncate flex-1">
                  {session.title || 'New Chat'}
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
            No conversations yet
          </div>
        )}
      </div>

      {/* Context Usage Bar */}
      <div className="p-3 border-t border-border bg-surface-elevated">
        <div className="flex items-center justify-between text-[10px] text-text-secondary font-mono mb-1">
          <span>CONTEXT USAGE</span>
          <span>{usagePercent.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-active h-1 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        {totalTokens > 0 && (
          <div className="text-[10px] text-text-secondary mt-1 font-mono">
            {formatTokens(totalTokens)} tokens
          </div>
        )}
      </div>
    </aside>
  );
};
