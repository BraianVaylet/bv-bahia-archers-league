/**
 * Tipos y catálogos del dominio.
 *
 * Fuente normativa: `docs/DOMAIN_WA.md` §1, §3 y §4.
 * Cualquier cambio acá exige actualizar ese documento y registrarlo en la bitácora.
 */

// ── Modalidades ──────────────────────────────────────────────────────────────

/**
 * Modalidad de un blanco. **Es por blanco, no por torneo**: un mismo recorrido
 * mezcla las cuatro. Un `11` es válido en un blanco 3D e inválido en el de sala
 * del mismo torneo.
 */
export const MODALITIES = ['sala', 'aire_libre', 'campo', '3d'] as const;

export type Modality = (typeof MODALITIES)[number];

// ── Categorías de arco ───────────────────────────────────────────────────────

/** Las siete categorías de la liga, en orden de presentación. */
export const BOW_CATEGORIES = [
  'recurvo',
  'compuesto',
  'cazador',
  'razo',
  'tradicional',
  'longbow',
  'escuela',
] as const;

export type BowCategory = (typeof BOW_CATEGORIES)[number];

// ── Estacas ──────────────────────────────────────────────────────────────────

/** Estacas por cercanía al blanco: roja (más lejos) › azul › amarilla. */
export const STAKES = ['roja', 'azul', 'amarilla'] as const;

export type Stake = (typeof STAKES)[number];

/** Asignación de categorías a estacas. Editable por torneo. */
export type StakeMap = Readonly<Record<Stake, readonly BowCategory[]>>;

// ── Tokens de flecha ─────────────────────────────────────────────────────────

/** Flecha sin puntaje. Se registra explícitamente, nunca se omite. */
export const MISS_TOKEN = 'M';

/** Anillo interno del 10 (sala y aire libre). Vale 10 y cuenta para desempate. */
export const X_TOKEN = 'X';

/** Inner-6 del juego de campo. Vale 6 y cuenta para desempate. Opcional. */
export const X6_TOKEN = 'X6';

/** Zona central del 3D. Vale 11 y cuenta para desempate. */
export const ELEVEN_TOKEN = '11';

/** Un token de flecha, tal como lo manda el cliente. El valor lo deriva el servidor. */
export type ArrowToken = string;

// ── Unidades de tiro ─────────────────────────────────────────────────────────

/** Las dos unidades de una patrulla. `A` tira primero. */
export const UNITS = ['A', 'B'] as const;

export type Unit = (typeof UNITS)[number];

/** Posición dentro de una unidad de dos arqueros. */
export const POSITIONS = ['izquierda', 'derecha'] as const;

export type Position = (typeof POSITIONS)[number];

// ── Estados ──────────────────────────────────────────────────────────────────

/** Ver la máquina de estados en `docs/FUNCTIONAL.md` §8. */
export const TOURNAMENT_STATUSES = [
  'sin_iniciar',
  'en_proceso',
  'completado',
  'publicado',
] as const;

export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const PATROL_STATUSES = ['pendiente', 'en_curso', 'pendiente_firma', 'cerrada'] as const;

export type PatrolStatus = (typeof PATROL_STATUSES)[number];

// ── Errores ──────────────────────────────────────────────────────────────────

/**
 * Error de dominio con `code`. Nunca se lanzan strings sueltos.
 */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
