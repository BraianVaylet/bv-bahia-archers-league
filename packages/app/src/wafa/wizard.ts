/**
 * Lógica del wizard de creación de torneo.
 *
 * Todo lo que decide algo vive acá, puro y sin React: el recorrido, la
 * renumeración de blancos y el aviso de la regla de escuela. Los componentes
 * sólo pintan.
 *
 * Ver `docs/FUNCTIONAL.md` §6.3.
 */

import {
  type BowCategory,
  buildPatrols,
  isEscuela,
  type Modality,
  maxPossibleScore,
  type ParticipantInput,
  SCORING,
} from '@bal/shared';

export interface BlancoBorrador {
  readonly index: number;
  readonly modality: Modality;
  readonly arrows: number;
  readonly description: string | null;
}

export interface ArqueroElegible {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly category: BowCategory;
}

/** Un blanco nuevo, con las flechas que manda el reglamento para su modalidad. */
export function blancoNuevo(index: number, modality: Modality = 'sala'): BlancoBorrador {
  return { index, modality, arrows: SCORING[modality].defaultArrows, description: null };
}

/**
 * Cambia la modalidad de un blanco y **repone las flechas por defecto**.
 *
 * Es lo que casi siempre se quiere: quien pasa un blanco a 3D espera 2 flechas,
 * no las 3 que tenía de sala. Si el admin las había tocado a mano, se pierden —
 * pero conservarlas dejaría un 3D de 6 flechas sin que nadie lo pidiera.
 */
export function conModalidad(blanco: BlancoBorrador, modality: Modality): BlancoBorrador {
  return { ...blanco, modality, arrows: SCORING[modality].defaultArrows };
}

/**
 * Renumera los blancos de 1 a N.
 *
 * El backend exige índices contiguos sin huecos. Se renumera después de cada
 * alta, baja o movimiento, así que el admin nunca ve un hueco ni tiene que
 * arreglarlo a mano.
 */
export function renumerar(blancos: readonly BlancoBorrador[]): BlancoBorrador[] {
  return blancos.map((b, i) => ({ ...b, index: i + 1 }));
}

export function agregarBlanco(blancos: readonly BlancoBorrador[]): BlancoBorrador[] {
  return renumerar([...blancos, blancoNuevo(blancos.length + 1)]);
}

export function eliminarBlanco(
  blancos: readonly BlancoBorrador[],
  index: number,
): BlancoBorrador[] {
  return renumerar(blancos.filter((b) => b.index !== index));
}

/**
 * Mueve un blanco una posición arriba o abajo.
 *
 * En los extremos no hace nada, en vez de envolver al otro lado: envolver
 * sorprende, y el admin está mirando una lista, no un anillo.
 */
export function moverBlanco(
  blancos: readonly BlancoBorrador[],
  index: number,
  direccion: -1 | 1,
): BlancoBorrador[] {
  const desde = blancos.findIndex((b) => b.index === index);
  const hasta = desde + direccion;
  if (desde === -1 || hasta < 0 || hasta >= blancos.length) return [...blancos];

  const copia = [...blancos];
  const [movido] = copia.splice(desde, 1);
  if (movido) copia.splice(hasta, 0, movido);

  return renumerar(copia);
}

/** Puntaje máximo del recorrido. Se recalcula en cada cambio. */
export function maximoDelRecorrido(blancos: readonly BlancoBorrador[]): number {
  return maxPossibleScore(blancos);
}

export interface ConteoCategoria {
  readonly category: BowCategory;
  readonly cantidad: number;
}

/** Cuántos arqueros hay de cada categoría, sin las categorías vacías. */
export function conteoPorCategoria(elegidos: readonly ArqueroElegible[]): ConteoCategoria[] {
  const conteo = new Map<BowCategory, number>();
  for (const a of elegidos) conteo.set(a.category, (conteo.get(a.category) ?? 0) + 1);

  return [...conteo.entries()].map(([category, cantidad]) => ({ category, cantidad }));
}

export type AvisoComposicion =
  | { readonly nivel: 'ok' }
  | { readonly nivel: 'error'; readonly mensaje: string }
  | { readonly nivel: 'aviso'; readonly mensaje: string };

/**
 * Revisa si la composición elegida se va a poder repartir en patrullas.
 *
 * **Corre el mismo algoritmo que el servidor** (`buildPatrols` es puro), así que
 * el aviso no es una heurística que adivina: es el resultado real. Si el plan
 * deja arqueros sin ubicar, se dice **quiénes** y por qué.
 *
 * Ver `docs/DOMAIN_WA.md` §5.
 */
export function avisoDeComposicion(
  elegidos: readonly ArqueroElegible[],
  cantidadBlancos: number,
): AvisoComposicion {
  if (elegidos.length < 2) {
    return { nivel: 'error', mensaje: 'Hacen falta al menos 2 arqueros para armar una patrulla.' };
  }

  const participantes: ParticipantInput[] = elegidos.map((a) => ({
    archerId: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    category: a.category,
  }));

  const plan = buildPatrols(participantes, undefined, Math.max(cantidadBlancos, 1));

  if (plan.unassigned.length > 0) {
    const nombres = plan.unassigned.map((p) => `${p.lastName}, ${p.firstName}`).join(' · ');
    return {
      nivel: 'error',
      mensaje: `No alcanzan los arqueros senior para acompañar a los de escuela. Quedarían sin patrulla: ${nombres}. Sumá un senior más o sacá un arquero de escuela.`,
    };
  }

  if (plan.requiresManualReview) {
    return {
      nivel: 'aviso',
      mensaje:
        'Las patrullas se van a poder armar, pero conviene revisarlas a mano antes de iniciar el torneo.',
    };
  }

  const escuela = elegidos.filter((a) => isEscuela(a.category)).length;
  const seniors = elegidos.length - escuela;

  if (escuela > 0 && seniors < escuela) {
    return {
      nivel: 'aviso',
      mensaje: `Hay ${escuela} de escuela y ${seniors} senior. Va a quedar justo: cada patrulla con escuela necesita al menos un senior que la acompañe.`,
    };
  }

  return { nivel: 'ok' };
}

export interface BorradorTorneo {
  seasonId: string;
  name: string;
  date: string;
  description: string;
  /** Inscripción: un monto único para todos. Ver docs/SECURITY.md §2. */
  payment: { required: boolean; amount: number };
  blancos: BlancoBorrador[];
  elegidos: ArqueroElegible[];
}

export function borradorVacio(): BorradorTorneo {
  return {
    seasonId: '',
    name: '',
    date: '',
    description: '',
    payment: { required: false, amount: 0 },
    blancos: [blancoNuevo(1)],
    elegidos: [],
  };
}

/** Motivo por el que un paso no está completo, o `undefined` si lo está. */
export function problemaDelPaso(paso: number, b: BorradorTorneo): string | undefined {
  if (paso === 1) {
    if (b.name.trim().length < 3) return 'El nombre necesita al menos 3 caracteres.';
    if (!b.date) return 'Falta la fecha.';
    if (!b.seasonId) return 'Elegí una temporada.';
    // El servidor lo rechaza igual; decirlo acá evita el viaje.
    if (b.payment.required && b.payment.amount <= 0) {
      return 'Si el torneo cobra inscripción, poné el monto.';
    }
    return undefined;
  }

  if (paso === 2) {
    return b.blancos.length === 0 ? 'El recorrido necesita al menos un blanco.' : undefined;
  }

  if (paso === 3) {
    const aviso = avisoDeComposicion(b.elegidos, b.blancos.length);
    // Un aviso no frena: es información. Un error sí, porque el servidor lo
    // rechazaría igual y es mejor decirlo acá.
    return aviso.nivel === 'error' ? aviso.mensaje : undefined;
  }

  return undefined;
}

/** El cuerpo que espera `POST /admin/tournaments`. */
export function cuerpoDeCreacion(b: BorradorTorneo) {
  return {
    seasonId: b.seasonId,
    name: b.name.trim(),
    date: b.date,
    description: b.description.trim(),
    // El monto se anula si no se cobra: uno que sobrevive apagado reaparece al
    // volver a marcar la casilla, y el torneo termina cobrando sin que nadie lo
    // haya decidido.
    payment: b.payment.required ? { ...b.payment } : { required: false, amount: 0 },
    targets: b.blancos.map((t) => ({
      index: t.index,
      modality: t.modality,
      arrows: t.arrows,
      description: t.description,
    })),
    archerIds: b.elegidos.map((a) => a.id),
  };
}
