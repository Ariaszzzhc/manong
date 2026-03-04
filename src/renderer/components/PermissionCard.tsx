import React, { useEffect, useCallback } from 'react';
import { Shield, Terminal, FileEdit } from 'lucide-react';
import type { PermissionRequest, PermissionDecision } from '../../shared/permission-types';
import { useTranslation } from '../i18n';
import { DiffView } from './DiffView';

interface PermissionCardProps {
  request: PermissionRequest;
  onRespond: (decision: PermissionDecision) => void;
}

export const PermissionCard: React.FC<PermissionCardProps> = ({
  request,
  onRespond,
}) => {
  const t = useTranslation();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'y' || e.key === 'Enter') {
        e.preventDefault();
        onRespond('allow');
      } else if (e.key === 'n' || e.key === 'Escape') {
        e.preventDefault();
        onRespond('deny');
      } else if (e.key === 'a') {
        e.preventDefault();
        onRespond('always-allow');
      }
    },
    [onRespond]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const icon =
    request.riskLevel === 'execute' ? (
      <Terminal size={16} className="text-warning" />
    ) : (
      <FileEdit size={16} className="text-primary" />
    );

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden w-full">
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={14} className="text-warning" />
          <h3 className="text-sm font-medium text-text-primary">
            {t['permission.title']}
          </h3>
        </div>

        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs font-medium text-text-primary">
            {request.toolName}
          </span>
        </div>

        <div className="bg-background rounded px-3 py-2 border border-border">
          <code className="text-xs text-text-primary font-mono break-all whitespace-pre-wrap">
            {request.description}
          </code>
        </div>

        {request.diff && (
          <div className="mt-2 bg-background rounded border border-border max-h-64 overflow-y-auto">
            <DiffView diff={request.diff} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-surface-hover">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onRespond('allow')}
            className="px-3 py-1 bg-primary text-on-primary text-xs rounded hover:bg-primary-hover transition-colors"
          >
            {t['permission.allow']}
            <span className="ml-1 opacity-60 text-[10px]">(y)</span>
          </button>
          <button
            onClick={() => onRespond('deny')}
            className="px-3 py-1 text-xs text-text-primary border border-border rounded hover:bg-hover transition-colors"
          >
            {t['permission.deny']}
            <span className="ml-1 opacity-60 text-[10px]">(n)</span>
          </button>
          <button
            onClick={() => onRespond('always-allow')}
            className="px-3 py-1 text-xs text-primary border border-primary/30 rounded hover:bg-primary/10 transition-colors"
          >
            {t['permission.alwaysAllow']}
            <span className="ml-1 opacity-60 text-[10px]">(a)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
