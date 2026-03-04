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

  // Brand & Status
  primary: string;          // Brand primary color
  primaryHover: string;     // Brand primary hover color
  onPrimary: string;        // Text on primary background
  success: string;          // Success state
  warning: string;          // Warning state
  error: string;            // Error state
  onError: string;          // Text on error background
  info: string;             // Info state
}

export const lightTokens: ThemeTokens = {
  background: '#F9FAFB',      // Gray 50 - Main background
  surface: '#FFFFFF',         // White - Card/panel background
  surfaceElevated: '#F3F4F6', // Gray 100 - Floating/popup/input background
  textPrimary: '#111827',     // Gray 900 - Primary text
  textSecondary: '#6B7280',   // Gray 500 - Secondary text
  border: '#E5E7EB',          // Gray 200 - Default border
  borderFocus: '#111827',     // Gray 900 - Focus border
  hover: '#F3F4F6',           // Gray 100 - Hover state
  active: '#E5E7EB',          // Gray 200 - Active state
  codeBackground: '#F9FAFB',  // Gray 50 - Code block background
  codeBorder: '#E5E7EB',      // Gray 200 - Code block border
  scrollbarThumb: '#D1D5DB',  // Gray 300
  scrollbarThumbHover: '#9CA3AF', // Gray 400
  
  // Brand & Status - Blue/Indigo based for professional look
  primary: '#2563EB',         // Blue 600
  primaryHover: '#1D4ED8',    // Blue 700
  onPrimary: '#FFFFFF',       // White text on primary
  success: '#059669',         // Emerald 600
  warning: '#D97706',         // Amber 600
  error: '#DC2626',           // Red 600
  onError: '#FFFFFF',         // White text on error
  info: '#2563EB',            // Blue 600
};

export const darkTokens: ThemeTokens = {
  background: '#09090B',      // Zinc 950
  surface: '#18181B',         // Zinc 900
  surfaceElevated: '#27272A', // Zinc 800
  textPrimary: '#FAFAFA',     // Zinc 50
  textSecondary: '#A1A1AA',   // Zinc 400
  border: '#27272A',          // Zinc 800
  borderFocus: '#FAFAFA',     // Zinc 50
  hover: '#27272A',           // Zinc 800
  active: '#3F3F46',          // Zinc 700
  codeBackground: '#000000',  // Pure black
  codeBorder: '#27272A',      // Zinc 800
  scrollbarThumb: '#3F3F46',  // Zinc 700
  scrollbarThumbHover: '#52525B', // Zinc 600

  // Brand & Status
  primary: '#3B82F6',         // Blue 500
  primaryHover: '#60A5FA',    // Blue 400
  onPrimary: '#FFFFFF',       // White text on primary
  success: '#10B981',         // Emerald 500
  warning: '#F59E0B',         // Amber 500
  error: '#EF4444',           // Red 500
  onError: '#FFFFFF',         // White text on error
  info: '#3B82F6',            // Blue 500
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
