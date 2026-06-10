import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: rootDir,
  build: {
    outDir: resolve(rootDir, '../../dist/apps/web/client'),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});
