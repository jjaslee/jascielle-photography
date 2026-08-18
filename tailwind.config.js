/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--bg) / <alpha-value>)',
        ink: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--border) / <alpha-value>)',
        salience: 'rgb(var(--salience-read) / <alpha-value>)',
        'salience-muted': 'rgb(var(--salience-unread) / <alpha-value>)',
        'salience-warm': 'rgb(var(--salience-warm) / <alpha-value>)',
        'salience-cool': 'rgb(var(--salience-cool) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Pinyon Script"', 'cursive'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        editorial: '0.18em',
        nav: '0.14em',
      },
      transitionDuration: {
        slow: '900ms',
        slower: '1200ms',
      },
      transitionTimingFunction: {
        elegant: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
