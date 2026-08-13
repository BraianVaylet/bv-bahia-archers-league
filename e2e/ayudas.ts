/**
 * Piezas compartidas por los E2E.
 *
 * Vivían dentro de `flujo-completo.spec.ts`. Se sacaron acá al escribir los
 * escenarios adicionales de `TEST-2`: copiarlas cinco veces habría dejado cinco
 * versiones que se separan la primera vez que cambia una pantalla.
 *
 * Ver `docs/TESTING.md` §6.
 */

import { type APIRequestContext, expect, type Page } from '@playwright/test';

export const PASSWORD_INICIAL = 'password-inicial-e2e';
export const PASSWORD_NUEVO = 'un-password-de-admin-largo';

/** Recorrido corto para los escenarios que no necesitan los 14 del brief. */
export const RECORRIDO_CORTO = [
  { index: 1, modality: '3d', arrows: 2, description: null },
  { index: 2, modality: 'sala', arrows: 3, description: null },
];

/** Tokens que se cargan en cada blanco, según su modalidad. */
export const FLECHAS: Record<string, string[]> = {
  '3d': ['11', '10'],
  campo: ['6', '5', '4'],
  aire_libre: ['X', '10', '9', '8', '7', '6'],
  sala: ['X', '10', '9'],
};

/** PNG mínimo con su cabecera real: el servidor valida los primeros bytes. */
export const PNG_VALIDO = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]).toString('base64')}`;

export interface AdminApi {
  readonly headers: Record<string, string>;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, data?: unknown): Promise<T>;
  patch<T>(path: string, data?: unknown): Promise<T>;
}

/**
 * Cliente de API con sesión de admin.
 *
 * El cambio de password sólo se intenta la primera vez: en una base compartida
 * por varios specs, el segundo intento fallaría porque ya no es el inicial.
 */
export async function adminApi(request: APIRequestContext): Promise<AdminApi> {
  const csrf = await request.get('/api/auth/csrf');
  const token = (await csrf.json()).csrfToken as string;
  const headers = { 'x-csrf-token': token };

  const login = await request.post('/api/auth/admin/login', {
    headers,
    data: { username: 'admin', password: PASSWORD_INICIAL },
  });

  if (login.ok()) {
    await request.post('/api/auth/admin/password', {
      headers,
      data: { currentPassword: PASSWORD_INICIAL, newPassword: PASSWORD_NUEVO },
    });
  } else {
    await request.post('/api/auth/admin/login', {
      headers,
      data: { username: 'admin', password: PASSWORD_NUEVO },
    });
  }

  return {
    headers,
    get: async <T>(path: string): Promise<T> => (await request.get(path)).json() as Promise<T>,
    post: async <T>(path: string, data?: unknown): Promise<T> =>
      (await request.post(path, { headers, ...(data ? { data } : {}) })).json() as Promise<T>,
    patch: async <T>(path: string, data?: unknown): Promise<T> =>
      (await request.patch(path, { headers, ...(data ? { data } : {}) })).json() as Promise<T>,
  };
}

export interface TorneoListo {
  readonly tournamentId: string;
  readonly seasonId: string;
  readonly patrols: readonly { id: string; number: number; username: string; pin: string }[];
}

/**
 * Temporada, arqueros, torneo y arranque, todo por API.
 *
 * Por API y no por interfaz a propósito: el wizard tiene sus propios tests, y
 * hacer las altas a mano acá haría cada escenario lento y frágil sin verificar
 * nada nuevo.
 */
export async function torneoIniciado(
  api: AdminApi,
  opciones: {
    nombre: string;
    arqueros?: number;
    targets?: typeof RECORRIDO_CORTO;
  },
): Promise<TorneoListo> {
  const { season } = await api.post<{ season: { id: string } }>('/api/admin/seasons', {
    name: `Liga de ${opciones.nombre}`,
    startsAt: '2026-01-01',
    endsAt: '2026-12-31',
  });

  const archerIds: string[] = [];
  for (let i = 0; i < (opciones.arqueros ?? 2); i++) {
    const { archer } = await api.post<{ archer: { id: string } }>('/api/admin/archers', {
      firstName: `Nombre${opciones.nombre}${i}`,
      lastName: `Apellido${opciones.nombre}${String(i).padStart(3, '0')}`,
      category: 'razo',
    });
    archerIds.push(archer.id);
  }

  const { tournament } = await api.post<{ tournament: { id: string } }>('/api/admin/tournaments', {
    seasonId: season.id,
    name: opciones.nombre,
    date: '2026-08-08',
    targets: opciones.targets ?? RECORRIDO_CORTO,
    archerIds,
  });

  await api.post(`/api/admin/tournaments/${tournament.id}/start`);

  const { patrols } = await api.get<{
    patrols: { id: string; number: number; username: string; pin: string }[];
  }>(`/api/admin/tournaments/${tournament.id}/patrols`);

  return { tournamentId: tournament.id, seasonId: season.id, patrols };
}

/** Entra a WAFL con las credenciales de una patrulla. */
export async function entrarComoLider(
  page: Page,
  tournamentId: string,
  nombreTorneo: string,
  username: string,
  pin: string,
): Promise<void> {
  await page.goto('/app/wafl');

  // Se espera la OPCIÓN, no el select: elegir un valor cuya opción todavía no
  // cargó no hace nada, y el formulario quedaría vacío sin que se note.
  await expect(page.getByRole('option', { name: new RegExp(nombreTorneo) })).toBeAttached();
  await page.getByLabel('Torneo').selectOption(tournamentId);
  await page.getByLabel('Patrulla').fill(username);
  await page.getByLabel('PIN').fill(pin);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('button', { name: 'Resultados finales' })).toBeVisible();
}

/**
 * Carga un blanco entero, para todos los arqueros de la patrulla.
 *
 * La condición de corte es el **conteo de puntajes completos**, que es estado
 * del dominio y no del DOM: preguntarle al botón «Continuar» si hay que seguir
 * es frágil, porque se re-renderiza cuando termina una sincronización de fondo.
 */
export async function cargarBlanco(page: Page, posicion: number, modality: string): Promise<void> {
  const tarjetas = page.getByTestId('numero-blanco');
  await tarjetas.nth(posicion).click();

  const completos = page.getByText('Puntaje completo');
  const tarjetasDeArquero = page.getByRole('button', { name: /Unidad [AB]/ });

  // Que haya arqueros ANTES de contarlos: `count()` no reintenta y devolvería 0
  // si la lista todavía no renderizó.
  await expect(tarjetasDeArquero.first()).toBeVisible();
  const arqueros = await tarjetasDeArquero.count();

  for (let cargados = 0; cargados < arqueros; cargados++) {
    for (const token of FLECHAS[modality] ?? []) {
      await page.getByRole('button', { name: `Puntaje ${token}` }).click();
    }
    await expect(completos).toHaveCount(cargados + 1, { timeout: 15_000 });
  }

  await page.getByRole('button', { name: 'Continuar' }).click();
}
