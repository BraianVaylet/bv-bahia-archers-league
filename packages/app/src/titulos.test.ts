import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Cada pantalla tiene su título (`REF6-12` / `U-5`).
 *
 * En una SPA el título de la pestaña no cambia solo (WCAG 2.4.2): una pantalla que se olvide de
 * `useTituloDePagina` se queda con el de la anterior, y el lector de pantalla anuncia la página
 * equivocada. Es un olvido fácil de cometer y casi imposible de ver a ojo, así que se revisa el
 * código —como `iconografia.test.tsx`— en vez de montar las quince pantallas.
 */

const RAIZ = join(process.cwd(), 'src');

const tsx = (dir: string): string[] =>
  readdirSync(dir)
    .filter((n) => /\.tsx$/.test(n) && !/\.test\./.test(n))
    .map((n) => join(dir, n));

const PANTALLAS = [
  ...tsx(join(RAIZ, 'wafa', 'pages')),
  // Las pantallas de WAFL son `*Page.tsx`; el resto de la carpeta son piezas (teclado, firma…).
  ...tsx(join(RAIZ, 'wafl')).filter((r) => /Page\.tsx$/.test(r)),
];

const llamadas = (codigo: string) => (codigo.match(/\buseTituloDePagina\(/g) ?? []).length;

describe('títulos de página', () => {
  it('encuentra las pantallas, no corre sobre una lista vacía', () => {
    expect(PANTALLAS.length).toBeGreaterThanOrEqual(15);
  });

  it.each(PANTALLAS.map((p) => [relative(RAIZ, p), p]))(
    '%s: declara su título',
    (_nombre, ruta) => {
      const codigo = readFileSync(ruta, 'utf8');

      // Un archivo es al menos una pantalla y puede traer más (`export function XxxPage`): una
      // llamada por cada una. `RecuperarPassword` es una pantalla sin el sufijo.
      const paginas = (codigo.match(/export function \w+Page\b/g) ?? []).length;

      expect(llamadas(codigo)).toBeGreaterThanOrEqual(Math.max(1, paginas));
    },
  );

  it.each([
    ['App.tsx', 'la pantalla de elegir rol'],
    [join('wafl', 'WaflApp.tsx'), 'la pantalla de torneo finalizado'],
  ])('%s: %s también tiene título', (archivo) => {
    expect(llamadas(readFileSync(join(RAIZ, archivo), 'utf8'))).toBeGreaterThan(0);
  });
});
