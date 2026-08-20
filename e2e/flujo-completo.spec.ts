import { MAX_SIGNATURE_BYTES } from '@bal/shared';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import {
  adminApi,
  entrarComoLider,
  FLECHAS,
  firmarDeVerdad,
  PASSWORD_NUEVO,
  PNG_VALIDO,
} from './ayudas.js';

/**
 * El flujo completo, contra el stack real, **con un tramo sin conexión**.
 *
 * Es el test que valida el requisito duro del proyecto: *la app no puede dejar
 * de funcionar*. Todo lo demás está cubierto por tests más chicos; esto verifica
 * que las piezas juntas aguanten un torneo entero.
 *
 * Ver `docs/TESTING.md` §6.
 */

/** El recorrido del brief: 6 blancos 3D, 6 de campo, 1 de aire libre, 1 de sala. */
const RECORRIDO = [
  ...Array.from({ length: 6 }, (_, i) => ({ index: i + 1, modality: '3d', arrows: 2 })),
  ...Array.from({ length: 6 }, (_, i) => ({ index: i + 7, modality: 'campo', arrows: 3 })),
  { index: 13, modality: 'aire_libre', arrows: 6 },
  { index: 14, modality: 'sala', arrows: 3 },
];

/** 6×3D(2×11) + 6×campo(3×6) + aire libre(6×10) + sala(3×10) = 330. */
const MAXIMO_ESPERADO = 330;

// ── Ayudas de interfaz ───────────────────────────────────────────────────────

/** Carga el recorrido completo de la patrulla desde la interfaz. */
async function cargarRecorrido(page: Page) {
  const tarjetas = page.getByTestId('numero-blanco');
  await expect(tarjetas).toHaveCount(RECORRIDO.length);

  /**
   * El orden del recorrido se lee **una sola vez**, antes de cargar nada.
   *
   * Leerlo dentro del bucle significaría leerlo mientras la lista se re-renderiza
   * —cada vez que se vuelve del blanco, y cada vez que termina una
   * sincronización de fondo— y `textContent()` no reintenta ante un nodo
   * desprendido. El orden no cambia: la rotación la fija el blanco de inicio.
   */
  const orden = (await tarjetas.allTextContents()).map((t) => t.trim());

  for (let i = 0; i < RECORRIDO.length; i++) {
    const blanco = RECORRIDO.find((b) => String(b.index) === orden[i]);
    if (!blanco) throw new Error(`No se encontró el blanco ${orden[i]}`);

    await tarjetas.nth(i).click();

    /**
     * Una tanda de flechas **por arquero**, ni una más.
     *
     * El teclado pasa solo al siguiente al completar uno, y queda deshabilitado
     * cuando ya cargaron todos. Preguntarle a `Continuar` si hay que seguir es
     * frágil —el botón se re-renderiza y la consulta puede fallar justo ahí— así
     * que la condición de corte es el **conteo de puntajes completos**, que es
     * un estado del dominio y no del DOM.
     */
    const completos = page.getByText('Puntaje completo');
    const tarjetasDeArquero = page.getByRole('button', { name: /Unidad [AB]/ });

    // Se espera a que haya arqueros ANTES de contarlos: `count()` no reintenta y
    // devolvería 0 si la lista todavía no renderizó. Con 0 el bucle no correría
    // y el fallo aparecería recién al tocar un «Continuar» deshabilitado.
    await expect(tarjetasDeArquero.first()).toBeVisible();
    const arqueros = await tarjetasDeArquero.count();

    for (let cargados = 0; cargados < arqueros; cargados++) {
      for (const token of FLECHAS[blanco.modality] ?? []) {
        await page.getByRole('button', { name: `Puntaje ${token}` }).click();
      }

      // La escritura va por una cola asincrónica: se espera a que ESTE arquero
      // quede completo antes de empezar con el siguiente.
      await expect(completos).toHaveCount(cargados + 1, { timeout: 15_000 });
    }

    await page.getByRole('button', { name: 'Continuar' }).click();
  }
}

/** Firma por todos y cierra el circuito. */
async function firmarYCerrar(page: Page) {
  await page.getByRole('button', { name: 'Resultados finales' }).click();

  // Se firma de a uno, contando: la lista se re-renderiza después de cada firma
  // y un locator guardado apuntaría a un nodo que ya no está.
  const botones = page.getByRole('button', { name: 'Firmar' });

  // Igual que arriba: primero que exista, después se cuenta.
  await expect(botones.first()).toBeVisible();

  for (let restantes = await botones.count(); restantes > 0; restantes--) {
    // Sólo `click()`: hace scroll solo y **reintenta re-resolviendo el
    // locator**. `scrollIntoViewIfNeeded` no reintenta, y la lista se
    // re-renderiza sola cuando termina una sincronización de fondo: el nodo
    // queda desprendido entre que se resuelve y se actúa sobre él.
    await botones.first().click();

    const canvas = page.getByTestId('signature-canvas');
    await expect(canvas).toBeVisible();
    const caja = await canvas.boundingBox();
    if (!caja) throw new Error('El canvas de firma no tiene tamaño');

    await firmarDeVerdad(page, caja);

    // El PNG que sale de acá tiene que entrar en el límite del schema, o el
    // servidor lo rechaza con 400 y el circuito no se puede cerrar nunca.
    const pesa = await canvas.evaluate(
      (c) => (c as HTMLCanvasElement).toDataURL('image/png').length,
    );
    expect(
      pesa,
      'la firma cruda tiene que ser más pesada que el límite, o el test no prueba nada',
    ).toBeGreaterThan(MAX_SIGNATURE_BYTES);

    await page.getByRole('button', { name: 'Confirmar firma' }).click();
    await expect(botones).toHaveCount(restantes - 1);
  }

  /**
   * **Ninguna firma quedó en conflicto.**
   *
   * Que el circuito cierre ya no alcanza como prueba: una op irrecuperable
   * ahora sale del outbox —si no, queda trabado para siempre—, así que el
   * cierre pasaría igual con las firmas rechazadas. Esto mira el resultado.
   */
  const enConflicto = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('bal-wafl');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const todas = req.result.transaction('signatures').objectStore('signatures').getAll();
          todas.onsuccess = () =>
            resolve(
              (todas.result as { syncState: string }[]).filter((f) => f.syncState === 'conflict')
                .length,
            );
          todas.onerror = () => reject(todas.error);
        };
      }),
  );
  expect(enConflicto, 'el servidor rechazó alguna firma').toBe(0);

  const cerrar = page.getByRole('button', { name: 'Finalizar torneo' });
  await expect(cerrar).toBeEnabled();
  await cerrar.click();
  await expect(page.getByText('Torneo finalizado')).toBeVisible();

  /**
   * La única salida de esa pantalla tiene que llevar a la landing, no a otra
   * vista de la PWA. Se compara el `pathname` resuelto y no el atributo: en
   * desarrollo el enlace es absoluto y acá —un solo origen, como en producción—
   * es relativo.
   */
  const aLaLanding = page.getByRole('link', { name: 'Ver los resultados de la liga' });
  const href = await aLaLanding.getAttribute('href');
  expect(new URL(href ?? '', page.url()).pathname, 'la salida no va a la landing').toBe('/');
}

// ── El flujo ─────────────────────────────────────────────────────────────────

test('un torneo completo, con la carga hecha sin conexión', async ({ browser, request }) => {
  // 1-2. Admin entra, cambia el password obligatorio, crea la temporada.
  const api = await adminApi(request);

  const { season } = await api.post<{ season: { id: string } }>('/api/admin/seasons', {
    name: 'Liga E2E 2026',
    startsAt: '2026-01-01',
    endsAt: '2026-12-31',
  });

  // 3. Padrón con varias categorías, incluida escuela.
  const categorias = [
    ...Array.from({ length: 4 }, () => 'razo'),
    ...Array.from({ length: 4 }, () => 'longbow'),
    ...Array.from({ length: 4 }, () => 'recurvo'),
    ...Array.from({ length: 4 }, () => 'tradicional'),
    ...Array.from({ length: 2 }, () => 'escuela'),
  ];

  const archerIds: string[] = [];
  for (const [i, category] of categorias.entries()) {
    const { archer } = await api.post<{ archer: { id: string } }>('/api/admin/archers', {
      firstName: `Nombre${i + 1}`,
      lastName: `Apellido${String(i + 1).padStart(3, '0')}`,
      category,
    });
    archerIds.push(archer.id);
  }

  // 4. Torneo con el recorrido del brief.
  const { tournament } = await api.post<{ tournament: { id: string; maxPossibleScore: number } }>(
    '/api/admin/tournaments',
    {
      seasonId: season.id,
      name: 'Fecha E2E',
      date: '2026-08-08',
      targets: RECORRIDO.map((b) => ({ ...b, description: null })),
      archerIds,
    },
  );

  // 5. El máximo es el del brief. Si esto cambia, cambió el scoring.
  expect(tournament.maxPossibleScore).toBe(MAXIMO_ESPERADO);

  // 6-7. Patrullas: ninguna 100% escuela (H3), y se anotan las credenciales.
  const { patrols } = await api.get<{
    patrols: {
      id: string;
      number: number;
      username: string;
      pin: string;
      members: { category: string }[];
    }[];
  }>(`/api/admin/tournaments/${tournament.id}/patrols`);

  expect(patrols.length).toBeGreaterThan(0);
  for (const p of patrols) {
    const todosEscuela = p.members.every((m) => m.category === 'escuela');
    expect(todosEscuela, `la patrulla ${p.number} quedó 100% escuela`).toBe(false);
  }

  // 8. Arranca el torneo.
  await api.post(`/api/admin/tournaments/${tournament.id}/start`);

  // 9-18. La primera patrulla hace el recorrido completo SIN CONEXIÓN.
  const primera = patrols[0];
  if (!primera) throw new Error('El torneo no armó ninguna patrulla');

  const contexto: BrowserContext = await browser.newContext();
  const page = await contexto.newPage();

  await entrarComoLider(page, tournament.id, 'Fecha E2E', primera.username, primera.pin);

  /**
   * ▶ 10. Se corta la conexión.
   *
   * `setOffline` **no alcanza**: emula las condiciones de red por CDP y el
   * tráfico a `localhost` no pasa por ahí, así que las peticiones seguirían
   * llegando y el test daría verde sin haber probado nada. Se agrega un
   * interceptor que aborta todo lo que vaya a la API, y se cuenta: la prueba de
   * que estuvo offline es que hubo intentos y **ninguno llegó**.
   */
  let intentosBloqueados = 0;
  await contexto.route('**/api/**', async (route) => {
    intentosBloqueados++;
    await route.abort('internetdisconnected');
  });
  await contexto.setOffline(true);

  const llegaronAlServidor: string[] = [];
  page.on('requestfinished', (r) => {
    if (r.url().includes('/api/')) llegaronAlServidor.push(r.url());
  });

  // 11. El recorrido completo, sin señal.
  await cargarRecorrido(page);

  // 12. El indicador dice que hay pendientes o que no hay conexión.
  await expect(page.getByTestId('sync-badge')).toContainText(/Sin conexión|pendiente/i);

  // Y de verdad no llegó nada: sin esto, todo lo anterior sería decorado.
  expect(intentosBloqueados).toBeGreaterThan(0);
  expect(llegaronAlServidor).toEqual([]);

  /**
   * 13. Recargar estando offline no pierde nada.
   *
   * Vuelve al login, que ofrece **seguir sin conexión** con el nombre del torneo
   * y la antigüedad de los datos. Es un toque de más a propósito: el celular
   * puede ser prestado, y entrar solo a la planilla de otro sería peor.
   *
   * Lo que importa es que los 14 blancos siguen cargados, y salen de IndexedDB
   * porque la red está cortada.
   */
  await page.reload();
  await page.getByRole('button', { name: 'Seguir sin conexión' }).click();
  await expect(page.getByText(/^14 de 14 blancos/)).toBeVisible();
  expect(llegaronAlServidor).toEqual([]);

  // ▶ 14. Vuelve la conexión.
  await contexto.unroute('**/api/**');
  await contexto.setOffline(false);

  // 15. Se espera a que el outbox se vacíe.
  await expect(page.getByTestId('sync-badge')).toContainText(/Sincronizado/i, { timeout: 60_000 });

  // 16. Los puntajes llegaron al servidor, y los totales los calculó él.
  const { participants } = await api.get<{
    participants: { patrolNumber: number; total: number; targetsCompleted: number }[];
  }>(`/api/admin/tournaments/${tournament.id}/results`);

  const deLaPrimera = participants.filter((p) => p.patrolNumber === primera.number);
  expect(deLaPrimera.length).toBeGreaterThan(0);
  for (const p of deLaPrimera) {
    expect(p.targetsCompleted).toBe(RECORRIDO.length);
    expect(p.total).toBeGreaterThan(0);
  }

  /**
   * 16.b El avance **de la patrulla**, que es lo que WAFA muestra.
   *
   * Es un contador distinto del de cada participante: se recalcula dentro de la
   * transacción del puntaje, y por leer fuera de ella se quedaba en 13 de 14
   * con el recorrido entero cargado. Esta aserción faltaba, y por eso el E2E
   * pasaba con el bug adentro.
   */
  const { patrols: avance } = await api.get<{
    patrols: { number: number; targetsCompleted: number }[];
  }>(`/api/admin/tournaments/${tournament.id}/patrols`);

  const laPrimera = avance.find((p) => p.number === primera.number);
  expect(laPrimera?.targetsCompleted).toBe(RECORRIDO.length);

  // 17-18. Firmas y cierre.
  await firmarYCerrar(page);
  await contexto.close();

  // 19. Las demás patrullas, por API: su camino ya quedó probado arriba.
  for (const patrulla of patrols.slice(1)) {
    await cerrarPatrullaPorApi(browser, tournament.id, patrulla, api);
  }

  // 20. Con todas cerradas, el torneo pasa a completado solo.
  const { tournament: despues } = await api.get<{ tournament: { status: string } }>(
    `/api/admin/tournaments/${tournament.id}`,
  );
  expect(despues.status).toBe('completado');

  // 21. El admin revisa los podios y publica.
  const publicar = await browser.newContext();
  const pagePublicar = await publicar.newPage();
  await entrarComoAdmin(pagePublicar);
  await pagePublicar.goto(`/app/wafa/torneos/${tournament.id}/publicar`);

  await expect(pagePublicar.getByTestId('podio-razo')).toBeVisible();
  await pagePublicar.getByRole('button', { name: 'Publicar' }).click();
  await pagePublicar.getByRole('button', { name: 'Sí, publicar' }).click();
  await expect(pagePublicar.getByText(/Publicado\./)).toBeVisible();
  await publicar.close();

  // 22. En la landing, SIN sesión, se ven el ranking y el detalle del torneo.
  const anonimo = await browser.newContext();
  const publico = await anonimo.newPage();

  await publico.goto(`/torneos/${tournament.id}`);
  await expect(publico.getByTestId('podio-razo')).toBeVisible();

  /**
   * Con la temporada en la URL, no con la que la landing elija por defecto.
   *
   * El ranking abre en la primera temporada de la lista, y los escenarios
   * adicionales crean las suyas en la misma base efímera: sin esto, el test
   * pasaba corriendo solo y fallaba en la suite, porque la temporada por
   * defecto era la de otro spec y no tenía nada publicado.
   */
  await publico.goto(`/ranking?temporada=${season.id}`);
  await expect(publico.getByRole('heading', { name: 'Razo' })).toBeVisible();

  /**
   * **Cero scroll horizontal, con datos reales y en un celular chico.**
   *
   * Es la regla de `DESIGN_SYSTEM.md` §7 —«ancho mínimo 360 px, cero scroll
   * horizontal, en ninguna pantalla»— y las dos tablas de la landing la
   * rompían: el podio tiene ocho columnas y se resolvía con `overflow-x-auto`.
   *
   * Se mide **acá y no en un test de componente** porque jsdom no hace layout:
   * el único lugar donde `scrollWidth` significa algo es un navegador de
   * verdad, con los datos que el torneo dejó publicados.
   */
  /**
   * **320 px y no 360.** El sistema declara 360 como ancho mínimo soportado,
   * pero un iPhone SE en modo zoom de texto entrega menos: si entra a 320,
   * entra en todo lo demás.
   */
  const rutasPublicas = [
    `/torneos/${tournament.id}`,
    `/ranking?temporada=${season.id}`,
    // La ficha del arquero, que es la que más números por fila tiene.
    `/arqueros/${(await api.get<{ archers: { id: string }[] }>('/api/admin/archers')).archers[0]?.id}`,
  ];

  await publico.setViewportSize({ width: 320, height: 740 });

  for (const ruta of rutasPublicas) {
    await publico.goto(ruta);
    await publico.waitForLoadState('networkidle');

    /**
     * Se busca **cualquier** elemento que scrollee de costado, no el documento.
     *
     * La primera versión miraba `documentElement` y **pasaba con la tabla
     * rota**: `overflow-x-auto` scrollea adentro del contenedor, así que la
     * página nunca desborda. Medía lo que no era.
     *
     * Para el que sostiene el celular es lo mismo: para ver el puntaje hay que
     * arrastrar de costado.
     */
    const desbordes = await publico.evaluate(() =>
      [...document.querySelectorAll('*')]
        // Los `sr-only` miden 1px y están recortados: su `scrollWidth` siempre
        // supera al `clientWidth` y no pueden producir scroll de nada.
        .filter((e) => e.clientWidth > 1)
        .filter((e) => e.scrollWidth > e.clientWidth + 1)
        .map((e) => `${e.tagName.toLowerCase()} — ${e.className || '(sin clase)'}`),
    );

    expect(desbordes, `${ruta} tiene algo que scrollea de costado a 320 px`).toEqual([]);
  }

  await anonimo.close();

  // 23. Los puntos de liga se aplicaron.
  const ranking = await request.get(`/api/public/rankings?seasonId=${season.id}&mode=position`);
  const { categories } = (await ranking.json()) as {
    categories: {
      category: string;
      ranked: unknown[];
      notYetEligible: { leaguePoints: number }[];
    }[];
  };

  const razo = categories.find((c) => c.category === 'razo');
  expect(razo).toBeDefined();

  // Con un solo torneo publicado nadie llega al mínimo de dos, así que todos
  // están en `notYetEligible` — pero YA tienen sus puntos acumulados.
  const conPuntos = razo?.notYetEligible.filter((e) => e.leaguePoints > 0) ?? [];
  expect(conPuntos.length).toBeGreaterThan(0);
});

// ── Auxiliares del flujo ─────────────────────────────────────────────────────

async function entrarComoAdmin(page: Page) {
  await page.goto('/app/wafa');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Password').fill(PASSWORD_NUEVO);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Crear torneo')).toBeVisible();
}

/**
 * Cierra una patrulla por API: carga, firma y cierra.
 *
 * Versión acelerada del paso 19. El camino por interfaz ya quedó verificado con
 * la primera patrulla; repetirlo por cada una sólo agregaría minutos.
 */
async function cerrarPatrullaPorApi(
  browser: import('@playwright/test').Browser,
  tournamentId: string,
  patrulla: { username: string; pin: string; number: number },
  api: Awaited<ReturnType<typeof adminApi>>,
) {
  const contexto = await browser.newContext();
  const req = contexto.request;

  const csrf = await req.get('/api/auth/csrf');
  const headers = { 'x-csrf-token': (await csrf.json()).csrfToken as string };

  await req.post('/api/auth/patrol/login', {
    headers,
    data: { tournamentId, username: patrulla.username, pin: patrulla.pin },
  });

  const bundle = (await (await req.get('/api/wafl/bundle')).json()) as {
    participants: { id: string }[];
  };

  let n = 0;
  const uuid = () =>
    `0192f3a1-8c4e-7000-9abc-${String(++n + patrulla.number * 1000).padStart(12, '0')}`;

  const ops = bundle.participants.flatMap((p) =>
    RECORRIDO.map((b) => ({
      type: 'score' as const,
      opId: uuid(),
      clientUpdatedAt: new Date().toISOString(),
      participantId: p.id,
      targetIndex: b.index,
      arrows: FLECHAS[b.modality],
    })),
  );

  // Se revisa cada respuesta: un `sync` que rechaza en silencio dejaría la
  // patrulla abierta y el fallo aparecería recién tres pasos después.
  const sincronizar = async (ops: unknown[]) => {
    const res = await req.post('/api/wafl/sync', { headers, data: { ops } });
    const cuerpo = (await res.json()) as {
      results?: { status: string; error?: { message: string } }[];
      error?: { message: string };
    };

    expect(res.status(), `sync de la patrulla ${patrulla.number}: ${JSON.stringify(cuerpo)}`).toBe(
      200,
    );

    const rechazadas = cuerpo.results?.filter((r) => r.status === 'rejected') ?? [];
    expect(
      rechazadas,
      `la patrulla ${patrulla.number} tuvo ops rechazadas: ${JSON.stringify(rechazadas)}`,
    ).toEqual([]);
  };

  await sincronizar(ops);

  await sincronizar(
    bundle.participants.map((p) => ({
      type: 'signature' as const,
      opId: uuid(),
      clientUpdatedAt: new Date().toISOString(),
      participantId: p.id,
      pngDataUrl: PNG_VALIDO,
    })),
  );

  await sincronizar([{ type: 'close', opId: uuid(), clientUpdatedAt: new Date().toISOString() }]);

  await contexto.close();
  void api;
}
