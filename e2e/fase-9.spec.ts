import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  adminApi,
  entrarComoAdmin,
  PNG_VALIDO,
  RECORRIDO_CORTO,
  torneoIniciado,
} from './ayudas.js';

/**
 * La Fase 9 de punta a punta (`TEST-4`), contra el stack real.
 *
 * 1. Un torneo que viene, con link de pre-inscripción, aparece en «Próximas fechas»; se le rehace
 *    el recorrido desde la ficha; al eliminarlo, desaparece de la landing.
 * 2. Un torneo completo: el admin corrige una flecha contra la planilla de papel desde WAFA, se
 *    publica, la tarjeta pública muestra lo corregido, ya no se puede corregir publicado; se archiva
 *    y sale del ranking y de la landing; se desarchiva y vuelve.
 *
 * Las altas van por API (el wizard tiene sus propios tests); lo que se mira por pantalla es lo que
 * esta fase agregó.
 *
 * Ver `docs/TESTING.md` §6 y la Fase 9 de `docs/ACTION_PLAN.md`.
 */

const ahora = () => new Date().toISOString();

/** Una fecha de dentro de `dias`, como la manda el wizard (`AAAA-MM-DD`). */
const dentroDe = (dias: number) =>
  new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

test('próximas fechas: con link, recorrido editado desde la ficha, y eliminado desaparece', async ({
  page,
  request,
  browser,
}) => {
  const api = await adminApi(request);
  const nombre = `Próxima E2E ${randomUUID().slice(0, 6)}`;
  const link = 'https://forms.gle/e2e-proximas';

  const { season } = await api.post<{ season: { id: string } }>('/api/admin/seasons', {
    name: `Liga de ${nombre}`,
    startsAt: '2026-01-01',
    endsAt: '2027-12-31',
  });
  const archerIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const { archer } = await api.post<{ archer: { id: string } }>('/api/admin/archers', {
      firstName: `Prox${i}`,
      lastName: `ProximaE2E${i}`,
      category: 'raso',
    });
    archerIds.push(archer.id);
  }
  const { tournament } = await api.post<{ tournament: { id: string } }>('/api/admin/tournaments', {
    seasonId: season.id,
    name: nombre,
    date: dentroDe(10),
    targets: RECORRIDO_CORTO,
    archerIds,
    registrationUrl: link,
  });
  const id = tournament.id;

  // La landing lo anuncia, con el botón al formulario.
  await page.goto('/');
  const tarjeta = page
    .getByRole('region', { name: 'Próximas fechas' })
    .getByRole('listitem')
    .filter({ hasText: nombre });
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.getByRole('link', { name: /Pre-inscribirme/ })).toHaveAttribute(
    'href',
    link,
  );

  // WAFA: rehacer el recorrido desde la ficha, con el aviso de rearmado.
  await entrarComoAdmin(page);
  await page.goto(`/app/wafa/torneos/${id}`);
  await page.getByRole('button', { name: 'Editar recorrido' }).click();
  await page.getByRole('button', { name: 'Agregar blanco' }).click();
  await expect(page.getByText(/se rearman las patrullas/)).toBeVisible();
  await page.getByRole('button', { name: 'Guardar recorrido' }).click();
  await expect
    .poll(
      async () =>
        (await api.get<{ tournament: { targets: unknown[] } }>(`/api/admin/tournaments/${id}`))
          .tournament.targets.length,
    )
    .toBe(3);

  // Eliminarlo lo saca de la landing.
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('button', { name: 'Confirmar borrado' }).click();
  await expect(page).toHaveURL(/\/app\/wafa\/?$/);
  await expect
    .poll(async () =>
      (
        await api.get<{ tournaments: { id: string }[] }>('/api/public/tournaments/upcoming')
      ).tournaments.map((t) => t.id),
    )
    .not.toContain(id);
  /*
    Como lo ve un visitante nuevo. `/api/public/*` sale con `Cache-Control` (`publicCache`): este
    navegador ya tenía la lista de antes y la sigue mostrando hasta que vence —verificado: la API
    ya no devuelve el torneo—. Eso es la caché funcionando, no un bug.

    Y dentro de «Próximas fechas», no en toda la página: la temporada del test se llama
    «Liga de <nombre>» y la landing la muestra como temporada activa.
  */
  const visitante = await browser.newPage();
  await visitante.goto('/');
  await expect(visitante.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    visitante.getByRole('region', { name: 'Próximas fechas' }).getByText(nombre),
  ).toHaveCount(0);
  await visitante.close();
});

test('corrección contra la planilla, publicar, archivar y desarchivar', async ({
  page,
  request,
  playwright,
  baseURL,
}) => {
  const api = await adminApi(request);
  const nombre = `Corrección E2E ${randomUUID().slice(0, 6)}`;
  const torneo = await torneoIniciado(api, { nombre, arqueros: 2 });
  const id = torneo.tournamentId;
  const patrulla = torneo.patrols[0];
  if (!patrulla) throw new Error('El torneo no armó ninguna patrulla');

  const { participants } = await api.get<{
    participants: { id: string; archerId: string; lastName: string }[];
  }>(`/api/admin/tournaments/${id}/results`);
  const [primero, segundo] = participants;
  if (!primero || !segundo) throw new Error('Se esperaban dos participantes');

  // El líder anota, firman los dos y cierra el circuito: el torneo queda esperando publicación.
  const lider = await playwright.request.newContext(baseURL ? { baseURL } : {});
  const csrf = (await (await lider.get('/api/auth/csrf')).json()).csrfToken as string;
  const headers = { 'x-csrf-token': csrf };
  const login = await lider.post('/api/auth/patrol/login', {
    headers,
    data: { tournamentId: id, username: patrulla.username, pin: patrulla.pin },
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
    puntaje(primero.id, 1, ['11', '8']),
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

  // WAFA: la planilla dice 10 y 10 en el blanco 1 del primero (la app tiene 11 y 8).
  await entrarComoAdmin(page);
  await page.goto(`/app/wafa/torneos/${id}`);
  await page.getByRole('link', { name: 'Corregir puntajes' }).click();
  await page.getByRole('button', { name: new RegExp(primero.lastName) }).click();
  await page
    .getByTestId('fila-1')
    .getByRole('button', { name: /Corregir/ })
    .click();
  await page.getByRole('button', { name: 'Puntaje 10' }).click();
  await page.getByRole('button', { name: 'Puntaje 10' }).click();
  await page.getByLabel('Por qué se corrige').fill('La planilla dice 10 y 10.');
  await page.getByRole('button', { name: 'Guardar corrección' }).click();
  await expect(page.getByText('Blanco 1 corregido.')).toBeVisible();
  await expect(page.getByTestId('fila-1')).toContainText('Corregido');

  // Se publica aunque el arquero ya había firmado: la corrección no traba la publicación.
  const publicar = await request.post(`/api/admin/tournaments/${id}/publish`, {
    headers: api.headers,
  });
  expect(publicar.ok()).toBe(true);

  // La tarjeta pública muestra lo corregido.
  await page.goto(`/torneos/${id}/participantes/${primero.id}`);
  const blanco1 = page.getByTestId('blanco-1');
  await expect(blanco1.getByRole('listitem').nth(0)).toHaveAccessibleName('10, 10 puntos');
  await expect(blanco1.getByRole('listitem').nth(1)).toHaveAccessibleName('10, 10 puntos');

  // Publicado ya no se corrige: primero se despublica (decisión 2).
  const corregirPublicado = await request.put(
    `/api/admin/tournaments/${id}/participants/${primero.id}/scores/1`,
    { headers: api.headers, data: { arrows: ['5', '5'], reason: 'No debería pasar.' } },
  );
  expect(corregirPublicado.status()).toBe(409);

  // El ranking de la temporada lo cuenta… hasta que se archiva.
  const enElRanking = async () => {
    const r = await api.get<{
      categories: {
        general: { ranked: { archerId: string }[]; notYetEligible: { archerId: string }[] };
      }[];
    }>(`/api/public/rankings?seasonId=${torneo.seasonId}`);
    return r.categories.some((c) =>
      [...c.general.ranked, ...c.general.notYetEligible].some(
        (s) => s.archerId === primero.archerId,
      ),
    );
  };
  expect(await enElRanking()).toBe(true);

  // WAFA (la sesión sigue abierta): archivar desde los resultados, con motivo.
  await page.goto(`/app/wafa/torneos/${id}/publicar`);
  await page.getByRole('button', { name: 'Archivar' }).click();
  await page.getByLabel('Por qué lo archivás').fill('Fecha suspendida por lluvia.');
  await page.getByRole('button', { name: 'Archivar' }).last().click();
  await expect(page.getByText(/^Archivado\./)).toBeVisible();

  // Sale del ranking y de la landing: listado y detalle.
  expect(await enElRanking()).toBe(false);
  const listado = await api.get<{ tournaments: { id: string }[] }>('/api/public/tournaments');
  expect(listado.tournaments.map((t) => t.id)).not.toContain(id);
  await page.goto(`/torneos/${id}`);
  await expect(page.getByRole('alert')).toBeVisible();

  // Desarchivar lo devuelve.
  const desarchivar = await request.post(`/api/admin/tournaments/${id}/unarchive`, {
    headers: api.headers,
    data: { reason: 'Se decidió que cuente.' },
  });
  expect(desarchivar.ok()).toBe(true);
  expect(await enElRanking()).toBe(true);
  await page.goto(`/torneos/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(nombre);
});
