import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      /**
       * `virtual:pwa-register/react` lo genera `vite-plugin-pwa` al construir y
       * **no existe fuera de Vite**. Sin este alias, cualquier test que toque
       * el árbol de la app explota al resolver el import.
       *
       * El doble no está para esquivar el problema: es lo que permite probar
       * que el aviso de versión está **conectado** al service worker. Un aviso
       * que nadie conecta es el defecto que `REF4-3` vino a corregir.
       */
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwaRegisterFalso.ts', import.meta.url),
      ),
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
