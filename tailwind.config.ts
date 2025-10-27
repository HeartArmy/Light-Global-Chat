import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        light: {
          background: '#ffffff',
          surface: '#f5f5f7',
          'surface-elevated': '#ffffff',
          'text-primary': '#1d1d1f',
          'text-secondary': '#6e6e73',
          accent: '#007aff',
          'accent-hover': '#0051d5',
          border: '#d2d2d7',
          error: '#ff3b30',
          success: '#34c759',
        },
        dark: {
          background: '#000000',
          surface: '#1c1c1e',
          'surface-elevated': '#2c2c2e',
          'text-primary': '#f5f5f7',
          'text-secondary': '#98989d',
          accent: '#0a84ff',
          'accent-hover': '#409cff',
          border: '#38383a',
          error: '#ff453a',
          success: '#32d74b',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        display: ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        heading: ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        body: ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['14px', { lineHeight: '1.4', fontWeight: '400' }],
        small: ['12px', { lineHeight: '1.3', fontWeight: '400' }],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '350ms',
      },
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-in-out': 'cubic-bezier(0.45, 0, 0.15, 1)',
      },
    },
  },
  plugins: [],
}
export default config
