import { defineConfig } from 'vitest/config';

/**
 * Los tests que ejercitan `syncService`, para la prueba de mutación (`REF6-14` / `T-7`).
 *
 * Cada mutante corre contra estos archivos y cada uno levanta su propio MongoDB en memoria, así que
 * correr los 28 de la suite haría la corrida varias veces más lenta sin probar más a `syncService`.
 * `sync-viajes` mide cantidad de comandos, no tiempo, así que no se rompe por correr instrumentado.
 */
export default defineConfig({
  test: {
    include: [
      'tests/wafl.test.ts',
      'tests/sync-en-proceso.test.ts',
      'tests/sync-reglas.test.ts',
      'tests/sync-viajes.test.ts',
      'tests/ciclo.test.ts',
      'tests/seguridad.test.ts',
    ],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
