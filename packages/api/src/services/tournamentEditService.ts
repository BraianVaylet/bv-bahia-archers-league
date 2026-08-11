/**
 * Edición de un torneo ya creado.
 *
 * La regla que manda: **un blanco en el que alguna patrulla ya cargó puntaje no
 * se puede editar ni eliminar.** Cambiarlo invalidaría puntajes ya firmados.
 * Ver `docs/FUNCTIONAL.md` §6.7.
 */

import { maxPossibleScore, type UpdateTournamentInput } from '@bal/shared';
import type { ObjectId } from 'mongodb';
import { tournaments } from '../db/client.js';
import type { TargetDoc, TournamentDoc } from '../db/types.js';
import { AppError, notFound } from '../lib/errors.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as scoreRepo from '../repositories/scoreRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';

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
