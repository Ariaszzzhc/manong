import React, { useMemo } from 'react';

interface DiffViewProps {
  diff: string;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'hunk';
  content: string;
}

function parseDiff(diff: string): DiffLine[] {
  const lines = diff.split('\n');
  const result: DiffLine[] = [];

  for (const line of lines) {
    // Skip header lines
    if (
      line.startsWith('===') ||
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('diff ')
    ) {
      continue;
    }

    if (line.startsWith('@@')) {
      result.push({ type: 'hunk', content: line });
    } else if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.slice(1) });
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.slice(1) });
    } else if (line.startsWith(' ')) {
      result.push({ type: 'context', content: line.slice(1) });
    } else if (line.startsWith('\\')) {
      // "\ No newline at end of file" — skip
      continue;
    }
  }

  return result;
}

const lineStyles: Record<DiffLine['type'], string> = {
  add: 'bg-green-500/10 text-green-400',
  remove: 'bg-red-500/10 text-red-400',
  context: 'text-text-secondary',
  hunk: 'text-blue-400/70',
};

const linePrefix: Record<DiffLine['type'], string> = {
  add: '+',
  remove: '-',
  context: ' ',
  hunk: '',
};

export const DiffView: React.FC<DiffViewProps> = ({ diff }) => {
  const lines = useMemo(() => parseDiff(diff), [diff]);

  if (lines.length === 0) return null;

  return (
    <div className="font-mono text-[11px] leading-[18px] overflow-x-auto">
      {lines.map((line, idx) => (
        <div key={idx} className={`px-2 whitespace-pre ${lineStyles[line.type]}`}>
          {line.type === 'hunk' ? (
            <span>{line.content}</span>
          ) : (
            <>
              <span className="select-none opacity-50 inline-block w-3">
                {linePrefix[line.type]}
              </span>
              <span>{line.content}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
