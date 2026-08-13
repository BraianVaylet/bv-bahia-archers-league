import { expect, test } from '@playwright/test';
import { adminApi, entrarComoLider, torneoIniciado } from './ayudas.js';

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
