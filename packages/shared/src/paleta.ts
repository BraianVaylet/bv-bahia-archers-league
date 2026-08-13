/**
 * Color por categoría y por modalidad.
 *
 * **La regla 8 se mantiene**: rojo, azul y amarillo son semántica reservada de
 * estaca y no se usan para nada más. Eso deja fuera tres familias enteras de
 * tono, y con las que quedan —verde, teal, violeta, magenta, tierra y los
 * neutros— hay que cubrir siete categorías y cuatro modalidades.
 *
 * Se resuelve así:
 *
 * 1. **El color nunca va solo.** Cada chip lleva su ícono y su texto. El color
 *    acelera el reconocimiento de algo que ya está escrito; no lo reemplaza.
 *    Ver `docs/DESIGN_SYSTEM.md` §10.
 * 2. **Categoría y modalidad se distinguen por forma, no sólo por tono.** La
 *    categoría es una píldora; la modalidad, un rectángulo. Por eso los dos
 *    ejes pueden compartir familia de color sin que se confundan: nunca dicen
 *    lo mismo y nunca se ven iguales.
 * 3. **Tonos apagados.** Los de estaca son saturados a propósito, para
 *    encontrarlos con el sol de frente. Estos son sordos: pertenecen a otro
 *    registro visual y no compiten por esa atención.
 *
 * Los valores son pares claro/oscuro. El de cada tema tiene que llegar a
 * contraste AA contra el fondo de ese tema, y hay un test que lo mide.
 */

import type { BowCategory, Modality } from './domain.js';

export interface ParDeColor {
  /** Sobre `--bg` claro. */
  readonly claro: string;
  /** Sobre `--bg` oscuro. */
  readonly oscuro: string;
}

/**
 * Siete categorías.
 *
 * `escuela` es la única **neutra**, y no por falta de tonos: es la única que no
 * es senior y la única que no puntúa para el ranking. Que no tenga color propio
 * dice eso mismo sin una nota al pie.
 */
export const COLOR_DE_CATEGORIA: Readonly<Record<BowCategory, ParDeColor>> = {
  recurvo: { claro: '#0a6f6a', oscuro: '#5ecfc4' },
  compuesto: { claro: '#5f39ad', oscuro: '#b39cf5' },
  cazador: { claro: '#8e2560', oscuro: '#f08fc0' },
  razo: { claro: '#47661a', oscuro: '#a8d15c' },
  // Tierra apagada, a propósito: un marrón es un rojo oscuro, y sólo deja de
  // leerse como estaca si baja la saturación. El test lo mide.
  tradicional: { claro: '#6b4526', oscuro: '#c99a72' },
  longbow: { claro: '#0f6f4d', oscuro: '#6fd6a8' },
  escuela: { claro: '#4d5260', oscuro: '#b0b6c2' },
};

/** Cuatro modalidades. El tono evoca el escenario, no el puntaje. */
export const COLOR_DE_MODALIDAD: Readonly<Record<Modality, ParDeColor>> = {
  sala: { claro: '#5f39ad', oscuro: '#b39cf5' },
  aire_libre: { claro: '#0a6f6a', oscuro: '#5ecfc4' },
  campo: { claro: '#41590f', oscuro: '#a8c85a' },
  '3d': { claro: '#7d4a2e', oscuro: '#d19b74' },
};

/**
 * Los tres tonos de estaca, para que un test pueda comprobar que ningún color
 * de esta paleta se les parezca. Duplicarlos acá es a propósito: si alguien
 * cambia un valor en `tokens.css` sin tocar este, el test lo dice.
 */
export const TONOS_DE_ESTACA = ['#d22b2b', '#1d5fd6', '#f5c518'] as const;
