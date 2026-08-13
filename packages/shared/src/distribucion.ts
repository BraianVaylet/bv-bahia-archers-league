/**
 * Reparto porcentual de un conjunto.
 *
 * Suena a formateo y no lo es. Con catorce blancos, seis en 3D son el 42,857…%
 * y **redondear cada parte por su cuenta da 99% o 101%**. Un renglón que dice
 * «50% campo · 21% 3D · 29% sala» y no suma cien hace dudar del resto de la
 * pantalla, que es lo último que se quiere en la que decide si un torneo se
 * puede correr.
 *
 * Se usa el **método del resto mayor**: se reparte la parte entera de cada
 * porcentaje y los puntos que sobran van, de a uno, a las partes con mayor
 * resto. Es el mismo método con el que se reparten bancas, y por la misma
 * razón: el total tiene que cerrar.
 */

import { BOW_CATEGORIES, type BowCategory, MODALITIES, type Modality } from './domain.js';

/**
 * Convierte conteos en porcentajes enteros que **suman exactamente 100**.
 *
 * Las partes en cero se descartan: «0% sala» es ruido en un torneo sin sala.
 * A igualdad de resto gana la que viene primero, para que dos pantallas con
 * los mismos datos muestren los mismos números.
 */
export function repartirPorcentajes<K extends string>(
  conteos: Readonly<Record<K, number>>,
): Record<K, number> {
  const entradas = (Object.entries(conteos) as [K, number][]).filter(([, n]) => n > 0);
  const total = entradas.reduce((n, [, c]) => n + c, 0);

  if (total === 0) return {} as Record<K, number>;

  const crudos = entradas.map(([clave, count], orden) => {
    const exacto = (count * 100) / total;
    const entero = Math.floor(exacto);
    return { clave, entero, resto: exacto - entero, orden };
  });

  let sobran = 100 - crudos.reduce((n, x) => n + x.entero, 0);

  // De mayor resto a menor; a igualdad, el que apareció primero.
  const porResto = [...crudos].sort((a, b) => b.resto - a.resto || a.orden - b.orden);
  for (const parte of porResto) {
    if (sobran <= 0) break;
    parte.entero++;
    sobran--;
  }

  const salida = {} as Record<K, number>;
  for (const { clave, entero } of crudos) salida[clave] = entero;
  return salida;
}

export interface ParteDeModalidad {
  readonly modality: Modality;
  readonly count: number;
  readonly pct: number;
}

/**
 * Qué proporción del recorrido es de cada modalidad.
 *
 * Ordenado de mayor a menor. A igualdad manda el orden del catálogo, no el de
 * aparición: dos torneos con el mismo reparto se leen igual.
 */
export function distribucionDeModalidades(
  modalidades: readonly Modality[],
): readonly ParteDeModalidad[] {
  const conteos = {} as Record<Modality, number>;
  for (const m of MODALITIES) conteos[m] = 0;
  for (const m of modalidades) conteos[m]++;

  const pcts = repartirPorcentajes(conteos);

  return MODALITIES.filter((m) => conteos[m] > 0)
    .map((m) => ({ modality: m, count: conteos[m], pct: pcts[m] ?? 0 }))
    .sort(
      (a, b) =>
        b.count - a.count || MODALITIES.indexOf(a.modality) - MODALITIES.indexOf(b.modality),
    );
}

export interface ParteDeCategoria {
  readonly category: BowCategory;
  readonly count: number;
  readonly pct: number;
}

/** Lo mismo para las categorías de los participantes. */
export function distribucionDeCategorias(
  categorias: readonly BowCategory[],
): readonly ParteDeCategoria[] {
  const conteos = {} as Record<BowCategory, number>;
  for (const c of BOW_CATEGORIES) conteos[c] = 0;
  for (const c of categorias) conteos[c]++;

  const pcts = repartirPorcentajes(conteos);

  return BOW_CATEGORIES.filter((c) => conteos[c] > 0)
    .map((c) => ({ category: c, count: conteos[c], pct: pcts[c] ?? 0 }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        BOW_CATEGORIES.indexOf(a.category) - BOW_CATEGORIES.indexOf(b.category),
    );
}
