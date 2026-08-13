import { expect, test } from '@playwright/test';
import { adminApi, cargarBlanco, entrarComoLider, torneoIniciado } from './ayudas.js';

/**
 * Cerrar y reabrir el navegador a mitad del recorrido no pierde nada.
 *
 * Es el escenario que valida el requisito duro del proyecto contra el modo de
 * falla más común en el monte: el celular se queda sin batería, se reinicia, o
 * el líder cierra la app sin querer. Todo lo cargado tiene que seguir ahí, **y
 * sin conexión**, porque en el recorrido no hay señal.
 *
 * Ver `docs/TESTING.md` §6 · `docs/OFFLINE_SYNC.md` §3.
 */
test('recargar sin conexión a mitad del recorrido no pierde nada', async ({ browser, request }) => {
  const api = await adminApi(request);
  const torneo = await torneoIniciado(api, { nombre: 'Recarga', arqueros: 2 });
  const patrulla = torneo.patrols[0];
  if (!patrulla) throw new Error('no se armó ninguna patrulla');

  const contexto = await browser.newContext();
  const page = await contexto.newPage();

  await entrarComoLider(page, torneo.tournamentId, 'Recarga', patrulla.username, patrulla.pin);

  // ▶ Sin conexión desde acá. Se corta de verdad: `setOffline` no alcanza para
  //   loopback en Chromium, así que además se abortan las llamadas a la API.
  await contexto.setOffline(true);
  await contexto.route('**/api/**', (ruta) => ruta.abort());

  // El primer blanco, completo, sin red.
  await cargarBlanco(page, 0, '3d');
  await expect(page.getByText(/^1 de 2 blancos/)).toBeVisible();

  // ▶ Se cierra la pestaña, como si se cerrara la app.
  await page.close();

  // ▶ Y se abre de nuevo, todavía sin conexión.
  const segunda = await contexto.newPage();
  await segunda.goto('/app/wafl');

  /**
   * Se entra por «Seguir sin conexión», que es lo que el líder ve.
   *
   * No se vuelve a tipear usuario y PIN: sin red el login no puede resolver, y
   * ese es justamente el caso — el bundle guardado es lo que lo deja entrar.
   */
  await segunda.getByRole('button', { name: 'Seguir sin conexión' }).click();

  // Lo cargado sigue estando: sale de IndexedDB, no de una respuesta HTTP.
  await expect(segunda.getByText(/^1 de 2 blancos/)).toBeVisible();
  await expect(segunda.getByText('Completo')).toHaveCount(1);

  // Y se puede seguir cargando donde se dejó.
  await cargarBlanco(segunda, 1, 'sala');
  await expect(segunda.getByText(/^2 de 2 blancos/)).toBeVisible();

  // ▶ Vuelve la conexión: todo lo que se cargó sin red llega al servidor.
  await contexto.unroute('**/api/**');
  await contexto.setOffline(false);
  await expect(segunda.getByTestId('sync-badge')).toContainText(/Sincronizado/i, {
    timeout: 60_000,
  });

  const { participants } = await api.get<{
    participants: { patrolNumber: number; targetsCompleted: number }[];
  }>(`/api/admin/tournaments/${torneo.tournamentId}/results`);

  const deLaPatrulla = participants.filter((p) => p.patrolNumber === patrulla.number);
  expect(deLaPatrulla.length).toBeGreaterThan(0);
  for (const p of deLaPatrulla) {
    expect(p.targetsCompleted).toBe(2);
  }

  await contexto.close();
});
