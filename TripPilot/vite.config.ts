/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// BUG-012: split the 700 KB+ monolithic entry chunk so first paint ships only
// the runtime it needs. Heavy, rarely-changing vendor code and the eagerly
// imported i18n bundle (i18next + the three locale JSONs) move out of `index`,
// while feature routes already code-split via React.lazy (router.tsx).
function manualChunks(id: string): string | undefined {
  if (id.includes('node_modules')) {
    // Only the always-eager runtime gets named vendor chunks. Everything else
    // (notably the heavy QR libs used solely by the lazy SyncTransferFlow)
    // keeps Rollup's natural, lazy-aware chunking — forcing it into one vendor
    // chunk would drag those libs onto the first-paint path.
    if (
      id.includes('react-dom') ||
      id.includes('react-router') ||
      id.includes('scheduler') ||
      /[\\/]react[\\/]/.test(id)
    ) {
      return 'vendor-react';
    }
    if (id.includes('dexie')) return 'vendor-dexie';
    if (id.includes('i18next')) return 'vendor-i18n';
    return undefined;
  }
  if (id.includes('/src/i18n/locales/')) return 'i18n-locales';
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.{ts,tsx}'],
  },
});
