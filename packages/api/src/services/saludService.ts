/**
 * Lo que el healthcheck necesita saber de la base.
 */

import * as saludRepo from '../repositories/saludRepo.js';

export interface EstadoDeLaBase {
  readonly ok: boolean;
  /** Cuánto tardó el `ping`, en ms. Con la base caída no significa nada. */
  readonly ms: number;
}

/** Mide el viaje a la base: es el costo de cada consulta de la sincronización. */
export async function estadoDeLaBase(): Promise<EstadoDeLaBase> {
  const desde = performance.now();
  const ok = await saludRepo.baseResponde();
  return { ok, ms: Math.round(performance.now() - desde) };
}
