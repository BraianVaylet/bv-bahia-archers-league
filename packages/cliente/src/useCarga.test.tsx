import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, crearCliente, useCarga, useRecurso } from './index.js';

/**
 * El hook de carga común (`REF6-11` / `C-2`).
 *
 * Cada página de WAFA reimplementaba `useState` + `useEffect` + `try/catch` +
 * `setError`, sin cancelación; la landing tenía su propio `useRecurso` con
 * `AbortController`. Un solo hook para los dos.
 */

/** Una promesa que se resuelve a mano: para controlar el orden de las respuestas. */
function diferida<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

describe('useCarga', () => {
  it('arranca cargando, y al terminar trae los datos', async () => {
    const { result } = renderHook(() => useCarga(async () => 'hola', []));

    expect(result.current.cargando).toBe(true);
    expect(result.current.datos).toBeUndefined();

    await waitFor(() => expect(result.current.datos).toBe('hola'));
    expect(result.current.cargando).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  describe('errores', () => {
    it('un ApiError muestra su mensaje', async () => {
      const { result } = renderHook(() =>
        useCarga(async () => {
          throw new ApiError(403, 'FORBIDDEN', 'No podés ver esto.');
        }, []),
      );

      await waitFor(() => expect(result.current.error).toBe('No podés ver esto.'));
      expect(result.current.cargando).toBe(false);
    });

    it('cualquier otra cosa muestra un mensaje de conexión', async () => {
      const { result } = renderHook(() =>
        useCarga(async () => {
          throw new TypeError('Failed to fetch');
        }, []),
      );

      await waitFor(() => expect(result.current.error).toMatch(/No se pudo conectar/));
    });

    // Las pantallas tienen su propio texto («No se pudo cargar el torneo. Revisá la conexión.»).
    it('el mensaje se puede dar fijo, sea cual sea el error', async () => {
      const { result } = renderHook(() =>
        useCarga(
          async () => {
            throw new ApiError(500, 'INTERNAL', 'otro texto');
          },
          [],
          { mensajeDeError: 'No se pudo cargar el torneo.' },
        ),
      );

      await waitFor(() => expect(result.current.error).toBe('No se pudo cargar el torneo.'));
    });
  });

  describe('cancelación', () => {
    it('al desmontar aborta la carga, y una respuesta tardía no toca nada', async () => {
      let senal: AbortSignal | undefined;
      const d = diferida<string>();
      const { unmount } = renderHook(() =>
        useCarga((signal) => {
          senal = signal;
          return d.promesa;
        }, []),
      );

      unmount();
      expect(senal?.aborted).toBe(true);

      // No tira ni deja un aviso de «actualizar un componente desmontado».
      d.resolver('tarde');
      await Promise.resolve();
    });

    it('al cambiar de recurso aborta el anterior y se queda con el nuevo, aunque llegue último', async () => {
      const a = diferida<string>();
      const b = diferida<string>();
      const señales: AbortSignal[] = [];

      const { result, rerender } = renderHook(
        ({ id }) =>
          useCarga(
            (signal) => {
              señales.push(signal);
              return id === 'a' ? a.promesa : b.promesa;
            },
            [id],
          ),
        { initialProps: { id: 'a' } },
      );

      rerender({ id: 'b' });
      expect(señales[0]?.aborted).toBe(true);

      // Llega primero la de B, después la vieja de A: A no puede pisar a B.
      await act(async () => {
        b.resolver('B');
        await b.promesa;
      });
      await act(async () => {
        a.resolver('A');
        await a.promesa;
      });

      expect(result.current.datos).toBe('B');
    });

    it('cambiar de recurso descarta los datos del anterior: no se muestran los de otro torneo', async () => {
      const b = diferida<string>();
      const { result, rerender } = renderHook(
        ({ id }) => useCarga(() => (id === 'a' ? Promise.resolve('A') : b.promesa), [id]),
        { initialProps: { id: 'a' } },
      );
      await waitFor(() => expect(result.current.datos).toBe('A'));

      rerender({ id: 'b' });

      expect(result.current.datos).toBeUndefined();
      expect(result.current.cargando).toBe(true);
    });
  });

  describe('recargar', () => {
    it('vuelve a pedir, y mientras tanto conserva lo que ya se veía', async () => {
      let n = 0;
      const segunda = diferida<number>();
      const { result } = renderHook(() =>
        useCarga(() => (++n === 1 ? Promise.resolve(1) : segunda.promesa), []),
      );
      await waitFor(() => expect(result.current.datos).toBe(1));

      let terminado: Promise<void> | undefined;
      act(() => {
        terminado = result.current.recargar();
      });

      // Sin parpadeo: los datos viejos siguen ahí mientras llegan los nuevos.
      expect(result.current.datos).toBe(1);
      expect(result.current.cargando).toBe(true);

      await act(async () => {
        segunda.resolver(2);
        await terminado;
      });
      expect(result.current.datos).toBe(2);
      expect(result.current.cargando).toBe(false);
    });

    it('si falla, muestra el error y conserva los datos', async () => {
      let n = 0;
      const { result } = renderHook(() =>
        useCarga(async () => {
          if (++n > 1) throw new ApiError(500, 'INTERNAL', 'Se cayó.');
          return 'bien';
        }, []),
      );
      await waitFor(() => expect(result.current.datos).toBe('bien'));

      await act(async () => {
        await result.current.recargar();
      });

      expect(result.current.error).toBe('Se cayó.');
      expect(result.current.datos).toBe('bien');
    });

    it('una recarga que sale bien limpia el error de la anterior', async () => {
      let n = 0;
      const { result } = renderHook(() =>
        useCarga(async () => {
          n++;
          if (n === 2) throw new ApiError(500, 'INTERNAL', 'Se cayó.');
          return n;
        }, []),
      );
      await waitFor(() => expect(result.current.datos).toBe(1));
      await act(async () => {
        await result.current.recargar();
      });
      expect(result.current.error).toBe('Se cayó.');

      await act(async () => {
        await result.current.recargar();
      });

      expect(result.current.error).toBeUndefined();
      expect(result.current.datos).toBe(3);
    });

    it('la función `recargar` no cambia: ni entre renders ni cuando llegan datos nuevos', async () => {
      let n = 0;
      const { result, rerender } = renderHook(() => useCarga(async () => ++n, []));
      await waitFor(() => expect(result.current.datos).toBe(1));
      const antes = result.current.recargar;

      rerender();
      expect(result.current.recargar).toBe(antes);

      // Un `useEffect([recargar])` —el refresco cada 30 s— se reiniciaría con cada dato nuevo.
      await act(async () => {
        await result.current.recargar();
      });
      expect(result.current.datos).toBe(2);
      expect(result.current.recargar).toBe(antes);
    });
  });

  /**
   * El refresco automático del seguimiento del torneo (`REF6-7`): lo que ya se ve sigue
   * siendo lo mejor que hay, y un corte de red cada 30 s no puede dejar la pantalla en rojo.
   */
  describe('recargar en silencio', () => {
    it('no pasa por «cargando»', async () => {
      let n = 0;
      const segunda = diferida<number>();
      const { result } = renderHook(() =>
        useCarga(() => (++n === 1 ? Promise.resolve(1) : segunda.promesa), []),
      );
      await waitFor(() => expect(result.current.datos).toBe(1));

      let terminado: Promise<void> | undefined;
      act(() => {
        terminado = result.current.recargar({ silencioso: true });
      });

      expect(result.current.cargando).toBe(false);

      await act(async () => {
        segunda.resolver(2);
        await terminado;
      });
      expect(result.current.datos).toBe(2);
    });

    it('si falla, no muestra nada y conserva los datos', async () => {
      let n = 0;
      const { result } = renderHook(() =>
        useCarga(async () => {
          if (++n > 1) throw new ApiError(503, 'INTERNAL', 'Sin servicio.');
          return 'bien';
        }, []),
      );
      await waitFor(() => expect(result.current.datos).toBe('bien'));

      await act(async () => {
        await result.current.recargar({ silencioso: true });
      });

      expect(result.current.error).toBeUndefined();
      expect(result.current.datos).toBe('bien');
    });

    // El motivo por el que el servidor rechazó la última acción tiene que poder leerse.
    it('si sale bien, NO borra un error anterior', async () => {
      let n = 0;
      const { result } = renderHook(() =>
        useCarga(async () => {
          n++;
          if (n === 2) throw new ApiError(409, 'CONFLICT', 'No se pudo.');
          return n;
        }, []),
      );
      await waitFor(() => expect(result.current.datos).toBe(1));
      await act(async () => {
        await result.current.recargar();
      });
      expect(result.current.error).toBe('No se pudo.');

      await act(async () => {
        await result.current.recargar({ silencioso: true });
      });

      expect(result.current.datos).toBe(3);
      expect(result.current.error).toBe('No se pudo.');
    });

    it('si ya hay una carga en vuelo, no manda otra', async () => {
      const pedido = vi.fn();
      const lenta = diferida<number>();
      const { result } = renderHook(() =>
        useCarga(() => {
          pedido();
          return lenta.promesa;
        }, []),
      );
      expect(pedido).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.recargar({ silencioso: true });
      });

      expect(pedido).toHaveBeenCalledTimes(1);
      lenta.resolver(1);
    });
  });
});

describe('useRecurso', () => {
  // El cliente se crea afuera del render: es una dependencia del efecto, y uno nuevo en cada
  // render volvería a pedir sin parar.
  const { api } = crearCliente({ base: '/api' });
  const clienteDePrueba = { get: api.get };

  it('es una lectura con tres estados explícitos: cargando, listo y error', async () => {
    const d = diferida<{ n: number }>();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => d.promesa.then((v) => new Response(JSON.stringify(v)))),
    );

    const { result } = renderHook(() => useRecurso<{ n: number }>(clienteDePrueba, '/x'));
    expect(result.current).toEqual({ estado: 'cargando' });

    d.resolver({ n: 1 });
    await waitFor(() => expect(result.current).toEqual({ estado: 'listo', datos: { n: 1 } }));

    vi.unstubAllGlobals();
  });

  it('un error es el tercer estado, con su mensaje', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'X', message: 'Roto.' } }), { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useRecurso(clienteDePrueba, '/x'));

    await waitFor(() => expect(result.current).toEqual({ estado: 'error', mensaje: 'Roto.' }));
    vi.unstubAllGlobals();
  });

  it('con `null` no pide nada: la ruta todavía no se conoce', () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);

    const { result } = renderHook(() => useRecurso(clienteDePrueba, null));

    expect(fetchFalso).not.toHaveBeenCalled();
    expect(result.current).toEqual({ estado: 'cargando' });
    vi.unstubAllGlobals();
  });

  it('al cambiar la ruta vuelve a cargar y vuelve a «cargando»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => new Response(JSON.stringify({ url }))),
    );

    const { result, rerender } = renderHook(
      ({ ruta }) => useRecurso<{ url: string }>(clienteDePrueba, ruta),
      {
        initialProps: { ruta: '/a' },
      },
    );
    await waitFor(() =>
      expect(result.current).toEqual({ estado: 'listo', datos: { url: '/api/a' } }),
    );

    rerender({ ruta: '/b' });

    expect(result.current).toEqual({ estado: 'cargando' });
    await waitFor(() =>
      expect(result.current).toEqual({ estado: 'listo', datos: { url: '/api/b' } }),
    );
    vi.unstubAllGlobals();
  });
});
