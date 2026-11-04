import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REFRESCO_MS, useRefrescoPeriodico } from './refrescoPeriodico.js';

/**
 * El refresco suave del seguimiento del torneo (`REF6-7` / `U-6`).
 *
 * En WAFA la pantalla de un torneo en curso cargaba una vez: para ver el avance
 * de las patrullas había que recargar. Cada 30 s alcanza para mirar cómo va el
 * torneo, y pausarlo con la pestaña oculta evita gastar datos y batería de un
 * celular que está en el bolsillo.
 *
 * Con relojes falsos: el hook no espera, se avanza el tiempo.
 */

function visibilidad(estado: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: estado, configurable: true });
}

/** La pestaña pasa a `estado` y el navegador lo avisa. */
function cambiarVisibilidad(estado: 'visible' | 'hidden') {
  visibilidad(estado);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

const pasan = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  visibilidad('visible');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  visibilidad('visible');
});

describe('useRefrescoPeriodico', () => {
  it('refresca cada 30 segundos, y no antes', () => {
    const refrescar = vi.fn();
    renderHook(() => useRefrescoPeriodico(refrescar, true));

    pasan(REFRESCO_MS - 1);
    expect(refrescar).not.toHaveBeenCalled();

    pasan(1);
    expect(refrescar).toHaveBeenCalledTimes(1);

    pasan(REFRESCO_MS * 2);
    expect(refrescar).toHaveBeenCalledTimes(3);
  });

  it('el período es de 30 segundos', () => {
    expect(REFRESCO_MS).toBe(30_000);
  });

  it('con la pestaña oculta no refresca', () => {
    visibilidad('hidden');
    const refrescar = vi.fn();
    renderHook(() => useRefrescoPeriodico(refrescar, true));

    pasan(REFRESCO_MS * 5);

    expect(refrescar).not.toHaveBeenCalled();
  });

  it('se pausa cuando la pestaña se oculta, y no acumula lo que se perdió', () => {
    const refrescar = vi.fn();
    renderHook(() => useRefrescoPeriodico(refrescar, true));

    cambiarVisibilidad('hidden');
    pasan(REFRESCO_MS * 10);

    expect(refrescar).not.toHaveBeenCalled();
  });

  it('al volver a la pestaña refresca de inmediato, y retoma el ritmo', () => {
    const refrescar = vi.fn();
    renderHook(() => useRefrescoPeriodico(refrescar, true));
    cambiarVisibilidad('hidden');
    pasan(REFRESCO_MS * 3);

    cambiarVisibilidad('visible');
    // De inmediato: lo que se ve puede tener minutos de atraso.
    expect(refrescar).toHaveBeenCalledTimes(1);

    pasan(REFRESCO_MS);
    expect(refrescar).toHaveBeenCalledTimes(2);
  });

  it('volver a la pestaña no duplica el ritmo: sigue siendo uno cada 30 s', () => {
    const refrescar = vi.fn();
    renderHook(() => useRefrescoPeriodico(refrescar, true));

    for (let i = 0; i < 3; i++) {
      cambiarVisibilidad('hidden');
      cambiarVisibilidad('visible');
    }
    refrescar.mockClear();

    pasan(REFRESCO_MS);

    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it('inactivo, no refresca nunca', () => {
    const refrescar = vi.fn();
    renderHook(() => useRefrescoPeriodico(refrescar, false));

    pasan(REFRESCO_MS * 5);
    cambiarVisibilidad('hidden');
    cambiarVisibilidad('visible');

    expect(refrescar).not.toHaveBeenCalled();
  });

  it('empieza a refrescar cuando pasa a activo, y deja de hacerlo cuando deja de serlo', () => {
    const refrescar = vi.fn();
    const { rerender } = renderHook(({ activo }) => useRefrescoPeriodico(refrescar, activo), {
      initialProps: { activo: false },
    });

    pasan(REFRESCO_MS * 2);
    expect(refrescar).not.toHaveBeenCalled();

    rerender({ activo: true });
    pasan(REFRESCO_MS);
    expect(refrescar).toHaveBeenCalledTimes(1);

    rerender({ activo: false });
    pasan(REFRESCO_MS * 3);
    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it('al salir de la pantalla no queda nada corriendo', () => {
    const refrescar = vi.fn();
    const { unmount } = renderHook(() => useRefrescoPeriodico(refrescar, true));

    unmount();
    pasan(REFRESCO_MS * 5);
    cambiarVisibilidad('hidden');
    cambiarVisibilidad('visible');

    expect(refrescar).not.toHaveBeenCalled();
  });

  /**
   * Cada render de la pantalla crea una función nueva. Si el efecto dependiera de
   * ella, el intervalo se reiniciaría en cada render y un torneo con actividad
   * constante nunca llegaría a los 30 s.
   */
  it('un render nuevo no reinicia la cuenta', () => {
    const primera = vi.fn();
    const segunda = vi.fn();
    const { rerender } = renderHook(({ f }) => useRefrescoPeriodico(f, true), {
      initialProps: { f: primera },
    });

    pasan(REFRESCO_MS - 1_000);
    rerender({ f: segunda });
    pasan(1_000);

    // Llegó a los 30 s de la primera cuenta, y llama a la función **vigente**.
    expect(primera).not.toHaveBeenCalled();
    expect(segunda).toHaveBeenCalledTimes(1);
  });
});
