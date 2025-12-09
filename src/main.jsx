import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Get the root element
const rootElement = document.getElementById('root')

// Safety check: ensure root element exists before rendering
if (!rootElement) {
  throw new Error('Root element not found. Make sure there is a <div id="root"></div> in your HTML.')
}

// Create root and render the app
createRoot(rootElement).render(
  <App />
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
