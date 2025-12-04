import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import News from './pages/News';
import Trading from './pages/Trading';
import Projection from './pages/Projection';
import Data from './pages/Data';
import API from './pages/API';
import Settings from './pages/Settings';
import FIB from './pages/FIB';
import Notes from './pages/Notes';

function App() {
  // Detect base path from current location for subdirectory deployment
  // If deployed to /trading/, the basename will be /trading
  const getBasename = () => {
    if (typeof window === 'undefined') return '/';
    
    const path = window.location.pathname;
    const pathParts = path.split('/').filter(Boolean);
    
    // Explicit check for /trading subdirectory - must be first segment
    // This handles: /trading, /trading/, /trading/news, etc.
    if (pathParts.length > 0 && pathParts[0] === 'trading') {
      return '/trading';
    }
    
    // Also check the full path for exact matches
    if (path.startsWith('/trading')) {
      return '/trading';
    }
    
    // Auto-detect subdirectory: if path has multiple segments and first isn't a known route
    const knownRoutes = ['news', 'trading', 'notes', 'projection', 'data', 'api', 'settings'];
    
    // If first part is not a known route, it's likely a subdirectory
    if (pathParts.length > 0 && !knownRoutes.includes(pathParts[0]) && pathParts[0] !== 'index.html') {
      return `/${pathParts[0]}`;
    }
    
    // Default to root
    return '/';
  };

  const basename = getBasename();
  
  // Debug logging in development
  if (import.meta.env.DEV) {
    console.log('Detected basename:', basename, 'from path:', window.location.pathname);
  }

  return (
    <ErrorBoundary>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="news" element={<News />} />
            <Route path="trading" element={<Trading />} />
            <Route path="notes" element={<Notes />} />
            <Route path="projection">
              <Route index element={<Projection />} />
              <Route path="fib" element={<FIB />} />
            </Route>
            <Route path="data" element={<Data />} />
            <Route path="api" element={<API />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
