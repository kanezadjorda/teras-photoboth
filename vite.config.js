import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        kiosk: resolve(__dirname, 'src/kiosk/index.html'),
        admin: resolve(__dirname, 'src/admin/index.html')
      }
    }
  }
});

