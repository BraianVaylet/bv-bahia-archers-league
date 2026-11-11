import type { BowCategory, Sex } from '@bal/shared';

export interface ArcherRow {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;
  readonly sex: Sex | null;
  readonly dni: string | null;
  /** `true` si falta `sex` o `dni` (padrón viejo). Decisión 6: no se fuerza a completarlo. */
  readonly profileIncomplete: boolean;
  readonly archived: boolean;
  /** Participó de algún torneo, así que **no se puede borrar**. */
  readonly participated: boolean;
  /** En cuántos torneos jugó. Distingue al que compite del que está en el padrón. */
  readonly tournamentCount: number;
}

/** Lo que se edita de un arquero, con `id` si ya existe. */
export interface Borrador {
  readonly id?: string;
  firstName: string;
  lastName: string;
  category: BowCategory;
  sex: Sex | '';
  dni: string;
}

export const BORRADOR_VACIO: Borrador = {
  firstName: '',
  lastName: '',
  category: 'raso',
  sex: '',
  dni: '',
};

/**
 * Lo que se le manda al servidor al crear o editar un arquero.
 *
 * **Un solo lugar para las dos altas** (`FE-39`): el padrón y el wizard de torneo armaban el cuerpo
 * cada uno a su manera, y el del wizard se quedó sin `sex` ni `dni` cuando `FE-29` los agregó.
 *
 * Sexo y DNI en blanco viajan como `null`, no como `''`: son opcionales (decisión 6 de la Fase 8)
 * y el servidor distingue «no cargado» de un valor.
 */
export function aCuerpoDeArquero(b: Borrador) {
  return {
    firstName: b.firstName,
    lastName: b.lastName,
    category: b.category,
    sex: b.sex || null,
    dni: b.dni.trim() || null,
  };
}

export const ETIQUETA_DE_SEXO: Record<Sex, string> = {
  femenino: 'Femenino',
  masculino: 'Masculino',
};
