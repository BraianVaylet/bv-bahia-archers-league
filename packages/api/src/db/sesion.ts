/**
 * Sesiones de MongoDB para las transacciones (`REF6-10` / `B-1`).
 *
 * Un servicio que necesita una transacción —aplicar una op de sync con su dedup, publicar
 * un torneo— tiene que abrir una sesión, y para eso hacía falta importar `db/client`: el
 * mismo módulo que da acceso a **todas las colecciones**. Con eso, `scripts/verificar-
 * capas.mjs` no podía prohibirle a un servicio importar el cliente, y la regla 3 («ninguna
 * consulta a MongoDB fuera de `repositories/`») quedaba sin dientes.
 *
 * Esto es lo único que se expone: abrir una sesión. No hay forma de pedir una colección
 * desde acá, así que una transacción puede **agruparse** en un servicio pero cada consulta
 * sigue pasando por un repositorio. Agregar acá otra cosa es el síntoma de que algo está
 * en la capa equivocada.
 */

import type { ClientSession } from 'mongodb';
import { getClient } from './client.js';

/** Abre una sesión. Quien la abre la cierra (`endSession`). */
export function iniciarSesion(): ClientSession {
  return getClient().startSession();
}
