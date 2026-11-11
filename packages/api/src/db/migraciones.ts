/**
 * Migraciones de datos que corren al arrancar el servidor.
 *
 * Cada una es **idempotente**: corre en cada arranque y, si no hay nada que
 * migrar, no toca nada. Así no hace falta acordarse de correrla a mano antes
 * del deploy, y un servidor nuevo nunca levanta contra datos que no entiende.
 */

import { STAKES } from '@bal/shared';
import type { Db } from 'mongodb';
import { COLLECTIONS } from './types.js';

export interface ResultadoDeMigracion {
  readonly archers: number;
  readonly participants: number;
  readonly standings: number;
  readonly tournaments: number;
}

const CLAVE_VIEJA = 'razo';
const CLAVE_NUEVA = 'raso';

/**
 * Renombra la categoría `razo` → `raso` (2026-11-11).
 *
 * La categoría es la clave que se guarda, no sólo la etiqueta. Un documento que
 * quedara con la clave vieja rompe la UI (`CATEGORY_INFO['razo']` no existe) y
 * desaparece en silencio de podios y rankings, que agrupan por `BOW_CATEGORIES`.
 *
 * Toca los cuatro lugares donde se guarda una categoría: el padrón, el snapshot
 * de cada participante, la liga materializada y el mapa de estacas de cada
 * torneo. El `auditLog` **no** se toca: es un registro histórico y se lee como
 * texto, nunca se agrupa por categoría.
 *
 * Los índices únicos que incluyen `category` (`uk_dni_category`,
 * `uk_temporada_archer`) no pueden chocar: antes de esta migración `raso` no
 * existía como clave.
 */
export async function migrarCategoriaRazoARaso(db: Db): Promise<ResultadoDeMigracion> {
  const renombrarCategoria = async (nombre: string) => {
    const r = await db
      .collection(nombre)
      .updateMany({ category: CLAVE_VIEJA }, { $set: { category: CLAVE_NUEVA } });
    return r.modifiedCount;
  };

  const archers = await renombrarCategoria(COLLECTIONS.archers);
  const participants = await renombrarCategoria(COLLECTIONS.participants);
  const standings = await renombrarCategoria(COLLECTIONS.standings);

  // Un mismo torneo puede tener la clave vieja en más de una estaca (el mapa es
  // editable). No se usa `stakeMap.<estaca>.$[c]`: un torneo viejo puede no
  // tener todas las estacas en el mapa, y Mongo rechaza el update entero si la
  // ruta no existe —lo que tumbaría el arranque—. El pipeline recorre las
  // estacas que el documento sí tiene.
  const r = await db
    .collection(COLLECTIONS.tournaments)
    .updateMany({ $or: STAKES.map((s) => ({ [`stakeMap.${s}`]: CLAVE_VIEJA })) }, [
      {
        $set: {
          stakeMap: {
            $arrayToObject: {
              $map: {
                input: { $objectToArray: '$stakeMap' },
                as: 'e',
                in: {
                  k: '$$e.k',
                  v: {
                    $map: {
                      input: '$$e.v',
                      as: 'c',
                      in: { $cond: [{ $eq: ['$$c', CLAVE_VIEJA] }, CLAVE_NUEVA, '$$c'] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ]);

  return { archers, participants, standings, tournaments: r.modifiedCount };
}
