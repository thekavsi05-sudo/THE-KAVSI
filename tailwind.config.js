/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FAF6F1',
        ink: '#211B1C',
        wine: {
          DEFAULT: '#6E2439',
          light: '#8C3A50',
          dark: '#4C1727',
        },
        champagne: {
          DEFAULT: '#B08D57',
          light: '#D6BC8C',
        },
        blush: '#EFDCD6',
        stone: '#8A7F79',
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        body: ['"Manrope"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.28em',
      },
      boxShadow: {
        fold: '0 18px 40px -18px rgba(33, 27, 28, 0.35)',
        card: '0 1px 2px rgba(33,27,28,0.06), 0 12px 24px -12px rgba(33,27,28,0.18)',
      },
      keyframes: {
        drape: {
          '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
          '100%': { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(14px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        drape: 'drape 1.1s cubic-bezier(0.65,0,0.35,1) forwards',
        fadeUp: 'fadeUp 0.6s ease forwards',
      },
    },
  },
  plugins: [],
}
