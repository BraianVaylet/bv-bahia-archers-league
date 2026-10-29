/**
 * Podio y modos del ranking.
 *
 * Lo muestran **dos apps**: la landing y WAFA. Los paquetes no comparten
 * componentes —tampoco comparten bundle, y es a propósito— pero sí comparten la
 * decisión: qué medalla lleva cada puesto y cómo se llama cada modo no debería
 * divergir entre las dos pantallas.
 *
 * Lo que se duplica es el JSX; esto, no.
 *
 * Ver `docs/DESIGN_SYSTEM.md` §10 · `docs/DOMAIN_WA.md` §9.
 */

export interface Medalla {
  readonly emoji: string;
  /** Para el `aria-label`: el emoji **nunca** va solo. */
  readonly nombre: string;
}

const MEDALLAS: Record<number, Medalla> = {
  1: { emoji: '🥇', nombre: 'primer puesto' },
  2: { emoji: '🥈', nombre: 'segundo puesto' },
  3: { emoji: '🥉', nombre: 'tercer puesto' },
};

/** La medalla del puesto, o `undefined` del cuarto en adelante. */
export function medallaDe(puesto: number | undefined): Medalla | undefined {
  return puesto === undefined ? undefined : MEDALLAS[puesto];
}

/**
 * Etiqueta del único modo de ranking de liga, con el `bestN` vigente.
 *
 * No es una constante: `bestN` viene de `LEAGUE_BEST_N` (`BE-18`) y puede
 * cambiar sin redeploy, así que la etiqueta nunca escribe «2» a fuego.
 */
export function etiquetaDeMejorDeN(bestN: number): string {
  return `Mejor de ${bestN}`;
}
