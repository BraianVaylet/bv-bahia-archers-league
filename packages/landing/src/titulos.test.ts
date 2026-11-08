import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Cada pantalla de la landing tiene su título (`REF6-12` / `U-5`).
 *
 * Mismo guardia que el de la PWA (`app/src/titulos.test.ts`): una pantalla que se olvida de
 * `useTituloDePagina` conserva el título de la anterior, y nadie lo ve a ojo.
 */

const RAIZ = join(process.cwd(), 'src');
const PAGINAS = join(RAIZ, 'pages');

const PANTALLAS = readdirSync(PAGINAS)
  .filter((n) => /\.tsx$/.test(n))
  .map((n) => join(PAGINAS, n));

describe('títulos de página', () => {
  it('encuentra las pantallas, no corre sobre una lista vacía', () => {
    expect(PANTALLAS.length).toBeGreaterThanOrEqual(6);
  });

  it.each(PANTALLAS.map((p) => [relative(RAIZ, p), p]))(
    '%s: declara su título',
    (_nombre, ruta) => {
      const codigo = readFileSync(ruta, 'utf8');
      // `Tournaments.tsx` trae dos pantallas (`TournamentsPage` y `TournamentPage`).
      const paginas = (codigo.match(/export function \w+Page\b/g) ?? []).length;
      const llamadas = (codigo.match(/\buseTituloDePagina\(/g) ?? []).length;

      expect(paginas).toBeGreaterThan(0);
      expect(llamadas).toBeGreaterThanOrEqual(paginas);
    },
  );
});
