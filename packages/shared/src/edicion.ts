/**
 * Qué se puede editar de un torneo en cada estado (`SH-11`).
 *
 * **Una sola tabla**, que leen el servicio que guarda (`tournamentEditService`) y la pantalla que
 * dibuja el formulario (WAFA). Si cada uno decidiera por su cuenta, el formulario podría ofrecer un
 * campo que el servidor rechaza, o esconder uno que el servidor acepta.
 *
 * Es por **campo**, no por blanco: «un blanco con puntajes no se toca» necesita mirar la base, así
 * que sigue en el servicio. Acá sólo se dice si el campo `targets` se puede tocar en ese estado.
 *
 * Ver `docs/FUNCTIONAL.md` §6.7 y §8, y las decisiones de la Fase 9 en `docs/ACTION_PLAN.md`.
 */

import { DomainError, type TournamentStatus } from './domain.js';

/** Lo que el admin puede cambiar de un torneo ya creado. */
export const CAMPOS_DE_TORNEO = [
  'name',
  'date',
  'description',
  'registrationUrl',
  'payment',
  'targets',
  'archerIds',
  'stakeMap',
  'distances',
  'scores',
] as const;

export type CampoDeTorneo = (typeof CAMPOS_DE_TORNEO)[number];

const EDITABLES: Readonly<Record<TournamentStatus, readonly CampoDeTorneo[]>> = {
  // Todavía no hay puntajes que corregir: el resto, todo.
  sin_iniciar: CAMPOS_DE_TORNEO.filter((c) => c !== 'scores'),
  // Decisión 1: lo que el backend ya aceptaba. Nada que rearme patrullas que ya están en el predio.
  en_proceso: ['name', 'date', 'description', 'registrationUrl', 'payment', 'targets'],
  // Decisiones 2 y 3: se corrige contra la planilla de papel antes de publicar.
  completado: ['name', 'date', 'scores'],
  // Para corregir un publicado se despublica: el ranking se recalcula entero al volver a publicar.
  publicado: [],
};

/**
 * Los campos que se pueden cambiar con el torneo en `status`.
 *
 * Un `Set` nuevo en cada llamada: si fuera el mismo para todos, quien lo recibe podría cambiarle la
 * regla al siguiente (`ReadonlySet` es sólo del compilador).
 */
export function camposEditables(status: TournamentStatus): ReadonlySet<CampoDeTorneo> {
  return new Set(EDITABLES[status]);
}

/**
 * Un pedido de edición trae campos que el estado del torneo no permite.
 *
 * Lleva **todos** los que sobran, no el primero: el admin tiene que poder ver de una vez qué le
 * rechazaron. `DomainError` no tiene `details`; el backend lo traduce a su `AppError`.
 */
export class CampoNoEditableError extends DomainError {
  readonly campos: readonly CampoDeTorneo[];

  constructor(status: TournamentStatus, campos: readonly CampoDeTorneo[]) {
    super(
      'FIELD_NOT_EDITABLE',
      `Con el torneo en «${status}» no se puede editar: ${campos.join(', ')}.`,
    );
    this.name = 'CampoNoEditableError';
    this.campos = campos;
  }
}

/**
 * Exige que todos los `campos` se puedan editar con el torneo en `status`.
 *
 * Se rechaza el pedido entero: aplicar los permitidos y descartar el resto en silencio dejaría al
 * admin creyendo que guardó algo que no guardó.
 *
 * @throws {CampoNoEditableError} `FIELD_NOT_EDITABLE`, con los campos que sobran.
 */
export function exigirEditables(status: TournamentStatus, campos: Iterable<CampoDeTorneo>): void {
  const permitidos = EDITABLES[status];
  const sobran = [...campos].filter((c) => !permitidos.includes(c));
  if (sobran.length > 0) throw new CampoNoEditableError(status, sobran);
}

/** Sólo un torneo que no arrancó: después ya hay patrullas en el predio, o resultados. */
export function puedeEliminar(status: TournamentStatus): boolean {
  return status === 'sin_iniciar';
}

/**
 * Archivar saca un torneo publicado del ranking de la temporada y de la landing, sin
 * despublicarlo, y se puede revertir (decisiones 4, 5 y 6 de la Fase 9). Los demás estados todavía
 * no suman al ranking: no hay nada que sacar.
 */
export function puedeArchivar(status: TournamentStatus, archivado: boolean): boolean {
  return status === 'publicado' && !archivado;
}

/** La vuelta de `puedeArchivar`. Despublicar un archivado ya lo desarchiva (`BE-26`). */
export function puedeDesarchivar(status: TournamentStatus, archivado: boolean): boolean {
  return status === 'publicado' && archivado;
}

/**
 * Si los resultados de un torneo se ven desde afuera: publicado y no archivado (`BE-26`).
 *
 * Una sola regla para el detalle público, la tarjeta de puntajes y la ficha del arquero
 * (decisión 5 de la Fase 9: un archivado **se oculta**). `archivedAt` es opcional porque los
 * torneos anteriores a `BE-26` no tienen la clave.
 */
export function resultadosVisibles(torneo: {
  readonly status: TournamentStatus;
  readonly archivedAt?: Date | null;
}): boolean {
  return torneo.status === 'publicado' && !torneo.archivedAt;
}
