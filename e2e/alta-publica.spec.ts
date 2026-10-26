import { expect, type Page, test } from '@playwright/test';
import {
  adminApi,
  cargarBlanco,
  entrarComoAdmin,
  entrarComoLider,
  firmarDeVerdad,
  RECORRIDO_CORTO,
} from './ayudas.js';

/**
 * El flujo nuevo de la Fase 8, contra el stack real: alta pública → aprobación
 * → torneo → publicación → ranking por categoría y por sexo. Y el camino
 * corto: un rechazo no deja rastro en el wizard.
 *
 * Ver `docs/TESTING.md` §6.
 */

/** Autoregistro desde la landing, por interfaz: es lo que de verdad hace un arquero nuevo. */
async function registrarsePublicamente(
  page: Page,
  datos: { apellido: string; nombre: string; dni: string; sexo: 'Femenino' | 'Masculino' },
): Promise<void> {
  await page.goto('/alta');
  await page.getByLabel('Apellido').fill(datos.apellido);
  await page.getByLabel('Nombre').fill(datos.nombre);
  await page.getByLabel('DNI').fill(datos.dni);
  // El radio es `sr-only` —la etiqueta es el control visible, como lo toca
  // de verdad quien usa el mouse—, así que se clickea la etiqueta, no
  // `.check()` sobre el input: eso intenta clickear un elemento sin área
  // visible propia y Playwright reintenta contra la etiqueta hasta el timeout.
  await page.getByText(datos.sexo, { exact: true }).click();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText(/pendiente de que el club la revise/)).toBeVisible();
}

test.describe('alta pública de arqueros', () => {
  test('alta → aprobación → torneo → publicación → ranking por categoría y por sexo', async ({
    browser,
    request,
  }) => {
    const api = await adminApi(request);

    // 1. Autoregistro público, desde la landing, sin sesión.
    const contextoPublico = await browser.newContext();
    const paginaPublica = await contextoPublico.newPage();
    await registrarsePublicamente(paginaPublica, {
      apellido: 'Pública',
      nombre: 'Lucía',
      dni: '30765432',
      sexo: 'Femenino',
    });
    await contextoPublico.close();

    // Queda `pendiente`: no entra todavía al padrón que alimenta el wizard.
    const { archers: antesDeAprobar } = await api.get<{ archers: { dni: string | null }[] }>(
      '/api/admin/archers',
    );
    expect(antesDeAprobar.some((a) => a.dni === '30765432')).toBe(false);

    // 2. El admin la revisa y la aprueba desde WAFA, por interfaz — es lo que prueba FE-30.
    const contextoAdmin = await browser.newContext();
    const paginaAdmin = await contextoAdmin.newPage();
    await entrarComoAdmin(paginaAdmin);
    await paginaAdmin.goto('/app/wafa/arqueros');
    await paginaAdmin.getByLabel('Ver pendientes de aprobar').check();

    const filaPendiente = paginaAdmin.getByTestId('arquero-Pública');
    await expect(filaPendiente).toContainText('30765432');
    await expect(filaPendiente).toContainText('Femenino');

    await filaPendiente.getByRole('button', { name: 'Aprobar' }).click();
    await filaPendiente.getByRole('button', { name: 'Sí, aprobar' }).click();
    await expect(paginaAdmin.getByTestId('arquero-Pública')).toHaveCount(0);

    // 3. Ya aprobada, aparece en el padrón que alimenta el wizard de torneo.
    const { archers: yaAprobados } = await api.get<{
      archers: { id: string; dni: string | null }[];
    }>('/api/admin/archers');
    const nueva = yaAprobados.find((a) => a.dni === '30765432');
    expect(nueva, 'el arquero aprobado no aparece en el padrón del wizard').toBeDefined();
    if (!nueva) throw new Error('inalcanzable: el expect de arriba ya cortó');

    // 4. El admin la suma a un torneo, junto con otro arquero —el mínimo de patrulla—.
    const { archer: compañera } = await api.post<{ archer: { id: string } }>('/api/admin/archers', {
      firstName: 'Compañera',
      lastName: 'DePatrulla',
      category: 'razo',
    });

    const { season } = await api.post<{ season: { id: string } }>('/api/admin/seasons', {
      name: 'Liga E2E alta pública',
      startsAt: '2026-01-01',
      endsAt: '2026-12-31',
    });

    const { tournament } = await api.post<{ tournament: { id: string } }>(
      '/api/admin/tournaments',
      {
        seasonId: season.id,
        name: 'Fecha de alta pública',
        date: '2026-08-08',
        targets: RECORRIDO_CORTO,
        archerIds: [nueva.id, compañera.id],
      },
    );
    await api.post(`/api/admin/tournaments/${tournament.id}/start`);

    const { patrols } = await api.get<{
      patrols: { id: string; number: number; username: string; pin: string }[];
    }>(`/api/admin/tournaments/${tournament.id}/patrols`);
    const patrulla = patrols[0];
    if (!patrulla) throw new Error('El torneo no armó ninguna patrulla');

    // 5. Recorrido, firmas y cierre por interfaz: WAFL de verdad, no un atajo de API.
    //    El mecanismo de scoring ya lo prueba TEST-1 a fondo; acá alcanza con
    //    que el circuito cierre.
    const contextoPatrulla = await browser.newContext();
    const paginaPatrulla = await contextoPatrulla.newPage();
    await entrarComoLider(
      paginaPatrulla,
      tournament.id,
      'Fecha de alta pública',
      patrulla.username,
      patrulla.pin,
    );
    for (const [i, blanco] of RECORRIDO_CORTO.entries()) {
      await cargarBlanco(paginaPatrulla, i, blanco.modality);
    }

    await paginaPatrulla.getByRole('button', { name: 'Resultados finales' }).click();
    const botonesFirmar = paginaPatrulla.getByRole('button', { name: 'Firmar' });
    await expect(botonesFirmar.first()).toBeVisible();

    for (let restantes = await botonesFirmar.count(); restantes > 0; restantes--) {
      await botonesFirmar.first().click();
      const canvas = paginaPatrulla.getByTestId('signature-canvas');
      await expect(canvas).toBeVisible();
      const caja = await canvas.boundingBox();
      if (!caja) throw new Error('El canvas de firma no tiene tamaño');
      await firmarDeVerdad(paginaPatrulla, caja);
      await paginaPatrulla.getByRole('button', { name: 'Confirmar firma' }).click();
      await expect(botonesFirmar).toHaveCount(restantes - 1);
    }

    await paginaPatrulla.getByRole('button', { name: 'Finalizar torneo' }).click();
    await expect(paginaPatrulla.getByText('Torneo finalizado')).toBeVisible();
    await contextoPatrulla.close();

    // 6. Con la única patrulla cerrada, el torneo pasa solo a completado.
    await expect
      .poll(async () => {
        const { tournament: t } = await api.get<{ tournament: { status: string } }>(
          `/api/admin/tournaments/${tournament.id}`,
        );
        return t.status;
      })
      .toBe('completado');

    // 7. El admin publica.
    await api.post(`/api/admin/tournaments/${tournament.id}/publish`);

    // 8. En la landing, sin sesión: aparece en Razo/General Y en Razo/Femenino,
    //    NO en Razo/Masculino — es lo que prueba BE-21/FE-28 de punta a punta,
    //    con un arquero que de verdad vino del autoregistro público.
    const contextoRanking = await browser.newContext();
    const paginaRanking = await contextoRanking.newPage();
    await paginaRanking.goto(`/ranking?temporada=${season.id}`);

    const tarjetaRazo = paginaRanking.getByTestId('cat-razo');
    await expect(tarjetaRazo).toContainText('Pública');

    await paginaRanking.getByRole('tab', { name: 'Femenino' }).click();
    await expect(tarjetaRazo).toContainText('Pública');

    await paginaRanking.getByRole('tab', { name: 'Masculino' }).click();
    await expect(tarjetaRazo).not.toContainText('Pública');

    // Ningún «puntos de liga» en pantalla: es el sistema que retiró SH-9.
    await expect(paginaRanking.getByText(/puntos de liga/i)).toHaveCount(0);

    await contextoRanking.close();
    await contextoAdmin.close();
  });

  test('un alta rechazada no aparece nunca en el wizard de torneo', async ({
    browser,
    request,
  }) => {
    const api = await adminApi(request);

    const contextoPublico = await browser.newContext();
    const paginaPublica = await contextoPublico.newPage();
    await registrarsePublicamente(paginaPublica, {
      apellido: 'Rechazada',
      nombre: 'Noemí',
      dni: '30765433',
      sexo: 'Femenino',
    });
    await contextoPublico.close();

    const contextoAdmin = await browser.newContext();
    const paginaAdmin = await contextoAdmin.newPage();
    await entrarComoAdmin(paginaAdmin);
    await paginaAdmin.goto('/app/wafa/arqueros');
    await paginaAdmin.getByLabel('Ver pendientes de aprobar').check();

    const fila = paginaAdmin.getByTestId('arquero-Rechazada');
    await expect(fila).toBeVisible();
    await fila.getByRole('button', { name: 'Rechazar' }).click();
    await fila.getByRole('button', { name: 'Sí, rechazar' }).click();
    await expect(paginaAdmin.getByTestId('arquero-Rechazada')).toHaveCount(0);

    /**
     * Nunca estuvo, ni como pendiente ni como aprobada: `rejectArcher` borra el
     * documento, no lo archiva. `GET /admin/archers` —sin filtro— es exactamente
     * lo que pide `SelectorDeArqueros` al abrir el paso 3 del wizard, así que
     * comprobar la respuesta es comprobar lo que el wizard va a mostrar.
     */
    const { archers } = await api.get<{ archers: { dni: string | null }[] }>('/api/admin/archers');
    expect(archers.some((a) => a.dni === '30765433')).toBe(false);

    const { archers: pendientes } = await api.get<{ archers: { dni: string | null }[] }>(
      '/api/admin/archers?status=pendiente',
    );
    expect(pendientes.some((a) => a.dni === '30765433')).toBe(false);

    await contextoAdmin.close();
  });
});
