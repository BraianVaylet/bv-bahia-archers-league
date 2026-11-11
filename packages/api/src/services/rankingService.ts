/**
 * Lo que la landing muestra de la liga: el ranking de una temporada y la ficha de un
 * arquero.
 *
 * Vivía en `routes/publico.ts` (`REF6-10` / `B-1`): la ruta agrupaba, ordenaba y derivaba
 * el promedio de «mejor de N» con repositorios en la mano. Es lógica de presentación del
 * dominio, y la ruta sólo debería validar la entrada y serializar.
 *
 * Las reglas del ranking (`sortStandingsByGender`, `bestNAvgPct`) siguen siendo de
 * `@bal/shared`: acá se las orquesta, no se las decide (regla 2).
 */

import {
  type ArcherStanding,
  type BowCategory,
  bestNAvgPct,
  resultadosVisibles,
  sortStandingsByGender,
} from '@bal/shared';
import type { ObjectId } from 'mongodb';
import { env } from '../env.js';
import { notFound } from '../lib/errors.js';
import * as standingRepo from '../repositories/standingRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';

/**
 * Ranking de liga por categoría, en tres vistas: **General, Femenino y Masculino**
 * (`SH-10`). Cada una rankea su propia pool —no es el general filtrado— así que cada una
 * numera desde 1 y los que no llegan a `bestN` torneos van en su propio `notYetEligible`,
 * **sin ocultarse**: esconderlos haría creer que se perdió su resultado. Un arquero sin
 * `sex` cargado entra al general igual que cualquiera, y a ninguna de las otras dos.
 */
export async function rankingDeTemporada(seasonId: ObjectId) {
  const bestN = env().LEAGUE_BEST_N;
  const docs = await standingRepo.listBySeason(seasonId);
  const dominio = docs.map(standingRepo.toDomain);

  const porCategoria = new Map<BowCategory, typeof dominio>();
  for (const s of dominio) {
    const grupo = porCategoria.get(s.category);
    if (grupo) grupo.push(s);
    else porCategoria.set(s.category, [s]);
  }

  // El promedio de «mejor de N» se DERIVA al serializar y no se guarda: dos copias del
  // mismo número son dos que pueden separarse.
  const conPromedio = <T extends ArcherStanding>(s: T) => ({
    ...s,
    bestNAvgPct: bestNAvgPct(s),
  });

  return {
    // El front nunca escribe «2» (ni ningún N) en un texto: lo lee de acá.
    bestN,
    categories: [...porCategoria.entries()].map(([category, entradas]) => {
      const { general, femenino, masculino } = sortStandingsByGender(entradas, bestN);
      const vista = (v: typeof general) => ({
        ranked: v.ranked.map(conPromedio),
        notYetEligible: v.notYetEligible.map(conPromedio),
      });

      return {
        category,
        general: vista(general),
        femenino: vista(femenino),
        masculino: vista(masculino),
      };
    }),
  };
}

/**
 * Ficha histórica de un arquero.
 *
 * Sin torneos publicados no hay ficha: no se filtra el padrón hacia afuera.
 *
 * @throws {AppError} `NOT_FOUND` si el arquero no tiene ningún torneo publicado.
 */
export async function fichaDeArquero(archerId: ObjectId) {
  const acumulados = await standingRepo.listByArcher(archerId);
  const primero = acumulados[0];
  if (!primero) throw notFound();

  /**
   * La serie del gráfico de evolución.
   *
   * Sale de las participaciones —que tienen el `normalizedPct` de cada torneo— cruzadas con
   * los torneos **publicados**. Un torneo sin publicar no aparece: es un endpoint público y
   * los resultados no son oficiales hasta que el admin los publica.
   */
  const participaciones = await tournamentRepo.listParticipationsOfArcher(archerId);
  const torneos = await tournamentRepo.findManyByIds(participaciones.map((p) => p.tournamentId));
  const publicados = new Map(
    // Los que se ven: publicados y no archivados (`BE-26`), la misma regla que el detalle.
    torneos.filter((t) => resultadosVisibles(t)).map((t) => [t._id.toHexString(), t]),
  );

  const history = participaciones
    .flatMap((p) => {
      const torneo = publicados.get(p.tournamentId.toHexString());
      if (!torneo) return [];

      return [
        {
          tournamentId: torneo._id.toHexString(),
          name: torneo.name,
          date: torneo.date,
          seasonId: torneo.seasonId.toHexString(),
          normalizedPct: p.normalizedPct,
          total: p.total,
        },
      ];
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    archer: {
      id: archerId.toHexString(),
      firstName: primero.firstName,
      lastName: primero.lastName,
      history,
      seasons: acumulados.map((s) => ({
        seasonId: s.seasonId.toHexString(),
        category: s.category,
        tournamentsPlayed: s.tournamentsPlayed,
        bestNormalizedPct: s.bestNormalizedPct,
        bestRawScore: s.bestRawScore,
        bestNAvgPct: bestNAvgPct(standingRepo.toDomain(s)),
        totalX: s.totalX,
        totalTens: s.totalTens,
        totalM: s.totalM,
      })),
    },
  };
}
