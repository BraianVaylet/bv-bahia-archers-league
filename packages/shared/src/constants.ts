/**
 * Catálogos con los valores del reglamento.
 *
 * Las tablas de acá se escriben **explícitas y legibles**, no generadas, para que
 * se puedan cotejar línea por línea contra `docs/DOMAIN_WA.md` y contra el
 * reglamento. Es el único lugar del sistema donde viven estos números.
 */

import {
  type BowCategory,
  DomainError,
  ELEVEN_TOKEN,
  MISS_TOKEN,
  type Modality,
  STAKES,
  type Stake,
  type StakeMap,
  X_TOKEN,
  X6_TOKEN,
} from './domain.js';

// ── Modalidades ──────────────────────────────────────────────────────────────

export interface ModalityConfig {
  readonly key: Modality;
  readonly label: string;
  /** Flechas por blanco según el reglamento. El admin puede sobreescribirlo. */
  readonly defaultArrows: number;
  readonly maxPerArrow: number;
  /** Tokens válidos, en orden descendente de valor. `M` siempre último. */
  readonly scoringSet: readonly string[];
  /** Valor canónico de cada token del set. */
  readonly values: Readonly<Record<string, number>>;
  /** Token de desempate primario. */
  readonly innerToken: string;
  /** Tokens de desempate, en orden de prioridad. */
  readonly tiebreakTokens: readonly string[];
  /** Si la modalidad distingue X (solo sala y aire libre). */
  readonly hasX: boolean;
}

/** Set de valores compartido por sala y aire libre (cara WA de 10 anillos). */
const DIEZ_ANILLOS = {
  [X_TOKEN]: 10,
  '10': 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
  '1': 1,
  [MISS_TOKEN]: 0,
} as const;

const DIEZ_ANILLOS_SET = [
  X_TOKEN,
  '10',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
  '1',
  MISS_TOKEN,
] as const;

/** docs/DOMAIN_WA.md §1 — tabla de modalidades. */
export const SCORING: Readonly<Record<Modality, ModalityConfig>> = {
  sala: {
    key: 'sala',
    label: 'Sala 18 m',
    defaultArrows: 3,
    maxPerArrow: 10,
    scoringSet: DIEZ_ANILLOS_SET,
    values: DIEZ_ANILLOS,
    innerToken: X_TOKEN,
    tiebreakTokens: [X_TOKEN, '10'],
    hasX: true,
  },

  aire_libre: {
    key: 'aire_libre',
    label: 'Aire libre',
    defaultArrows: 6,
    maxPerArrow: 10,
    scoringSet: DIEZ_ANILLOS_SET,
    values: DIEZ_ANILLOS,
    innerToken: X_TOKEN,
    tiebreakTokens: [X_TOKEN, '10'],
    hasX: true,
  },

  campo: {
    key: 'campo',
    label: 'Juego de campo',
    defaultArrows: 3,
    maxPerArrow: 6,
    scoringSet: [X6_TOKEN, '6', '5', '4', '3', '2', '1', MISS_TOKEN],
    values: {
      [X6_TOKEN]: 6,
      '6': 6,
      '5': 5,
      '4': 4,
      '3': 3,
      '2': 2,
      '1': 1,
      [MISS_TOKEN]: 0,
    },
    innerToken: X6_TOKEN,
    tiebreakTokens: [X6_TOKEN, '6'],
    hasX: false,
  },

  '3d': {
    key: '3d',
    label: '3D',
    defaultArrows: 2,
    maxPerArrow: 11,
    scoringSet: [ELEVEN_TOKEN, '10', '8', '5', MISS_TOKEN],
    values: {
      [ELEVEN_TOKEN]: 11,
      '10': 10,
      '8': 8,
      '5': 5,
      [MISS_TOKEN]: 0,
    },
    innerToken: ELEVEN_TOKEN,
    tiebreakTokens: [ELEVEN_TOKEN, '10'],
    hasX: false,
  },
};

/** Rango de flechas por blanco que el admin puede configurar. */
export const MIN_ARROWS_PER_TARGET = 1;
export const MAX_ARROWS_PER_TARGET = 12;

// ── Categorías ───────────────────────────────────────────────────────────────

export interface CategoryInfo {
  readonly key: BowCategory;
  readonly label: string;
  /** Orden de presentación, 1-based. */
  readonly sort: number;
  /**
   * `false` solo para `escuela`. Sostiene la restricción H3: ninguna patrulla
   * puede ser 100% escuela. Ver `docs/DOMAIN_WA.md` §5.
   */
  readonly senior: boolean;
}

export const CATEGORY_INFO: Readonly<Record<BowCategory, CategoryInfo>> = {
  recurvo: { key: 'recurvo', label: 'Recurvo olímpico', sort: 1, senior: true },
  compuesto: { key: 'compuesto', label: 'Compuesto libre', sort: 2, senior: true },
  cazador: { key: 'cazador', label: 'Compuesto cazador', sort: 3, senior: true },
  razo: { key: 'razo', label: 'Razo', sort: 4, senior: true },
  tradicional: { key: 'tradicional', label: 'Tradicional', sort: 5, senior: true },
  longbow: { key: 'longbow', label: 'Longbow', sort: 6, senior: true },
  escuela: { key: 'escuela', label: 'Escuela', sort: 7, senior: false },
};

/** `true` si la categoría es de escuela (no senior). */
export function isEscuela(category: BowCategory): boolean {
  return !CATEGORY_INFO[category].senior;
}

// ── Estacas ──────────────────────────────────────────────────────────────────

/** docs/DOMAIN_WA.md §4 — mapeo por defecto, editable por torneo. */
export const DEFAULT_STAKE_MAP: StakeMap = {
  roja: ['recurvo', 'compuesto', 'cazador'],
  azul: ['razo', 'tradicional', 'longbow'],
  amarilla: ['escuela'],
};

/**
 * Estaca que le corresponde a una categoría.
 *
 * @throws {DomainError} `STAKE_MAP_INCOMPLETE` si el mapeo no cubre la categoría.
 */
export function stakeForCategory(
  category: BowCategory,
  stakeMap: StakeMap = DEFAULT_STAKE_MAP,
): Stake {
  for (const stake of STAKES) {
    if (stakeMap[stake].includes(category)) {
      return stake;
    }
  }

  throw new DomainError(
    'STAKE_MAP_INCOMPLETE',
    `El mapeo de estacas no cubre la categoría "${category}".`,
  );
}

// ── Puntos de liga ───────────────────────────────────────────────────────────

/**
 * Puntos por puesto en el podio de cada categoría, 1-based.
 * Del 6.º en adelante, 0. Ver `docs/DOMAIN_WA.md` §9.1.
 */
export const LEAGUE_POINTS_BY_POSITION = [5, 4, 3, 2, 1] as const;

/** Torneos publicados mínimos para figurar en los rankings de liga. */
export const MIN_TOURNAMENTS_FOR_RANKING = 2;
