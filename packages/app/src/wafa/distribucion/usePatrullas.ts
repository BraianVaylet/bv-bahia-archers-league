/**
 * La distribución de patrullas de un torneo y su edición (`REF6-11` / `C-1`, `C-2`).
 *
 * Mientras el torneo está `sin_iniciar` el admin reacomoda arqueros en un **borrador** local. Lo
 * que viene del servidor y lo que se está editando son dos cosas: cada carga reemplaza el borrador,
 * y guardar reemplaza lo que el servidor tiene con lo que él mismo devuelve.
 */

import { useCarga } from '@bal/cliente';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../../lib/apiClient.js';
import {
  type Borrador,
  borradorDe,
  cuerpoDeDistribucion,
  type PatrullaVista,
  problemaDelBorrador,
  violacionesDe,
} from '../patrullas.js';

interface Respuesta {
  readonly patrols: PatrullaVista[];
  readonly violations: unknown[];
}

export interface TorneoDePatrullas {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly targets: readonly { index: number }[];
}

export function usePatrullas(id: string) {
  const carga = useCarga(
    async (signal) => {
      const [t, r] = await Promise.all([
        api.get<{ tournament: TorneoDePatrullas }>(`/admin/tournaments/${id}`, signal),
        // Con `?pins=1`: ésta es la pantalla de credenciales, la única que los muestra.
        api.get<Respuesta>(`/admin/tournaments/${id}/patrols?pins=1`, signal),
      ]);
      return { torneo: t.tournament, patrullas: r.patrols };
    },
    [id],
    { mensajeDeError: 'No se pudieron cargar las patrullas. Revisá la conexión.' },
  );

  const [patrullas, setPatrullas] = useState<PatrullaVista[]>();
  const [borrador, setBorrador] = useState<Borrador[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorDeGuardado, setErrorDeGuardado] = useState<string>();

  /**
   * Hay cambios que el servidor todavía no tiene.
   *
   * Es lo que deshabilita **Imprimir**: la planilla en papel es la única fuente de verdad en el
   * monte, y no puede decir algo distinto de lo que la app va a mandar. Cualquier edición lo
   * prende; guardar y recargar lo apagan.
   */
  const [sinGuardar, setSinGuardar] = useState(false);

  // Cada carga reemplaza lo que se estaba editando: es lo que el servidor tiene.
  useEffect(() => {
    if (!carga.datos) return;
    setPatrullas(carga.datos.patrullas);
    setBorrador(borradorDe(carga.datos.patrullas));
    setSinGuardar(false);
  }, [carga.datos]);

  /** Toda edición del borrador pasa por acá, para que ninguna se olvide de marcarlo. */
  const editar = (siguiente: Borrador[]) => {
    setBorrador(siguiente);
    setSinGuardar(true);
    setGuardado(false);
  };

  const guardar = async () => {
    setGuardando(true);
    setErrorDeGuardado(undefined);

    try {
      const r = await api.put<Respuesta>(
        `/admin/tournaments/${id}/patrols`,
        cuerpoDeDistribucion(borrador),
      );
      setPatrullas(r.patrols);
      setBorrador(borradorDe(r.patrols));
      setSinGuardar(false);
      setGuardado(true);
    } catch (err) {
      setErrorDeGuardado(
        err instanceof ApiError ? err.message : 'No se pudo guardar. Revisá la conexión.',
      );
    } finally {
      setGuardando(false);
    }
  };

  return {
    torneo: carga.datos?.torneo,
    patrullas,
    borrador,
    editar,
    guardar,
    guardando,
    guardado,
    sinGuardar,
    error: errorDeGuardado ?? carga.error,
    recargar: carga.recargar,
    violaciones: violacionesDe(borrador),
    problema: problemaDelBorrador(borrador),
  };
}
