/**
 * Lo que la portada decide antes de dibujar (`REF7-6`, `docs/post/ref-7/DISENO.md` §5.1).
 *
 * Funciones puras, sin I/O: el componente pide los datos y pinta lo que salga de acá. No son reglas
 * de negocio —esas viven en `@bal/shared`—: son decisiones de presentación de esta pantalla.
 */

import type { TournamentStatus } from '@bal/shared';

export interface TorneoListado {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  readonly status: TournamentStatus;
  readonly targetCount: number;
  readonly participantCount: number;
}

/**
 * La tarjeta que flota sobre la foto del hero: el torneo **en curso**; si no hay, la última fecha
 * publicada; si no hay torneos, ninguna. `/api/public/tournaments` llega del más nuevo al más viejo.
 */
export function torneoDestacado<T extends TorneoListado>(torneos: readonly T[]): T | null {
  return (
    torneos.find((t) => t.status === 'en_proceso') ??
    torneos.find((t) => t.status === 'publicado') ??
    null
  );
}

/** Hasta tres para la sección «Torneos»: los en curso primero, después del más nuevo al más viejo. */
export function torneosDeLaPortada<T extends TorneoListado>(torneos: readonly T[]): T[] {
  const enCurso = torneos.filter((t) => t.status === 'en_proceso');
  const resto = torneos.filter((t) => t.status !== 'en_proceso');
  return [...enCurso, ...resto].slice(0, 3);
}

/**
 * El avance de **todas** las patrullas juntas, para un solo anillo: un segmento por blanco de cada
 * patrulla. Una patrulla no puede sumar más blancos que los del recorrido.
 */
export function avanceAgregado(detalle: {
  readonly targets: readonly unknown[];
  readonly patrols: readonly { readonly targetsCompleted: number }[];
}): { total: number; completados: number; patrullas: number } {
  const blancos = detalle.targets.length;
  return {
    total: blancos * detalle.patrols.length,
    completados: detalle.patrols.reduce(
      (n, p) => n + Math.min(Math.max(p.targetsCompleted, 0), blancos),
      0,
    ),
    patrullas: detalle.patrols.length,
  };
}

/**
 * Los valores de flecha de una modalidad, como fichas. Salen de `SCORING[m].scoringSet`, nunca
 * escritos a mano. Si son más de siete, se abrevian: los cuatro primeros, «…» y los dos últimos.
 */
export function fichasDelSet(set: readonly string[]): string[] {
  return set.length > 7 ? [...set.slice(0, 4), '…', ...set.slice(-2)] : [...set];
}

const PUNTOS = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `89,39`: el porcentaje normalizado del ranking, con coma decimal. */
export function formatearPuntos(pct: number): string {
  return PUNTOS.format(pct);
}
