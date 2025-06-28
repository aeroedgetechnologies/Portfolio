import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3006,
    proxy: {
      '/api': {
        target: 'https://forgetworries.onrender.com',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'https://forgetworries.onrender.com',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}) 