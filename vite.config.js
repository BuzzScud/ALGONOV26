import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/dist/',                       // absolute path - site root is project folder
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    modulePreload: false,               // Disable modulepreload to avoid browser warnings
    rollupOptions: {
      output: {
        // Keep everything in one bundle to avoid load order issues
        manualChunks: undefined,
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
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
          const match = path.match(/^\/api\/quote\/([^?]+)(\?.*)?$/);
          if (match) {
            const symbol = match[1];
            const queryParams = new URLSearchParams(match[2]?.substring(1) || '');
            const period = queryParams.get('period') || '1d';
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
