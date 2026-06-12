import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Em dev, /api e /health apontam para o backend Express
      '/api': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
  preview: {
    // O build de produção (vite preview) usa o mesmo proxy —
    // necessário para validar o PWA com service worker ativo
    proxy: {
      '/api': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true, // habilita o auto-cleanup da Testing Library entre testes
  },
})
