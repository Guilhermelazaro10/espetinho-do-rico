import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fontes locais (sem Google Fonts): funcionam no APK sem internet e não
// bloqueiam a renderização. Só o subconjunto latino, que cobre o português.
import '@fontsource/alfa-slab-one/latin-400.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import './index.css'
import App from './App.jsx'
import DialogosGlobais from './components/DialogosGlobais.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ehNativo } from './lib/servidor'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <DialogosGlobais />
  </StrictMode>,
)

// PWA: registra o service worker apenas no build de produção
// (em dev ele atrapalharia o hot reload do Vite)
// No app nativo (APK) o shell já está empacotado — service worker só atrapalha.
if ('serviceWorker' in navigator && import.meta.env.PROD && !ehNativo()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((erro) => console.error('Falha ao registrar o service worker:', erro))
  })
}
