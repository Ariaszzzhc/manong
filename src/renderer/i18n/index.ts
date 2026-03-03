import { useMemo } from 'react';
import { useAppStore } from '../stores/app';
import { en } from './locales/en';
import { zhCN } from './locales/zh-CN';
import type { Translations, TranslationKey } from './locales/en';

export type { Translations, TranslationKey };

export const SUPPORTED_LOCALES: Record<string, string> = {
  en: 'English',
  'zh-CN': '简体中文',
};

export type LocaleCode = keyof typeof SUPPORTED_LOCALES;

const localeMap: Record<string, Translations> = {
  en,
  'zh-CN': zhCN,
};

export function detectLocale(): string {
  const lang = navigator.language;
  // Exact match
  if (localeMap[lang]) return lang;
  // Prefix match (e.g. zh-TW -> zh-CN)
  const prefix = lang.split('-')[0];
  for (const key of Object.keys(localeMap)) {
    if (key.split('-')[0] === prefix) return key;
  }
  return 'en';
}

export function useTranslation(): Translations {
  const language = useAppStore((s) => s.config?.language);
  return useMemo(() => localeMap[language as string] ?? en, [language]);
}

export function tf(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}
