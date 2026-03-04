import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../stores/app';
import { useTranslation } from '../i18n';

// Module-level cache: avoids re-render flash when ReactMarkdown
// unmounts/remounts this component during streaming.
const svgCache = new Map<string, string>();

interface MermaidBlockProps {
  code: string;
  isStreaming?: boolean;
}

export const MermaidBlock: React.FC<MermaidBlockProps> = ({ code, isStreaming }) => {
  const appTheme = useAppStore((s) => s.config?.theme) ?? 'dark';
  const mermaidTheme = appTheme === 'light' ? 'default' : 'dark';
  const t = useTranslation();

  const cacheKey = `${mermaidTheme}:${code.trim()}`;
  const cached = svgCache.get(cacheKey);

  const [svg, setSvg] = useState(cached || '');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!cached);

  useEffect(() => {
    if (isStreaming) return;

    const hit = svgCache.get(cacheKey);
    if (hit) {
      setSvg(hit);
      setIsLoading(false);
      return;
    }

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
        svgCache.set(cacheKey, result.svg);
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
  }, [cacheKey, isStreaming]);

  if (isStreaming || isLoading) {
    return (
      <div className="my-4 p-4 bg-surface rounded-lg border border-border text-text-secondary text-sm flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" />
        <span>{t['mermaid.loading']}</span>
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
