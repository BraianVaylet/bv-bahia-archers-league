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
      /**
       * `offline/` es donde viven el outbox y la sincronización: lo que decide si un
       * puntaje llega al servidor. Los umbrales de `docs/TESTING.md` §8 bloquean
       * (`REF6-9` / `T-1`); estaba en 76 % de ramas contra un 85 % exigido y nadie lo
       * sabía, porque el CI no medía. El resto de la app (70/60) no bloquea: se mira,
       * no se exige.
       */
      thresholds: {
        'src/offline/**': { lines: 90, branches: 85 },
      },
    },
  },
});
