import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {})
      if ('caches' in window) {
        caches.keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => {})
      }
    })
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
