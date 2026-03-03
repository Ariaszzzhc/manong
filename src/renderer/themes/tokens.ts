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
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceElevated: '#F4F4F5',
  textPrimary: '#09090B',
  textSecondary: '#71717A',
  border: '#E4E4E7',
  borderFocus: '#09090B',
  hover: '#F4F4F5',
  active: '#E4E4E7',
  codeBackground: '#F4F4F5',
  codeBorder: '#E4E4E7',
  scrollbarThumb: '#D4D4D8',
  scrollbarThumbHover: '#A1A1AA',
};

export const darkTokens: ThemeTokens = {
  background: '#09090B', // Zinc 950
  surface: '#18181B',    // Zinc 900
  surfaceElevated: '#27272A', // Zinc 800
  textPrimary: '#FAFAFA', // Zinc 50
  textSecondary: '#A1A1AA', // Zinc 400
  border: '#27272A',     // Zinc 800
  borderFocus: '#FAFAFA', // Zinc 50 (white for focus)
  hover: '#27272A',      // Zinc 800
  active: '#3F3F46',     // Zinc 700
  codeBackground: '#000000', // Pure black for code
  codeBorder: '#27272A', // Zinc 800
  scrollbarThumb: '#3F3F46',
  scrollbarThumbHover: '#52525B',
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
