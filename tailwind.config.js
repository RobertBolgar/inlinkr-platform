/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#9ca3af',
          500: '#71717a',
          600: '#52525b',
          700: '#3a3a3a',
          800: '#262626',
          900: '#161616',
          950: '#09090b',
        },
        primary: {
          DEFAULT: '#F05A1A',
          hover: '#FF6A2C',
          strong: '#CF4611',
        },
        info: '#60A5FA',
        success: '#34D399',
        warning: '#FBBF24',
        danger: '#F87171',
        background: '#09090B',
        surface: {
          DEFAULT: '#161616',
          elevated: '#1D1D1F',
          hover: '#222224',
        },
        border: '#262626',
        text: {
          DEFAULT: '#F5F5F5',
          muted: '#9CA3AF',
          subtle: '#71717A',
        },
      },
      boxShadow: {
        'ink-sm': '0 1px 2px rgb(0 0 0 / 0.18)',
        ink: '0 12px 28px rgb(0 0 0 / 0.22)',
        'ink-lg': '0 20px 45px rgb(0 0 0 / 0.32)',
      },
      transitionTimingFunction: {
        ink: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'ink-enter': {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'ink-enter': 'ink-enter 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
