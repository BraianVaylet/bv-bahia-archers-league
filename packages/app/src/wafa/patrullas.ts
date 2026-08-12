/**
 * Lógica del editor de patrullas.
 *
 * Pura y sin React, como el wizard: mover un arquero de una patrulla a otra es
 * la decisión que importa, y conviene poder probarla sin clicks.
 *
 * Ver `docs/FUNCTIONAL.md` §6.6 · `docs/DOMAIN_WA.md` §5.
 */

import {
  type BowCategory,
  MAX_PATROL_SIZE,
  type PatrolViolation,
  POSITIONS,
  type Position,
  type Stake,
  UNITS,
  type Unit,
  validatePatrols,
} from '@bal/shared';

export interface MiembroVista {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;
  readonly stake: Stake;
  readonly unit: Unit;
  readonly position: Position;
  readonly signed: boolean;
}

export interface PatrullaVista {
  readonly id: string;
  readonly number: number;
  readonly startTargetIndex: number;
  readonly username: string;
  readonly status: string;
  readonly targetsCompleted: number;
  readonly members: readonly MiembroVista[];
  /** Sólo mientras el torneo no se publicó. */
  readonly pin?: string;
}

/** El estado editable: qué arqueros tiene cada patrulla y desde dónde arranca. */
export interface Borrador {
  readonly numero: number;
  readonly startTargetIndex: number;
  /** En orden. La unidad y la posición se derivan de acá. */
  readonly miembros: readonly MiembroVista[];
}

export function borradorDe(patrullas: readonly PatrullaVista[]): Borrador[] {
  return patrullas.map((p) => ({
    numero: p.number,
    startTargetIndex: p.startTargetIndex,
    // Se ordena por unidad y posición para que el borrador arranque igual a como
    // lo muestra el servidor, y no dependa del orden que devolvió la base.
    //
    // Por el ÍNDICE del catálogo, no alfabéticamente: `derecha` va antes que
    // `izquierda` en el abecedario, y en la línea de tiro es al revés.
    miembros: [...p.members].sort(
      (a, b) =>
        UNITS.indexOf(a.unit) - UNITS.indexOf(b.unit) ||
        POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position),
    ),
  }));
}

/**
 * Reparte a los miembros en unidades de a dos.
 *
 * **La `B` se queda con todo lo que sobre, aunque pase de dos.** Recortar en
 * `MAX_PATROL_SIZE` hacía que mover un 5º arquero a una patrulla llena lo
 * moviera y lo perdiera: desaparecía de la pantalla y del cuerpo que se manda,
 * sin decir nada. Un estado inválido se muestra y `problemaDelBorrador` frena
 * el guardado; lo que no se hace es descartar arqueros en silencio.
 */
export function unidadesDe(miembros: readonly MiembroVista[]) {
  const b = miembros.slice(2);
  return [
    { label: 'A' as Unit, members: miembros.slice(0, 2) },
    ...(b.length > 0 ? [{ label: 'B' as Unit, members: b }] : []),
  ];
}

/** Mueve un arquero a otra patrulla. No muta el borrador recibido. */
export function moverArquero(
  borrador: readonly Borrador[],
  participantId: string,
  aNumero: number,
): Borrador[] {
  const arquero = borrador.flatMap((p) => p.miembros).find((m) => m.id === participantId);
  if (!arquero) return [...borrador];

  return borrador.map((p) => {
    if (p.numero === aNumero) {
      return p.miembros.some((m) => m.id === participantId)
        ? p
        : { ...p, miembros: [...p.miembros, arquero] };
    }
    return { ...p, miembros: p.miembros.filter((m) => m.id !== participantId) };
  });
}

/** Cambia el blanco desde el que arranca una patrulla. */
export function cambiarInicio(
  borrador: readonly Borrador[],
  numero: number,
  startTargetIndex: number,
): Borrador[] {
  return borrador.map((p) => (p.numero === numero ? { ...p, startTargetIndex } : p));
}

/**
 * Corre las restricciones `H1`..`H4` sobre el borrador.
 *
 * Es **el mismo `validatePatrols` que usa el servidor**, así que lo que se ve en
 * vivo es lo que va a quedar registrado, no una aproximación.
 */
export function violacionesDe(borrador: readonly Borrador[]): PatrolViolation[] {
  return validatePatrols(
    borrador
      .filter((p) => p.miembros.length > 0)
      .map((p) => ({
        number: p.numero,
        startTargetIndex: p.startTargetIndex,
        units: unidadesDe(p.miembros).map((u) => ({
          label: u.label,
          // biome-ignore lint/style/noNonNullAssertion: unidadesDe nunca devuelve una unidad vacía
          category: u.members[0]!.category,
          // biome-ignore lint/style/noNonNullAssertion: idem
          stake: u.members[0]!.stake,
          members: u.members.map((m) => ({
            archerId: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
            category: m.category,
            stake: m.stake,
            position: m.position,
          })),
        })),
      })),
  );
}

/** Texto de una violación, en el idioma del club. */
export function textoDeViolacion(v: PatrolViolation): string {
  switch (v.code) {
    case 'PATROL_SIZE':
      return `Patrulla ${v.patrolNumber}: ${v.size} ${v.size === 1 ? 'arquero' : 'arqueros'}. Tienen que ser entre 2 y ${MAX_PATROL_SIZE}.`;
    case 'ALL_ESCUELA':
      return `Patrulla ${v.patrolNumber}: son todos de escuela. Necesitan al menos un senior que los acompañe.`;
    case 'MIXED_UNIT':
      return `Patrulla ${v.patrolNumber}, unidad ${v.unit}: tiran juntos arqueros de categorías distintas (${v.categories.join(', ')}).`;
    default:
      // La estaca se deriva de la categoría (`H4`): si no coincide, el dato está
      // corrupto, no es una decisión que el admin haya tomado.
      return `Patrulla ${v.patrolNumber}: un arquero tiene estaca ${v.got} y le corresponde ${v.expected}.`;
  }
}

/**
 * Motivo por el que el borrador no se puede guardar, o `undefined` si se puede.
 *
 * **Las violaciones de dominio no frenan** —el admin puede tener motivos, y el
 * servidor las registra— pero sí frena lo que el servidor rechazaría: una
 * patrulla con más arqueros de los que entran en dos unidades.
 */
export function problemaDelBorrador(borrador: readonly Borrador[]): string | undefined {
  const excedida = borrador.find((p) => p.miembros.length > MAX_PATROL_SIZE);
  if (excedida) {
    return `La patrulla ${excedida.numero} tiene ${excedida.miembros.length} arqueros. El máximo es ${MAX_PATROL_SIZE}.`;
  }
  return undefined;
}

/** El cuerpo que espera `PUT /admin/tournaments/:id/patrols`. */
export function cuerpoDeDistribucion(borrador: readonly Borrador[]) {
  return {
    patrols: borrador
      // Una patrulla sin nadie no se manda: el schema exige al menos una unidad.
      // Al no mencionarla, queda vacía, que es exactamente lo que se quiere.
      .filter((p) => p.miembros.length > 0)
      .map((p) => ({
        number: p.numero,
        startTargetIndex: p.startTargetIndex,
        units: unidadesDe(p.miembros).map((u) => ({
          label: u.label,
          members: u.members.map((m) => m.id),
        })),
      })),
  };
}
