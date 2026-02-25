/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 다크 테마 기본 색상
        dark: {
          DEFAULT: '#08080f',
          50: '#1a1a2e',
          100: '#16162a',
          200: '#121226',
          300: '#0d0d18',
          400: '#08080f',
          500: '#050508'
        },
        // 카드/컴포넌트 배경
        card: {
          DEFAULT: '#0d0d18',
          hover: '#121226',
          active: '#1a1a2e'
        },
        // 보더 색상
        border: {
          DEFAULT: '#1a1a2e',
          light: '#2a2a4e',
          dark: '#0d0d18'
        },
        // 액센트 컬러 (Violet/Indigo)
        accent: {
          DEFAULT: '#7c3aed',
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95'
        },
        // 상태 색상
        success: {
          DEFAULT: '#10b981',
          dark: '#059669'
        },
        warning: {
          DEFAULT: '#f59e0b',
          dark: '#d97706'
        },
        error: {
          DEFAULT: '#ef4444',
          dark: '#dc2626'
        },
        info: {
          DEFAULT: '#3b82f6',
          dark: '#2563eb'
        }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans KR"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace']
      },
      animation: {
        'fade-up': 'fadeUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite'
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(124, 58, 237, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(124, 58, 237, 0.6)' }
        }
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(124, 58, 237, 0.3)',
        'glow': '0 0 20px rgba(124, 58, 237, 0.4)',
        'glow-lg': '0 0 30px rgba(124, 58, 237, 0.5)'
      }
    }
  },
  plugins: []
};
