import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// La landing se sirve en la raíz y NO registra service worker: es pública,
// tiene que cargar rápido y no debe arrastrar el bundle de administración.
// Ver docs/ARCHITECTURE.md §3.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
