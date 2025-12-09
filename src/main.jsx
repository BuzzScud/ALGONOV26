import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Make sure there is a <div id="root"></div> in your HTML.');
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
); 

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
