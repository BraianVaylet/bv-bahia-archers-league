/**
 * Armado de patrullas.
 *
 * Regla propia del club, no de World Archery. Es el algoritmo más delicado del
 * sistema: decide con quién tira cada arquero el día del torneo.
 *
 * Restricciones **duras** (nunca se violan en el armado automático):
 *   `H1`  tamaño de patrulla entre 2 y 4
 *   `H2`  cada unidad de tiro es homogénea de categoría
 *   `H3`  ninguna patrulla puede ser 100% escuela
 *   `H4`  la estaca se deriva de la categoría
 *
 * Objetivos **blandos**, en orden:
 *   `S1`  reunir arqueros de la misma categoría
 *   `S2`  balancear el tamaño de las patrullas
 *   `S3`  repartir los blancos de inicio por el circuito
 *
 * El resultado es **determinista**: el mismo input, en cualquier orden, produce
 * exactamente el mismo plan.
 *
 * Ver `docs/DOMAIN_WA.md` §5.
 */

import {
  CATEGORY_INFO,
  DEFAULT_STAKE_MAP,
  isEscuela,
  MAX_PATROL_SIZE,
  MIN_PATROL_SIZE,
  stakeForCategory,
} from './constants.js';
import type { BowCategory, Position, Stake, StakeMap, Unit } from './domain.js';
import { comparePersonName, compareText } from './text.js';

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Un arquero inscripto, antes de asignarle patrulla. */
export interface ParticipantInput {
  readonly archerId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;
}

export interface PlannedMember extends ParticipantInput {
  readonly stake: Stake;
  readonly position: Position;
}

export interface PlannedUnit {
  /** `A` tira primero. */
  readonly label: Unit;
  readonly category: BowCategory;
  readonly stake: Stake;
  readonly members: readonly PlannedMember[];
}

export interface PlannedPatrol {
  readonly number: number;
  readonly startTargetIndex: number;
  readonly units: readonly PlannedUnit[];
}

export type PatrolWarning = {
  readonly code: 'ESCUELA_SIN_SENIOR';
  readonly archerIds: readonly string[];
};

export interface PatrolPlan {
  readonly patrols: readonly PlannedPatrol[];
  /** Arqueros que no pudieron ubicarse sin violar una restricción dura. */
  readonly unassigned: readonly ParticipantInput[];
  readonly warnings: readonly PatrolWarning[];
  readonly requiresManualReview: boolean;
}

export type PatrolViolation =
  | { readonly code: 'PATROL_SIZE'; readonly patrolNumber: number; readonly size: number }
  | {
      readonly code: 'MIXED_UNIT';
      readonly patrolNumber: number;
      readonly unit: Unit;
      readonly categories: readonly BowCategory[];
    }
  | { readonly code: 'ALL_ESCUELA'; readonly patrolNumber: number }
  | { readonly code: 'TOO_MANY_PAIRS'; readonly patrolNumbers: readonly number[] }
  | {
      readonly code: 'DUPLICATE_START';
      readonly targetIndex: number;
      readonly patrolNumbers: readonly number[];
    }
  | {
      readonly code: 'STAKE_MISMATCH';
      readonly patrolNumber: number;
      readonly archerId: string;
      readonly expected: Stake;
      readonly got: Stake;
    };

// ── Orden determinista ───────────────────────────────────────────────────────

function compararParticipantes(a: ParticipantInput, b: ParticipantInput): number {
  return (
    CATEGORY_INFO[a.category].sort - CATEGORY_INFO[b.category].sort ||
    comparePersonName(a, b) ||
    compareText(a.archerId, b.archerId)
  );
}

// ── Unidades de tiro ─────────────────────────────────────────────────────────

interface Unidad {
  readonly category: BowCategory;
  readonly stake: Stake;
  readonly members: readonly ParticipantInput[];
}

/**
 * Arma las unidades de cada categoría: `floor(n / 2)` de a dos y, si sobra uno,
 * una unidad solitaria. Garantiza `H2` por construcción.
 */
function armarUnidades(participantes: readonly ParticipantInput[], stakeMap: StakeMap): Unidad[] {
  const porCategoria = new Map<BowCategory, ParticipantInput[]>();
  for (const p of participantes) {
    const grupo = porCategoria.get(p.category);
    if (grupo) grupo.push(p);
    else porCategoria.set(p.category, [p]);
  }

  const unidades: Unidad[] = [];

  // Recorrer las categorías en orden de catálogo, no de inserción: determinismo.
  const porOrdenDeCatalogo = [...porCategoria.entries()].sort(
    ([a], [b]) => CATEGORY_INFO[a].sort - CATEGORY_INFO[b].sort,
  );

  for (const [category, sinOrdenar] of porOrdenDeCatalogo) {
    const miembros = sinOrdenar.sort(compararParticipantes);
    const stake = stakeForCategory(category, stakeMap);

    for (let i = 0; i < miembros.length; i += 2) {
      unidades.push({ category, stake, members: miembros.slice(i, i + 2) });
    }
  }

  return unidades;
}

const tamañoUnidad = (u: Unidad): number => u.members.length;

// ── Combinación de unidades en patrullas ─────────────────────────────────────

interface PatrullaEnArmado {
  units: Unidad[];
}

/**
 * Saca el elemento de un índice ya validado por el llamador (`findIndex` que no
 * devolvió -1, o un `length` comprobado). Existe para no repetir guardas de
 * `undefined` que `noUncheckedIndexedAccess` obliga a escribir y que nunca se
 * ejecutan: ramas muertas que ensucian el código y la cobertura.
 */
function sacar<T>(lista: T[], indice: number): T {
  // biome-ignore lint/style/noNonNullAssertion: el índice lo garantiza el llamador
  return lista.splice(indice, 1)[0]!;
}

/**
 * Elige el mejor compañero para una unidad, en orden de preferencia:
 * misma categoría (`S1`) › misma estaca › cualquiera.
 */
function mejorCompañero(unidad: Unidad, pool: readonly Unidad[]): Unidad | undefined {
  return (
    pool.find((u) => u.category === unidad.category) ??
    pool.find((u) => u.stake === unidad.stake) ??
    pool[0]
  );
}

/**
 * Cuántas unidades solitarias pueden emparejarse con una unidad de dos sin dejar
 * a ninguna otra huérfana.
 *
 * Una unidad solitaria **nunca** puede formar patrulla sola: violaría `H1`. Las
 * de dos sí. Entonces, con `S` solitarias y `P` de a dos, si cada solitaria se
 * lleva una de a dos y `S > P`, las sobrantes quedan huérfanas.
 *
 * La cuenta: se toman como máximo `min(P, S)`, y se resta uno si la paridad no
 * cierra — porque las solitarias que no se llevan una de a dos tienen que poder
 * emparejarse **entre sí**, y para eso deben quedar en número par.
 *
 * Ejemplos: `S=3, P=2 → 1` (una se lleva un par, las otras dos se emparejan) ·
 * `S=2, P=2 → 2` · `S=1, P=0 → 0` (queda huérfana; es el caso de un solo arquero).
 */
function solitariasQuePuedenLlevarsePar(solitarias: number, pares: number): number {
  const tentativo = Math.min(pares, solitarias);
  const ajustado = (solitarias - tentativo) % 2 === 0 ? tentativo : tentativo - 1;
  return Math.max(0, ajustado);
}

/**
 * Combina unidades en patrullas de 1 o 2 unidades.
 *
 * Las unidades solitarias se procesan **primero**, y sólo algunas se llevan una
 * unidad de dos: si todas lo hicieran, las de más quedarían sin compañero. Ver
 * `solitariasQuePuedenLlevarsePar`.
 */
function combinar(unidades: readonly Unidad[]): {
  patrullas: PatrullaEnArmado[];
  sobrantes: Unidad[];
} {
  const pool = [...unidades];
  const patrullas: PatrullaEnArmado[] = [];
  const sobrantes: Unidad[] = [];

  const totalSolitarias = pool.filter((u) => tamañoUnidad(u) === 1).length;
  const totalPares = pool.length - totalSolitarias;
  let cupoDePares = solitariasQuePuedenLlevarsePar(totalSolitarias, totalPares);

  // Fase A — las unidades solitarias buscan compañero.
  for (;;) {
    const i = pool.findIndex((u) => tamañoUnidad(u) === 1);
    if (i === -1) break;
    const unidad = sacar(pool, i);

    // Mientras haya cupo, se lleva una de a dos y forma una patrulla de TRES.
    // Agotado el cupo, sólo puede emparejarse con otra solitaria.
    //
    // La preferencia por las de a dos es lo que cumple `S4`. Ofrecerle el pool
    // entero dejaba que se emparejara con otra solitaria —una patrulla de 2—
    // **gastando el cupo igual**: con 1 recurvo y 5 compuestos salían una de 2
    // y una de 4, en vez de dos de 3.
    const deADos = pool.filter((u) => tamañoUnidad(u) === 2);
    const candidatas =
      cupoDePares > 0 && deADos.length > 0 ? deADos : pool.filter((u) => tamañoUnidad(u) === 1);
    const compañero = mejorCompañero(unidad, candidatas);

    if (!compañero) {
      sobrantes.push(unidad);
      continue;
    }

    sacar(pool, pool.indexOf(compañero));
    if (tamañoUnidad(compañero) === 2) cupoDePares--;
    patrullas.push({ units: [unidad, compañero] });
  }

  // Fase B — las unidades de dos se combinan entre sí.
  while (pool.length > 0) {
    const unidad = sacar(pool, 0);
    const compañero = mejorCompañero(unidad, pool);

    if (compañero) {
      sacar(pool, pool.indexOf(compañero));
      patrullas.push({ units: [unidad, compañero] });
    } else {
      patrullas.push({ units: [unidad] });
    }
  }

  return { patrullas, sobrantes };
}

// ── Materialización ──────────────────────────────────────────────────────────

/**
 * `A` tira primero. Es la unidad de la categoría con menor orden de catálogo;
 * en una patrulla con escuela, eso deja siempre al senior tirando primero.
 */
function ordenarUnidades(units: readonly Unidad[]): Unidad[] {
  return [...units].sort((a, b) => {
    const porCategoria = CATEGORY_INFO[a.category].sort - CATEGORY_INFO[b.category].sort;
    if (porCategoria !== 0) return porCategoria;
    // Toda unidad tiene al menos un miembro por construcción de `armarUnidades`.
    // biome-ignore lint/style/noNonNullAssertion: unidad no vacía por construcción
    return compararParticipantes(a.members[0]!, b.members[0]!);
  });
}

/** Una patrulla tiene a lo sumo dos unidades, y una unidad a lo sumo dos arqueros. */
const etiqueta = (i: number): Unit => (i === 0 ? 'A' : 'B');
const posicion = (j: number): Position => (j === 0 ? 'izquierda' : 'derecha');

function materializar(
  patrulla: PatrullaEnArmado,
  numero: number,
  blancoInicio: number,
): PlannedPatrol {
  return {
    number: numero,
    startTargetIndex: blancoInicio,
    units: ordenarUnidades(patrulla.units).map((u, i) => ({
      label: etiqueta(i),
      category: u.category,
      stake: u.stake,
      members: u.members.map((m, j) => ({ ...m, stake: u.stake, position: posicion(j) })),
    })),
  };
}

/**
 * Reparte los blancos de inicio a lo largo del circuito (`S3`).
 * Con al menos tantos blancos como patrullas, no se repite ninguno.
 */
function blancoDeInicio(indice: number, patrullas: number, blancos: number): number {
  if (blancos < 1 || patrullas < 1) return 1;
  return Math.floor((indice * blancos) / patrullas) + 1;
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Arma el plan de patrullas de un torneo.
 *
 * Nunca devuelve una patrulla que viole `H1`..`H4`. Si algún arquero no puede
 * ubicarse sin violar una restricción —el caso típico es que no alcancen los
 * seniors para acompañar a los de escuela— queda en `unassigned` con su warning,
 * y el plan pide revisión manual. **Nunca se pierde un arquero en silencio.**
 */
export function buildPatrols(
  participants: readonly ParticipantInput[],
  stakeMap: StakeMap = DEFAULT_STAKE_MAP,
  targetCount = 1,
): PatrolPlan {
  const unidades = armarUnidades([...participants].sort(compararParticipantes), stakeMap);

  const unidadesEscuela = unidades.filter((u) => isEscuela(u.category));
  const unidadesSenior = unidades.filter((u) => !isEscuela(u.category));

  const patrullas: PatrullaEnArmado[] = [];
  const sinAsignar: ParticipantInput[] = [];

  // 1. Cada unidad de escuela toma una unidad senior que la acompañe (H3).
  //
  //    Se prefieren las unidades senior SOLITARIAS: son las que no pueden formar
  //    patrulla por su cuenta, así que dárselas a escuela las salva y deja libres
  //    las de a dos, que sí se bastan solas. Consumir primero las de a dos dejaría
  //    solitarias sin compañero posible.
  const poolSenior = [...unidadesSenior].sort((a, b) => tamañoUnidad(a) - tamañoUnidad(b));
  for (const escuela of unidadesEscuela) {
    const senior = poolSenior.shift();
    if (senior) patrullas.push({ units: [senior, escuela] });
    else sinAsignar.push(...escuela.members);
  }

  const escuelaSinSenior = sinAsignar.map((m) => m.archerId);

  // 2. Las unidades senior restantes se combinan entre sí.
  const { patrullas: senior, sobrantes } = combinar(poolSenior);
  patrullas.push(...senior);
  for (const u of sobrantes) sinAsignar.push(...u.members);

  // 3. Numerar y repartir los blancos de inicio.
  const materializadas = patrullas.map((p, i) =>
    materializar(p, i + 1, blancoDeInicio(i, patrullas.length, targetCount)),
  );

  const warnings: PatrolWarning[] =
    escuelaSinSenior.length > 0
      ? [{ code: 'ESCUELA_SIN_SENIOR', archerIds: escuelaSinSenior }]
      : [];

  return {
    patrols: materializadas,
    unassigned: sinAsignar,
    warnings,
    requiresManualReview: sinAsignar.length > 0,
  };
}

/**
 * Mínimo de patrullas de dos alcanzable con estas unidades.
 *
 * Una patrulla es a lo sumo dos unidades y de 2 a 4 arqueros, así que las
 * formas posibles son `4 = u2+u2` · `3 = u2+u1` · `2 = u2` ó `u1+u1`. Se prueban
 * todas las cantidades de patrullas de tres y se toma la mejor; las
 * combinaciones que dejarían una unidad solitaria suelta se descartan, porque
 * serían una patrulla de uno y violarían `H1`.
 *
 * Con 7 arqueros repartidos en 5 unidades, por ejemplo, el mínimo es **dos**:
 * no hay reparto que lo evite.
 */
function minPatrolsOfTwo(patrols: readonly PlannedPatrol[]): number {
  const unidades = patrols.flatMap((p) => p.units);
  const u1 = unidades.filter((u) => u.members.length === 1).length;
  const u2 = unidades.filter((u) => u.members.length === 2).length;

  let mejor = Number.POSITIVE_INFINITY;
  for (let tres = 0; tres <= Math.min(u1, u2); tres++) {
    const solitariasRestantes = u1 - tres;
    if (solitariasRestantes % 2 !== 0) continue;
    mejor = Math.min(mejor, solitariasRestantes / 2 + ((u2 - tres) % 2));
  }

  return mejor;
}

/**
 * Violaciones que dependen del **conjunto**, no de una patrulla suelta.
 *
 * Van aparte de `validatePatrols` para que el recorrido por patrulla siga
 * leyéndose de un vistazo: son reglas de otra naturaleza, que sólo tienen
 * sentido mirando todas juntas.
 */
function violacionesDelConjunto(patrols: readonly PlannedPatrol[]): PatrolViolation[] {
  const violaciones: PatrolViolation[] = [];

  // S4 — como mucho una patrulla de dos. Si a una le falta uno, el otro queda
  // solo y no puede tirar. Las de UNO ya las reporta H1: contarlas acá sería
  // decir dos veces lo mismo con dos nombres distintos.
  //
  // Sólo se avisa si existe un reparto MEJOR. Con ciertas composiciones dos de
  // dos es el óptimo —7 arqueros en 5 unidades, por ejemplo— y marcar como
  // violación algo que no se puede arreglar es enseñarle al admin a ignorar
  // los avisos.
  const deDos = patrols.filter((p) => p.units.flatMap((u) => u.members).length === MIN_PATROL_SIZE);
  if (deDos.length > 1 && deDos.length > minPatrolsOfTwo(patrols)) {
    violaciones.push({ code: 'TOO_MANY_PAIRS', patrolNumbers: deDos.map((p) => p.number) });
  }

  // Dos patrullas en el mismo blanco de inicio se cruzan en el recorrido.
  const porBlanco = new Map<number, number[]>();
  for (const p of patrols) {
    const grupo = porBlanco.get(p.startTargetIndex);
    if (grupo) grupo.push(p.number);
    else porBlanco.set(p.startTargetIndex, [p.number]);
  }

  for (const [targetIndex, patrolNumbers] of porBlanco) {
    if (patrolNumbers.length > 1) {
      violaciones.push({ code: 'DUPLICATE_START', targetIndex, patrolNumbers });
    }
  }

  return violaciones;
}

/**
 * Verifica `H1`..`H4` sobre una distribución de patrullas.
 *
 * Se usa tras la edición manual del admin. **Informa, no bloquea**: el admin
 * conoce el terreno y puede tener motivos para una excepción; la decisión queda
 * en el audit log. Ver `docs/FUNCTIONAL.md` §6.6.
 */
export function validatePatrols(
  patrols: readonly PlannedPatrol[],
  stakeMap: StakeMap = DEFAULT_STAKE_MAP,
): PatrolViolation[] {
  const violaciones: PatrolViolation[] = [];

  for (const patrulla of patrols) {
    const miembros = patrulla.units.flatMap((u) => u.members);

    // H1 — tamaño.
    if (miembros.length < MIN_PATROL_SIZE || miembros.length > MAX_PATROL_SIZE) {
      violaciones.push({
        code: 'PATROL_SIZE',
        patrolNumber: patrulla.number,
        size: miembros.length,
      });
    }

    // H3 — ninguna patrulla 100% escuela.
    if (miembros.length > 0 && miembros.every((m) => isEscuela(m.category))) {
      violaciones.push({ code: 'ALL_ESCUELA', patrolNumber: patrulla.number });
    }

    for (const unidad of patrulla.units) {
      // H2 — unidad homogénea de categoría.
      const categorias = unidad.members.map((m) => m.category);
      if (new Set(categorias).size > 1) {
        violaciones.push({
          code: 'MIXED_UNIT',
          patrolNumber: patrulla.number,
          unit: unidad.label,
          categories: categorias,
        });
      }

      // H4 — la estaca se deriva de la categoría.
      for (const miembro of unidad.members) {
        const esperada = stakeForCategory(miembro.category, stakeMap);
        if (miembro.stake !== esperada) {
          violaciones.push({
            code: 'STAKE_MISMATCH',
            patrolNumber: patrulla.number,
            archerId: miembro.archerId,
            expected: esperada,
            got: miembro.stake,
          });
        }
      }
    }
  }

  violaciones.push(...violacionesDelConjunto(patrols));

  return violaciones;
}
