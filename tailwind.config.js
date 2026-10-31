/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Hiragino Sans"', '"Noto Sans JP"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        popIn: {
          '0%': { transform: 'scale(0.65)', opacity: '0.3' },
          '70%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        lineGlow: {
          '0%': { backgroundColor: 'rgba(99, 102, 241, 0.38)' },
          '100%': { backgroundColor: 'transparent' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-3px)' },
          '75%': { transform: 'translateX(3px)' },
        }
      },
      animation: {
        'pop-in': 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'line-glow': 'lineGlow 0.65s ease-out',
        'shake': 'shake 0.25s ease-in-out',
      },
    },
  },
  plugins: [],
};
