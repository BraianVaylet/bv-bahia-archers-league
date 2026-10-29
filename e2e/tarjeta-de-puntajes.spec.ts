import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { adminApi, PNG_VALIDO, torneoIniciado } from './ayudas.js';

/**
 * Desde los resultados de un torneo publicado se entra a un arquero y se ve
 * qué sacó en cada flecha de cada blanco. Contra el stack real, en un navegador.
 *
 * El puntaje se carga por API como lo haría WAFL al sincronizar —el teclado ya
 * lo prueba `TEST-1` a fondo—; lo que se mira acá es lo que ve quien entra a la
 * landing.
 *
 * Ver `docs/TESTING.md` §6.
 */

const ahora = () => new Date().toISOString();

test('de los resultados se entra a un arquero y se ve cada flecha de cada blanco', async ({
  page,
  request,
  playwright,
  baseURL,
}) => {
  const api = await adminApi(request);
  const torneo = await torneoIniciado(api, { nombre: 'Tarjeta', arqueros: 2 });
  const patrulla = torneo.patrols[0];
  if (!patrulla) throw new Error('El torneo no armó ninguna patrulla');

  const { participants } = await api.get<{
    participants: { id: string; lastName: string }[];
  }>(`/api/admin/tournaments/${torneo.tournamentId}/results`);
  const [primero, segundo] = participants;
  if (!primero || !segundo) throw new Error('Se esperaban dos participantes');

  // El líder en su propio contexto: compartir el del admin le pisaría la sesión.
  const lider = await playwright.request.newContext(baseURL ? { baseURL } : {});
  const csrf = (await (await lider.get('/api/auth/csrf')).json()).csrfToken as string;
  const headers = { 'x-csrf-token': csrf };

  const login = await lider.post('/api/auth/patrol/login', {
    headers,
    data: { tournamentId: torneo.tournamentId, username: patrulla.username, pin: patrulla.pin },
  });
  expect(login.ok()).toBe(true);

  const sincronizar = async (ops: unknown[]) => {
    const res = await lider.post('/api/wafl/sync', { headers, data: { ops } });
    expect(res.ok()).toBe(true);
  };

  const puntaje = (participantId: string, targetIndex: number, arrows: string[]) => ({
    type: 'score',
    opId: randomUUID(),
    clientUpdatedAt: ahora(),
    participantId,
    targetIndex,
    arrows,
  });

  await sincronizar([
    // Cargadas SIN orden a propósito: la tarjeta las muestra de mayor a menor.
    puntaje(primero.id, 1, ['10', '11']),
    puntaje(primero.id, 2, ['9', 'X', 'M']),
    puntaje(segundo.id, 1, ['8', '5']),
    puntaje(segundo.id, 2, ['7', '7', '7']),
  ]);
  await sincronizar(
    [primero, segundo].map((p) => ({
      type: 'signature',
      opId: randomUUID(),
      clientUpdatedAt: ahora(),
      participantId: p.id,
      pngDataUrl: PNG_VALIDO,
    })),
  );
  await sincronizar([{ type: 'close', opId: randomUUID(), clientUpdatedAt: ahora() }]);
  await lider.dispose();

  await api.post(`/api/admin/tournaments/${torneo.tournamentId}/publish`);

  // La landing, sin sesión.
  await page.goto(`/torneos/${torneo.tournamentId}`);
  await page.getByRole('link', { name: new RegExp(primero.lastName) }).click();

  await expect(page).toHaveURL(
    new RegExp(`/torneos/${torneo.tournamentId}/participantes/[0-9a-f]{24}$`),
  );
  await expect(page.getByRole('heading', { level: 1 })).toContainText(primero.lastName);

  // Blanco 1 (3D): el `11` vale 11, y va primero aunque se haya tirado último.
  const blanco1 = page.getByTestId('blanco-1');
  await expect(blanco1.getByRole('listitem')).toHaveCount(2);
  await expect(blanco1.getByRole('listitem').nth(0)).toHaveAccessibleName('11, 11 puntos');
  await expect(blanco1.getByRole('listitem').nth(1)).toHaveAccessibleName('10, 10 puntos');
  await expect(blanco1).toContainText('21');

  // Blanco 2 (sala): `X` vale 10 y `M` vale 0, y lo dice.
  const blanco2 = page.getByTestId('blanco-2');
  await expect(blanco2.getByRole('listitem')).toHaveCount(3);
  await expect(blanco2.getByRole('listitem').nth(0)).toHaveAccessibleName('X, 10 puntos');
  await expect(blanco2.getByRole('listitem').nth(1)).toHaveAccessibleName('9, 9 puntos');
  await expect(blanco2.getByRole('listitem').nth(2)).toHaveAccessibleName('M, 0 puntos');
  await expect(blanco2).toContainText('19');

  // 21 + 19, de un máximo de 22 + 30.
  await expect(page.getByTestId('resumen')).toContainText('40');
  await expect(page.getByTestId('resumen')).toContainText('de 52');

  // Y se vuelve al torneo desde la propia tarjeta.
  await page.getByRole('link', { name: /Tarjeta/ }).click();
  await expect(page).toHaveURL(new RegExp(`/torneos/${torneo.tournamentId}$`));

  // Sin horizontal scroll en un celular: la regla de toda pantalla.
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole('link', { name: new RegExp(segundo.lastName) }).click();
  await expect(page.getByTestId('blanco-1')).toBeVisible();
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(desborda).toBe(false);
});
