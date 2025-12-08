import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './src/index.css'
import App from './src/App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Load Preline UI after React mounts
if (typeof window !== 'undefined') {
  // Import Preline dynamically
  import('preline').then((module) => {
    // Initialize Preline if it has an init method
    if (module.default && typeof module.default === 'function') {
      module.default();
    }
  }).catch((error) => {
    // Only log in development to avoid console noise in production
    if (import.meta.env.DEV) {
      console.warn('Preline UI could not be loaded:', error);
    }
  });
}

