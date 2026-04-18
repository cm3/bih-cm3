import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { localSavePlugin } from './dev/local-save-plugin';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command }) => ({
  base: './',
  server: {
    host: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(projectRoot, 'index.html'),
        collection: path.resolve(projectRoot, 'collection.html'),
      },
    },
  },
  plugins: command === 'serve' ? [localSavePlugin()] : [],
}));
