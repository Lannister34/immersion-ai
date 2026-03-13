import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4778,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4777',
        changeOrigin: true,
        // SSE streaming needs long timeouts — KoboldCpp may take 30s+ to process prompt
        timeout: 120_000,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setSocketKeepAlive(true);
          });
        },
      },
      '/csrf-token': {
        target: 'http://localhost:4777',
        changeOrigin: true,
      },
      // Proxy character avatar files (e.g. /characters/Arina.png)
      // but NOT the /characters page route
      '^/characters/.+': {
        target: 'http://localhost:4777',
        changeOrigin: true,
      },
    },
  },
})
