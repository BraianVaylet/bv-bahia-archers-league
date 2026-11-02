import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apagarOrdenadamente } from '../src/lib/apagado.js';

/**
 * Apagado ordenado (`REF6-13` / `B-3`).
 *
 * Un redeploy en medio del torneo mandaba `SIGTERM`, el proceso cerraba Mongo de inmediato y las
 * transacciones de sync que estaban corriendo se abortaban a la mitad. La idempotencia lo absorbe
 * (el cliente reintenta), pero hasta el `releaseOp` del `catch` puede fallar con la conexión ya
 * cerrada. Hay que esperar a que terminen los requests en vuelo —con un plazo— y recién después
 * desconectar.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Una promesa que se resuelve (o rechaza) cuando el test lo decide. */
function diferida() {
  let resolver: () => void = () => {};
  let rechazar: (e: Error) => void = () => {};
  const promesa = new Promise<void>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

describe('apagarOrdenadamente', () => {
  it('espera a que el servidor termine sus requests antes de desconectar la base', async () => {
    const orden: string[] = [];
    const cierre = diferida();

    const apagado = apagarOrdenadamente({
      cerrarServidor: () => cierre.promesa.then(() => void orden.push('servidor cerrado')),
      desconectar: async () => void orden.push('base desconectada'),
      plazoMs: 10_000,
    });

    await vi.advanceTimersByTimeAsync(2_000);
    expect(orden).toEqual([]);

    cierre.resolver();
    expect(await apagado).toBe('limpio');
    expect(orden).toEqual(['servidor cerrado', 'base desconectada']);
  });

  it('si los requests no terminan en el plazo, desconecta igual: no se cuelga para siempre', async () => {
    const desconectar = vi.fn(async () => {});

    const apagado = apagarOrdenadamente({
      cerrarServidor: () => new Promise<void>(() => {}),
      desconectar,
      plazoMs: 10_000,
    });

    await vi.advanceTimersByTimeAsync(9_999);
    expect(desconectar).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(await apagado).toBe('por-plazo');
    expect(desconectar).toHaveBeenCalledTimes(1);
  });

  it('si el servidor cierra antes, no queda un temporizador colgado', async () => {
    await apagarOrdenadamente({
      cerrarServidor: async () => {},
      desconectar: async () => {},
      plazoMs: 10_000,
    });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('si cerrar el servidor falla, desconecta igual y lo informa', async () => {
    const desconectar = vi.fn(async () => {});

    const resultado = await apagarOrdenadamente({
      cerrarServidor: () => Promise.reject(new Error('no se pudo cerrar')),
      desconectar,
      plazoMs: 10_000,
    });

    expect(resultado).toBe('con-error');
    expect(desconectar).toHaveBeenCalledTimes(1);
  });

  it('si desconectar falla, no lanza: el proceso se va a ir igual', async () => {
    const resultado = apagarOrdenadamente({
      cerrarServidor: async () => {},
      desconectar: () => Promise.reject(new Error('conexión ya cerrada')),
      plazoMs: 10_000,
    });

    await expect(resultado).resolves.toBe('con-error');
  });

  it('desconecta una sola vez', async () => {
    const desconectar = vi.fn(async () => {});

    await apagarOrdenadamente({ cerrarServidor: async () => {}, desconectar, plazoMs: 10_000 });

    expect(desconectar).toHaveBeenCalledTimes(1);
  });
});
