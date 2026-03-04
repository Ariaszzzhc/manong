import { createTwoFilesPatch } from 'diff';
import type { FileDiffInfo } from '../../../shared/types';

export function computeFileDiff(
  filePath: string,
  original: string,
  modified: string
): FileDiffInfo {
  const diff = createTwoFilesPatch(filePath, filePath, original, modified, '', '', {
    context: 3,
  });

  let linesAdded = 0;
  let linesRemoved = 0;
  const lines = diff.split('\n');
  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) linesAdded++;
    else if (line.startsWith('-')) linesRemoved++;
  }

  return {
    filePath,
    changeType: original === '' ? 'created' : 'modified',
    diff,
    linesAdded,
    linesRemoved,
  };
}
