/**
 * Pago de la inscripción.
 *
 * **Un monto único por torneo.** El pago de cada arquero es un booleano y nada
 * más: el monto vive en el torneo y lo lee el servidor de la base. El cliente
 * nunca manda una cifra, ni al marcar un pago ni al pedir la recaudación.
 * Ver `docs/SECURITY.md` §2.
 *
 * La recaudación **se deriva** —pagos × monto— en vez de acumularse. Un total
 * guardado puede quedar desfasado de los pagos que lo componen; uno derivado no.
 */

import type { ObjectId } from 'mongodb';
import { notFound } from '../lib/errors.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';

export interface PaymentSummary {
  readonly payment: { required: boolean; amount: number };
  readonly paidCount: number;
  /** Cantidad de pagos × monto del torneo. */
  readonly collected: number;
  readonly participants: readonly {
    id: string;
    firstName: string;
    lastName: string;
    category: string;
    patrolNumber: number;
    paid: boolean;
  }[];
}

/** Estado de los pagos de un torneo, con la recaudación derivada. */
export async function summary(tournamentId: ObjectId): Promise<PaymentSummary> {
  const torneo = await tournamentRepo.findById(tournamentId);
  if (!torneo) throw notFound();

  const [miembros, patrullas] = await Promise.all([
    tournamentRepo.listParticipants(tournamentId),
    tournamentRepo.listPatrols(tournamentId),
  ]);

  const numeroDePatrulla = new Map(patrullas.map((p) => [p._id.toHexString(), p.number]));
  const pagados = miembros.filter((m) => m.paid);

  return {
    payment: torneo.payment,
    paidCount: pagados.length,
    // Un torneo gratuito recauda cero aunque alguien figure como pagado: el
    // monto manda, no la marca.
    collected: pagados.length * torneo.payment.amount,
    participants: miembros.map((m) => ({
      id: m._id.toHexString(),
      firstName: m.firstName,
      lastName: m.lastName,
      category: m.category,
      patrolNumber: numeroDePatrulla.get(m.patrolId.toHexString()) ?? 0,
      paid: m.paid,
    })),
  };
}

/**
 * Marca o desmarca el pago de un arquero.
 *
 * Se puede desmarcar: cobrar de más también es un error que hay que poder
 * corregir, y bloquear la vuelta atrás obligaría a tocar la base a mano.
 *
 * @throws {AppError} `NOT_FOUND` si el participante no existe.
 */
export async function setPaid(participantId: ObjectId, paid: boolean): Promise<{ paid: boolean }> {
  const doc = await tournamentRepo.setParticipantPaid(participantId, paid);
  if (!doc) throw notFound();

  return { paid: doc.paid };
}
