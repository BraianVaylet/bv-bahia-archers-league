/**
 * Las temporadas y el ranking de la que está elegida (`REF6-11` / `C-1`, `C-2`).
 *
 * Los mismos endpoints públicos que la landing: el admin lo mira desde acá para no cambiar de app
 * en medio de la fecha.
 */

import { useCarga } from '@bal/cliente';
import { useEffect, useState } from 'react';
import { conSenal, cuerpo, rpc } from '../../lib/rpc.js';

export function useRanking() {
  const [elegida, setElegida] = useState('');

  const cargaTemporadas = useCarga(
    async (signal) => (await cuerpo(rpc.publico.seasons.$get(undefined, conSenal(signal)))).seasons,
    [],
  );

  // Si la carga falla se ve como «no hay temporadas», igual que antes de `useCarga`.
  const temporadas =
    cargaTemporadas.datos ?? (cargaTemporadas.error === undefined ? undefined : []);

  // La primera es la más reciente: el servidor las ordena por fecha.
  useEffect(() => {
    if (cargaTemporadas.datos) setElegida(cargaTemporadas.datos[0]?.id ?? '');
  }, [cargaTemporadas.datos]);

  const cargaRanking = useCarga(
    async (signal) => {
      if (!elegida) return null;
      return cuerpo(rpc.publico.rankings.$get({ query: { seasonId: elegida } }, conSenal(signal)));
    },
    [elegida],
    // Cambiar de temporada es el mismo ranking con otra consulta: no se vacía mientras llega.
    { conservarDatos: true, mensajeDeError: 'No se pudo cargar el ranking. Revisá la conexión.' },
  );

  return {
    temporadas,
    elegida,
    setElegida,
    bestN: cargaRanking.datos?.bestN ?? 2,
    categorias: cargaRanking.datos?.categories,
    error: cargaRanking.error,
  };
}
