import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  publicDir: 'public',
  server: {
    port: 5173,
    host: 'localhost',
  },
  build: {
    outDir: 'dist',
    // Ensure _redirects file is copied to build output
    copyPublicDir: true,
  },
})