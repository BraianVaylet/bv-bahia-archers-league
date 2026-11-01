/**
 * Cliente HTTP de la PWA.
 *
 * Es el cliente compartido con la landing (`@bal/cliente`, `REF6-11` / `C-4`): el CSRF, el
 * `ApiError` y los errores se manejan en un solo lugar. Acá sólo se dice dónde cuelga la API.
 *
 * Ver `docs/SECURITY.md` §8.
 */

import { ApiError, crearCliente } from '@bal/cliente';

const { request, api } = crearCliente({ base: import.meta.env.VITE_API_BASE ?? '/api' });

export { ApiError, api, request };
