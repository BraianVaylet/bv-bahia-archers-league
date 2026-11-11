/**
 * Lecturas de torneos, para la landing y para WAFA.
 *
 * Vivían en `routes/publico.ts` y `routes/admin.ts` (`REF6-10` / `B-1`): cada ruta
 * pedía los repositorios, armaba el objeto de respuesta y lo serializaba. La convención del
 * proyecto es `routes → services → repositories`, y una ruta que arma la respuesta con
 * repositorios es lógica de presentación en la capa que sólo debería validar la entrada.
 *
 * **Las respuestas son las mismas, byte por byte**: esto movió código, no lo cambió.
 */

import {
  distribucionDeModalidades,
  hoyEnArgentina,
  resultadosVisibles,
  type TournamentStatus,
} from '@bal/shared';
import type { ObjectId } from 'mongodb';
import { notFound } from '../lib/errors.js';
import * as patrolRepo from '../repositories/patrolRepo.js';
import * as tournamentRepo from '../repositories/tournamentRepo.js';
import { blancosBloqueados as blancosBloqueadosDe } from './tournamentEditService.js';

// ── Landing ──────────────────────────────────────────────────────────────────

/**
 * Los torneos que se ven desde afuera.
 *
 * Sólo publicados y en proceso: un torneo sin iniciar no le importa a nadie desde afuera, y
 * uno completado sin publicar todavía no es oficial.
 */
export async function listadoPublico() {
  const docs = await tournamentRepo.listPublicos();

  return {
    tournaments: docs.map((t) => ({
      id: t._id.toHexString(),
      name: t.name,
      date: t.date,
      status: t.status,
      targetCount: t.targets.length,
      participantCount: t.participantCount,
      modalities: distribucionDeModalidades(t.targets.map((b) => b.modality)),
    })),
  };
}

/** Cuántas próximas fechas muestra la landing como mucho: la portada usa tres, `/torneos` todas. */
const MAX_PROXIMAS = 6;

/**
 * «Próximas fechas»: los torneos sin iniciar de hoy en adelante (`BE-28`, decisión 7 de la Fase 9).
 *
 * Es lo único de un torneo sin iniciar que se ve desde afuera, y es **la convocatoria**: cuándo,
 * dónde anotarse, cuánto sale y qué se tira. Quién está anotado y cómo se arman las patrullas no:
 * pueden cambiar hasta minutos antes de largar.
 *
 * «Hoy» es el día de Bahía Blanca, no el de UTC (`hoyEnArgentina`): a las 21 h de acá ya es mañana
 * en UTC, y el torneo del día dejaría de figurar.
 */
export async function proximasFechas(ahora: Date = new Date()) {
  const docs = await tournamentRepo.listProximos(hoyEnArgentina(ahora), MAX_PROXIMAS);

  return {
    tournaments: docs.map((t) => ({
      id: t._id.toHexString(),
      name: t.name,
      date: t.date,
      description: t.description,
      // Validado `https:` al cargarlo (`RegistrationUrlSchema`). Torneos viejos: sin la clave.
      registrationUrl: t.registrationUrl ?? null,
      payment: t.payment,
      targetCount: t.targets.length,
      modalities: distribucionDeModalidades(t.targets.map((b) => b.modality)),
    })),
  };
}

/**
 * El detalle público de un torneo. **Un torneo que no está publicado NUNCA expone
 * puntajes**: en proceso sólo salen la distribución de patrullas y el avance. Ver
 * `docs/FUNCTIONAL.md` §5.3.
 *
 * @throws {AppError} `NOT_FOUND` si no existe, está sin iniciar, completado sin publicar, o
 *   publicado pero archivado (`BE-26`, decisión 5: un archivado se oculta).
 */
export async function detallePublico(id: ObjectId) {
  const torneo = await tournamentRepo.findById(id);
  const visible = torneo !== null && (torneo.status === 'en_proceso' || resultadosVisibles(torneo));
  if (!torneo || !visible) throw notFound();

  const [miembros, patrullas] = await Promise.all([
    tournamentRepo.listParticipants(torneo._id),
    patrolRepo.listByTournament(torneo._id),
  ]);

  const base = {
    id: torneo._id.toHexString(),
    name: torneo.name,
    date: torneo.date,
    description: torneo.description,
    // Ya validado `https:` al cargarlo (`RegistrationUrlSchema`): la landing lo usa como `href`.
    registrationUrl: torneo.registrationUrl ?? null,
    status: torneo.status,
    // Cuánto sale entrar: lo que cualquiera quiere saber antes de anotarse, y que el club
    // publica igual en el grupo y en la puerta. Quién pagó NO sale de acá: eso es del club.
    payment: torneo.payment,
    targets: torneo.targets,
    maxPossibleScore: torneo.maxPossibleScore,
    patrols: patrullas.map((p) => ({
      number: p.number,
      // El usuario, para la botonera de WAFL. **No es información nueva**: es
      // `patrulla${number}` y el número ya está acá al lado. Se manda para que el cliente
      // no repita la regla de nombrado. El PIN sigue siendo el único factor y nunca sale de
      // acá. Ver `docs/SECURITY.md` §3.
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
  if (torneo.status !== 'publicado') return { tournament: base };

  return {
    tournament: {
      ...base,
      results: miembros
        .filter((m) => m.status === 'activo')
        .map((m) => ({
          // Con qué se abre la tarjeta de puntajes del arquero. Es el id de la participación
          // en este torneo, no el del arquero del padrón.
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
  };
}

// ── WAFA ─────────────────────────────────────────────────────────────────────

export interface FiltroDeTorneos {
  readonly status?: TournamentStatus;
  readonly seasonId?: ObjectId;
}

/** El listado de torneos del admin, con la distribución de modalidades ya calculada. */
export async function listadoAdmin(filtro: FiltroDeTorneos = {}) {
  const docs = await tournamentRepo.list({
    ...(filtro.status ? { status: filtro.status } : {}),
    ...(filtro.seasonId ? { seasonId: filtro.seasonId } : {}),
  });

  return {
    tournaments: docs.map((t) => ({
      id: t._id.toHexString(),
      name: t.name,
      date: t.date,
      status: t.status,
      targetCount: t.targets.length,
      patrolCount: t.patrolCount,
      participantCount: t.participantCount,
      maxPossibleScore: t.maxPossibleScore,
      // Archivado (`BE-26`): WAFA lo sigue mostrando, marcado, para poder desarchivarlo.
      archived: Boolean(t.archivedAt),
      // La distribución se calcula acá y no en el cliente: el listado no manda los blancos, y
      // mandarlos para que el cliente los cuente sería enviar catorce objetos por torneo para
      // mostrar cuatro números.
      modalities: distribucionDeModalidades(t.targets.map((b) => b.modality)),
    })),
  };
}

/** El detalle de un torneo para WAFA. @throws {AppError} `NOT_FOUND`. */
export async function detalleAdmin(id: ObjectId) {
  const doc = await tournamentRepo.findById(id);
  if (!doc) throw notFound();

  return {
    tournament: {
      id: doc._id.toHexString(),
      seasonId: doc.seasonId.toHexString(),
      name: doc.name,
      date: doc.date,
      description: doc.description,
      registrationUrl: doc.registrationUrl ?? null,
      status: doc.status,
      payment: doc.payment,
      targets: doc.targets,
      maxPossibleScore: doc.maxPossibleScore,
      stakeMap: doc.stakeMap,
      archived: Boolean(doc.archivedAt),
      patrolCount: doc.patrolCount,
      participantCount: doc.participantCount,
    },
  };
}

/**
 * Resultados con los rollups de cada participante.
 *
 * Es lo que le falta a WAFA para seguir un torneo en curso y para previsualizar los podios
 * **antes** de publicar. A diferencia del endpoint público, acá sí se ven los puntajes de un
 * torneo `completado`: el admin tiene que poder revisar lo que está por aplicar a la liga.
 *
 * @throws {AppError} `NOT_FOUND`.
 */
export async function resultadosAdmin(id: ObjectId) {
  const doc = await tournamentRepo.findById(id);
  if (!doc) throw notFound();

  const [miembros, patrullas] = await Promise.all([
    tournamentRepo.listParticipants(id),
    tournamentRepo.listPatrols(id),
  ]);
  const numeroDePatrulla = new Map(patrullas.map((p) => [p._id.toHexString(), p.number]));

  return {
    maxPossibleScore: doc.maxPossibleScore,
    participants: miembros.map((m) => ({
      id: m._id.toHexString(),
      archerId: m.archerId.toHexString(),
      firstName: m.firstName,
      lastName: m.lastName,
      category: m.category,
      stake: m.stake,
      patrolNumber: numeroDePatrulla.get(m.patrolId.toHexString()) ?? 0,
      total: m.total,
      normalizedPct: m.normalizedPct,
      innerCount: m.innerCount,
      tenCount: m.tenCount,
      mCount: m.mCount,
      targetsCompleted: m.targetsCompleted,
      status: m.status,
      signed: m.signature !== null,
      // Que la firma haya sido desbloqueada no se oculta: el podio se mira distinto si alguien
      // no firmó de puño y letra.
      signatureUnlocked: m.signature?.unlockedBy != null,
    })),
  };
}

/** Qué blancos de un torneo ya tienen puntajes y no se pueden editar. @throws {AppError} `NOT_FOUND`. */
export async function blancosBloqueados(id: ObjectId) {
  const doc = await tournamentRepo.findById(id);
  if (!doc) throw notFound();

  return { lockedTargets: await blancosBloqueadosDe(doc) };
}
