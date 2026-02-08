/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary: Slate-charcoal (modern, softer than old navy)
        primary: {
          DEFAULT: '#1A2540',
          50: '#F0F4F8',
          100: '#D9E2EC',
          200: '#BCCCDC',
          300: '#829AB1',
          400: '#486581',
          500: '#334E68',
          600: '#243352',
          700: '#1A2540',
          800: '#131B2E',
          900: '#0C1222',
        },
        // Accent: Warm teal (brand color, slightly warmer/brighter)
        accent: {
          DEFAULT: '#20C997',
          50: '#E6FCF5',
          100: '#C3FAE8',
          200: '#96F2D7',
          300: '#63E6BE',
          400: '#38D9A9',
          500: '#20C997',
          600: '#12B886',
          700: '#099268',
          800: '#087F5B',
          900: '#066649',
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
        // Surface colors (warm grays)
        surface: {
          50: '#FAFBFC',
          100: '#F1F3F5',
          200: '#E9ECEF',
          300: '#DEE2E6',
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
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(0,0,0,0.04)',
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08)',
        'glow': '0 0 20px rgba(32,201,151,0.12)',
        'glow-lg': '0 0 40px rgba(32,201,151,0.16)',
        'glow-accent': '0 0 20px rgba(32,201,151,0.15), 0 0 40px rgba(32,201,151,0.08)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-subtle': 'linear-gradient(135deg, #F0F4F8 0%, #E6FCF5 50%, #F0F4F8 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #131B2E 0%, #0C1222 100%)',
        'gradient-hero': 'linear-gradient(135deg, #131B2E 0%, #1A2540 40%, #0C1222 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 3s infinite',
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
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
}
