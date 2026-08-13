import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Iconografía (REF-4).
 *
 * `docs/DESIGN_SYSTEM.md` §10: **el color y el ícono nunca son el único
 * portador de información.** Un control que sólo muestra un símbolo tiene que
 * decir qué hace, y un símbolo decorativo no tiene que anunciarse.
 *
 * Se revisa el código y no el DOM a propósito: montar las trece pantallas para
 * esto costaría más y taparía las que todavía no tienen test de render.
 */

/**
 * Desde el `cwd` del paquete, no desde `import.meta.url`: bajo Vite esa URL no
 * es `file:` y `fileURLToPath` la rechaza.
 */
const RAIZ = join(process.cwd(), 'src');

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return fuentes(ruta);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [ruta] : [];
  });
}

/** Glifos y emojis. Excluye los guiones de las separadoras de comentarios. */
const GLIFO = /[←-⯿☀-➿\u{1F300}-\u{1FAFF}]/u;

const ARCHIVOS = fuentes(RAIZ);

describe('iconografía', () => {
  it('encuentra las pantallas, no corre sobre una lista vacía', () => {
    // Sin esto, un `fuentes()` que devuelve nada haría pasar todo por vacuidad.
    expect(ARCHIVOS.length).toBeGreaterThan(10);
  });

  it.each(ARCHIVOS.map((a) => [relative(RAIZ, a), a]))(
    '%s: ningún glifo se anuncia sin querer',
    (_nombre, ruta) => {
      const lineas = readFileSync(ruta, 'utf8').split('\n');

      const sospechosas = lineas
        .map((linea, i) => ({ linea: linea.trim(), n: i + 1 }))
        .filter(({ linea }) => GLIFO.test(linea))
        // Comentarios, separadoras y strings de props no pintan nada.
        .filter(({ linea }) => !linea.startsWith('//') && !linea.startsWith('*'))
        .filter(({ linea }) => !linea.includes('──'))
        .filter(({ linea }) => !linea.includes('aria-hidden'))
        .filter(({ linea }) => !linea.includes('aria-label'))
        // `textoVolver="← Blancos"` lleva su propio texto al lado de la flecha.
        // Con `\s*`: la prop se escribe pegada en el JSX y con espacios en la
        // firma del componente, y sin eso el default se marcaba como sospechoso.
        .filter(({ linea }) => !/texto\w*\s*=/.test(linea));

      expect(sospechosas).toEqual([]);
    },
  );
});
