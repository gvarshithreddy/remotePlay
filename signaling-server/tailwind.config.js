/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/index.html",
    "./public/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        'game-bg': '#0a0a0f',
        'game-card': '#12121e',
        'game-accent': '#7c4dff',
        'game-success': '#00e676',
        'game-error': '#ff1744',
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'accent-glow': '0 0 15px rgba(124, 77, 255, 0.4)',
        'success-glow': '0 0 15px rgba(0, 230, 118, 0.4)',
        'premium': '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124, 77, 255, 0.1)',
      }
    },
  },
  plugins: [],
}
