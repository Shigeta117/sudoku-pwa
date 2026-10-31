/// <reference types="vitest" />
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Emit sw.js from src/sw.js with this build's hashed files and a build id baked in,
 * so each deploy installs a fresh service worker that precaches exactly the current assets.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/'))
        .sort()
        .map((f) => './' + f);
      const buildId = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync('src/sw.js', 'utf8')
        .replace('__BUILD_ID__', buildId)
        .replace('__BUILD_ASSETS__', JSON.stringify(assets));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  // Relative base: works both at a domain root (Vercel) and under /sudoku-pwa/ (GitHub Pages)
  base: './',
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'node',
  },
});
