/**
 * Las temporadas y el ranking de la que está elegida (`REF6-11` / `C-1`, `C-2`).
 *
 * Los mismos endpoints públicos que la landing: el admin lo mira desde acá para no cambiar de app
 * en medio de la fecha.
 */

import { useCarga } from '@bal/cliente';
import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient.js';
import type { CategoriaRankeada, Temporada } from './tipos.js';

export function useRanking() {
  const [elegida, setElegida] = useState('');

  const cargaTemporadas = useCarga(
    async (signal) => (await api.get<{ seasons: Temporada[] }>('/public/seasons', signal)).seasons,
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
      return api.get<{ bestN: number; categories: CategoriaRankeada[] }>(
        `/public/rankings?seasonId=${elegida}`,
        signal,
      );
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
