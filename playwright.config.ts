/**
 * E2E contra el stack real.
 *
 * Ver `docs/TESTING.md` §6.
 */

import { defineConfig, devices } from '@playwright/test';

const PUERTO = Number(process.env.E2E_PORT ?? 8788);
const BASE = `http://localhost:${PUERTO}`;

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

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

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
