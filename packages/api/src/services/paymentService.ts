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

export interface SeasonCollection {
  readonly collected: number;
  readonly tournaments: readonly {
    readonly id: string;
    readonly name: string;
    readonly date: Date;
    readonly amount: number;
    readonly paidCount: number;
    readonly participantCount: number;
    readonly collected: number;
  }[];
}

/**
 * Lo recaudado en toda la temporada, torneo por torneo.
 *
 * El total **se deriva de la lista** en vez de contarse aparte: dos números que
 * dicen lo mismo son dos números que pueden discrepar, y el que discrepa es
 * siempre el que se mira.
 *
 * Va bajo `/admin`: cuánto entró es información del club, no del ranking.
 */
export async function seasonCollection(seasonId: ObjectId): Promise<SeasonCollection> {
  const torneos = await tournamentRepo.list({ seasonId });

  const detalle = await Promise.all(
    torneos.map(async (t) => {
      // Por el repositorio, no con una consulta suelta: ninguna query a Mongo
      // vive fuera de `repositories/`. Es la regla 3 de `CLAUDE.md`.
      const miembros = await tournamentRepo.listParticipants(t._id);
      const pagados = miembros.filter((m) => m.paid).length;

      return {
        id: t._id.toHexString(),
        name: t.name,
        date: t.date,
        amount: t.payment.amount,
        paidCount: pagados,
        participantCount: t.participantCount,
        // Un torneo gratuito recauda cero aunque alguien figure como pagado:
        // el monto manda, no la marca.
        collected: pagados * t.payment.amount,
      };
    }),
  );

  return {
    collected: detalle.reduce((n, t) => n + t.collected, 0),
    tournaments: detalle,
  };
}
