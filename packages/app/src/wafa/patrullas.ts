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
  MIN_PATROL_SIZE,
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
  /**
   * **Cuál patrulla es.**
   *
   * El número es editable —eliminar una renumera al resto— así que no
   * identifica nada. El servidor mapea por acá; mapeando por número, los
   * arqueros de la vieja patrulla 3 terminaban en el documento de la 2, con el
   * PIN de la 2. Ver `BITACORA.md`, entrada de `REF3-1`.
   */
  readonly id: string;
  readonly numero: number;
  readonly startTargetIndex: number;
  /** En orden. La unidad y la posición se derivan de acá. */
  readonly miembros: readonly MiembroVista[];
}

export function borradorDe(patrullas: readonly PatrullaVista[]): Borrador[] {
  return patrullas.map((p) => ({
    id: p.id,
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

/**
 * Mueve un arquero dentro de su patrulla.
 *
 * **El orden no es cosmético.** `unidadesDe` reparte por posición en la lista:
 * los dos primeros son la unidad `A` y el resto la `B`, y **la `A` tira
 * primero**. Subir a un arquero lo puede pasar de la segunda tanda a la
 * primera, que es exactamente lo que el admin quiere poder decidir.
 *
 * En los extremos no hace nada. La pantalla además deshabilita el botón: un
 * botón que parece activo y no hace nada es peor que uno apagado.
 */
export function moverEnPatrulla(
  borrador: readonly Borrador[],
  participantId: string,
  direccion: 'arriba' | 'abajo',
): Borrador[] {
  return borrador.map((p) => {
    const i = p.miembros.findIndex((m) => m.id === participantId);
    if (i === -1) return p;

    const j = direccion === 'arriba' ? i - 1 : i + 1;

    const miembros = [...p.miembros];
    const a = miembros[i];
    const b = miembros[j];

    /**
     * Fuera de rango, `b` es `undefined` y no hay nada que intercambiar.
     *
     * Acá había **además** un `if (j < 0 || j >= length)`. Una mutación que lo
     * borraba no rompía ningún test, y tenía razón: los dos chequeos hacen el
     * mismo trabajo. El que queda es el que `noUncheckedIndexedAccess` obliga a
     * escribir igual, así que el otro era una segunda condición que podía
     * quedar desincronizada sin que nadie lo notara.
     */
    if (!a || !b) return p;

    miembros[i] = b;
    miembros[j] = a;
    return { ...p, miembros };
  });
}

/**
 * Elimina una patrulla vacía y **renumera** las que siguen.
 *
 * Renumerar no es presentación: el `username` de la patrulla es
 * `patrulla${number}` y es lo que el líder usa para entrar. Una numeración con
 * huecos deja un `patrulla3` que no existe y un torneo con patrullas 1, 2 y 4.
 *
 * **Sólo se elimina si está vacía.** Con gente adentro, eliminarla sacaría
 * arqueros del torneo sin decirlo: primero se los mueve.
 */
export function eliminarPatrulla(borrador: readonly Borrador[], numero: number): Borrador[] {
  const objetivo = borrador.find((p) => p.numero === numero);
  if (!objetivo || objetivo.miembros.length > 0) return [...borrador];

  return borrador.filter((p) => p.numero !== numero).map((p, i) => ({ ...p, numero: i + 1 }));
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

/** Enumera números de patrulla como los diría una persona: «2, 3 y 5». */
function listar(numeros: readonly number[]): string {
  if (numeros.length <= 1) return String(numeros[0] ?? '');
  return `${numeros.slice(0, -1).join(', ')} y ${numeros[numeros.length - 1]}`;
}

/**
 * Texto de una violación, en el idioma del club.
 *
 * **Sin `default`.** Con un caso por código, agregar una violación nueva sin
 * darle texto rompe el `typecheck` en vez de imprimir el mensaje de otra: así
 * aparecieron `TOO_MANY_PAIRS` y `DUPLICATE_START` como «Patrulla undefined».
 */
export function textoDeViolacion(v: PatrolViolation): string {
  switch (v.code) {
    case 'PATROL_SIZE':
      return `Patrulla ${v.patrolNumber}: ${v.size} ${v.size === 1 ? 'arquero' : 'arqueros'}. Tienen que ser entre ${MIN_PATROL_SIZE} y ${MAX_PATROL_SIZE}.`;
    case 'ALL_ESCUELA':
      return `Patrulla ${v.patrolNumber}: son todos de escuela. Necesitan al menos un senior que los acompañe.`;
    case 'MIXED_UNIT':
      return `Patrulla ${v.patrolNumber}, unidad ${v.unit}: tiran juntos arqueros de categorías distintas (${v.categories.join(', ')}).`;
    case 'TOO_MANY_PAIRS':
      return `Las patrullas ${listar(v.patrolNumbers)} tienen dos arqueros. Si a una le falta uno, el otro se queda sin poder tirar: conviene juntarlas.`;
    case 'DUPLICATE_START':
      return `Las patrullas ${listar(v.patrolNumbers)} arrancan las dos en el blanco ${v.targetIndex}. Se van a cruzar en el recorrido.`;
    case 'STAKE_MISMATCH':
      // La estaca se deriva de la categoría (`H4`): si no coincide, el dato está
      // corrupto, no es una decisión que el admin haya tomado.
      return `Patrulla ${v.patrolNumber}: un arquero tiene estaca ${v.got} y le corresponde ${v.expected}.`;
  }
}

/**
 * Motivo por el que el borrador no se puede guardar, o `undefined` si se puede.
 *
 * **El guardado exige entre 2 y 4 en todas.** Las violaciones de reglamento
 * —una unidad mezclada, una patrulla toda de escuela— siguen avisando sin
 * frenar, porque el admin conoce el terreno y la decisión queda registrada.
 * El tamaño no: un arquero solo no tiene quién le controle el puntaje, así que
 * no es una excepción que alguien pueda decidir, es un torneo que no se puede
 * correr.
 *
 * Una patrulla **vacía** no frena: es un estado intermedio mientras se
 * reacomoda, y no se manda al servidor.
 */
export function problemaDelBorrador(borrador: readonly Borrador[]): string | undefined {
  const excedida = borrador.find((p) => p.miembros.length > MAX_PATROL_SIZE);
  if (excedida) {
    return `La patrulla ${excedida.numero} tiene ${excedida.miembros.length} arqueros. El máximo es ${MAX_PATROL_SIZE}.`;
  }

  /**
   * **Una patrulla vacía frena el guardado.**
   *
   * Antes se guardaba: `cuerpoDeDistribucion` la filtraba antes de mandar y el
   * torneo terminaba con una patrulla menos y una numeración con huecos, sin
   * que nadie lo hubiera pedido. Ahora hay que eliminarla explícitamente, que
   * es lo que renumera al resto.
   */
  const vacia = borrador.find((p) => p.miembros.length === 0);
  if (vacia) {
    return `La patrulla ${vacia.numero} no tiene arqueros. Movele alguien o eliminala.`;
  }

  const escasa = borrador.find((p) => p.miembros.length > 0 && p.miembros.length < MIN_PATROL_SIZE);
  if (escasa) {
    return `La patrulla ${escasa.numero} tiene ${escasa.miembros.length === 1 ? 'un solo arquero' : `${escasa.miembros.length} arqueros`}. Tienen que ser al menos ${MIN_PATROL_SIZE}.`;
  }

  return undefined;
}

/** El cuerpo que espera `PUT /admin/tournaments/:id/patrols`. */
export function cuerpoDeDistribucion(borrador: readonly Borrador[]) {
  return {
    patrols: borrador
      /**
       * Una patrulla sin nadie no se manda, y **desde `REF3-1` eso la borra**.
       *
       * Antes el comentario acá decía «al no mencionarla, queda vacía, que es
       * exactamente lo que se quiere» — y era cierto hasta que `REF2-5` agregó
       * que una patrulla vacía frena el guardado. Entre las dos cosas, el
       * torneo quedaba imposible de guardar.
       *
       * En la práctica este filtro ya no se usa: `problemaDelBorrador` frena
       * antes con una patrulla vacía. Queda como red.
       */
      .filter((p) => p.miembros.length > 0)
      .map((p) => ({
        // El id, no el número: el número lo renumera eliminar una patrulla.
        id: p.id,
        number: p.numero,
        startTargetIndex: p.startTargetIndex,
        units: unidadesDe(p.miembros).map((u) => ({
          label: u.label,
          members: u.members.map((m) => m.id),
        })),
      })),
  };
}
