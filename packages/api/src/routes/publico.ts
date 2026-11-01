/**
 * Endpoints públicos de la landing. Sin autenticación.
 *
 * **Un torneo que no está publicado NUNCA expone puntajes.** Sólo la
 * distribución de patrullas y el avance. Ver `docs/FUNCTIONAL.md` §5.3.
 */

import { ArcherSelfRegisterSchema, ObjectIdSchema } from '@bal/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { toObjectId } from '../lib/ids.js';
import { publicCache } from '../middleware/cache.js';
import { parseJsonBody, parseQuery } from '../middleware/validate.js';
import * as archerService from '../services/archerService.js';
import * as rankingService from '../services/rankingService.js';
import * as seasonService from '../services/seasonService.js';
import * as tarjetaService from '../services/tarjetaService.js';
import * as tournamentQueryService from '../services/tournamentQueryService.js';

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
    return c.json({ archer: await archerService.registerPublic(input) });
  })

  .get('/seasons', async (c) => c.json({ seasons: await seasonService.listar() }))

  /**
   * Ranking de liga por categoría, en tres vistas: General, Femenino y Masculino
   * (`SH-10`). El armado vive en `rankingService`.
   */
  .get('/rankings', async (c) => {
    const { seasonId } = parseQuery(c, RankingQuery);
    return c.json(await rankingService.rankingDeTemporada(toObjectId(seasonId)));
  })

  .get('/tournaments', async (c) => c.json(await tournamentQueryService.listadoPublico()))

  .get('/tournaments/:id', async (c) =>
    c.json(await tournamentQueryService.detallePublico(toObjectId(c.req.param('id')))),
  )
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

  /** Ficha histórica de un arquero. Sin torneos publicados no hay ficha (404). */
  .get('/archers/:id', async (c) =>
    c.json(await rankingService.fichaDeArquero(toObjectId(c.req.param('id')))),
  );
