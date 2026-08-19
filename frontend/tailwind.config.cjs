module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        toydb: {
          teal: { DEFAULT: '#3FA9B8', dark: '#247987', light: '#78C5CF', pale: '#E5F5F7' },
          orange: { DEFAULT: '#F45B35', dark: '#D94325', light: '#FF8A6D', pale: '#FFF0EB' },
          gold: { DEFAULT: '#F5B83D', dark: '#D99A20', light: '#FFD978', pale: '#FFF7DE' },
          cream: '#FFF8E8',
          white: '#FFFCF4',
          navy: { DEFAULT: '#142B3A', light: '#284858' },
          slate: { DEFAULT: '#58717A', light: '#8CA1A6' },
          border: '#D9D0BD',
          success: { DEFAULT: '#4E9F6E', pale: '#EAF6EE' },
          danger: { DEFAULT: '#D94B45', pale: '#FCECEA' }
        }
      }
    },
  },
  plugins: [],
}
