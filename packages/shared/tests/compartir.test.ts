import { describe, expect, it } from 'vitest';
import { TOPE_AL_COMPARTIR, textoDeRanking } from '../src/compartir.js';

/**
 * El ranking como texto (REF2-6, rediseñado en SH-9).
 *
 * El único modo que queda es «mejor de N». El texto **tiene que decir el `N`
 * vigente**: compartir «mejor de 3» sin decir el 3 es mandar un número sin
 * explicar qué significa.
 */

const linea = (position: number, lastName: string, valor: number) => ({
  position,
  firstName: 'Nombre',
  lastName,
  valor,
});

describe('textoDeRanking', () => {
  it('dice la temporada y el bestN vigente en el encabezado', () => {
    const t = textoDeRanking({
      temporada: 'Liga 2026',
      bestN: 2,
      categorias: [{ category: 'razo', ranked: [linea(1, 'Pérez', 85)] }],
    });

    expect(t.split('\n')[0]).toMatch(/Liga 2026/);
    expect(t.split('\n')[0]).toMatch(/Mejor de 2/);
  });

  /** El `bestN` vigente cambia el encabezado, aunque el ranking sea el mismo. */
  it('un bestN distinto cambia el encabezado', () => {
    const categorias = [{ category: 'razo' as const, ranked: [linea(1, 'Pérez', 85)] }];

    const dosMejores = textoDeRanking({ temporada: 'Liga', bestN: 2, categorias });
    const tresMejores = textoDeRanking({ temporada: 'Liga', bestN: 3, categorias });

    expect(dosMejores).not.toBe(tresMejores);
    expect(dosMejores.split('\n')[0]).toMatch(/Mejor de 2/);
    expect(tresMejores.split('\n')[0]).toMatch(/Mejor de 3/);
  });

  it('el valor de cada arquero va en porcentaje', () => {
    const t = textoDeRanking({
      temporada: 'Liga',
      bestN: 2,
      categorias: [{ category: 'razo', ranked: [linea(1, 'Pérez', 85)] }],
    });

    expect(t).toMatch(/85 %/);
  });

  it('agrupa por categoría con su nombre', () => {
    const t = textoDeRanking({
      temporada: 'Liga',
      bestN: 2,
      categorias: [
        { category: 'razo', ranked: [linea(1, 'Pérez', 12)] },
        { category: 'longbow', ranked: [linea(1, 'Gómez', 9)] },
      ],
    });

    expect(t).toMatch(/Razo/);
    expect(t).toMatch(/Longbow/);
    expect(t).toMatch(/Pérez/);
    expect(t).toMatch(/Gómez/);
  });

  // El podio lleva medalla; del cuarto en adelante, el número.
  it('los tres primeros llevan medalla y el resto su puesto', () => {
    const t = textoDeRanking({
      temporada: 'Liga',
      bestN: 2,
      categorias: [
        {
          category: 'razo',
          ranked: [
            linea(1, 'Uno', 5),
            linea(2, 'Dos', 4),
            linea(3, 'Tres', 3),
            linea(4, 'Cuatro', 2),
          ],
        },
      ],
    });

    expect(t).toMatch(/🥇 Uno/);
    expect(t).toMatch(/🥈 Dos/);
    expect(t).toMatch(/🥉 Tres/);
    expect(t).toMatch(/4º Cuatro/);
  });

  it('corta en el tope para que entre en un mensaje', () => {
    const ranked = Array.from({ length: 12 }, (_, i) => linea(i + 1, `Ap${i + 1}`, 12 - i));
    const t = textoDeRanking({
      temporada: 'Liga',
      bestN: 2,
      categorias: [{ category: 'razo', ranked }],
    });

    expect(t).toMatch(new RegExp(`Ap${TOPE_AL_COMPARTIR}`));
    expect(t).not.toMatch(new RegExp(`Ap${TOPE_AL_COMPARTIR + 1}\\b`));
  });

  // Un título de categoría sin nadie debajo parece un error en un celular.
  it('no menciona categorías sin nadie rankeado', () => {
    const t = textoDeRanking({
      temporada: 'Liga',
      bestN: 2,
      categorias: [
        { category: 'razo', ranked: [linea(1, 'Pérez', 12)] },
        { category: 'longbow', ranked: [] },
      ],
    });

    expect(t).toMatch(/Razo/);
    expect(t).not.toMatch(/Longbow/);
  });

  it('sin nadie rankeado lo dice, en vez de mandar un título suelto', () => {
    const t = textoDeRanking({ temporada: 'Liga', bestN: 2, categorias: [] });
    expect(t).toMatch(/Todavía no hay nadie rankeado/);
  });

  // Se pega en WhatsApp, donde una tabla se desarma.
  it('no usa markdown ni tabulaciones', () => {
    const t = textoDeRanking({
      temporada: 'Liga',
      bestN: 2,
      categorias: [{ category: 'razo', ranked: [linea(1, 'Pérez', 12)] }],
    });

    expect(t).not.toMatch(/[|\t]/);
    expect(t).not.toMatch(/\*\*/);
  });
});
