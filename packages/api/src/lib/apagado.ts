/**
 * Apagado ordenado (`REF6-13` / `B-3`).
 *
 * Un redeploy en medio del torneo manda `SIGTERM`. Cerrar Mongo de inmediato aborta las
 * transacciones de sincronización que estaban corriendo, y hasta el `releaseOp` del `catch` puede
 * fallar con la conexión ya cerrada. El orden correcto es: dejar de aceptar requests, **esperar a que
 * terminen los que estaban en vuelo**, y recién entonces desconectar la base.
 *
 * Esperar tiene un plazo: un cliente colgado no puede dejar el proceso vivo para siempre. Pasado el
 * plazo se desconecta igual, y la idempotencia de `/wafl/sync` absorbe lo que haya quedado a medias.
 *
 * **Railway le da 0 segundos entre `SIGTERM` y `SIGKILL` por defecto**: sin
 * `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` (o `deploy.drainingSeconds` en `railway.json`) mayor que este
 * plazo, el proceso muere antes de poder esperar a nadie. Ver `docs/CONFIG.md`.
 */

import { log } from './logger.js';

/** Cuánto se espera a los requests en vuelo. Una op de sync tarda segundos, no más. */
export const PLAZO_DE_APAGADO_MS = 10_000;

export type ResultadoDelApagado = 'limpio' | 'por-plazo' | 'con-error';

export interface OpcionesDelApagado {
  /** Deja de aceptar conexiones y resuelve cuando terminó el último request en vuelo. */
  readonly cerrarServidor: () => Promise<void>;
  readonly desconectar: () => Promise<void>;
  readonly plazoMs: number;
}

const PLAZO = Symbol('plazo vencido');

export async function apagarOrdenadamente(
  opciones: OpcionesDelApagado,
): Promise<ResultadoDelApagado> {
  const { cerrarServidor, desconectar, plazoMs } = opciones;
  let resultado: ResultadoDelApagado = 'limpio';

  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const vencido = new Promise<typeof PLAZO>((resolver) => {
    temporizador = setTimeout(() => resolver(PLAZO), plazoMs);
  });

  try {
    const terminado = await Promise.race([cerrarServidor(), vencido]);
    if (terminado === PLAZO) {
      resultado = 'por-plazo';
      log.warn('apagado.plazo_vencido', { plazoMs });
    }
  } catch (error) {
    resultado = 'con-error';
    log.error('apagado.error_al_cerrar_el_servidor', { error });
  } finally {
    clearTimeout(temporizador);
  }

  try {
    await desconectar();
  } catch (error) {
    resultado = 'con-error';
    log.error('apagado.error_al_desconectar', { error });
  }

  return resultado;
}
