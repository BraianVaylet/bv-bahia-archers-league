/**
 * E2E contra el stack real.
 *
 * Ver `docs/TESTING.md` §6.
 */

import { defineConfig, devices } from '@playwright/test';

const PUERTO = Number(process.env.E2E_PORT ?? 8788);
const BASE = `http://localhost:${PUERTO}`;

/** Lo que corre además en los navegadores de celular. */
const ESPECS_MOVILES = [
  '**/offline-recarga.spec.ts',
  '**/objetivos-tactiles.spec.ts',
  '**/flujo-corto.spec.ts',
];

export default defineConfig({
  testDir: './e2e',
  // El flujo completo es largo por naturaleza: 14 blancos por arquero, varias
  // patrullas y un tramo offline con esperas de sincronización.
  timeout: 300_000,
  expect: { timeout: 15_000 },

  // En serie: comparten una única base efímera, y correrlos en paralelo haría
  // que un torneo pise al otro.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,

  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },

  /**
   * La app se usa en celulares, y **Safari en iPhone** es donde IndexedDB, el service
   * worker, `storage.persist()` y el desalojo de datos se comportan distinto
   * (`REF6-9` / `T-2`). Los dos proyectos móviles corren lo que más importa en un
   * teléfono, no toda la suite: recargar sin señal, los objetivos táctiles y un
   * recorrido corto. El resto sigue en Chromium de escritorio.
   *
   * WebKit de Playwright no reemplaza al dispositivo real (`FE-21`), pero encuentra la
   * mayoría de las diferencias antes.
   */
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] }, testMatch: ESPECS_MOVILES },
    { name: 'iPhone 14', use: { ...devices['iPhone 14'] }, testMatch: ESPECS_MOVILES },
  ],

  webServer: {
    command: 'pnpm build && pnpm exec tsx e2e/servidor.ts',
    url: `${BASE}/api/health`,
    // El primer arranque descarga el binario de MongoDB.
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
