import { describe, expect, it } from 'vitest';
import { CATEGORY_INFO, SCORING } from '../src/constants.js';
import type { BowCategory, Modality } from '../src/domain.js';

/**
 * Las etiquetas que se muestran, fijadas (`REF4-1`).
 *
 * **Son etiquetas, no identidad.** Las claves del dominio —`recurvo`,
 * `compuesto`, `campo`— no cambian nunca: viajan en la base, en las URLs y en
 * los `data-testid`. Lo que cambia acá es sólo lo que lee un humano.
 *
 * Se acortaron porque el ancho de un celular es el recurso escaso de este
 * proyecto: «Compuesto cazador» al lado de un nombre y una estaca no entra en
 * 360 px, y lo que se rompía eran las pantallas, no las etiquetas.
 */

describe('etiquetas de categoría', () => {
  /** El diccionario del pedido, tal cual. */
  const ESPERADAS: Record<BowCategory, string> = {
    recurvo: 'Recurvo',
    compuesto: 'Compuesto',
    cazador: 'Cazador',
    razo: 'Razo',
    tradicional: 'Tradicional',
    longbow: 'Longbow',
    // El pedido no la nombra: queda como estaba.
    escuela: 'Escuela',
  };

  it('son las del diccionario', () => {
    for (const [clave, etiqueta] of Object.entries(ESPERADAS)) {
      expect(CATEGORY_INFO[clave as BowCategory].label).toBe(etiqueta);
    }
  });

  /**
   * **Toda categoría tiene etiqueta, y no vacía.**
   *
   * Una categoría nueva sin etiqueta no rompe el typecheck —el tipo es
   * `string`— y aparecería como un hueco en la interfaz.
   */
  it('ninguna queda sin etiqueta', () => {
    for (const info of Object.values(CATEGORY_INFO)) {
      expect(info.label.trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * El límite que hace entrar la fila del celular. Con «Compuesto cazador»
   * —17 caracteres— la fila de la landing desbordaba a 360 px.
   */
  it('ninguna pasa de 11 caracteres', () => {
    for (const info of Object.values(CATEGORY_INFO)) {
      expect(info.label.length, `«${info.label}» es muy larga`).toBeLessThanOrEqual(11);
    }
  });

  /** Dos categorías con la misma etiqueta serían indistinguibles en pantalla. */
  it('no se repiten entre sí', () => {
    const etiquetas = Object.values(CATEGORY_INFO).map((i) => i.label);
    expect(new Set(etiquetas).size).toBe(etiquetas.length);
  });
});

describe('etiquetas de modalidad', () => {
  const ESPERADAS: Record<Modality, string> = {
    sala: '18 m',
    aire_libre: 'Aire libre',
    campo: 'Campo',
    '3d': '3D',
  };

  it('son las del diccionario', () => {
    for (const [clave, etiqueta] of Object.entries(ESPERADAS)) {
      expect(SCORING[clave as Modality].label).toBe(etiqueta);
    }
  });

  it('ninguna queda sin etiqueta', () => {
    for (const info of Object.values(SCORING)) {
      expect(info.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('no se repiten entre sí', () => {
    const etiquetas = Object.values(SCORING).map((i) => i.label);
    expect(new Set(etiquetas).size).toBe(etiquetas.length);
  });
});
