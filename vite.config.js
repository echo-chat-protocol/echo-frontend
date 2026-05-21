import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

import os from 'node:os'
import path, { dirname } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import pkg from './package.json'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const devProxyTarget =
  process.env.VITE_DEV_PROXY_TARGET || process.env.VITE_SOCKET_URL || 'http://127.0.0.1:3001'
const devServerPort = Number(process.env.VITE_DEV_SERVER_PORT || 5173)
const devProxy = {
  target: devProxyTarget,
  changeOrigin: true,
  secure: devProxyTarget.startsWith('https://'),
}

function resolveLanOrigin(port) {
  const explicit = process.env.VITE_PAIRING_SERVER_URL || process.env.VITE_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const interfaces = os.networkInterfaces()
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        return `http://${address.address}:${port}`
      }
    }
  }

  return null
}

const devLanOrigin = resolveLanOrigin(devServerPort)

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    'import.meta.env.VITE_DEV_LAN_ORIGIN': JSON.stringify(devLanOrigin),
  },
  server: {
    host: true,
    port: devServerPort,
    proxy: {
      '/api': devProxy,
      '/sync': devProxy,
      '/pairing': devProxy,
      '/devices': devProxy,
      '/messages': devProxy,
      '/users': devProxy,
      '/keys': devProxy,
      '/socket.io': {
        target: devProxyTarget,
        changeOrigin: true,
        secure: devProxyTarget.startsWith('https://'),
        ws: true,
      },
    },
  },
  plugins: [
    react({
      // Parse JSX in both .jsx and plain .js files
      include: /\.(jsx?|tsx?)$/,
    }),
    wasm(),
    topLevelAwait(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@store': path.resolve(__dirname, './src/store'),
      // WASM modules
      'aes-wasm': path.resolve(__dirname, './aes-wasm/pkg/aes_wasm.js'),
      'xeddsa-wasm': path.resolve(__dirname, './xeddsa-wasm/pkg/xeddsa_wasm.js'),
      'dh-wasm': path.resolve(__dirname, './dh-wasm/pkg/dh_wasm.js'),
    },
    // Allow Vite to resolve .js files that export JSX
    extensions: ['.jsx', '.js', '.tsx', '.ts', '.json'],
  },
  optimizeDeps: {
    exclude: ['@mascaro101/echo-protocol', 'aes-wasm', 'xeddsa-wasm', 'dh-wasm'],
    esbuildOptions: {
      // Treat .js files in src/ as jsx so pre-bundling doesn't choke on them
      loader: { '.js': 'jsx' },
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          icons: ['lucide-react', 'react-icons'],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['e2e/**', '**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.*', 'src/**/__tests__/**', 'src/**/*.spec.*'],
    },
  },
})
