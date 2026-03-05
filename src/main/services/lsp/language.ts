import * as path from 'path';

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.py': 'python',
  '.go': 'go',
};

export function getLanguageId(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext];
}

export function getExtension(languageId: string): string | undefined {
  for (const [ext, lang] of Object.entries(EXTENSION_TO_LANGUAGE)) {
    if (lang === languageId) return ext;
  }
  return undefined;
}
