/**
 * Acceso a `archers`.
 *
 * Ninguna consulta a MongoDB vive fuera de `repositories/`.
 */

import type { ArcherInput } from '@bal/shared';
import type { ObjectId } from 'mongodb';
import { archers, participants } from '../db/client.js';
import type { ArcherDoc, ArcherRegistrationStatus } from '../db/types.js';
import { searchKey } from '../lib/crypto.js';
import { AppError } from '../lib/errors.js';

export interface ListOptions {
  readonly archived?: boolean;
  /** Texto libre. Se normaliza igual que `searchKey` antes de buscar. */
  readonly query?: string;
  /**
   * Sin esto, la lista **excluye** `pendiente`: es la que alimenta el wizard
   * de torneo (`FE-11`), y un arquero sin aprobar no se puede sumar a uno.
   * `BE-22` pide `'pendiente'` explícito para su cola de aprobación.
   */
  readonly status?: ArcherRegistrationStatus;
}

export function list(options: ListOptions = {}): Promise<ArcherDoc[]> {
  const filtro: Record<string, unknown> = {
    archivedAt: options.archived ? { $ne: null } : null,
    registrationStatus: options.status ?? 'aprobado',
  };

  if (options.query) {
    // `escapeRegExp` no hace falta porque se escapan todos los metacaracteres:
    // el término viene del usuario y una regex maliciosa es un vector de ReDoS.
    const termino = searchKey(options.query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Por nombre o por DNI (`FE-29`): el mismo término, sin que el admin tenga
    // que elegir en qué campo busca. `$regex` sobre `dni` no explota con los
    // documentos viejos en `null` — simplemente no matchea, no es un string.
    filtro.$or = [{ searchKey: { $regex: termino } }, { dni: { $regex: termino } }];
  }

  return archers().find(filtro).sort({ lastName: 1, firstName: 1 }).limit(500).toArray();
}

export function findById(id: ObjectId): Promise<ArcherDoc | null> {
  return archers().findOne({ _id: id });
}

export function findManyByIds(ids: readonly ObjectId[]): Promise<ArcherDoc[]> {
  return archers()
    .find({ _id: { $in: [...ids] } })
    .toArray();
}

/**
 * Crea un arquero.
 *
 * `registrationStatus` por defecto es `'aprobado'`: un arquero creado por el
 * admin lo vale de entrada. El autoregistro público (`BE-20`) pasa
 * `'pendiente'` explícito.
 *
 * @throws {AppError} `ARCHER_DNI_DUPLICATE` si el DNI ya está en uso.
 */
export async function create(
  input: ArcherInput,
  registrationStatus: ArcherRegistrationStatus = 'aprobado',
): Promise<ArcherDoc> {
  const ahora = new Date();
  const doc = {
    firstName: input.firstName,
    lastName: input.lastName,
    category: input.category,
    sex: input.sex,
    dni: input.dni,
    registrationStatus,
    searchKey: searchKey(input.lastName, input.firstName),
    archivedAt: null,
    createdAt: ahora,
    updatedAt: ahora,
  } as ArcherDoc;

  try {
    const { insertedId } = await archers().insertOne(doc);
    return { ...doc, _id: insertedId };
  } catch (error) {
    // Dedup por el índice único parcial de `dni`: sin `findOne` previo, igual
    // que el resto de los índices únicos de este proyecto.
    if (error instanceof Error && error.message.includes('E11000')) {
      throw new AppError('ARCHER_DNI_DUPLICATE');
    }
    throw error;
  }
}

export async function update(id: ObjectId, input: ArcherInput): Promise<ArcherDoc | null> {
  try {
    return await archers().findOneAndUpdate(
      { _id: id },
      {
        $set: {
          firstName: input.firstName,
          lastName: input.lastName,
          category: input.category,
          sex: input.sex,
          dni: input.dni,
          searchKey: searchKey(input.lastName, input.firstName),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('E11000')) {
      throw new AppError('ARCHER_DNI_DUPLICATE');
    }
    throw error;
  }
}

/** `pendiente` → `aprobado` (`BE-22`). Idempotente: aprobar uno ya aprobado no hace nada raro. */
export async function approve(id: ObjectId): Promise<ArcherDoc | null> {
  return archers().findOneAndUpdate(
    { _id: id },
    { $set: { registrationStatus: 'aprobado', updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

export async function setArchived(id: ObjectId, archived: boolean): Promise<ArcherDoc | null> {
  return archers().findOneAndUpdate(
    { _id: id },
    { $set: { archivedAt: archived ? new Date() : null, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
}

export async function remove(id: ObjectId): Promise<boolean> {
  const r = await archers().deleteOne({ _id: id });
  return r.deletedCount === 1;
}

/**
 * `true` si el arquero participó de algún torneo.
 *
 * Es lo que impide borrarlo: su histórico y su lugar en los rankings dependen
 * de que siga existiendo. Ver `docs/FUNCTIONAL.md` §6.4.
 */
export async function hasParticipated(id: ObjectId): Promise<boolean> {
  return (await participants().countDocuments({ archerId: id }, { limit: 1 })) > 0;
}

/**
 * En cuántos torneos **distintos** participó cada uno de los ids dados.
 *
 * Una sola consulta para todo el padrón: preguntar uno por uno sería una
 * consulta por arquero cada vez que se abre la pantalla.
 *
 * Se cuentan torneos y no participaciones. Un arquero repetido en el mismo
 * torneo sólo puede venir de un bug, pero un número que sume dos veces la
 * misma fecha no significa nada para el admin.
 *
 * @returns un mapa `archerId` → cantidad. Los que no participaron no aparecen.
 */
export async function tournamentCounts(ids: readonly ObjectId[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();

  const filas = await participants()
    .aggregate<{ _id: ObjectId; torneos: number }>([
      { $match: { archerId: { $in: [...ids] } } },
      { $group: { _id: '$archerId', torneos: { $addToSet: '$tournamentId' } } },
      { $project: { torneos: { $size: '$torneos' } } },
    ])
    .toArray();

  return new Map(filas.map((f) => [f._id.toHexString(), f.torneos]));
}
