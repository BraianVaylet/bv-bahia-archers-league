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
        // El mismo que el `meta theme-color` de `index.html`: barra del sistema de un
        // color con la app instalada y de otro en la pestaña son dos productos.
        theme_color: '#fbfaf5',
        background_color: '#fbfaf5',
        icons: [
          // Android e iOS esperan PNG; el SVG queda para quien lo entienda.
          { src: '/app/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/app/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Aparte, con aire alrededor: con `any maskable` en uno solo Android lo
          // recorta sin zona segura y se come el borde del logo.
          {
            src: '/app/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: '/app/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },

      workbox: {
        // `webp` y `png` tienen que estar: `cba.webp` pesa 18 KB, por encima del límite de
        // inline de Vite, y lo usan el login de WAFL y el pie, que está siempre visible.
        // Sin señal se veía roto.
        //
        // De las fuentes (`REF7-1`) se precachea sólo el subset `latin`, que cubre el castellano
        // entero (ñ, tildes, ¿, ¡) y la puntuación. Los paquetes traen además cirílico, vietnamita y
        // latin-ext: ~200 KB que cada celular bajaría al instalar la app y que el navegador nunca
        // pide, porque `unicode-range` sólo descarga un subset si la página usa uno de sus
        // caracteres. Con señal, si un nombre trae uno, se baja igual; sin señal, ese carácter sale
        // en la fuente del sistema. `scripts/presupuesto.mjs` lo verifica sobre `sw.js`.
        globPatterns: ['**/*.{js,css,html,svg,webp,png}', '**/*-latin-wdth-normal-*.woff2'],
        navigateFallback: '/app/index.html',

        // Sin `runtimeCaching`, a propósito. WAFL lee de IndexedDB (regla 6) y WAFA es
        // online por diseño: no hay nada de la API que valga guardar. Y había uno que
        // nunca matcheaba (Workbox evalúa la regex contra la URL completa), que si
        // alguien "arreglaba" habría guardado 24 h `/api/admin/*` —con los PIN en claro—.
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
