/**
 * El cliente RPC de WAFA (`REF6-11` / `C-3`).
 *
 * `hc<…>` es el cliente de Hono tipado con las rutas del backend: la forma de cada respuesta, y lo
 * que acepta cada ruta (cuerpo, consulta, parámetros), salen de lo que el servidor declara. Renombrar
 * un campo en una ruta rompe el `typecheck` de la pantalla que lo lee, en vez de fallar en runtime en
 * el celular de alguien.
 *
 * Los tipos vienen de `@bal/api/tipos` y **sólo como tipo**: `import type` se borra al compilar, así
 * que nada del backend entra al bundle (`scripts/verificar-capas.mjs` lo comprueba).
 *
 * Todo pasa por el `fetch` de `@bal/cliente`, el mismo de `apiClient.ts`: el token CSRF se adjunta
 * solo en cada mutación y un rechazo del servidor sale como `ApiError`.
 *
 * Es de WAFA. WAFL sigue con `apiClient.ts` y no baja esto.
 */

import type { RutasDeAdmin, RutasDeAuth, RutasPublicas } from '@bal/api/tipos';
import { hc } from 'hono/client';
import { ApiError, BASE_DE_LA_API, pedir } from './apiClient.js';

/** Un cliente por grupo de rutas: cada uno cuelga de su prefijo y comparten el `fetch`. */
const rpc = {
  admin: hc<RutasDeAdmin>(`${BASE_DE_LA_API}/admin`, { fetch: pedir }),
  auth: hc<RutasDeAuth>(`${BASE_DE_LA_API}/auth`, { fetch: pedir }),
  publico: hc<RutasPublicas>(`${BASE_DE_LA_API}/public`, { fetch: pedir }),
};

/** Lo que devuelve el JSON de una respuesta, para todos los estados con que puede salir bien. */
type Cuerpo<R> = R extends { json: () => Promise<infer T> } ? T : never;

/**
 * El cuerpo de una llamada RPC que salió bien.
 *
 * Si el servidor rechaza, `fetch` ya lanzó el `ApiError` antes de llegar acá. Si contesta `200`
 * con algo que no es JSON —el portal cautivo del wifi del club—, `json()` lanza `SyntaxError` y
 * no `ApiError`, a propósito: quien reintenta lo trata como «no sé qué pasó».
 */
async function cuerpo<R extends { json: () => Promise<unknown> }>(
  pedido: Promise<R>,
): Promise<Cuerpo<R>> {
  return (await (await pedido).json()) as Cuerpo<R>;
}

/** La señal para cancelar un pedido RPC: es el segundo argumento de cada `$get`, `$post`… */
const conSenal = (signal: AbortSignal) => ({ init: { signal } });

export { ApiError, conSenal, cuerpo, rpc };
