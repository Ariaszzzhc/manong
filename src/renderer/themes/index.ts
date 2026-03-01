// Theme management for Manong

import { lightTokens, darkTokens, applyTheme, type ThemeTokens } from './tokens';

export {
  lightTokens,
  darkTokens,
  applyTheme,
  type ThemeTokens,
};

export const themes = {
  light: lightTokens,
  dark: darkTokens,
} as const;

export type ThemeName = keyof typeof themes;
