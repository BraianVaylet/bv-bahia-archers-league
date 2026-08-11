/**
 * Conversión segura de identificadores.
 *
 * **Nunca** se construye un `ObjectId` con un valor del request sin validarlo
 * primero: un objeto en lugar de un string se convierte en un operador de Mongo.
 * Ver `docs/SECURITY.md` §6.
 */

import { ObjectIdSchema } from '@bal/shared';
import { ObjectId } from 'mongodb';
import { AppError } from './errors.js';

/**
 * Convierte un parámetro de ruta o de body en `ObjectId`.
 *
 * @throws {AppError} `NOT_FOUND` si no tiene forma de identificador. Se responde
 *   404 y no 400 a propósito: un id malformado y un id inexistente no se
 *   distinguen, así no se puede sondear qué existe.
 */
export function toObjectId(value: unknown): ObjectId {
  const parsed = ObjectIdSchema.safeParse(value);
  if (!parsed.success) throw new AppError('NOT_FOUND');
  return new ObjectId(parsed.data);
}

/** Igual que `toObjectId` pero para una lista. */
export function toObjectIds(values: readonly string[]): ObjectId[] {
  return values.map(toObjectId);
}
