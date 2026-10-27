/** @type {import('tailwindcss').Config} */
// Semantic design tokens. Every colour maps to a CSS variable defined in src/index.css so
// the whole app re-themes (dark / light / system) by toggling a class on <html>.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: token('c-base'),
        surface: token('c-surface'),
        raised: token('c-raised'),
        overlay: token('c-overlay'),
        line: token('c-line'),
        'line-strong': token('c-line-strong'),
        fg: token('c-fg'),
        muted: token('c-muted'),
        faint: token('c-faint'),
        lime: {
          DEFAULT: token('c-lime'),
          soft: token('c-lime-soft'),
          ink: token('c-lime-ink'),
        },
        danger: token('c-danger'),
        warn: token('c-warn'),
        info: token('c-info'),
        ok: token('c-ok'),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        glow: '0 0 28px -6px rgb(var(--c-lime) / 0.45)',
        card: '0 10px 30px -14px rgb(0 0 0 / 0.55)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 260ms ease-out both',
        'fade-in': 'fade-in 200ms ease-out both',
        shimmer: 'shimmer 1.6s infinite',
        marquee: 'marquee 28s linear infinite',
      },
    },
  },
  plugins: [],
};
