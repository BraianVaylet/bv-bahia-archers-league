/**
 * Cliente HTTP del sitio público.
 *
 * Casi todo acá es lectura, sin sesión. `post` es la excepción —desde `BE-20`/`FE-27`, el alta
 * de arquero— y por eso sí necesita CSRF: el middleware lo exige en toda mutación de `/api/*`,
 * autoregistro incluido. Sin outbox: a diferencia de WAFL, una alta que falla no se reintenta
 * sola.
 *
 * Es el cliente compartido con la PWA (`@bal/cliente`, `REF6-11` / `C-4`). La API de la landing
 * cuelga de `/api/public`, pero el token CSRF es común a toda la API: se pide a la ruta
 * **absoluta** `/api/auth/csrf`, que es el valor por defecto del cliente.
 */

import { ApiError, crearCliente } from '@bal/cliente';

const { api } = crearCliente({
  base: import.meta.env.VITE_API_BASE ?? '/api/public',
  mensajes: {
    lectura: 'No se pudo cargar la información.',
    escritura: 'No se pudo enviar. Revisá la conexión.',
  },
});

/** Lo que `useRecurso` necesita: un `get` que no cambie entre renders. */
export const cliente = { get: api.get };

export const get = api.get;
export const post = <T>(path: string, body: unknown) => api.post<T>(path, body);

export { ApiError };
