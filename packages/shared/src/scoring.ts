/**
 * Puntuación de un blanco — lógica pura compartida por backend y frontends.
 *
 * **El servidor es la autoridad.** Deriva el valor de cada flecha desde su token
 * y recalcula los totales. Nunca confía en un `total` del cliente.
 *
 * La modalidad es **de cada blanco**, no del torneo: un `11` es válido en un
 * blanco 3D e inválido en el de sala del mismo recorrido. Por eso todas las
 * funciones de acá reciben la modalidad de forma explícita.
 *
 * Ver `docs/DOMAIN_WA.md` §1, §2 y §7.
 */

import { type ModalityConfig, SCORING } from './constants';
import { DomainError, MISS_TOKEN, type Modality, X_TOKEN } from './domain';

/** Resultado del cómputo de un blanco válido. */
export interface TargetComputation {
  /** Puntaje del blanco. */
  readonly total: number;
  /** Flechas en la zona interna: `X`, `X6` u `11` según la modalidad. */
  readonly innerCount: number;
  /** Flechas `X`. Siempre 0 en campo y 3D, que no usan ese token. */
  readonly xCount: number;
  /** Flechas que valen 10. La `X` entra, porque vale 10. Ver `docs/DOMAIN_WA.md` §8. */
  readonly tenCount: number;
  /** Flechas sin puntaje. */
  readonly mCount: number;
  /** Conteo de los tokens de desempate de la modalidad, en orden de prioridad. */
  readonly tiebreakCounts: readonly number[];
}

export type TargetValidationError =
  | { readonly code: 'ARROW_COUNT'; readonly expected: number; readonly got: number }
  | { readonly code: 'INVALID_TOKEN'; readonly index: number; readonly token: string };

export type TargetValidationResult =
  | { readonly ok: true; readonly value: TargetComputation }
  | { readonly ok: false; readonly error: TargetValidationError };

/**
 * Busca el valor de un token en el set de la modalidad.
 *
 * Usa `Object.hasOwn` a propósito: un acceso directo devolvería las propiedades
 * heredadas de `Object.prototype`, y un token `"toString"` o `"constructor"`
 * pasaría por válido.
 */
function lookupValue(cfg: ModalityConfig, token: string): number | undefined {
  return Object.hasOwn(cfg.values, token) ? cfg.values[token] : undefined;
}

/** `true` si el token pertenece al set de la modalidad. */
export function isValidToken(modality: Modality, token: string): boolean {
  return lookupValue(SCORING[modality], token) !== undefined;
}

/**
 * Valor canónico de un token.
 *
 * @throws {DomainError} `INVALID_TOKEN` si el token no pertenece a la modalidad.
 */
export function tokenValue(modality: Modality, token: string): number {
  const value = lookupValue(SCORING[modality], token);
  if (value === undefined) {
    throw new DomainError(
      'INVALID_TOKEN',
      `El token "${token}" no es válido para la modalidad "${modality}".`,
    );
  }
  return value;
}

/** Puntaje máximo posible de un blanco. */
export function maxTargetScore(modality: Modality, arrows: number): number {
  return SCORING[modality].maxPerArrow * arrows;
}

/** Un blanco del recorrido, en lo que hace falta para calcular el máximo. */
export interface TargetLike {
  readonly modality: Modality;
  readonly arrows: number;
}

/**
 * Puntaje máximo posible del torneo completo.
 *
 * Es lo que hace comparables los puntajes entre torneos multitarget con
 * configuraciones distintas, vía `normalizedPct`. Ver `docs/DOMAIN_WA.md` §9.2.
 */
export function maxPossibleScore(targets: readonly TargetLike[]): number {
  return targets.reduce((acc, t) => acc + maxTargetScore(t.modality, t.arrows), 0);
}

function countToken(arrows: readonly string[], token: string): number {
  let n = 0;
  for (const a of arrows) {
    if (a === token) n++;
  }
  return n;
}

/**
 * Valida y computa el puntaje de un blanco.
 *
 * No exige orden descendente: es una convención de carga de la UI y el orden no
 * altera el puntaje. Ver `docs/DOMAIN_WA.md` §2.
 */
export function validateTargetScore(
  modality: Modality,
  arrowsPerTarget: number,
  arrows: readonly string[],
): TargetValidationResult {
  if (arrows.length !== arrowsPerTarget) {
    return {
      ok: false,
      error: { code: 'ARROW_COUNT', expected: arrowsPerTarget, got: arrows.length },
    };
  }

  const cfg = SCORING[modality];
  let total = 0;
  let tenCount = 0;

  // `entries()` en vez de índice numérico: con `noUncheckedIndexedAccess`, un
  // `arrows[i]` obliga a un fallback que nunca se ejecuta y queda como rama muerta.
  for (const [i, token] of arrows.entries()) {
    const value = lookupValue(cfg, token);
    if (value === undefined) {
      return { ok: false, error: { code: 'INVALID_TOKEN', index: i, token } };
    }
    total += value;
    if (value === 10) tenCount++;
  }

  return {
    ok: true,
    value: {
      total,
      innerCount: countToken(arrows, cfg.innerToken),
      xCount: cfg.hasX ? countToken(arrows, X_TOKEN) : 0,
      tenCount,
      mCount: countToken(arrows, MISS_TOKEN),
      tiebreakCounts: cfg.tiebreakTokens.map((t) => countToken(arrows, t)),
    },
  };
}

/**
 * Ordena las flechas de mayor a menor para mostrarlas (notación de planilla).
 * A igual valor, el token inner va primero. Los tokens desconocidos quedan al
 * final: ordenar no es validar.
 *
 * No muta el array recibido.
 */
export function sortArrowsDescending(
  modality: Modality,
  arrows: readonly string[],
): readonly string[] {
  const cfg = SCORING[modality];

  return [...arrows].sort((a, b) => {
    const delta = (lookupValue(cfg, b) ?? -1) - (lookupValue(cfg, a) ?? -1);
    if (delta !== 0) return delta;
    if (a === cfg.innerToken) return -1;
    if (b === cfg.innerToken) return 1;
    return 0;
  });
}
