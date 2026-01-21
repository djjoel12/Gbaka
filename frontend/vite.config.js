import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../backend/public',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy pour les API
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      // Proxy pour Mapbox tiles
      '/mapbox': {
        target: 'https://api.mapbox.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/mapbox/, '')
      }
    }
  }
})