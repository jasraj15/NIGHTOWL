/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060911',
          900: '#0B0F19',
          850: '#0F1626',
          800: '#141D33',
          750: '#1A2542',
          700: '#223055',
          600: '#324578',
        },
        ivory: {
          50: '#FCFBF7',
          100: '#F7F4EB',
          200: '#ECE6D6',
          300: '#DBD2BC',
          400: '#BDB197',
          500: '#94886E',
        },
        lime: {
          300: '#E1FF5A',
          400: '#D4FF33',
          DEFAULT: '#CCFF00',
          500: '#B8E600',
          600: '#94BA00',
        },
        amber: {
          warm: '#FFB347',
        },
        retailer: {
          blinkit: '#F8CB46',
          zepto: '#9333EA',
          flipkart: '#2874F0',
          other: '#6B7280',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-lime': '0 0 24px -4px rgba(204, 255, 0, 0.35)',
        'glow-subtle': '0 0 40px -10px rgba(20, 29, 51, 0.8)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
