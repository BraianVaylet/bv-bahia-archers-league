import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Los tests de integración usan mongodb-memory-server en modo replica set
    // (las transacciones lo exigen) y levantar el binario tarda.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      /**
       * Los umbrales de `docs/TESTING.md` §8, **que bloquean** (`REF6-9` / `T-1`).
       *
       * Estaban escritos y no corría nada: el CI ejecutaba `vitest run` sin
       * `--coverage`, así que `middleware/auth` llevaba semanas en 88 % de ramas
       * contra un 100 % exigido. Se aplican por carpeta, no al total: un 95 % global
       * deja pasar un servicio entero sin probar si el resto está muy cubierto.
       *
       * «Autorización de sync» (`TESTING.md` §8) vive dentro de `syncService.ts`, que
       * comparte archivo con el resto de la sincronización: no se puede separar por
       * carpeta, así que queda cubierta por el umbral de `services/`.
       */
      thresholds: {
        'src/services/**': { lines: 85, branches: 80 },
        'src/middleware/auth.ts': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
