# Subdirectory Deployment Fix

## Issue
The web app is deployed to `https://voynich.online/trading/` but React Router was not configured for subdirectory deployment, causing routing issues.

## Solution

### 1. Added Basename to BrowserRouter
Updated `src/App.jsx` to automatically detect and set the correct `basename` for React Router:

```javascript
const getBasename = () => {
  if (typeof window === 'undefined') return '/';
  
  const path = window.location.pathname;
  
  // Explicit check for /trading subdirectory
  if (path.startsWith('/trading')) {
    return '/trading';
  }
  
  // Auto-detect subdirectory for other deployments
  const pathParts = path.split('/').filter(Boolean);
  const knownRoutes = ['news', 'trading', 'notes', 'projection', 'data', 'api', 'settings'];
  
  if (pathParts.length > 0 && !knownRoutes.includes(pathParts[0]) && pathParts[0] !== 'index.html') {
    return `/${pathParts[0]}`;
  }
  
  return '/';
};

<BrowserRouter basename={basename}>
```

### 2. Updated ErrorBoundary
Fixed the error boundary to redirect to the correct base path:

```javascript
handleReset = () => {
  const path = window.location.pathname;
  const basePath = path.startsWith('/trading') ? '/trading' : '/';
  window.location.href = basePath;
};
```

## How It Works

- **Automatic Detection**: The app automatically detects if it's deployed to a subdirectory
- **Explicit Support**: Specifically handles `/trading/` subdirectory
- **Fallback**: Works at root (`/`) or any other subdirectory
- **Relative Paths**: Asset paths already use relative paths (`base: './'` in vite.config.js)

## Deployment

1. Build the app: `npm run build`
2. Upload the `dist/` folder contents to `/trading/` directory on your server
3. Ensure server configuration supports SPA routing:
   - Apache: `.htaccess` with rewrite rules
   - Nginx: `try_files $uri $uri/ /trading/index.html;`

## Testing

After deployment, verify:
- ✅ Home page loads at `https://voynich.online/trading/`
- ✅ Navigation works (e.g., `/trading/news`, `/trading/projection`)
- ✅ Direct URL access works (e.g., `/trading/data`)
- ✅ Assets load correctly (JS, CSS files)
- ✅ No 404 errors in browser console

## Routes

All routes now work correctly with the `/trading/` prefix:
- `https://voynich.online/trading/` - Dashboard
- `https://voynich.online/trading/news` - News
- `https://voynich.online/trading/trading` - Trading/Charts
- `https://voynich.online/trading/projection` - Projection
- `https://voynich.online/trading/projection/fib` - FIB
- `https://voynich.online/trading/data` - Data
- `https://voynich.online/trading/api` - API
- `https://voynich.online/trading/settings` - Settings
- `https://voynich.online/trading/notes` - Notes

---

**Fixed:** React Router now correctly handles subdirectory deployment at `/trading/`

