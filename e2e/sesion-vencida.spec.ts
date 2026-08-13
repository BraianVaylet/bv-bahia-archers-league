import { expect, test } from '@playwright/test';
import { adminApi, cargarBlanco, entrarComoLider, torneoIniciado } from './ayudas.js';

/**
 * Un 401 durante la sincronización **NO descarta el outbox**.
 *
 * Es la regla más cara de romper de todo el proyecto: descartar ops ante un 401
 * pierde trabajo del líder, y el trabajo del líder es el torneo. La sesión de
 * patrulla dura 12 horas y un torneo puede pasarse; que venza tiene que
 * significar «volvé a entrar», nunca «perdiste lo que cargaste».
 *
 * Ver `docs/OFFLINE_SYNC.md` §5.5 y §12 · `docs/TESTING.md` §6.
 */
test('un 401 en la sincronización conserva lo cargado', async ({ browser, request }) => {
  const api = await adminApi(request);
  const torneo = await torneoIniciado(api, { nombre: 'Sesion', arqueros: 2 });
  const patrulla = torneo.patrols[0];
  if (!patrulla) throw new Error('no se armó ninguna patrulla');

  const contexto = await browser.newContext();
  const page = await contexto.newPage();

  await entrarComoLider(page, torneo.tournamentId, 'Sesion', patrulla.username, patrulla.pin);

  /**
   * La sincronización responde 401 desde acá.
   *
   * Se intercepta en vez de esperar a que la sesión venza de verdad: el test
   * tendría que dormir doce horas. Lo que importa es cómo reacciona el cliente
   * al 401, no cómo se llegó a él.
   */
  await contexto.route('**/api/wafl/sync', (ruta) =>
    ruta.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Entrá de nuevo.' } }),
    }),
  );

  await cargarBlanco(page, 0, '3d');

  // Lo cargado está en pantalla: sale de IndexedDB, no de la respuesta.
  await expect(page.getByText(/^1 de 2 blancos/)).toBeVisible();

  // Y el indicador dice cuántos cambios faltan mandar, no que se perdió algo.
  await expect(page.getByTestId('sync-badge')).toContainText(/sin sincronizar/i, {
    timeout: 30_000,
  });

  /**
   * Lo que de verdad se está probando: el outbox **sigue lleno**.
   *
   * Se mira IndexedDB directamente y no el badge: el badge podría estar
   * mostrando un número viejo, y lo que importa es que las ops estén guardadas.
   */
  const pendientes = await page.evaluate(async () => {
    const abrir = indexedDB.open('bal-wafl');
    const db = await new Promise<IDBDatabase>((res, rej) => {
      abrir.onsuccess = () => res(abrir.result);
      abrir.onerror = () => rej(abrir.error);
    });

    return new Promise<number>((res, rej) => {
      const pedido = db.transaction('outbox').objectStore('outbox').count();
      pedido.onsuccess = () => res(pedido.result);
      pedido.onerror = () => rej(pedido.error);
    });
  });

  expect(pendientes).toBeGreaterThan(0);

  // ▶ Vuelve a andar: lo pendiente se envía solo, sin que el líder recargue.
  await contexto.unroute('**/api/wafl/sync');
  await expect(page.getByTestId('sync-badge')).toContainText(/Sincronizado/i, { timeout: 60_000 });

  const { participants } = await api.get<{
    participants: { patrolNumber: number; targetsCompleted: number }[];
  }>(`/api/admin/tournaments/${torneo.tournamentId}/results`);

  for (const p of participants.filter((x) => x.patrolNumber === patrulla.number)) {
    expect(p.targetsCompleted).toBe(1);
  }

  await contexto.close();
});
