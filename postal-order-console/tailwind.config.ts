import type { Config } from 'tailwindcss';

// Tokens copied from the existing postal-frontend tailwind config so the
// console looks like the rest of the platform.
const config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      transitionProperty: { none: 'none' },
      colors: {
        'primary-color': 'var(--primary-color)',
        'primary-dark': 'var(--primary-dark)',
        'secondary-color': 'var(--secondary-color)',
        'secondary-border-color': '#111827',
        'dark-950': 'var(--dark-950)',
        'dark-900': 'var(--dark-900)',
        'dark-600': 'var(--dark-600)',
        surface: 'var(--surface)',
        'surface-muted': 'var(--surface-muted)',
        'text-base': 'var(--text-base)',
        'text-muted': 'var(--text-muted)',
        border: 'var(--border)',
      },
      width: {
        'custom-button': '110px',
        'app-bar-search-width': '408px',
      },
      height: { 'custom-button': '45px' },
      fontSize: {
        'heading-1': '20px',
        'heading-2': '36px',
        'card-h1': '16px',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.55)' },
          '70%': { boxShadow: '0 0 0 12px rgba(239,68,68,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
        },
      },
      animation: { 'pulse-ring': 'pulse-ring 1.6s ease-out infinite' },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
