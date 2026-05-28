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
// Prefer explicit target via env. Fall back to the hosted backend so dev works out-of-the-box
// even when a local backend isn't running.
const devProxyTarget =
  process.env.VITE_DEV_PROXY_TARGET ||
  process.env.VITE_SOCKET_URL ||
  'https://echo-backend-x91g.onrender.com'
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
  const candidates = []
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        candidates.push(address.address)
      }
    }
  }

  const preferred = candidates.find((ip) => {
    if (ip.startsWith('192.168.')) return true
    if (ip.startsWith('10.')) return true
    return /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  })

  const nonOverlay = candidates.find((ip) => !/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip))
  const selected = preferred || nonOverlay || candidates[0]

  return selected ? `http://${selected}:${port}` : null
}

const devLanOrigin = resolveLanOrigin(devServerPort)
const hmrHost =
  process.env.TAURI_DEV_HOST || (devLanOrigin ? new URL(devLanOrigin).hostname : 'localhost')

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __DEV_LAN_ORIGIN__: JSON.stringify(devLanOrigin),
  },
  server: {
    host: true,
    port: devServerPort,
    hmr: {
      // Ensure the WebView (tauri.localhost) connects HMR to the correct port/host
      clientPort: devServerPort,
      host: hmrHost,
    },
    proxy: {
      '/api': devProxy,
      '/sync': devProxy,
      '/pairing': devProxy,
      '/devices': devProxy,
      '/messages': devProxy,
      '/users': devProxy,
      '/keys': devProxy,
      '/uploads': devProxy,
      '/socket.io': {
        target: devProxyTarget,
        changeOrigin: true,
        secure: devProxyTarget.startsWith('https://'),
        ws: true,
        // Spoof Origin to an allowed production host so Socket.IO CORS on the
        // remote backend accepts the Engine.IO websocket upgrade during dev.
        // HTTP requests are same-origin (proxied) and don't need CORS.
        headers: {
          Origin: 'https://chat-tuah-frontend.vercel.app',
        },
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
