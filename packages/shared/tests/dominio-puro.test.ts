import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `@bal/shared` es el dominio y nada más (`REF6-14` / `C-9`).
 *
 * El paquete se describe como «dominio puro, sin I/O» y exportaba también la paleta de colores, la
 * decisión del tema, los puertos de desarrollo, `tokens.css` y las imágenes. Eso es presentación y
 * despliegue, y le sumaba imágenes a un paquete que también consume el backend. Vive en `@bal/ui`.
 *
 * Se mira el árbol y no el código: lo que no debe volver es un archivo, una exportación o una
 * entrada del `package.json`.
 */

const RAIZ = process.cwd();
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');

describe('@bal/shared no tiene nada de presentación', () => {
  it('encuentra su propio árbol, no corre sobre una carpeta vacía', () => {
    expect(readdirSync(join(RAIZ, 'src')).length).toBeGreaterThan(10);
  });

  it.each(['paleta', 'tema', 'despliegue'])('no tiene el módulo %s', (modulo) => {
    expect(existsSync(join(RAIZ, 'src', `${modulo}.ts`))).toBe(false);
  });

  it('no los exporta desde el índice', () => {
    const indice = leer('src/index.ts');

    expect(indice).not.toMatch(/\.\/(paleta|tema|despliegue)\.js/);
  });

  it('no trae imágenes ni hojas de estilo', () => {
    expect(existsSync(join(RAIZ, 'assets'))).toBe(false);
    expect(existsSync(join(RAIZ, 'styles'))).toBe(false);
  });

  it('su package.json no los expone ni los empaqueta', () => {
    const paquete = JSON.parse(leer('package.json')) as {
      exports: Record<string, unknown>;
      files: string[];
    };

    expect(Object.keys(paquete.exports)).not.toContain('./tokens.css');
    expect(Object.keys(paquete.exports).some((k) => k.startsWith('./assets'))).toBe(false);
    expect(paquete.files).not.toContain('assets');
    expect(paquete.files).not.toContain('styles');
  });
});
