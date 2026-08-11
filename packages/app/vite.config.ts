import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// La PWA se sirve bajo /app: el service worker queda acotado a ese scope y la
// landing pública no lo carga. Ver docs/ARCHITECTURE.md §3.
export default defineConfig({
  base: '/app/',

  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      // NUNCA autoUpdate. `autoUpdate` recarga la app sola cuando detecta una
      // versión nueva, y hacer eso a mitad de un recorrido es inaceptable: el
      // líder pierde el contexto de lo que estaba anotando.
      // Ver docs/OFFLINE_SYNC.md §8.
      registerType: 'prompt',

      includeAssets: ['theme-init.js'],

      manifest: {
        name: 'Liga Bahiense de Arquería',
        short_name: 'Liga Bahiense',
        description: 'Anotá los puntajes del torneo, con o sin señal.',
        lang: 'es-AR',
        scope: '/app/',
        start_url: '/app/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#16170f',
        background_color: '#fbfaf5',
        icons: [
          { src: '/app/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/app/index.html',

        runtimeCaching: [
          {
            // El endpoint de sincronización queda EXCLUIDO a propósito: cachear
            // una escritura no tiene sentido y podría enmascarar fallos.
            urlPattern: /^\/api\/(?!wafl\/sync)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 60, maxAgeSeconds: 86_400 },
            },
          },
        ],
      },
    }),
  ],

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
