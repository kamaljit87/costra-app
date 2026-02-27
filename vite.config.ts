import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import blogPlugin from './plugins/vite-plugin-blog'

export default defineConfig({
  plugins: [react(), blogPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    modulePreload: {
      // Only preload chunks referenced in entry – not all manualChunks
      resolveDependencies: (_filename, deps) => deps.filter(d => !d.includes('vendor-charts') && !d.includes('vendor-motion')),
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-motion': ['motion', 'framer-motion'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})

