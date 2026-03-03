import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { useAppStore } from '../stores/app';

interface MermaidBlockProps {
  code: string;
}

export const MermaidBlock: React.FC<MermaidBlockProps> = ({ code }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appTheme = useAppStore((s) => s.config?.theme) ?? 'dark';
  const mermaidTheme = appTheme === 'light' ? 'default' : 'dark';

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: 'loose',
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      suppressErrorRendering: true,
    });

    setIsLoading(true);
    setError(null);

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError('Empty diagram code');
      setIsLoading(false);
      return;
    }

    const id = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    const renderDiagram = async () => {
      try {
        const result = await mermaid.render(id, trimmedCode);
        setSvg(result.svg);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    renderDiagram();
  }, [code, mermaidTheme]);

  if (isLoading) {
    return (
      <div className="my-4 p-4 bg-surface rounded-lg border border-border text-text-secondary text-sm flex items-center gap-2">
        <span className="animate-pulse">Loading diagram...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
        <div className="font-semibold mb-1">Mermaid Syntax Error</div>
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{error}</pre>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-red-300 hover:text-red-200">View source code</summary>
          <pre className="mt-2 p-2 bg-surface rounded text-xs overflow-x-auto">{code}</pre>
        </details>
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram my-4 p-4 bg-surface rounded-lg border border-border overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
