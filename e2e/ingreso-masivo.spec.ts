import { expect, test } from '@playwright/test';
import { adminApi, torneoIniciado } from './ayudas.js';

/**
 * Quince patrullas entran desde la misma IP, con el límite de producción.
 *
 * El día del torneo los líderes entran desde el wifi del club —una sola IP
 * pública— o desde la misma operadora móvil. El límite de login contaba **cada
 * request** a `/api/auth/*`, así que la patrulla 11 recibía «Demasiados
 * intentos» por culpa de las diez anteriores, que habían entrado bien.
 *
 * Ningún E2E lo veía porque `servidor.ts` subía el límite a 100. Ya no lo sube:
 * este spec corre con la configuración real (`REF6-2` / `S-2`).
 *
 * Ver `docs/SECURITY.md` §3.3 · `docs/TESTING.md` §6.
 */
test('quince patrullas entran desde la misma IP sin recibir 429', async ({
  request,
  playwright,
  baseURL,
}) => {
  const api = await adminApi(request);
  const torneo = await torneoIniciado(api, { nombre: 'Masivo', arqueros: 60 });
  expect(torneo.patrols.length).toBeGreaterThanOrEqual(15);

  for (const patrulla of torneo.patrols.slice(0, 15)) {
    // Un contexto por líder: su propio celular, su propia sesión. La IP es la misma.
    const celular = await playwright.request.newContext({ baseURL: baseURL ?? '' });
    const { csrfToken } = (await (await celular.get('/api/auth/csrf')).json()) as {
      csrfToken: string;
    };

    const ingreso = await celular.post('/api/auth/patrol/login', {
      headers: { 'x-csrf-token': csrfToken },
      data: { tournamentId: torneo.tournamentId, username: patrulla.username, pin: patrulla.pin },
    });
    expect(ingreso.status(), `patrulla ${patrulla.number}`).toBe(200);

    // Y lo primero que hace la app al entrar: bajar el recorrido.
    expect((await celular.get('/api/wafl/bundle')).status(), `bundle ${patrulla.number}`).toBe(200);

    await celular.dispose();
  }

  // El admin recargando WAFA en el mismo wifi: `/me` en cada carga.
  for (let i = 0; i < 15; i++) {
    expect((await request.get('/api/auth/me')).status()).toBe(200);
  }
});
