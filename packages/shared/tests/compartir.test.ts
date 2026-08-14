import { describe, expect, it } from 'vitest';
import { TOPE_AL_COMPARTIR, textoDeRanking } from '../src/compartir.js';

/**
 * El ranking como texto (REF2-6).
 *
 * Lo que se comparte **tiene que decir de qué modo es**. Los dos modos ordenan
 * distinto y dan podios distintos: mandar «el ranking» a secas es mandar una
 * lista de números sin unidad.
 */

const linea = (position: number, lastName: string, valor: number) => ({
  position,
  firstName: 'Nombre',
  lastName,
  valor,
});

describe('textoDeRanking', () => {
  it('dice la temporada y el modo en el encabezado', () => {
    const t = textoDeRanking({
      temporada: 'Liga 2026',
      modo: 'position',
      categorias: [{ category: 'razo', ranked: [linea(1, 'Pérez', 12)] }],
    });

    expect(t.split('\n')[0]).toMatch(/Liga 2026/);
    expect(t.split('\n')[0]).toMatch(/[Pp]untos/);
  });

  /**
   * **El mismo ranking en el otro modo dice otra cosa.** Es la razón de ser de
   * esta función: si el texto no cambia con el modo, compartir «mejor de 2»
   * manda los puntos y nadie lo nota.
   */
  it('el modo cambia el encabezado Y la unidad', () => {
    const categorias = [{ category: 'razo' as const, ranked: [linea(1, 'Pérez', 85)] }];

    const porPuntos = textoDeRanking({ temporada: 'Liga', modo: 'position', categorias });
    const mejorDeDos = textoDeRanking({ temporada: 'Liga', modo: 'best_two', categorias });

    expect(porPuntos).not.toBe(mejorDeDos);
    expect(porPuntos).toMatch(/85 pts/);
    expect(mejorDeDos).toMatch(/85 %/);
  });

  it('agrupa por categoría con su nombre', () => {
    const t = textoDeRanking({
      temporada: 'Liga',
      modo: 'position',
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
      modo: 'position',
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
      modo: 'position',
      categorias: [{ category: 'razo', ranked }],
    });

    expect(t).toMatch(new RegExp(`Ap${TOPE_AL_COMPARTIR}`));
    expect(t).not.toMatch(new RegExp(`Ap${TOPE_AL_COMPARTIR + 1}\\b`));
  });

  // Un título de categoría sin nadie debajo parece un error en un celular.
  it('no menciona categorías sin nadie rankeado', () => {
    const t = textoDeRanking({
      temporada: 'Liga',
      modo: 'position',
      categorias: [
        { category: 'razo', ranked: [linea(1, 'Pérez', 12)] },
        { category: 'longbow', ranked: [] },
      ],
    });

    expect(t).toMatch(/Razo/);
    expect(t).not.toMatch(/Longbow/);
  });

  it('sin nadie rankeado lo dice, en vez de mandar un título suelto', () => {
    const t = textoDeRanking({ temporada: 'Liga', modo: 'position', categorias: [] });
    expect(t).toMatch(/Todavía no hay nadie rankeado/);
  });

  // Se pega en WhatsApp, donde una tabla se desarma.
  it('no usa markdown ni tabulaciones', () => {
    const t = textoDeRanking({
      temporada: 'Liga',
      modo: 'position',
      categorias: [{ category: 'razo', ranked: [linea(1, 'Pérez', 12)] }],
    });

    expect(t).not.toMatch(/[|\t]/);
    expect(t).not.toMatch(/\*\*/);
  });
});
