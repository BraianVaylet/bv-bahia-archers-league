import type { BowCategory } from '@bal/shared';

export interface Temporada {
  readonly id: string;
  readonly name: string;
}

export interface Entrada {
  readonly archerId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly tournamentsPlayed: number;
  readonly bestNormalizedPct: number;
  readonly bestNAvgPct: number;
  readonly position?: number;
  readonly tied?: boolean;
}

export interface VistaDeRanking {
  readonly ranked: readonly Entrada[];
  readonly notYetEligible: readonly Entrada[];
}

export interface CategoriaRankeada {
  readonly category: BowCategory;
  readonly general: VistaDeRanking;
  readonly femenino: VistaDeRanking;
  readonly masculino: VistaDeRanking;
}

export const VISTAS = [
  { key: 'general', label: 'General' },
  { key: 'femenino', label: 'Femenino' },
  { key: 'masculino', label: 'Masculino' },
] as const;

export type Vista = (typeof VISTAS)[number]['key'];
