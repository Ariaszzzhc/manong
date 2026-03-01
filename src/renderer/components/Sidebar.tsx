import React from 'react';
import { useAppStore } from '../stores/app';

export const Sidebar: React.FC = () => {
  const { sessions, currentSessionId, setCurrentSession, deleteSession } =
    useAppStore();

  const handleNewSession = async () => {
    const session = await window.manong.session.create();
    useAppStore.getState().addSession(session);
  };

  const groupedSessions = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { [key: string]: typeof sessions } = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    for (const session of sessions) {
      const sessionDate = new Date(session.updatedAt);
      sessionDate.setHours(0, 0, 0, 0);

      if (sessionDate.getTime() === today.getTime()) {
        groups['Today'].push(session);
      } else if (sessionDate.getTime() === yesterday.getTime()) {
        groups['Yesterday'].push(session);
      } else {
        groups['Earlier'].push(session);
      }
    }

    return groups;
  }, [sessions]);

  return (
    <div className="w-64 bg-zinc-900 text-zinc-100 flex flex-col h-full border-r border-zinc-800">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <button
          onClick={handleNewSession}
          className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Session
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedSessions).map(([group, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={group} className="py-2">
              <div className="px-4 py-1 text-xs font-semibold text-zinc-500 uppercase">
                {group}
              </div>
              {items.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center px-4 py-2 cursor-pointer hover:bg-zinc-800 ${
                    currentSessionId === session.id ? 'bg-zinc-800' : ''
                  }`}
                  onClick={() => setCurrentSession(session)}
                >
                  <div className="flex-1 truncate text-sm">
                    {session.title}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                      window.manong.session.delete(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-opacity"
                  >
                    <svg
                      className="w-4 h-4 text-zinc-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="p-4 text-center text-zinc-500 text-sm">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  );
};
