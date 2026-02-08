/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			primary: {
  				'50': '#F0F1FD',
  				'100': '#E0E2FB',
  				'200': '#C1C5F7',
  				'300': '#9CA3F0',
  				'400': '#7880E9',
  				'500': '#4F5BD5',
  				'600': '#3F4ABF',
  				'700': '#2F3899',
  				'800': '#1F2673',
  				'900': '#141855',
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			accent: {
  				'50': '#F0F1FD',
  				'100': '#E0E2FB',
  				'200': '#C1C5F7',
  				'300': '#9CA3F0',
  				'400': '#7880E9',
  				'500': '#4F5BD5',
  				'600': '#3F4ABF',
  				'700': '#2F3899',
  				'800': '#1F2673',
  				'900': '#141855',
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			success: {
  				'50': '#f0fdf4',
  				'100': '#dcfce7',
  				'200': '#bbf7d0',
  				'300': '#86efac',
  				'400': '#4ade80',
  				'500': '#16A34A',
  				'600': '#15803d',
  				'700': '#166534',
  				'800': '#14532d',
  				'900': '#14532d',
  				DEFAULT: '#16A34A'
  			},
  			surface: {
  				'50': '#FFFFFF',
  				'100': '#F8F9FA',
  				'200': '#F1F3F5',
  				'300': '#E9ECEF',
  				'400': '#DEE2E6'
  			},
  			text: {
  				primary: '#0F172A',
  				muted: '#64748B'
  			},
  			warning: {
  				'50': '#fffbeb',
  				'100': '#fef3c7',
  				'200': '#fde68a',
  				'300': '#fcd34d',
  				'400': '#fbbf24',
  				'500': '#F59E0B',
  				'600': '#d97706',
  				'700': '#b45309',
  				'800': '#92400e',
  				'900': '#78350f',
  				DEFAULT: '#F59E0B'
  			},
  			error: {
  				'50': '#fef2f2',
  				'100': '#fee2e2',
  				'200': '#fecaca',
  				'300': '#fca5a5',
  				'400': '#f87171',
  				'500': '#DC2626',
  				'600': '#dc2626',
  				'700': '#b91c1c',
  				'800': '#991b1b',
  				'900': '#7f1d1d',
  				DEFAULT: '#DC2626'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'Plus Jakarta Sans',
  				'system-ui',
  				'sans-serif'
  			]
  		},
  		boxShadow: {
  			xs: '0 1px 2px rgba(0,0,0,0.04)',
  			card: '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
  			'card-hover': '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)',
  			dropdown: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)'
  		},
  		backgroundImage: {
  			'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  			'gradient-subtle': 'linear-gradient(135deg, #F8F9FA 0%, #F0F1FD 50%, #F8F9FA 100%)'
  		},
  		animation: {
  			'fade-in': 'fadeIn 0.5s ease-out',
  			'slide-up': 'slideUp 0.5s ease-out',
  			'slide-in-left': 'slideInLeft 0.3s ease-out',
  			shimmer: 'shimmer 2s linear infinite'
  		},
  		keyframes: {
  			fadeIn: {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			slideUp: {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(20px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			slideInLeft: {
  				'0%': {
  					opacity: '0',
  					transform: 'translateX(-20px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateX(0)'
  				}
  			},
  			shimmer: {
  				'0%': {
  					backgroundPosition: '-200% 0'
  				},
  				'100%': {
  					backgroundPosition: '200% 0'
  				}
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
