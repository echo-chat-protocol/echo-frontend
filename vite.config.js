import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
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
      '@features': path.resolve(__dirname, './src/features'),
      '@assets': path.resolve(__dirname, './src/assets'),
      // WASM modules
      'aes-wasm': path.resolve(__dirname, './aes-wasm/pkg/aes_wasm.js'),
      'xeddsa-wasm': path.resolve(__dirname, './xeddsa-wasm/pkg/xeddsa_wasm.js'),
      'dh-wasm': path.resolve(__dirname, './dh-wasm/pkg/dh_wasm.js'),
    },
  },
  optimizeDeps: {
    exclude: ['@mascaro101/echo-protocol', 'aes-wasm', 'xeddsa-wasm', 'dh-wasm']
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
});
