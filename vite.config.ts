import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Define the environment variable for API URL if using .env files
const API_URL = process.env.VITE_API_URL || 'https://forgetworries.onrender.com';

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
        target: API_URL, // Use the environment variable
        changeOrigin: true,
        secure: false, // Set to true if you are using https
        headers: {
          'X-Custom-Header': 'custom-header-value', // Example: add custom headers
        },
      },
      '/socket.io': {
        target: API_URL,
        ws: true,
        changeOrigin: true, // Ensure socket.io connections are handled
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true, // Set to false in production to avoid exposing source maps
    chunkSizeWarningLimit: 500, // Optionally set a chunk size limit for large files
    minify: 'esbuild', // Enable minification
    target: 'esnext', // Modern browsers support ESNext features
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'], // Example: separate common dependencies into a vendor chunk
        },
      },
    },
  },
  optimizeDeps: {
    include: ['gsap'], // Pre-bundle libraries you want to optimize
  },
  define: {
    'process.env': process.env, // Allows environment variables in the app
  },
})
