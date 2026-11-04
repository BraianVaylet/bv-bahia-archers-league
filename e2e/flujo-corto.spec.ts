import { expect, test } from '@playwright/test';
import { adminApi, cargarBlanco, entrarComoLider, torneoIniciado } from './ayudas.js';

/**
 * Un recorrido corto, de punta a punta, pensado para correr en cada navegador de
 * celular (`REF6-9` / `T-2`).
 *
 * `flujo-completo.spec.ts` es largo a propósito —14 blancos, varias patrullas, un
 * tramo offline— y sólo corre en Chromium de escritorio. Esto es lo mínimo que tiene
 * que andar en un teléfono: entrar como líder, cargar un blanco con el teclado de
 * scoring, y que ese puntaje llegue al servidor.
 *
 * Es donde Safari en iPhone se comporta distinto: IndexedDB, el service worker y el
 * desalojo de datos. Un navegador distinto de Chromium no reemplaza al dispositivo
 * real (`FE-21`), pero encuentra la mayoría de las diferencias antes.
 */
test('un líder entra, carga un blanco y el puntaje llega al servidor', async ({
  page,
  request,
}, info) => {
  const api = await adminApi(request);
  const torneo = await torneoIniciado(api, {
    nombre: `Flujo corto ${info.project.name}`,
    arqueros: 2,
  });
  const patrulla = torneo.patrols[0];
  if (!patrulla) throw new Error('no se armó ninguna patrulla');

  await entrarComoLider(
    page,
    torneo.tournamentId,
    `Flujo corto ${info.project.name}`,
    patrulla.username,
    patrulla.pin,
  );

  await cargarBlanco(page, 0, '3d');
  await expect(page.getByText(/^1 de 2 blancos/)).toBeVisible();

  // Lo cargado en el celular llegó al servidor: el avance de la patrulla lo dice.
  await expect
    .poll(
      async () => {
        const { patrols } = await api.get<{
          patrols: { id: string; targetsCompleted: number }[];
        }>(`/api/admin/tournaments/${torneo.tournamentId}/patrols`);
        return patrols.find((p) => p.id === patrulla.id)?.targetsCompleted;
      },
      { timeout: 30_000 },
    )
    .toBe(1);
});
