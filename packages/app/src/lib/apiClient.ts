/**
 * Cliente HTTP de la PWA.
 *
 * Es el cliente compartido con la landing (`@bal/cliente`, `REF6-11` / `C-4`): el CSRF, el
 * `ApiError` y los errores se manejan en un solo lugar. Acá sólo se dice dónde cuelga la API.
 *
 * Es el que usa WAFL: su flujo de datos es IndexedDB y la cola de operaciones (regla 6), no una
 * llamada por pantalla. WAFA pide por `rpc.ts`, que le suma los tipos de las rutas del backend
 * (`REF6-11` / `C-3`) y por eso vive aparte: así WAFL no baja el cliente RPC.
 *
 * Ver `docs/SECURITY.md` §8.
 */

import { ApiError, crearCliente } from '@bal/cliente';

export const BASE_DE_LA_API = import.meta.env.VITE_API_BASE ?? '/api';

const { request, api, fetch: pedir } = crearCliente({ base: BASE_DE_LA_API });

export { ApiError, api, pedir, request };
