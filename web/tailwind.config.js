/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Design system — docs/design-system.md
        primary: {
          DEFAULT: '#0F4C3A',
          light: '#E8F3EE',
          dark: '#0A3529'
        },
        secondary: '#D9A441',
        success: { DEFAULT: '#1E8E3E', dark: '#3DDC84' },
        warning: { DEFAULT: '#F59E0B', dark: '#FBBF24' },
        danger: { DEFAULT: '#DC2626', dark: '#F87171' },
        info: { DEFAULT: '#2563EB', dark: '#60A5FA' },
        surface: { DEFAULT: '#F7F8F7', dark: '#182420' },
        ink: {
          DEFAULT: '#111827',
          secondary: '#6B7280',
          disabled: '#B0B4B0',
          dark: '#F3F4F2',
          darkSecondary: '#9CA69F',
          darkDisabled: '#4B5750'
        },
        line: { DEFAULT: '#E2E4E2', dark: '#2A3833' },
        bg: { DEFAULT: '#FFFFFF', dark: '#0E1512' }
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '20px'
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08)',
        modal: '0 8px 24px rgba(0,0,0,0.16)'
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px'
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans', 'system-ui', 'sans-serif']
      },
      fontSize: {
        display: ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        h1: ['24px', { lineHeight: '1.3', fontWeight: '700' }],
        h2: ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['17px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['15px', { lineHeight: '1.5' }],
        caption: ['13px', { lineHeight: '1.4' }]
      }
    }
  },
  plugins: []
}
