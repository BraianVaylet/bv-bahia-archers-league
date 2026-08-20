import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clasesDeTarjeta } from './Tarjeta.js';

/**
 * La tarjeta compartida (`REF5-2`).
 *
 * Estaba escrita a mano **29 veces en 18 archivos**, con derivas que no
 * significaban nada: unas con `p-3` y otras con `p-4`, unas sobre `--surface` y
 * otras sobre `--surface-2`.
 */

describe('clasesDeTarjeta', () => {
  it('por defecto: radio de tarjeta, borde y la superficie base', () => {
    const clases = clasesDeTarjeta();

    expect(clases).toContain('rounded-[var(--radius-lg)]');
    expect(clases).toContain('border');
    expect(clases).toContain('bg-[var(--surface)]');
  });

  /**
   * **Ninguna sombra, nunca.** `DESIGN_SYSTEM.md` §4: la elevación es por borde
   * y fondo porque las sombras se disuelven bajo el sol, y la única real está
   * reservada para el teclado de scoring.
   */
  it('no eleva con sombra', () => {
    for (const densidad of ['normal', 'amplia'] as const) {
      for (const nivel of ['base', 'anidada'] as const) {
        expect(clasesDeTarjeta({ densidad, nivel })).not.toContain('shadow');
      }
    }
  });

  it('la densidad amplia tiene más relleno que la normal', () => {
    expect(clasesDeTarjeta({ densidad: 'normal' })).toContain('p-3');
    expect(clasesDeTarjeta({ densidad: 'amplia' })).toContain('p-4');
  });

  /** Si las dos densidades dieran lo mismo, la variante sería decorativa. */
  it('las dos densidades no dan lo mismo', () => {
    expect(clasesDeTarjeta({ densidad: 'normal' })).not.toBe(
      clasesDeTarjeta({ densidad: 'amplia' }),
    );
  });

  /**
   * Una tarjeta dentro de otra usa `--surface-2`: con el mismo fondo, lo único
   * que las separaría es el borde, y a un metro de distancia eso no alcanza.
   */
  it('la anidada usa la superficie de segundo nivel', () => {
    expect(clasesDeTarjeta({ nivel: 'anidada' })).toContain('bg-[var(--surface-2)]');
    expect(clasesDeTarjeta({ nivel: 'anidada' })).not.toContain('bg-[var(--surface)]');
  });

  it('los dos niveles no dan lo mismo', () => {
    expect(clasesDeTarjeta({ nivel: 'base' })).not.toBe(clasesDeTarjeta({ nivel: 'anidada' }));
  });
});

/**
 * **`cn` concatena y no resuelve conflictos de Tailwind.**
 *
 * Una tarjeta que trae su propio `px-4 py-3` terminaría con ese Y con `p-3` en
 * el mismo atributo, y quién gana lo decide el orden del CSS, no el del string.
 * Poder no emitir relleno ni fondo es lo que evita esa pelea.
 */
describe('las variantes que no emiten nada', () => {
  it('sin relleno no pone ninguna clase de padding', () => {
    const clases = clasesDeTarjeta({ densidad: 'ninguna' });

    expect(clases).not.toMatch(/(^|\s)p-\d/);
    // Pero sigue siendo una tarjeta.
    expect(clases).toContain('border');
    expect(clases).toContain('rounded-[var(--radius-lg)]');
  });

  it('transparente no pone ninguna clase de fondo', () => {
    const clases = clasesDeTarjeta({ nivel: 'transparente' });

    expect(clases).not.toContain('bg-');
    expect(clases).toContain('border');
  });

  it('sin relleno y transparente sigue teniendo borde y radio', () => {
    const clases = clasesDeTarjeta({ densidad: 'ninguna', nivel: 'transparente' });
    expect(clases.split(/\s+/).filter(Boolean).sort()).toEqual([
      'border',
      'rounded-[var(--radius-lg)]',
    ]);
  });
});

/**
 * **Que la primitiva exista no impide que alguien vuelva a escribirla a mano.**
 *
 * Es la razón de esta tanda: la tarjeta estaba copiada 29 veces porque nada
 * marcaba la copia. Se recorre el código de las tres aplicaciones, igual que
 * hace el test de iconografía — se revisa el código y no el DOM porque montar
 * las trece pantallas costaría más y dejaría afuera las que no tienen render.
 */
describe('nadie vuelve a escribir la tarjeta a mano', () => {
  const RAIZ = join(import.meta.dirname, '..', '..');

  const fuentes = (dir: string): string[] =>
    readdirSync(dir).flatMap((entrada) => {
      const ruta = join(dir, entrada);
      if (statSync(ruta).isDirectory()) return fuentes(ruta);
      return ruta.endsWith('.tsx') && !ruta.includes('.test.') ? [ruta] : [];
    });

  it('ninguna pantalla repite el radio con el borde', () => {
    const culpables = ['app', 'landing', 'ui']
      .flatMap((paquete) => fuentes(join(RAIZ, paquete, 'src')))
      .filter((ruta) => !ruta.endsWith('Tarjeta.tsx'))
      .filter((ruta) => {
        const codigo = readFileSync(ruta, 'utf8');
        return codigo.split(/\r?\n/).some((linea) => {
          /*
            Sólo la forma **sin prefijo de variante**.

            `max-sm:rounded-[…] max-sm:border` es la fila que se vuelve tarjeta
            en el celular (`REF5-1`), y el constructor no puede producir eso:
            emite clases planas, no variantes. Es otra cosa, no una copia.

            El canvas de firma comparte el radio y tampoco es una tarjeta: es un
            área de dibujo con borde punteado.
          */
          const clases = linea.split(/[\s"'`]+/);
          return (
            clases.includes('rounded-[var(--radius-lg)]') &&
            clases.includes('border') &&
            !linea.includes('border-dashed')
          );
        });
      })
      .map((ruta) => ruta.slice(RAIZ.length + 1));

    expect(culpables, 'usar clasesDeTarjeta en vez de repetir las clases').toEqual([]);
  });
});
