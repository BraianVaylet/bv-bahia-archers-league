/**
 * El padrón de arqueros y sus filtros (`REF6-11` / `C-1`, `C-2`).
 *
 * La búsqueda y «ver archivados» viajan al servidor, que tiene el índice. La categoría se filtra acá,
 * sobre lo que ya llegó: el padrón entero son cientos de arqueros, ya está en memoria, y así responde
 * sin viaje.
 */

import { useCarga } from '@bal/cliente';
import type { BowCategory } from '@bal/shared';
import { useState } from 'react';
import { conSenal, cuerpo, rpc } from '../../lib/rpc.js';
import type { ArcherRow } from './tipos.js';

export function usePadron() {
  const [busqueda, setBusqueda] = useState('');
  const [verArchivados, setVerArchivados] = useState(false);
  const [verPendientes, setVerPendientes] = useState(false);
  const [categoria, setCategoria] = useState<BowCategory | ''>('');
  /** Del cliente, como la categoría: `profileIncomplete` ya viene en cada fila. */
  const [soloIncompletos, setSoloIncompletos] = useState(false);

  const carga = useCarga(
    async (signal) => {
      // Pendientes y archivados no se combinan: son dos vistas, no dos filtros que se puedan
      // pedir a la vez. Lo exige también la UI (`elegirArchivados` / `elegirPendientes`).
      const vista = verPendientes
        ? ({ status: 'pendiente' } as const)
        : verArchivados
          ? ({ archived: 'true' } as const)
          : {};
      const query = { ...vista, ...(busqueda.trim() ? { q: busqueda.trim() } : {}) };

      const r = await cuerpo(rpc.admin.archers.$get({ query }, conSenal(signal)));
      return r.archers satisfies readonly ArcherRow[] as readonly ArcherRow[];
    },
    [busqueda, verArchivados, verPendientes],
    // Es el mismo padrón con otra consulta: la lista se queda mientras llega la nueva, no parpadea
    // con cada tecla.
    { conservarDatos: true, mensajeDeError: 'No se pudo cargar el padrón. Revisá la conexión.' },
  );

  return {
    busqueda,
    setBusqueda,
    categoria,
    setCategoria,
    verArchivados,
    verPendientes,
    /** Marcar «archivados» destilda «pendientes»: son dos vistas, no dos filtros. */
    elegirArchivados: (marcado: boolean) => {
      setVerArchivados(marcado);
      if (marcado) setVerPendientes(false);
    },
    elegirPendientes: (marcado: boolean) => {
      setVerPendientes(marcado);
      if (marcado) setVerArchivados(false);
    },
    /** Todo lo que llegó, o `undefined` mientras no llegó nada. */
    arqueros: carga.datos,
    soloIncompletos,
    setSoloIncompletos,
    visibles: carga.datos?.filter(
      (a) =>
        (categoria === '' || a.category === categoria) && (!soloIncompletos || a.profileIncomplete),
    ),
    error: carga.error,
    recargar: carga.recargar,
  };
}
