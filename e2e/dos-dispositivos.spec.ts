import { expect, test } from '@playwright/test';
import { adminApi, cargarBlanco, entrarComoLider, torneoIniciado } from './ayudas.js';

/**
 * Dos dispositivos con la misma credencial: gana el más reciente.
 *
 * Pasa de verdad: el líder carga desde su celular y alguien más entra desde
 * otro con el mismo PIN, porque el PIN está en la planilla impresa. La regla es
 * **last-write-wins por `clientUpdatedAt`**, con desempate determinista por
 * `opId` — nunca «el que llegó último al servidor», que dependería de la señal.
 *
 * Ver `docs/OFFLINE_SYNC.md` §6 · `docs/TESTING.md` §6.
 */
test('con dos dispositivos gana el puntaje más reciente, no el que llegó último', async ({
  browser,
  request,
}) => {
  const api = await adminApi(request);
  const torneo = await torneoIniciado(api, { nombre: 'DosDisp', arqueros: 2 });
  const patrulla = torneo.patrols[0];
  if (!patrulla) throw new Error('no se armó ninguna patrulla');

  const { participants } = await api.get<{
    participants: { id: string; patrolNumber: number }[];
  }>(`/api/admin/tournaments/${torneo.tournamentId}/results`);

  const arquero = participants.find((p) => p.patrolNumber === patrulla.number);
  if (!arquero) throw new Error('la patrulla no tiene arqueros');

  // Dos contextos: dos dispositivos distintos con la misma credencial.
  const unContexto = await browser.newContext();
  const otroContexto = await browser.newContext();
  const uno = await unContexto.newPage();
  const otro = await otroContexto.newPage();

  await entrarComoLider(uno, torneo.tournamentId, 'DosDisp', patrulla.username, patrulla.pin);
  await entrarComoLider(otro, torneo.tournamentId, 'DosDisp', patrulla.username, patrulla.pin);

  /**
   * Las dos ops se mandan por API con `clientUpdatedAt` explícito.
   *
   * Por API y no por interfaz **a propósito**: lo que se prueba es la regla de
   * resolución, y hacerlo con clicks dejaría los dos relojes a merced de cuánto
   * tarda cada click. Acá el orden temporal es el dato del test.
   */
  const viejo = new Date('2026-08-08T10:00:00.000Z').toISOString();
  const nuevo = new Date('2026-08-08T10:05:00.000Z').toISOString();

  const opDe = (clientUpdatedAt: string, arrows: string[], n: number) => ({
    type: 'score' as const,
    opId: `0192f3a1-8c4e-7000-9abc-${String(n).padStart(12, '0')}`,
    clientUpdatedAt,
    participantId: arquero.id,
    targetIndex: 1,
    arrows,
  });

  const sync = async (page: typeof uno, op: unknown) =>
    page.evaluate(async (cuerpo) => {
      const csrf = await (await fetch('/api/auth/csrf')).json();
      const res = await fetch('/api/wafl/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
        body: JSON.stringify({ ops: [cuerpo] }),
      });
      return res.json();
    }, op);

  // El MÁS NUEVO llega primero; el más viejo, después.
  await sync(uno, opDe(nuevo, ['11', '11'], 1));
  const segunda = (await sync(otro, opDe(viejo, ['5', '5'], 2))) as {
    results: { status: string }[];
  };

  // La op vieja se rechaza como `superseded`: no es un error del líder, es que
  // ya había algo más nuevo.
  expect(segunda.results[0]?.status).toBe('superseded');

  const { participants: despues } = await api.get<{
    participants: { id: string; total: number }[];
  }>(`/api/admin/tournaments/${torneo.tournamentId}/results`);

  // 11 + 11 = 22, el del dispositivo con la carga más reciente.
  expect(despues.find((p) => p.id === arquero.id)?.total).toBe(22);

  await unContexto.close();
  await otroContexto.close();
});

/**
 * Los dos celulares terminan mostrando **lo mismo**.
 *
 * El test de arriba prueba la regla de resolución mirando al servidor. Lo que no
 * miraba es el celular que perdió: sacaba la op del outbox y se quedaba con sus
 * flechas en `pending`, que `sembrarPuntajes` nunca pisa. Mostraba —y hacía
 * firmar— un número que no era el que el servidor guardó (`REF6-4` / `U-3`).
 *
 * Por la interfaz y sin timestamps a mano: el que pierde carga primero y sin
 * señal, el que gana carga después y sincroniza, y el orden temporal sale de que
 * uno pasó antes que el otro.
 */
test('el celular que pierde termina mostrando lo mismo que el que ganó', async ({
  browser,
  request,
}) => {
  const api = await adminApi(request);
  const torneo = await torneoIniciado(api, { nombre: 'DosPantallas', arqueros: 2 });
  const patrulla = torneo.patrols[0];
  if (!patrulla) throw new Error('no se armó ninguna patrulla');

  const contextoGanador = await browser.newContext();
  const contextoPerdedor = await browser.newContext();
  const ganador = await contextoGanador.newPage();
  const perdedor = await contextoPerdedor.newPage();

  for (const page of [ganador, perdedor]) {
    await entrarComoLider(
      page,
      torneo.tournamentId,
      'DosPantallas',
      patrulla.username,
      patrulla.pin,
    );
  }

  // Lo que ve cada uno en la pantalla de resultados: el total y las X/10/M de
  // cada arquero, que es lo que se mira antes de firmar.
  const resultados = async (page: typeof ganador) => {
    await page.getByRole('button', { name: 'Resultados finales' }).click();
    const lista = page.getByTestId(/^resultado-/);
    await expect(lista.first()).toBeVisible();
    const textos = await lista.allInnerTexts();
    await page
      .getByRole('button', { name: /Blancos/ })
      .first()
      .click();
    return textos;
  };

  // 1 · El que va a perder carga PRIMERO, y sin señal: queda pendiente.
  await contextoPerdedor.setOffline(true);
  await contextoPerdedor.route('**/api/**', (ruta) => ruta.abort());
  await cargarBlanco(perdedor, 0, '3d', ['5', '5']);
  // «Resultados finales» sigue deshabilitado hasta que está todo el recorrido. El
  // blanco 2 lo cargan igual los dos: el único que entra en conflicto es el 1.
  await cargarBlanco(perdedor, 1, 'sala');

  // 2 · El que gana carga DESPUÉS, con señal: llega al servidor.
  await cargarBlanco(ganador, 0, '3d', ['11', '8']);
  await cargarBlanco(ganador, 1, 'sala');
  await expect(ganador.getByTestId('sync-badge')).toHaveAttribute('data-status', 'synced', {
    timeout: 30_000,
  });

  // Hasta acá cada uno tiene su verdad: el conflicto es real.
  const delGanador = await resultados(ganador);
  const delPerdedorAntes = await resultados(perdedor);
  expect(delPerdedorAntes).not.toEqual(delGanador);

  // 3 · Vuelve la señal del que perdió. Su carga es más vieja: `superseded`.
  await contextoPerdedor.unroute('**/api/**');
  await contextoPerdedor.setOffline(false);
  await perdedor.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(perdedor.getByTestId('sync-badge')).toHaveAttribute('data-status', 'synced', {
    timeout: 30_000,
  });

  // 4 · Las dos pantallas dicen lo mismo, y es lo del que ganó.
  const delPerdedorDespues = await resultados(perdedor);
  expect(delPerdedorDespues).toEqual(delGanador);

  await contextoGanador.close();
  await contextoPerdedor.close();
});
