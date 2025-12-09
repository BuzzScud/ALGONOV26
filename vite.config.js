import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',                         // relative paths for subdirectory deployment (e.g., /trading/)
  build: {
    outDir: 'dist',
    sourcemap: false,                 // disable in production – stops exposing /src/*.jsx paths
    rollupOptions: {
      output: {
        manualChunks: undefined,
        // Output JS files to js/ directory for server compatibility
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  server: {
    port: 5173,
    sourcemap: true,                  // keep enabled only for local dev
    strictPort: false,
    open: false,
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      '/api/quote': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => {
          // Extract symbol and period from path like /api/quote/AAPL?period=ytd
          const match = path.match(/^\/api\/quote\/([^?]+)(\?.*)?$/);
          if (match) {
            const symbol = match[1];
            const queryParams = new URLSearchParams(match[2]?.substring(1) || '');
            const period = queryParams.get('period') || '1d';
            
            // Map period to Yahoo Finance range and interval
            const periodMap = {
              'ytd': { range: 'ytd', interval: '1d' },
              '1d': { range: '1d', interval: '5m' },
              '5d': { range: '5d', interval: '15m' },
              '1mo': { range: '1mo', interval: '1d' },
              '3mo': { range: '3mo', interval: '1d' },
              '6mo': { range: '6mo', interval: '1d' },
              '1y': { range: '1y', interval: '1wk' },
            };
            
            const { range, interval } = periodMap[period] || periodMap['1d'];
            return `/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
          }
          return path;
        },
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      },
    },
  },
})
