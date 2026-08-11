import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// La PWA se sirve bajo /app: el service worker queda acotado a ese scope y la
// landing pública no lo carga. Ver docs/ARCHITECTURE.md §3.
// La configuración de PWA, Tailwind y tema se agrega en FE-1.
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
