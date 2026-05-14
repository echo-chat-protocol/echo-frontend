import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import path from 'path'

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      // Path aliases — use @/... instead of relative paths
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
  },
  optimizeDeps: {
    exclude: ['aes-wasm', 'xeddsa-wasm', 'dh-wasm'],
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
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    css: true,
    include: ['src/**/*.test.{js,jsx,ts,tsx}', 'src/**/*.spec.{js,jsx,ts,tsx}'],
    exclude: ['tests/**', 'node_modules/**', 'dist/**', 'playwright-report/**', 'test-results/**'],
    coverage: {
      provider: 'istanbul',
      all: false,
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/pages/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/**/*.spec.{js,jsx}', 'src/**/test/**'],
    },
  },
})
