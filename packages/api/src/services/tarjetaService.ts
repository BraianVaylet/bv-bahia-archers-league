/**
 * Tarjeta de puntajes de un arquero, para la landing.
 *
 * Orquesta: lee, valida que se pueda mostrar y serializa. **La cuenta no se
 * hace acá**: el valor de cada flecha y los totales los deriva
 * `armarTarjetaDePuntajes`, en `@bal/shared`.
 *
 * Ver `docs/FUNCTIONAL.md` §5.3.
 */

import { armarTarjetaDePuntajes } from '@bal/shared';
import type { ObjectId } from 'mongodb';
import { notFound } from '../lib/errors.js';
import * as scoreRepo from '../repositories/scoreRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';

/**
 * @throws {AppError} `NOT_FOUND` en cualquiera de estos casos, **sin
 *   distinguirlos**: el torneo no existe o no está publicado, el participante no
 *   existe, es de otro torneo o estuvo ausente. Distinguirlos le diría a quien
 *   sondea qué ids existen. Un torneo sin publicar no expone ningún puntaje.
 */
export async function tarjetaDeParticipante(tournamentId: ObjectId, participantId: ObjectId) {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (torneo?.status !== 'publicado') throw notFound();

  const participante = await scoreRepo.findParticipant(participantId);
  if (!participante?.tournamentId.equals(torneo._id) || participante.status !== 'activo') {
    throw notFound();
  }

  const puntajes = await scoreRepo.listScoresOfParticipant(participante._id);
  const tarjeta = armarTarjetaDePuntajes(torneo.targets, puntajes);

  // Lista blanca, campo por campo: el participante tiene la firma, si pagó y el
  // `archerId`, y nada de eso sale por una ruta sin sesión.
  return {
    tournament: {
      id: torneo._id.toHexString(),
      name: torneo.name,
      date: torneo.date,
    },
    archer: {
      firstName: participante.firstName,
      lastName: participante.lastName,
      category: participante.category,
      stake: participante.stake,
    },
    total: tarjeta.total,
    maxTotal: tarjeta.maxTotal,
    normalizedPct: participante.normalizedPct,
    innerCount: participante.innerCount,
    xCount: participante.xCount,
    tenCount: participante.tenCount,
    mCount: participante.mCount,
    rows: tarjeta.rows,
  };
}
