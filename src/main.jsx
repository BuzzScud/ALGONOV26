import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Get the root element
const rootElement = document.getElementById('root');

// Safety check: ensure root element exists before rendering
if (!rootElement) {
  throw new Error('Root element not found. Make sure there is a <div id="root"></div> in your HTML.');
}

// Create root instance and render the app with StrictMode (React 18+ best practice)
// Store the root instance for React 19 compatibility
try {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  // Log error in development for debugging
  if (import.meta.env.DEV) {
    console.error('Error rendering React app:', error);
  }
  // Re-throw to ensure ErrorBoundary can catch and handle it gracefully
  throw error;
} 

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
