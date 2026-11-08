/**
 * Estado de la conexión a la base, para el healthcheck.
 */

import { ping } from '../db/client.js';

/** `true` si la base responde. */
export const baseResponde = (): Promise<boolean> => ping();
