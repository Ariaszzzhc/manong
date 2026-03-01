// Theme Token definitions for Manong

export interface ThemeTokens {
  // Backgrounds
  background: string;       // Main background
  surface: string;          // Card/panel background
  surfaceElevated: string;  // Floating/popup background

  // Text
  textPrimary: string;      // Primary text
  textSecondary: string;    // Secondary/description text

  // Borders
  border: string;           // Default border
  borderFocus: string;      // Focus border

  // States
  hover: string;            // Hover background
  active: string;           // Active background

  // Code blocks
  codeBackground: string;   // Code background
  codeBorder: string;       // Code border

  // Scrollbar
  scrollbarThumb: string;       // Scrollbar thumb color
  scrollbarThumbHover: string;  // Scrollbar thumb hover color
}

export const lightTokens: ThemeTokens = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceElevated: '#F3F4F6',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  borderFocus: '#EA580C',
  hover: '#F3F4F6',
  active: '#E5E7EB',
  codeBackground: '#F3F4F6',
  codeBorder: '#E5E7EB',
  scrollbarThumb: '#D1D5DB',
  scrollbarThumbHover: '#9CA3AF',
};

export const darkTokens: ThemeTokens = {
  background: '#0D0D0D',
  surface: '#161616',
  surfaceElevated: '#1E1E1E',
  textPrimary: '#E5E5E5',
  textSecondary: '#A3A3A3',
  border: '#262626',
  borderFocus: '#EA580C',
  hover: '#1E1E1E',
  active: '#262626',
  codeBackground: '#1E1E1E',
  codeBorder: '#262626',
  scrollbarThumb: '#404040',
  scrollbarThumbHover: '#525252',
};

// Convert camelCase to kebab-case for CSS variable names
function toKebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// Apply theme tokens as CSS variables on :root
export function applyTheme(tokens: ThemeTokens): void {
  const root = document.documentElement;
  Object.entries(tokens).forEach(([key, value]) => {
    const cssVar = toKebabCase(key);
    root.style.setProperty(`--${cssVar}`, value);
  });
}
