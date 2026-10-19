/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        body: ['Nunito', 'sans-serif'],
      },
      colors: {
        hub: {
          bg: '#0a0a0f',
          surface: '#111118',
          card: '#16161f',
          border: '#1e1e2e',
          accent: '#00ff87',
          'accent-dim': '#00cc6a',
          danger: '#ff3b5c',
          muted: '#6b7280',
          text: '#e8e8f0',
        }
      }
    }
  },
  plugins: []
}
