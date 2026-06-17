import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
