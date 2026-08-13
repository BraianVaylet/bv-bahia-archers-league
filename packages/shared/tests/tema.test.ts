import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { alternarTema, COLOR_DE_BARRA, resolverTema, TEMA_KEY } from '../src/index.js';

/**
 * Decisión del tema (REF-4).
 *
 * La lógica vive acá y no en cada app porque hay **tres** lugares que tienen
 * que coincidir: el script anti-FOUC de cada `index.html` y el control que lo
 * conmuta. Ver docs/DESIGN_SYSTEM.md §9.
 */

describe('TEMA_KEY', () => {
  // El script anti-FOUC de los `index.html` lee esta misma clave, escrita a
  // mano porque corre antes de cualquier import. Si cambia acá y allá no, el
  // tema elegido se pierde en cada recarga.
  it('es la clave que leen los scripts anti-FOUC', () => {
    expect(TEMA_KEY).toBe('bal_tema');
  });
});

describe('resolverTema', () => {
  it('respeta lo que el usuario eligió', () => {
    expect(resolverTema('dark', false)).toBe('dark');
    expect(resolverTema('light', true)).toBe('light');
  });

  it('sin elección, sigue la preferencia del sistema', () => {
    expect(resolverTema(null, true)).toBe('dark');
    expect(resolverTema(null, false)).toBe('light');
  });

  // Un valor corrupto no es una elección: forzar claro ignoraría a alguien que
  // tiene el sistema en oscuro.
  it('un valor que no reconoce lo trata como si no hubiera elección', () => {
    expect(resolverTema('azul', true)).toBe('dark');
    expect(resolverTema('', true)).toBe('dark');
    expect(resolverTema('azul', false)).toBe('light');
  });
});

describe('alternarTema', () => {
  it('va y vuelve', () => {
    expect(alternarTema('light')).toBe('dark');
    expect(alternarTema('dark')).toBe('light');
  });
});

/**
 * Los dos `index.html` repiten esta lógica a mano: corren antes de cualquier
 * bundle y no pueden importar nada. Que exista un archivo con los valores
 * correctos no prueba que los `index.html` digan lo mismo — hay que ir a
 * leerlos.
 */
describe('los scripts anti-FOUC dicen lo mismo', () => {
  // Relativo a este archivo: `packages/shared/tests/` → `packages/<app>/`.
  const HTML = ['../../app/index.html', '../../landing/index.html'] as const;

  it.each(HTML)('%s usa la misma clave de localStorage', (ruta) => {
    const html = readFileSync(new URL(ruta, import.meta.url), 'utf8');
    expect(html).toContain(`localStorage.getItem('${TEMA_KEY}')`);
  });

  it.each(HTML)('%s pinta la barra con el mismo color oscuro', (ruta) => {
    const html = readFileSync(new URL(ruta, import.meta.url), 'utf8');
    expect(html).toContain(COLOR_DE_BARRA.dark);
  });

  it.each(HTML)('%s arranca con el color claro en el meta', (ruta) => {
    const html = readFileSync(new URL(ruta, import.meta.url), 'utf8');
    expect(html).toContain(`<meta name="theme-color" content="${COLOR_DE_BARRA.light}" />`);
  });

  // Sin `data-theme` en el html, el CSS no tiene de dónde agarrarse.
  it.each(HTML)('%s escribe data-theme antes de pintar', (ruta) => {
    const html = readFileSync(new URL(ruta, import.meta.url), 'utf8');
    expect(html).toContain(`setAttribute('data-theme', 'dark')`);
  });
});
