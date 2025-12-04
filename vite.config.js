import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative paths for assets - works in any deployment location
  // For subdirectory deployment at /trading/, assets will be loaded correctly
  base: './',
  server: {
    sourcemap: true,           // ← important for dev server
    port: 5173,
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
  build: {
    sourcemap: true,            // ← optional, only if you debug production build
    // Optimize chunk splitting for better performance
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['chart.js', 'react-chartjs-2', 'chartjs-plugin-zoom', 'chartjs-chart-financial'],
          'ui-vendor': ['apexcharts', 'lightweight-charts', '@dnd-kit/core', '@dnd-kit/sortable'],
          'utils-vendor': ['lodash', 'pdfjs-dist', 'react-pdf'],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Optimize for production (esbuild is faster and doesn't require additional dependencies)
    minify: 'esbuild',
  },
})
