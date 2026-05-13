import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inline plugin: make Vite treat src/index.js as JSX
// (avoids renaming the file while keeping all other .js handling untouched)
const jsxInJs = {
  name: 'jsx-in-js',
  enforce: 'pre',
  transform(code, id) {
    if (/\/src\/index\.js$/.test(id)) {
      // Hand off to the React plugin by returning with the jsx loader hint
      return { code, map: null }
    }
  },
  options(o) {
    // Tell Rollup to treat the file as jsx for the purpose of the entry point
    if (o?.input) {
      const inputs = Array.isArray(o.input) ? o.input : Object.values(o.input);
      inputs.forEach((f) => {
        if (/index\.js$/.test(f)) {
          // Mark the extension for Rollup
          this.addWatchFile?.(f);
        }
      });
    }
  },
};

export default defineConfig({
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
});
