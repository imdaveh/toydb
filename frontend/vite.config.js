import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'favicon.svg'],
      manifest: {
        name: 'ToyDB',
        short_name: 'ToyDB',
        description: 'Toy collection manager',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#142B3A',
        background_color: '#FFF8E8',
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
