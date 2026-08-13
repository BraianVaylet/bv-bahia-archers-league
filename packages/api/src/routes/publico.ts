/**
 * Endpoints públicos de la landing. Sin autenticación.
 *
 * **Un torneo que no está publicado NUNCA expone puntajes.** Sólo la
 * distribución de patrullas y el avance. Ver `docs/FUNCTIONAL.md` §5.3.
 */

import { type ArcherStanding, bestTwoAvgPct, ObjectIdSchema, sortStandings } from '@bal/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { seasons } from '../db/client.js';
import { notFound } from '../lib/errors.js';
import { toObjectId } from '../lib/ids.js';
import { publicCache } from '../middleware/cache.js';
import { parseQuery } from '../middleware/validate.js';
import * as patrolRepo from '../repositories/patrolRepo.js';
import * as standingRepo from '../repositories/standingRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';

const RankingQuery = z.strictObject({
  seasonId: ObjectIdSchema,
  mode: z.enum(['position', 'best_two']).default('position'),
});

export const publico = new Hono()
  .use('*', publicCache({ maxAge: 60 }))

  .get('/seasons', async (c) => {
    const docs = await seasons().find({}).sort({ startsAt: -1 }).toArray();
    return c.json({
      seasons: docs.map((s) => ({
        id: s._id.toHexString(),
        name: s.name,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
      })),
    });
  })

  /**
   * Ranking de liga por categoría.
   *
   * Los que no llegan al mínimo de torneos vienen en `notYetEligible`, **no se
   * ocultan**: esconderlos haría creer que se perdió su resultado.
   */
  .get('/rankings', async (c) => {
    const { seasonId, mode } = parseQuery(c, RankingQuery);
    const docs = await standingRepo.listBySeason(toObjectId(seasonId));
    const dominio = docs.map(standingRepo.toDomain);

    const porCategoria = new Map<string, typeof dominio>();
    for (const s of dominio) {
      const grupo = porCategoria.get(s.category);
      if (grupo) grupo.push(s);
      else porCategoria.set(s.category, [s]);
    }

    // El promedio de «mejor de 2» se DERIVA al serializar y no se guarda: dos
    // copias del mismo número son dos que pueden separarse.
    const conPromedio = <T extends ArcherStanding>(s: T) => ({
      ...s,
      bestTwoAvgPct: bestTwoAvgPct(s),
    });

    return c.json({
      mode,
      categories: [...porCategoria.entries()].map(([category, entradas]) => {
        const { ranked, notYetEligible } = sortStandings(entradas, mode);
        return {
          category,
          ranked: ranked.map(conPromedio),
          notYetEligible: notYetEligible.map(conPromedio),
        };
      }),
    });
  })

  .get('/tournaments', async (c) => {
    // Sólo publicados y en proceso: un torneo sin iniciar no le importa a nadie
    // desde afuera, y uno completado sin publicar todavía no es oficial.
    const docs = (await tournamentRepo.list()).filter(
      (t) => t.status === 'publicado' || t.status === 'en_proceso',
    );

    return c.json({
      tournaments: docs.map((t) => ({
        id: t._id.toHexString(),
        name: t.name,
        date: t.date,
        status: t.status,
        targetCount: t.targets.length,
        participantCount: t.participantCount,
      })),
    });
  })

  .get('/tournaments/:id', async (c) => {
    const torneo = await tournamentRepo.findById(toObjectId(c.req.param('id')));
    if (!torneo || torneo.status === 'sin_iniciar' || torneo.status === 'completado') {
      throw notFound();
    }

    const [miembros, patrullas] = await Promise.all([
      tournamentRepo.listParticipants(torneo._id),
      patrolRepo.listByTournament(torneo._id),
    ]);

    const base = {
      id: torneo._id.toHexString(),
      name: torneo.name,
      date: torneo.date,
      description: torneo.description,
      status: torneo.status,
      targets: torneo.targets,
      maxPossibleScore: torneo.maxPossibleScore,
      patrols: patrullas.map((p) => ({
        number: p.number,
        startTargetIndex: p.startTargetIndex,
        status: p.status,
        targetsCompleted: p.targetsCompleted,
        members: miembros
          .filter((m) => m.patrolId.equals(p._id))
          .map((m) => ({
            firstName: m.firstName,
            lastName: m.lastName,
            category: m.category,
            stake: m.stake,
            unit: m.unit,
          })),
      })),
    };

    // En proceso: distribución y avance, PERO NINGÚN puntaje.
    if (torneo.status !== 'publicado') {
      return c.json({ tournament: base });
    }

    return c.json({
      tournament: {
        ...base,
        results: miembros
          .filter((m) => m.status === 'activo')
          .map((m) => ({
            firstName: m.firstName,
            lastName: m.lastName,
            category: m.category,
            total: m.total,
            normalizedPct: m.normalizedPct,
            innerCount: m.innerCount,
            xCount: m.xCount,
            tenCount: m.tenCount,
            mCount: m.mCount,
          })),
      },
    });
  })

  /** Ficha histórica de un arquero. */
  .get('/archers/:id', async (c) => {
    const archerId = toObjectId(c.req.param('id'));
    const acumulados = await standingRepo.listByArcher(archerId);

    // Sin torneos publicados no hay ficha: no se filtra el padrón hacia afuera.
    if (acumulados.length === 0) throw notFound();

    const primero = acumulados[0];
    if (!primero) throw notFound();

    return c.json({
      archer: {
        id: archerId.toHexString(),
        firstName: primero.firstName,
        lastName: primero.lastName,
        seasons: acumulados.map((s) => ({
          seasonId: s.seasonId.toHexString(),
          category: s.category,
          leaguePoints: s.leaguePoints,
          tournamentsPlayed: s.tournamentsPlayed,
          podiums: s.podiums,
          bestNormalizedPct: s.bestNormalizedPct,
          bestRawScore: s.bestRawScore,
          bestTwoAvgPct: bestTwoAvgPct(standingRepo.toDomain(s)),
          totalX: s.totalX,
          totalTens: s.totalTens,
          totalM: s.totalM,
        })),
      },
    });
  });
