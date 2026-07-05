/// <reference types="vitest/config" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const certFile = path.resolve(__dirname, 'certs/dev.pem')
const keyFile = path.resolve(__dirname, 'certs/dev-key.pem')
const https =
  fs.existsSync(certFile) && fs.existsSync(keyFile)
    ? { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }
    : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    https,
    // Always proxy API/WS so clients can use same-origin URLs on any LAN IP.
    // changeOrigin keeps Django Host as 127.0.0.1 (no per-network ALLOWED_HOSTS).
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true, changeOrigin: true },
    },
  },
  // Reduce dev-server memory on constrained machines
  optimizeDeps: {
    holdUntilCrawlEnd: false,
  },
})
