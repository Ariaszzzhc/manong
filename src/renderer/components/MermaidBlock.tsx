import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { useAppStore } from '../stores/app';
import { useTranslation } from '../i18n';

interface MermaidBlockProps {
  code: string;
}

export const MermaidBlock: React.FC<MermaidBlockProps> = ({ code }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appTheme = useAppStore((s) => s.config?.theme) ?? 'dark';
  const mermaidTheme = appTheme === 'light' ? 'default' : 'dark';
  const t = useTranslation();

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
      setError(t['mermaid.emptyDiagram']);
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
        <span className="animate-pulse">{t['mermaid.loading']}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-4 p-4 bg-error/10 border border-error/50 rounded-lg text-error text-sm">
        <div className="font-semibold mb-1">{t['mermaid.syntaxError']}</div>
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{error}</pre>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-error/80 hover:text-error">{t['mermaid.viewSource']}</summary>
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
