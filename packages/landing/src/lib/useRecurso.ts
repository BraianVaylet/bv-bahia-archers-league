/**
 * Carga de un recurso de sólo lectura.
 *
 * Los tres estados se representan **explícitamente**. Sin `cargando`, la primera
 * pintada mostraría «no hay nada» a alguien cuyos datos están en camino, que es
 * el error más fácil de cometer en una pantalla de lectura.
 */

import { useEffect, useState } from 'react';
import { ApiError, get } from './api.js';

export type Recurso<T> =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'listo'; readonly datos: T }
  | { readonly estado: 'error'; readonly mensaje: string };

export function useRecurso<T>(path: string | null): Recurso<T> {
  const [recurso, setRecurso] = useState<Recurso<T>>({ estado: 'cargando' });

  useEffect(() => {
    if (path === null) return;

    const control = new AbortController();
    setRecurso({ estado: 'cargando' });

    get<T>(path, control.signal)
      .then((datos) => setRecurso({ estado: 'listo', datos }))
      .catch((err: unknown) => {
        // Un aborto no es un error: pasa al cambiar de página antes de que llegue.
        if (control.signal.aborted) return;
        setRecurso({
          estado: 'error',
          mensaje:
            err instanceof ApiError
              ? err.message
              : 'No se pudo conectar. Probá de nuevo en un rato.',
        });
      });

    return () => control.abort();
  }, [path]);

  return recurso;
}
