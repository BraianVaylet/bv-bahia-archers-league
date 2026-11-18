import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import {
  type AdminApi,
  adminApi,
  entrarComoAdmin,
  entrarComoLider,
  FLECHAS,
  firmarDeVerdad,
  RECORRIDO_CORTO,
  torneoIniciado,
} from './ayudas.js';

/**
 * E2E de la Fase 10: lo que se arregló después de la prueba 1 (`TEST-5`).
 *
 * Contra el stack real, como el resto: un caso por cada frente de la devolución.
 */

const hoy = () => new Date().toISOString().slice(0, 10);
const dentroDe = (dias: number) =>
  new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

/** Temporada, arqueros de raso y un torneo **sin iniciar**, todo por API. */
async function torneoSinIniciar(
  api: AdminApi,
  opciones: { nombre: string; fecha: string; arqueros: number },
): Promise<{ tournamentId: string; archerIds: string[] }> {
  const { season } = await api.post<{ season: { id: string } }>('/api/admin/seasons', {
    name: `Liga de ${opciones.nombre}`,
    startsAt: '2026-01-01',
    endsAt: '2027-12-31',
  });
  const archerIds: string[] = [];
  for (let i = 0; i < opciones.arqueros; i++) {
    const { archer } = await api.post<{ archer: { id: string } }>('/api/admin/archers', {
      firstName: `N${opciones.nombre}${i}`,
      lastName: `A${opciones.nombre}${String(i).padStart(2, '0')}`,
      category: 'raso',
    });
    archerIds.push(archer.id);
  }
  const { tournament } = await api.post<{ tournament: { id: string } }>('/api/admin/tournaments', {
    seasonId: season.id,
    name: opciones.nombre,
    date: opciones.fecha,
    targets: RECORRIDO_CORTO,
    archerIds,
  });
  return { tournamentId: tournament.id, archerIds };
}

/**
 * `FE-41`: «mientras el torneo se ejecutaba no se veía en la landing». Con la portada abierta desde
 * antes de largar, el torneo aparece en el hero sin recargar: al volver a la pestaña (y cada minuto).
 * Se insiste hasta 80 s porque `/api/public/tournaments` se puede cachear 15 + 30 s.
 */
test('landing: un torneo que larga con la portada abierta aparece en el hero sin recargar', async ({
  page,
  request,
}) => {
  const api = await adminApi(request);
  const nombre = `EnCurso ${randomUUID().slice(0, 6)}`;
  // Con fecha de hoy: es el más nuevo, y el hero muestra el en curso más nuevo.
  const { tournamentId } = await torneoSinIniciar(api, { nombre, fecha: hoy(), arqueros: 2 });

  await page.goto('/');
  await expect(page.getByTestId('hero')).toBeVisible();
  // Puede no haber tarjeta todavía (base vacía, ningún torneo en curso): se mira el hero entero.
  await expect(page.getByTestId('hero')).not.toContainText(nombre);

  await api.post(`/api/admin/tournaments/${tournamentId}/start`);

  await expect
    .poll(
      async () => {
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        const tarjeta = page.getByTestId('tarjeta-destacada');
        return (await tarjeta.count()) > 0 ? ((await tarjeta.textContent()) ?? '') : '';
      },
      {
        message: 'el torneo en curso no apareció sin recargar',
        timeout: 80_000,
        intervals: [5_000],
      },
    )
    .toContain(nombre);
  await expect(page.getByTestId('tarjeta-destacada')).toContainText('En curso');
});

/**
 * Firma por todos, sin esperar a que se sincronice nada: es lo que hace un líder apurado.
 */
async function firmarTodos(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Resultados finales' }).click();
  const botones = page.getByRole('button', { name: 'Firmar' });
  await expect(botones.first()).toBeVisible();

  for (let restantes = await botones.count(); restantes > 0; restantes--) {
    await botones.first().click();
    const canvas = page.getByTestId('signature-canvas');
    await expect(canvas).toBeVisible();
    const caja = await canvas.boundingBox();
    if (!caja) throw new Error('El canvas de firma no tiene tamaño');
    await firmarDeVerdad(page, caja);
    await page.getByRole('button', { name: 'Confirmar firma' }).click();
    await expect(botones).toHaveCount(restantes - 1);
  }
}

/**
 * `FE-45` y `FE-44`: los toques rápidos no se pierden, y «Finalizar torneo» cierra en **un solo
 * toque**, aunque la última firma todavía no se haya enviado.
 *
 * A propósito **no** se usa `esperarOutboxVacio`: esperar a que se vacíe el outbox antes de tocar
 * es exactamente el doble toque que la prueba 1 encontró.
 */
test('WAFL: anotar a toques rápidos, firmar y finalizar con un solo toque', async ({
  page,
  request,
}) => {
  const api = await adminApi(request);
  const nombre = `Toques ${randomUUID().slice(0, 6)}`;
  const { tournamentId, patrols } = await torneoIniciado(api, { nombre, arqueros: 2 });
  const [patrulla] = patrols;
  if (!patrulla) throw new Error('el torneo no armó patrullas');

  await entrarComoLider(page, tournamentId, nombre, patrulla.username, patrulla.pin);

  // Una sola patrulla, que arranca en el 1: los blancos aparecen en el orden del recorrido.
  for (const [posicion, blanco] of RECORRIDO_CORTO.entries()) {
    await page.getByTestId('numero-blanco').nth(posicion).click();
    await expect(page.getByRole('button', { name: /Unidad [AB]/ }).first()).toBeVisible();

    // Todas las flechas de los dos arqueros, una atrás de otra, sin esperar entre toques.
    const fichas = FLECHAS[blanco.modality] ?? [];
    for (const token of [...fichas, ...fichas]) {
      await page.getByRole('button', { name: `Puntaje ${token}` }).click({ delay: 0 });
    }

    await expect(page.getByText('Puntaje completo')).toHaveCount(2);
    await page.getByRole('button', { name: 'Continuar' }).click();
  }

  await firmarTodos(page);

  // Un toque, sin esperar al outbox.
  await page.getByRole('button', { name: 'Finalizar torneo' }).click();
  await expect(page.getByText('Torneo finalizado')).toBeVisible({ timeout: 30_000 });

  // Y el cierre llegó al servidor: la patrulla quedó cerrada.
  await expect
    .poll(
      async () =>
        (
          await api.get<{ patrols: { id: string; status: string }[] }>(
            `/api/admin/tournaments/${tournamentId}/patrols`,
          )
        ).patrols.find((p) => p.id === patrulla.id)?.status,
      { timeout: 30_000 },
    )
    .toBe('cerrada');
});

/**
 * `FE-46`/`FE-47` y `BE-31`: el admin ajusta las patrullas a mano y crea una nueva; después agrega
 * un arquero al torneo, y los ajustes y los PIN siguen como estaban.
 */
test('WAFA: crear una patrulla a mano y agregar un arquero no desordena nada', async ({
  page,
  request,
}) => {
  const api = await adminApi(request);
  const nombre = `Patr ${randomUUID().slice(0, 6)}`;
  // Cuatro de raso: una sola patrulla de cuatro.
  const { tournamentId, archerIds } = await torneoSinIniciar(api, {
    nombre,
    fecha: dentroDe(20),
    arqueros: 4,
  });

  await entrarComoAdmin(page);
  await page.goto(`/app/wafa/torneos/${tournamentId}/patrullas`);
  await expect(page.getByTestId('patrulla-1')).toBeVisible();

  // Los dos últimos pasan a una patrulla nueva: el primero la crea, el segundo se suma.
  const [, , tercero, cuarto] = archerIds.map((_, i) => `A${nombre}${String(i).padStart(2, '0')}`);
  await page.getByRole('button', { name: `Mover a ${tercero} a otra patrulla` }).click();
  await page.getByRole('button', { name: /^A una nueva/ }).click();
  await page.getByRole('button', { name: `Mover a ${cuarto} a otra patrulla` }).click();
  await page.getByRole('button', { name: /^A la 2/ }).click();
  await page.getByRole('button', { name: 'Guardar patrullas' }).click();
  await expect(page.getByText('Patrullas guardadas.')).toBeVisible();

  const leer = () =>
    api.get<{
      patrols: { id: string; number: number; pin: string; members: { lastName: string }[] }[];
    }>(`/api/admin/tournaments/${tournamentId}/patrols?pins=1`);
  const antes = (await leer()).patrols;
  expect(antes).toHaveLength(2);
  const laNueva = antes.find((p) => p.number === 2);
  expect(laNueva?.members.map((m) => m.lastName).sort()).toEqual([tercero, cuarto].sort());

  // Entra un arquero más al torneo.
  const { archer } = await api.post<{ archer: { id: string } }>('/api/admin/archers', {
    firstName: 'Nuevo',
    lastName: `Nuevo${nombre}`,
    category: 'raso',
  });
  await api.patch(`/api/admin/tournaments/${tournamentId}`, {
    archerIds: [...archerIds, archer.id],
  });

  const despues = (await leer()).patrols;
  for (const p of antes) {
    const ahora = despues.find((q) => q.id === p.id);
    expect(ahora?.pin, `la patrulla ${p.number} cambió de PIN`).toBe(p.pin);
    for (const m of p.members) {
      expect(ahora?.members.map((x) => x.lastName)).toContain(m.lastName);
    }
  }
  expect(despues.flatMap((p) => p.members).map((m) => m.lastName)).toContain(`Nuevo${nombre}`);
});

/**
 * `BE-29` y `FE-43`: una próxima fecha tiene página pública con los inscriptos y las patrullas,
 * con el estado claro y sin datos privados.
 */
test('landing: la página de una próxima fecha muestra inscriptos y patrullas, sin datos privados', async ({
  page,
  request,
}) => {
  const api = await adminApi(request);
  const nombre = `Prox10 ${randomUUID().slice(0, 6)}`;
  const { tournamentId } = await torneoSinIniciar(api, {
    nombre,
    fecha: dentroDe(15),
    arqueros: 2,
  });

  await page.goto(`/torneos/${tournamentId}`);

  await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible();
  await expect(page.getByTestId('estado-torneo')).toHaveText('Inscripción abierta');
  await expect(page.getByTestId('aviso-proxima')).toContainText(/patrullas pueden cambiar/);
  const inscriptos = page.getByRole('region', { name: /Inscriptos/ });
  await expect(inscriptos).toContainText(`A${nombre}00`);
  await expect(inscriptos).toContainText(`A${nombre}01`);
  await expect(page.getByTestId('patrulla-1')).toContainText('Arranca en el blanco');

  // Nada de lo que no tiene que salir: ni el usuario de la patrulla, ni su PIN.
  const respuesta = await request.get(`/api/public/tournaments/${tournamentId}`);
  const crudo = await respuesta.text();
  expect(crudo).not.toMatch(/"username"|"pin"|"dni"|"archerId"/i);
  await expect(page.locator('body')).not.toContainText('patrulla1');
});
