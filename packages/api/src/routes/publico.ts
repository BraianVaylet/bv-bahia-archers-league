/**
 * Endpoints públicos de la landing. Sin autenticación.
 *
 * **Un torneo que no está publicado NUNCA expone puntajes.** Sólo la
 * distribución de patrullas y el avance. Ver `docs/FUNCTIONAL.md` §5.3.
 */

import {
  ArcherSelfRegisterSchema,
  type ArcherStanding,
  bestNAvgPct,
  distribucionDeModalidades,
  ObjectIdSchema,
  sortStandingsByGender,
} from '@bal/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { seasons } from '../db/client.js';
import { env } from '../env.js';
import { notFound } from '../lib/errors.js';
import { toObjectId } from '../lib/ids.js';
import { publicCache } from '../middleware/cache.js';
import { parseJsonBody, parseQuery } from '../middleware/validate.js';
import * as patrolRepo from '../repositories/patrolRepo.js';
import * as standingRepo from '../repositories/standingRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';
import * as archerService from '../services/archerService.js';
import * as tarjetaService from '../services/tarjetaService.js';

const RankingQuery = z.strictObject({
  seasonId: ObjectIdSchema,
});

export const publico = new Hono()
  .use('*', publicCache({ maxAge: 60 }))

  /**
   * Autoregistro público (`BE-20`, `docs/SECURITY.md` §15).
   *
   * Nace `pendiente`: no es inscripción a nada, es un pedido de alta que un
   * admin tiene que aprobar desde WAFA (`BE-22`) antes de que sirva para algo.
   * La respuesta nunca incluye `dni` ni `registrationStatus` — ninguna ruta
   * sin sesión los devuelve, ni siquiera el del propio request.
   */
  .post('/archers', async (c) => {
    const input = await parseJsonBody(c, ArcherSelfRegisterSchema);
    const archer = await archerService.registerPublic(input);

    return c.json({
      archer: {
        id: archer.id,
        firstName: archer.firstName,
        lastName: archer.lastName,
        category: archer.category,
      },
    });
  })

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
   * Ranking de liga por categoría, en tres vistas: **General, Femenino y
   * Masculino** (`SH-10`). Cada una rankea su propia pool —no es el general
   * filtrado— así que cada una numera desde 1 y los que no llegan a `bestN`
   * torneos van en su propio `notYetEligible`, **sin ocultarse**: esconderlos
   * haría creer que se perdió su resultado. Un arquero sin `sex` cargado
   * entra al general igual que cualquiera, y a ninguna de las otras dos.
   */
  .get('/rankings', async (c) => {
    const { seasonId } = parseQuery(c, RankingQuery);
    const bestN = env().LEAGUE_BEST_N;
    const docs = await standingRepo.listBySeason(toObjectId(seasonId));
    const dominio = docs.map(standingRepo.toDomain);

    const porCategoria = new Map<string, typeof dominio>();
    for (const s of dominio) {
      const grupo = porCategoria.get(s.category);
      if (grupo) grupo.push(s);
      else porCategoria.set(s.category, [s]);
    }

    // El promedio de «mejor de N» se DERIVA al serializar y no se guarda: dos
    // copias del mismo número son dos que pueden separarse.
    const conPromedio = <T extends ArcherStanding>(s: T) => ({
      ...s,
      bestNAvgPct: bestNAvgPct(s),
    });

    return c.json({
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
        modalities: distribucionDeModalidades(t.targets.map((b) => b.modality)),
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
      // Cuánto sale entrar: lo que cualquiera quiere saber antes de anotarse, y
      // que el club publica igual en el grupo y en la puerta. Quién pagó NO
      // sale de acá: eso es del club.
      payment: torneo.payment,
      targets: torneo.targets,
      maxPossibleScore: torneo.maxPossibleScore,
      patrols: patrullas.map((p) => ({
        number: p.number,
        // El usuario, para la botonera de WAFL. **No es información nueva**:
        // es `patrulla${number}` y el número ya está acá al lado. Se manda para
        // que el cliente no repita la regla de nombrado. El PIN sigue siendo el
        // único factor y nunca sale de acá. Ver `docs/SECURITY.md` §3.
        username: p.username,
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
            // Con qué se abre la tarjeta de puntajes del arquero. Es el id de
            // la participación en este torneo, no el del arquero del padrón.
            id: m._id.toHexString(),
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

  /**
   * Los puntajes de un arquero en un torneo publicado: cada flecha de cada
   * blanco. Es a donde lleva cada fila de los resultados.
   *
   * Un torneo sin publicar responde 404, igual que su detalle: **ningún puntaje
   * sale antes de que el admin lo publique**.
   */
  .get('/tournaments/:id/participants/:participantId', async (c) => {
    const tarjeta = await tarjetaService.tarjetaDeParticipante(
      toObjectId(c.req.param('id')),
      toObjectId(c.req.param('participantId')),
    );

    return c.json({ scorecard: tarjeta });
  })

  /** Ficha histórica de un arquero. */
  .get('/archers/:id', async (c) => {
    const archerId = toObjectId(c.req.param('id'));
    const acumulados = await standingRepo.listByArcher(archerId);

    // Sin torneos publicados no hay ficha: no se filtra el padrón hacia afuera.
    if (acumulados.length === 0) throw notFound();

    const primero = acumulados[0];
    if (!primero) throw notFound();

    /**
     * La serie del gráfico de evolución.
     *
     * Sale de las participaciones —que tienen el `normalizedPct` de cada
     * torneo— cruzadas con los torneos **publicados**. Un torneo sin publicar
     * no aparece: es un endpoint público y los resultados no son oficiales
     * hasta que el admin los publica.
     */
    const participaciones = await tournamentRepo.listParticipationsOfArcher(archerId);
    const torneos = await tournamentRepo.findManyByIds(participaciones.map((p) => p.tournamentId));
    const publicados = new Map(
      torneos.filter((t) => t.status === 'publicado').map((t) => [t._id.toHexString(), t]),
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

    return c.json({
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
    });
  });
