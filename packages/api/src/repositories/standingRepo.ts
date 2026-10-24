/**
 * Acceso a `standings` — el ranking de liga materializado.
 *
 * Se recalcula al publicar, no en cada visita a la landing: publicar es una
 * operación rara (una por mes) y la landing es lo que más tráfico recibe.
 * Ver `docs/ARCHITECTURE.md` §5, decisión 4.
 */

import type { ArcherStanding } from '@bal/shared';
import { type ClientSession, ObjectId } from 'mongodb';
import { standings } from '../db/client.js';
import type { StandingDoc } from '../db/types.js';

export function listBySeason(seasonId: ObjectId): Promise<StandingDoc[]> {
  return standings().find({ seasonId }).toArray();
}

/** Todo el histórico de un arquero, en todas las temporadas. */
export function listByArcher(archerId: ObjectId): Promise<StandingDoc[]> {
  return standings().find({ archerId }).sort({ updatedAt: -1 }).toArray();
}

export const toDomain = (doc: StandingDoc): ArcherStanding => ({
  archerId: doc.archerId.toHexString(),
  firstName: doc.firstName,
  lastName: doc.lastName,
  category: doc.category,
  tournamentsPlayed: doc.tournamentsPlayed,
  bestNormalizedPct: doc.bestNormalizedPct,
  bestRawScore: doc.bestRawScore,
  bestTournamentId: doc.bestTournamentId?.toHexString() ?? null,
  // Los acumulados escritos antes de «mejor de N» no tienen el campo. Se leen
  // como vacío en vez de romper; `db:reconcile` los recalcula.
  topNPcts: doc.topNPcts ?? [],
  totalX: doc.totalX,
  totalTens: doc.totalTens,
  totalM: doc.totalM,
});

/** Reemplaza el acumulado de la temporada. Dentro de la transacción de publicación. */
export async function replaceSeason(
  seasonId: ObjectId,
  nuevos: readonly ArcherStanding[],
  session: ClientSession,
): Promise<void> {
  await standings().deleteMany({ seasonId }, { session });

  if (nuevos.length === 0) return;

  await standings().insertMany(
    nuevos.map((s) => ({
      seasonId,
      category: s.category,
      archerId: new ObjectId(s.archerId),
      firstName: s.firstName,
      lastName: s.lastName,
      tournamentsPlayed: s.tournamentsPlayed,
      bestNormalizedPct: s.bestNormalizedPct,
      bestRawScore: s.bestRawScore,
      bestTournamentId: s.bestTournamentId ? new ObjectId(s.bestTournamentId) : null,
      topNPcts: [...s.topNPcts],
      totalX: s.totalX,
      totalTens: s.totalTens,
      totalM: s.totalM,
      updatedAt: new Date(),
    })) as StandingDoc[],
    { session },
  );
}
