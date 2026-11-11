/**
 * Corrección de puntajes por el admin, contra la planilla de papel (`BE-25`).
 *
 * La planilla de papel es la fuente de verdad; la app es la que registra el ranking. Cuando no
 * coinciden, el admin corrige la app **antes de publicar** (decisión 2 de la Fase 9: sólo con el
 * torneo `completado`; un publicado se despublica primero).
 *
 * Es el único camino, además del sync de WAFL, que escribe un puntaje, y sigue sus mismas reglas:
 *
 * - **El servidor es la autoridad** (regla 1): llegan tokens; los valores y los totales los deriva
 *   `validateTargetScore` con la modalidad **de ese blanco**, leída del torneo en base.
 * - **El mismo camino de escritura** que el sync (`escribirPuntaje`): documento y delta de los
 *   rollups en una transacción.
 * - **La firma no se borra** (decisión 3): vale la del papel. El audit log anota que la corrección
 *   fue después de firmar.
 *
 * Ver `docs/FUNCTIONAL.md` §6.7.
 */

import {
  armarTarjetaDePuntajes,
  CampoNoEditableError,
  exigirEditables,
  type ScoreCorrectionInput,
  validateTargetScore,
} from '@bal/shared';
import type { ObjectId } from 'mongodb';
import type { TournamentDoc } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as scoreRepo from '../repositories/scoreRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';
import { escribirPuntaje } from './escrituraDePuntaje.js';
import { recalcularAvanceDePatrulla } from './syncService.js';
import { conTransaccion } from './tournamentService.js';

const noEditable = () =>
  new AppError('FIELD_NOT_EDITABLE', {
    message: 'Los puntajes sólo se corrigen con el torneo esperando publicación.',
    details: { campos: ['scores'] },
  });

/** Los puntajes se corrigen sólo en el estado que dice `camposEditables` (`SH-11`). */
function exigirCorregible(torneo: TournamentDoc): void {
  try {
    exigirEditables(torneo.status, ['scores']);
  } catch (err) {
    if (err instanceof CampoNoEditableError) throw noEditable();
    throw err;
  }
}

/**
 * Reemplaza las flechas de un participante en un blanco.
 *
 * @throws {AppError} `NOT_FOUND` si el torneo, el participante (o es de otro torneo) o el blanco
 *   no existen.
 * @throws {AppError} `FIELD_NOT_EDITABLE` si el torneo no está esperando publicación, o dejó de
 *   estarlo mientras se corregía.
 * @throws {AppError} `INVALID_STATE_TRANSITION` si el arquero estuvo ausente.
 * @throws {AppError} `INVALID_TOKEN` / `ARROW_COUNT` si las flechas no valen para ese blanco.
 */
export async function corregirPuntaje(
  tournamentId: ObjectId,
  participantId: ObjectId,
  targetIndex: number,
  input: ScoreCorrectionInput,
  actorId: ObjectId,
) {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();
  exigirCorregible(torneo);

  const participante = await scoreRepo.findParticipant(participantId);
  if (!participante?.tournamentId.equals(torneo._id)) throw notFound();
  if (participante.status !== 'activo') {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'El arquero estuvo ausente: no tiene puntajes que corregir.',
    });
  }

  const blanco = torneo.targets.find((t) => t.index === targetIndex);
  if (!blanco) throw notFound();

  // Contra la modalidad DEL BLANCO, leída del torneo en base. Nunca contra una lista fija.
  const validacion = validateTargetScore(blanco.modality, blanco.arrows, input.arrows);
  if (!validacion.ok) {
    const { error } = validacion;
    throw new AppError(error.code, {
      message:
        error.code === 'ARROW_COUNT'
          ? `Este blanco es de ${error.expected} flechas y llegaron ${error.got}.`
          : `El puntaje "${error.token}" no es válido para un blanco de ${blanco.modality}.`,
    });
  }

  const ahora = new Date();
  const resultado = await conTransaccion(async (session) => {
    /*
      El ancla: escribir el torneo condicionado a `completado`. Si alguien publicó entre la
      lectura de arriba y acá, no matchea y se corta; si publica mientras esta transacción
      corre, las dos escriben el mismo documento y una choca (`WriteConflict`) y se reintenta.
      Sin esto, una corrección podía caer sobre un torneo ya publicado sin recalcular el ranking.
    */
    const anclado = await tournamentRepo.updateIfStatus(
      torneo._id,
      'completado',
      { lastCorrectedAt: ahora },
      session,
    );
    if (!anclado) throw noEditable();

    // Releído en la transacción: el delta de los rollups parte del total vigente.
    const vigente = await scoreRepo.findParticipant(participante._id, session);
    if (!vigente) throw notFound();
    const existente = await scoreRepo.findScore(vigente._id, targetIndex, session);

    await escribirPuntaje(
      {
        torneo: anclado,
        participante: vigente,
        blanco,
        arrows: input.arrows,
        computo: validacion.value,
        existente,
        clientUpdatedAt: ahora,
        lastOpId: `admin:${actorId.toHexString()}:${ahora.getTime()}`,
        correccion: { correctedBy: actorId, correctedAt: ahora },
      },
      session,
    );

    /*
      La firma no se borra (decisión 3), pero su hash se recalcula con el puntaje corregido y queda
      marcada. Sin esto, publicar la rechazaba como «cambió después de firmar» (`SIGNATURE_MISMATCH`)
      y la corrección trababa justo el caso para el que existe. Un cambio que NO pase por acá sigue
      sin coincidir con el hash y traba la publicación, como antes (encontrado con `TEST-4`).
    */
    if (vigente.signature) {
      const conElTotalNuevo = await scoreRepo.findParticipant(vigente._id, session);
      if (conElTotalNuevo) {
        await scoreRepo.setSignature(
          vigente._id,
          {
            ...vigente.signature,
            scorecardHash: await scoreRepo.scorecardHashOf(conElTotalNuevo, session),
            correctedBy: actorId,
            correctedAt: ahora,
          },
          session,
        );
      }
    }

    await auditRepo.record(
      {
        actorType: 'admin',
        actorId,
        action: 'score.admin_correct',
        entity: 'participant',
        entityId: vigente._id,
        meta: {
          tournamentId: torneo._id.toHexString(),
          targetIndex,
          before: existente?.arrows ?? null,
          after: [...input.arrows],
          reason: input.reason,
          // Decisión 3: la firma no se borra; queda dicho que la corrección fue después.
          despuesDeFirmar: vigente.signature !== null,
        },
      },
      session,
    );

    return { participantId: vigente._id };
  });

  // Un blanco que estaba vacío cambia el avance de la patrulla. Fuera de la transacción, igual que
  // en el sync: tiene la suya.
  await recalcularAvanceDePatrulla(participante.patrolId);

  const actualizado = await scoreRepo.findParticipant(resultado.participantId);

  return {
    score: {
      targetIndex,
      arrows: [...input.arrows],
      total: validacion.value.total,
      correctedAt: ahora,
    },
    participant: {
      id: participante._id.toHexString(),
      total: actualizado?.total ?? 0,
      normalizedPct: actualizado?.normalizedPct ?? 0,
      targetsCompleted: actualizado?.targetsCompleted ?? 0,
    },
  };
}

/**
 * La tarjeta de un arquero para el admin: cada flecha de cada blanco, en cualquier estado del
 * torneo, con los blancos corregidos marcados. Es lo que `FE-34` pone al lado de la planilla.
 *
 * A diferencia de la pública (`tarjetaService`), no exige `publicado`: el admin revisa justo antes
 * de publicar. Sigue sin sacar la firma ni el pago.
 *
 * @throws {AppError} `NOT_FOUND` si el torneo o el participante no existen, o es de otro torneo.
 */
export async function tarjetaParaAdmin(tournamentId: ObjectId, participantId: ObjectId) {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();

  const participante = await scoreRepo.findParticipant(participantId);
  if (!participante?.tournamentId.equals(torneo._id)) throw notFound();

  const puntajes = await scoreRepo.listScoresOfParticipant(participante._id);
  const tarjeta = armarTarjetaDePuntajes(torneo.targets, puntajes);

  return {
    archer: {
      id: participante._id.toHexString(),
      firstName: participante.firstName,
      lastName: participante.lastName,
      category: participante.category,
      stake: participante.stake,
      status: participante.status,
      signed: participante.signature !== null,
    },
    total: tarjeta.total,
    maxTotal: tarjeta.maxTotal,
    rows: tarjeta.rows,
    corrected: puntajes
      .filter((s) => s.correctedAt)
      .map((s) => s.targetIndex)
      .sort((a, b) => a - b),
  };
}
