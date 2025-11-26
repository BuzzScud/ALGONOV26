import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Load Preline UI after React mounts
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const script = document.createElement('script');
    script.src = '/node_modules/preline/dist/preline.js';
    script.async = true;
    if (!document.querySelector('script[src="/node_modules/preline/dist/preline.js"]')) {
      document.body.appendChild(script);
    }
  });
}
