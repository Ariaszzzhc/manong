/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#EA580C',
          hover: '#C2410C',
        },
        // Theme-aware colors using CSS variables
        background: 'var(--background)',
        surface: 'var(--surface)',
        'surface-elevated': 'var(--surface-elevated)',
        border: 'var(--border)',
        'border-focus': 'var(--border-focus)',
        hover: 'var(--hover)',
        active: 'var(--active)',
        'code-bg': 'var(--code-background)',
        'code-border': 'var(--code-border)',
        // Text colors using CSS variables
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        // Accent colors (static)
        accent: {
          blue: '#3B82F6',
          green: '#10B981',
          purple: '#8B5CF6',
          red: '#EF4444',
          yellow: '#F59E0B',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
