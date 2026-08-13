import { expect, test } from '@playwright/test';
import { adminApi, cargarBlanco, entrarComoLider, torneoIniciado } from './ayudas.js';

/**
 * El admin no puede editar un blanco que ya se tiró.
 *
 * Cambiar la modalidad o las flechas de un blanco con puntajes cargados
 * invalidaría lo que ya anotaron los líderes: un `11` que era válido en 3D deja
 * de serlo si el blanco pasa a sala. El servidor lo bloquea y **la pantalla lo
 * dice antes**, con el motivo — un campo gris sin explicación parece un error
 * de la app.
 *
 * Ver `docs/FUNCTIONAL.md` §6.7 · `docs/TESTING.md` §6.
 */
test('un blanco con puntajes queda bloqueado de verdad', async ({ browser, request }) => {
  const api = await adminApi(request);
  const torneo = await torneoIniciado(api, { nombre: 'Bloqueado', arqueros: 2 });
  const patrulla = torneo.patrols[0];
  if (!patrulla) throw new Error('no se armó ninguna patrulla');

  const contexto = await browser.newContext();
  const page = await contexto.newPage();

  await entrarComoLider(page, torneo.tournamentId, 'Bloqueado', patrulla.username, patrulla.pin);

  // Se carga el blanco 1 entero y se espera a que llegue al servidor: recién
  // ahí queda bloqueado de verdad.
  await cargarBlanco(page, 0, '3d');
  await expect(page.getByTestId('sync-badge')).toContainText(/Sincronizado/i, { timeout: 60_000 });

  // 1 · La API lo reporta como bloqueado.
  const { lockedTargets } = await api.get<{ lockedTargets: number[] }>(
    `/api/admin/tournaments/${torneo.tournamentId}/locked-targets`,
  );
  expect(lockedTargets).toContain(1);

  // 2 · Y rechaza el cambio, no lo acepta en silencio.
  const rechazo = await request.patch(`/api/admin/tournaments/${torneo.tournamentId}`, {
    headers: api.headers,
    data: {
      targets: [
        { index: 1, modality: 'sala', arrows: 3, description: null },
        { index: 2, modality: 'sala', arrows: 3, description: null },
      ],
    },
  });
  expect(rechazo.ok()).toBe(false);

  // 3 · El torneo quedó como estaba: el blanco 1 sigue siendo 3D.
  const { tournament } = await api.get<{
    tournament: { targets: { index: number; modality: string }[] };
  }>(`/api/admin/tournaments/${torneo.tournamentId}`);
  expect(tournament.targets.find((t) => t.index === 1)?.modality).toBe('3d');

  /**
   * Que la PANTALLA lo explique ya lo cubre `torneo-ui.test.tsx` a nivel de
   * componente, con el mismo `motivoDeBloqueo`. Repetirlo acá obligaría a
   * hacer login de admin por interfaz y sumaría fragilidad sin probar nada que
   * no esté probado: lo que sólo este test puede demostrar es que un puntaje
   * real, por el stack real, bloquea el blanco de verdad.
   */

  await contexto.close();
});
