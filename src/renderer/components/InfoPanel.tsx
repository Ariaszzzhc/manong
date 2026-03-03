import React from 'react';
import { useAppStore } from '../stores/app';
import { useTranslation } from '../i18n';

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
  const t = useTranslation();

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
    <div className="w-72 bg-surface border-l border-border p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-text-secondary uppercase mb-4">
        {t['info.sessionInfo']}
      </h3>

      {/* Stats */}
      <div className="mb-6">
        <label className="text-xs text-text-secondary uppercase">{t['info.statistics']}</label>
        <div className="mt-2 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">{t['info.messages']}</span>
            <span className="text-text-primary">
              {currentSession?.messages.length ?? 0}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">{t['info.toolCalls']}</span>
            <span className="text-text-primary">{toolCalls ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Token Usage - Cumulative */}
      <div className="mb-6">
        <label className="text-xs text-text-secondary uppercase">{t['info.cumulativeUsage']}</label>
        <div className="mt-2 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">{t['info.input']}</span>
            <span className="text-text-primary">
              {formatTokens(tokenUsage?.inputTokens ?? 0)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">{t['info.output']}</span>
            <span className="text-text-primary">
              {formatTokens(tokenUsage?.outputTokens ?? 0)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary font-medium">{t['info.total']}</span>
            <span className="text-text-primary font-medium">
              {formatTokens(totalTokens)}
            </span>
          </div>
        </div>
      </div>

      {/* Token Usage - Current Context */}
      {lastUsage && (
        <div className="mb-6">
          <label className="text-xs text-text-secondary uppercase">{t['info.currentContext']}</label>
          <div className="mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">{t['info.tokens']}</span>
              <span className="text-text-primary font-medium">
                {formatTokens(contextTokens)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mb-6">
        <label className="text-xs text-text-secondary uppercase">{t['info.status']}</label>
        <div className="mt-2 flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isStreaming ? 'bg-success streaming-indicator' : 'bg-text-secondary'
            }`}
          />
          <span className="text-sm text-text-secondary">
            {isStreaming ? t['info.processing'] : t['info.idle']}
          </span>
        </div>
      </div>

      {/* Recent Changes */}
      <div>
        <label className="text-xs text-text-secondary uppercase">{t['info.recentChanges']}</label>
        <div className="mt-2 text-sm text-text-secondary">
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
                      className="text-text-secondary font-mono text-xs truncate"
                    >
                      {args.file_path}
                    </div>
                  );
                })}
            </div>
          ) : (
            t['info.noChanges']
          )}
        </div>
      </div>
    </div>
  );
};
