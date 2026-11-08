/**
 * Los tipos de la API que ven los frontends (`REF6-11` / `C-3`).
 *
 * Es el **único** archivo del backend que otro paquete puede importar, y sólo como tipo
 * (`import type`): los frontends se los pasan al cliente RPC de Hono (`hc<…>`) y de ahí sale la
 * forma de cada respuesta. Renombrar un campo en una ruta rompe el `typecheck` de las pantallas que
 * lo leen, en vez de fallar en runtime en el celular de alguien.
 *
 * No exporta nada que exista en runtime: `scripts/verificar-capas.mjs` comprueba que nadie lo
 * importe sin `type`, porque eso arrastraría Hono, Mongo y los servicios al bundle de la PWA.
 *
 * Las rutas de WAFL (`/wafl/*`) no están: su capa de datos es IndexedDB y la cola de operaciones,
 * no una llamada por pantalla (regla 6).
 */

import type { admin } from './routes/admin.js';
import type { auth } from './routes/auth.js';
import type { publico } from './routes/publico.js';

/** `/api/admin/*`: todo lo que exige sesión de administrador. */
export type RutasDeAdmin = typeof admin;

/** `/api/auth/*`: sesión, CSRF y recuperación. */
export type RutasDeAuth = typeof auth;

/** `/api/public/*`: lo que ve cualquiera, sin sesión. */
export type RutasPublicas = typeof publico;
