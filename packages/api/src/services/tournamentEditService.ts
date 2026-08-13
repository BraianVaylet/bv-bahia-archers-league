/**
 * Edición de un torneo ya creado.
 *
 * La regla que manda: **un blanco en el que alguna patrulla ya cargó puntaje no
 * se puede editar ni eliminar.** Cambiarlo invalidaría puntajes ya firmados.
 * Ver `docs/FUNCTIONAL.md` §6.7.
 */

import {
  buildPatrols,
  maxPossibleScore,
  type StakeMap,
  type UpdateTournamentInput,
} from '@bal/shared';
import { ObjectId } from 'mongodb';
import { tournaments } from '../db/client.js';
import type { TargetDoc, TournamentDoc } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';
import * as archerRepo from '../repositories/archerRepo.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as scoreRepo from '../repositories/scoreRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';
import { aParticipantInput, conTransaccion, materializar } from './tournamentService.js';

/** Blancos del torneo que ya tienen al menos un puntaje cargado. */
export async function blancosBloqueados(torneo: TournamentDoc): Promise<number[]> {
  const bloqueados: number[] = [];

  for (const blanco of torneo.targets) {
    if ((await scoreRepo.countScoresOfTarget(torneo._id, blanco.index)) > 0) {
      bloqueados.push(blanco.index);
    }
  }

  return bloqueados;
}

function mismoBlanco(a: TargetDoc, b: TargetDoc | undefined): boolean {
  return (
    b !== undefined &&
    a.modality === b.modality &&
    a.arrows === b.arrows &&
    a.description === b.description
  );
}

/**
 * Actualiza el torneo.
 *
 * - `sin_iniciar`: se puede cambiar todo.
 * - `en_proceso`: sólo los blancos **sin puntajes**.
 * - `completado` y `publicado`: nada.
 *
 * @throws {AppError} `TARGET_LOCKED` si se intenta tocar un blanco ya tirado.
 */
export async function updateTournament(
  tournamentId: ObjectId,
  input: UpdateTournamentInput,
  actorId: ObjectId,
): Promise<TournamentDoc> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();

  if (torneo.status === 'completado' || torneo.status === 'publicado') {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'Un torneo cerrado no se puede editar.',
    });
  }

  const cambios: Partial<TournamentDoc> = {};
  if (input.name !== undefined) cambios.name = input.name;
  if (input.date !== undefined) cambios.date = input.date;
  if (input.description !== undefined) cambios.description = input.description;

  if (input.targets) {
    const nuevos: TargetDoc[] = input.targets.map((t) => ({
      index: t.index,
      modality: t.modality,
      arrows: t.arrows,
      description: t.description,
    }));

    if (torneo.status === 'en_proceso') {
      const bloqueados = await blancosBloqueados(torneo);
      const porIndice = new Map(nuevos.map((t) => [t.index, t]));

      for (const indice of bloqueados) {
        const antes = torneo.targets.find((t) => t.index === indice);
        // Un blanco bloqueado tiene que seguir existiendo y seguir siendo idéntico.
        if (!antes || !mismoBlanco(antes, porIndice.get(indice))) {
          throw new AppError('TARGET_LOCKED', {
            details: { targetIndex: indice },
            message: `El blanco ${indice} ya tiene puntajes cargados y no se puede modificar.`,
          });
        }
      }
    }

    cambios.targets = nuevos;
    cambios.maxPossibleScore = maxPossibleScore(nuevos);
  }

  if (input.payment) cambios.payment = { ...input.payment };

  /**
   * Cambiar quiénes participan **rearma las patrullas**.
   *
   * No es una decisión de comodidad: las patrullas se derivan de la lista de
   * arqueros y de las restricciones del dominio (`H1`-`H4`). Agregar a alguien
   * sin rehacerlas daría una patrulla de cinco o una 100% escuela, que es justo
   * lo que el algoritmo evita.
   *
   * Sólo con el torneo `sin_iniciar`. Con el torneo en marcha las patrullas ya
   * están en el monte con su PIN y su planilla impresa: rearmarlas desde el
   * escritorio dejaría al líder mirando una lista que no coincide con la gente
   * que tiene al lado.
   */
  const nuevosParticipantes =
    input.archerIds === undefined ? null : await prepararParticipantes(torneo, input.archerIds);

  if (nuevosParticipantes) {
    cambios.patrolCount = nuevosParticipantes.patrolDocs.length;
    cambios.participantCount = nuevosParticipantes.participantDocs.length;
  }

  const actualizado = await tournaments().findOneAndUpdate(
    { _id: tournamentId, status: torneo.status },
    { $set: cambios },
    { returnDocument: 'after' },
  );

  if (!actualizado) {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'El torneo cambió de estado mientras se procesaba la solicitud.',
    });
  }

  if (nuevosParticipantes) {
    const { patrolDocs, participantDocs } = nuevosParticipantes;

    // En una transacción: un torneo sin patrullas, aunque sea por un instante,
    // es un torneo que un líder no puede abrir.
    await conTransaccion(async (session) => {
      // Patrullas, participantes y puntajes, juntos: un puntaje sin dueño hace
      // que el torneo marque blancos bloqueados de arqueros que ya no existen.
      await tournamentRepo.clearDistribution(tournamentId, session);
      await tournamentRepo.insertPatrols(patrolDocs, session);
      await tournamentRepo.insertParticipants(participantDocs, session);

      await auditRepo.record(
        {
          actorType: 'admin',
          actorId,
          action: 'tournament.participants_edit',
          entity: 'tournament',
          entityId: tournamentId,
          meta: { participants: participantDocs.length, patrols: patrolDocs.length },
        },
        session,
      );
    });
  }

  if (cambios.targets) {
    await auditRepo.record({
      actorType: 'admin',
      actorId,
      action: 'tournament.target_edit',
      entity: 'tournament',
      entityId: tournamentId,
      meta: { targets: cambios.targets.length, maxPossibleScore: cambios.maxPossibleScore },
    });
  }

  return actualizado;
}

/** Elimina un torneo. Sólo si nunca arrancó. */
export async function removeTournament(tournamentId: ObjectId): Promise<void> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();

  if (torneo.status !== 'sin_iniciar') {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'Sólo se puede eliminar un torneo que todavía no arrancó.',
    });
  }

  await tournamentRepo.remove(tournamentId);
}

/**
 * Valida la lista de arqueros y arma las patrullas nuevas.
 *
 * Las mismas dos comprobaciones que al crear el torneo —que existan y que
 * ninguno esté archivado—: si estuvieran sólo en la creación, se podría meter
 * un archivado por la puerta de la edición.
 */
async function prepararParticipantes(torneo: TournamentDoc, archerIds: readonly string[]) {
  if (torneo.status !== 'sin_iniciar') {
    throw new AppError('INVALID_STATE_TRANSITION', {
      message: 'Los participantes sólo se pueden cambiar antes de iniciar el torneo.',
    });
  }

  const ids = archerIds.map((id) => new ObjectId(id));
  const arqueros = await archerRepo.findManyByIds(ids);

  if (arqueros.length !== ids.length) {
    throw new AppError('NOT_FOUND', { message: 'Alguno de los arqueros no existe.' });
  }

  const archivados = arqueros.filter((a) => a.archivedAt !== null);
  if (archivados.length > 0) {
    throw new AppError('VALIDATION_ERROR', {
      message: 'No se puede inscribir a un arquero archivado.',
      details: { archerIds: archivados.map((a) => a._id.toHexString()) },
    });
  }

  const stakeMap: StakeMap = torneo.stakeMap;
  const plan = buildPatrols(aParticipantInput(arqueros), stakeMap, torneo.targets.length);

  return materializar(plan, torneo._id, new Date());
}
