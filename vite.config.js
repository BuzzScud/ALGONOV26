import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',                         // relative paths for subdirectory deployment (e.g., /trading/)
  build: {
    outDir: 'dist',
    sourcemap: false,                 // disable in production – stops exposing /src/*.jsx paths
    chunkSizeWarningLimit: 600,       // Increase limit slightly since we're splitting properly
    rollupOptions: {
      output: {
        // Manual code splitting for better performance
        manualChunks: (id) => {
          if (!id.includes('node_modules')) {
            return; // Let Vite handle app code
          }
          
          // React core + all React-dependent UI libraries in same chunk
          // This prevents "useLayoutEffect undefined" errors in production
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/@dnd-kit') ||
              id.includes('node_modules/preline') ||
              id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          
          // Chart.js vendor chunk (large library)
          if (id.includes('node_modules/chart.js') || 
              id.includes('node_modules/react-chartjs-2') ||
              id.includes('node_modules/chartjs-')) {
            return 'vendor-charts';
          }
          
          // PDF.js vendor chunk (very large library)
          if (id.includes('node_modules/pdfjs-dist') || id.includes('node_modules/react-pdf')) {
            return 'vendor-pdf';
          }
          
          // Lightweight charts vendor chunk
          if (id.includes('node_modules/lightweight-charts')) {
            return 'vendor-lwc';
          }
          
          // ApexCharts vendor chunk
          if (id.includes('node_modules/apexcharts')) {
            return 'vendor-apex';
          }
          
          // Other vendor libraries (lodash, etc.)
          return 'vendor-misc';
        },
        // Output all files to assets/ directory (standard Vite structure)
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
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
