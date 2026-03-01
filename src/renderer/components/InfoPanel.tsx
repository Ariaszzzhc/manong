import React from 'react';
import { useAppStore } from '../stores/app';

const formatTokens = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

export const InfoPanel: React.FC = () => {
  const { currentSession, isStreaming } = useAppStore();

  const toolCalls = currentSession?.messages.reduce((acc, msg) => {
    return (
      acc +
      msg.parts.filter(
        (p) => p.type === 'tool-call' || p.type === 'tool-result'
      ).length
    );
  }, 0);

  const tokenUsage = currentSession?.tokenUsage;
  const lastUsage = currentSession?.lastUsage;

  const totalTokens = tokenUsage
    ? tokenUsage.inputTokens + tokenUsage.outputTokens
    : 0;

  const contextTokens = lastUsage
    ? lastUsage.inputTokens + lastUsage.outputTokens +
      lastUsage.cacheCreationInputTokens + lastUsage.cacheReadInputTokens
    : 0;

  return (
    <div className="w-72 bg-zinc-900 border-l border-zinc-800 p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase mb-4">
        Session Info
      </h3>

      {/* Stats */}
      <div className="mb-6">
        <label className="text-xs text-zinc-500 uppercase">Statistics</label>
        <div className="mt-2 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Messages</span>
            <span className="text-zinc-300">
              {currentSession?.messages.length ?? 0}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Tool Calls</span>
            <span className="text-zinc-300">{toolCalls ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Token Usage - Cumulative */}
      <div className="mb-6">
        <label className="text-xs text-zinc-500 uppercase">Cumulative Usage</label>
        <div className="mt-2 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Input</span>
            <span className="text-zinc-300">
              {formatTokens(tokenUsage?.inputTokens ?? 0)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Output</span>
            <span className="text-zinc-300">
              {formatTokens(tokenUsage?.outputTokens ?? 0)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400 font-medium">Total</span>
            <span className="text-zinc-200 font-medium">
              {formatTokens(totalTokens)}
            </span>
          </div>
        </div>
      </div>

      {/* Token Usage - Current Context */}
      {lastUsage && (
        <div className="mb-6">
          <label className="text-xs text-zinc-500 uppercase">Current Context</label>
          <div className="mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Tokens</span>
              <span className="text-zinc-200 font-medium">
                {formatTokens(contextTokens)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mb-6">
        <label className="text-xs text-zinc-500 uppercase">Status</label>
        <div className="mt-2 flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isStreaming ? 'bg-green-500 streaming-indicator' : 'bg-zinc-500'
            }`}
          />
          <span className="text-sm text-zinc-400">
            {isStreaming ? 'Processing...' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Recent Changes */}
      <div>
        <label className="text-xs text-zinc-500 uppercase">Recent Changes</label>
        <div className="mt-2 text-sm text-zinc-500">
          {currentSession?.messages.some((m) =>
            m.parts.some(
              (p) =>
                p.type === 'tool-call' &&
                ['write_file', 'edit_file'].includes(p.toolName)
            )
          ) ? (
            <div className="space-y-1">
              {currentSession?.messages
                .flatMap((m) =>
                  m.parts.filter(
                    (p) =>
                      p.type === 'tool-call' &&
                      ['write_file', 'edit_file'].includes(p.toolName)
                  )
                )
                .slice(-5)
                .map((p, idx) => {
                  if (p.type !== 'tool-call') return null;
                  const args = p.args as { file_path?: string };
                  return (
                    <div
                      key={idx}
                      className="text-zinc-400 font-mono text-xs truncate"
                    >
                      {args.file_path}
                    </div>
                  );
                })}
            </div>
          ) : (
            'No changes yet'
          )}
        </div>
      </div>
    </div>
  );
};
