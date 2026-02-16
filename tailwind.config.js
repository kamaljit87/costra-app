/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand color (#3F4ABF)
        primary: {
          DEFAULT: '#3F4ABF',
          50: '#EEEFFE',
          100: '#D8DAFC',
          200: '#B3B7F9',
          300: '#8B91F3',
          400: '#656DEE',
          500: '#3F4ABF',
          600: '#353EA2',
          700: '#2B3285',
          800: '#212668',
          900: '#171B4B',
        },
        // Accent color (same as primary for brand consistency)
        accent: {
          DEFAULT: '#3F4ABF',
          50: '#EEEFFE',
          100: '#D8DAFC',
          200: '#B3B7F9',
          300: '#8B91F3',
          400: '#656DEE',
          500: '#3F4ABF',
          600: '#353EA2',
          700: '#2B3285',
          800: '#212668',
          900: '#171B4B',
        },
        // Success green
        success: {
          DEFAULT: '#16A34A',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#16A34A',
          600: '#15803d',
          700: '#166534',
          800: '#14532d',
          900: '#14532d',
        },
        // Sidebar colors (using primary palette)
        sidebar: {
          bg: '#2B3285',
          'bg-dark': '#212668',
          hover: '#353EA2',
          border: '#353EA2',
          text: '#D8DAFC',
          'text-muted': '#8B91F3',
          active: '#ffffff',
          'active-bg': '#2B3285',
        },
        // Surface colors for cards
        surface: {
          50: '#F8FAFC',
          100: '#f1f5f9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
        },
        // Text colors
        text: {
          primary: '#0F172A',
          muted: '#64748B',
        },
        // Status colors
        warning: {
          DEFAULT: '#F59E0B',
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#F59E0B',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          DEFAULT: '#DC2626',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#DC2626',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // shadcn semantic tokens (from CSS variables in index.css)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'glow': '0 0 20px rgba(63, 74, 191, 0.15)',
        'glow-lg': '0 0 40px rgba(63, 74, 191, 0.2)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.05), 0 10px 30px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 6px rgba(0, 0, 0, 0.05), 0 20px 40px rgba(0, 0, 0, 0.08)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': 'linear-gradient(135deg, #3F4ABF 0%, #656DEE 100%)',
        'mesh-gradient': 'linear-gradient(135deg, #EEEFFE 0%, #D8DAFC 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
