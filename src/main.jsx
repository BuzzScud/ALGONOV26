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
  // Import Preline dynamically - use preline/preline for proper initialization
  import('preline/preline').then(() => {
    // Wait for DOM to be ready before initializing
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      // Initialize Preline components using HSStaticMethods
      if (window.HSStaticMethods && typeof window.HSStaticMethods.autoInit === 'function') {
        window.HSStaticMethods.autoInit();
      }
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (window.HSStaticMethods && typeof window.HSStaticMethods.autoInit === 'function') {
          window.HSStaticMethods.autoInit();
        }
      });
    }
  }).catch(() => {
    // Silently fail - Preline is optional UI enhancement
  });
}
