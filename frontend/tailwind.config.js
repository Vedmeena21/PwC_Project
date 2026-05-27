/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // PwC brand orange palette
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#EB8C00',   // PwC primary orange
          600: '#D04A02',   // PwC dark orange (hover)
          700: '#B86E00',   // PwC deeper orange
          800: '#92400e',
          900: '#78350f',
        },
        pwc: {
          orange: '#EB8C00',
          darkorange: '#D04A02',
          red: '#E0301E',
          burgundy: '#A32020',
          charcoal: '#2D2D2D',
          gray: '#464646',
        },
        slate: {
          950: '#1a1a1a',   // PwC near-black (charcoal-tinted)
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
        mono: ["'JetBrains Mono'", "'Fira Code'", 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
      },
    },
  },
  plugins: [],
}
