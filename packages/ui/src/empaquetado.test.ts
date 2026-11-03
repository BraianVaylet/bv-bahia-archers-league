// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El empaquetado de `@bal/ui` (`REF6-14` / `C-9`).
 *
 * `tokens.css` y las imágenes se mudaron acá desde `@bal/shared`. Un import mal escrito de
 * `@bal/ui/assets/…` o de `@bal/ui/tokens.css` no falla al compilar TypeScript: falla en el build de
 * Vite, o peor, deja una imagen rota que sólo se ve sin señal. Esto lo comprueba en el árbol.
 */

const RAIZ = process.cwd();
const PACKAGES = join(RAIZ, '..');

const paquete = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as {
  exports: Record<string, string | { default: string }>;
  files: string[];
};

describe('exports y files de package.json', () => {
  it('cada archivo exportado existe', () => {
    for (const destino of Object.values(paquete.exports)) {
      if (typeof destino !== 'string' || destino.includes('*')) continue;
      expect(existsSync(join(RAIZ, destino)), destino).toBe(true);
    }
  });

  it('expone los estilos y las imágenes', () => {
    expect(paquete.exports['./tokens.css']).toBe('./styles/tokens.css');
    expect(paquete.exports['./assets/*']).toBe('./assets/*');
  });

  it('empaqueta lo que expone', () => {
    expect(paquete.files).toEqual(expect.arrayContaining(['dist', 'src', 'styles', 'assets']));
  });

  it('las imágenes están donde el export dice', () => {
    const imagenes = readdirSync(join(RAIZ, 'assets'));

    expect(imagenes).toEqual(
      expect.arrayContaining(['cba.webp', 'portada.webp', 'liga.svg', 'liga-1024.png']),
    );
  });
});

/** Todos los archivos de código y de estilo de una carpeta, recursivamente. */
function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'dist' ? [] : fuentes(ruta);
    return /\.(tsx?|css)$/.test(e.name) ? [ruta] : [];
  });
}

describe('quien importa de @bal/ui', () => {
  const usos = ['app', 'landing'].flatMap((app) =>
    fuentes(join(PACKAGES, app, 'src')).flatMap((ruta) => {
      const texto = readFileSync(ruta, 'utf8');
      return [...texto.matchAll(/@bal\/ui\/(assets\/[\w.-]+|tokens\.css)/g)].map((m) => ({
        ruta,
        especificador: m[1] as string,
      }));
    }),
  );

  it('encuentra usos: no corre sobre una lista vacía', () => {
    // Los dos CSS importan los tokens y la PWA y la landing traen una imagen cada una.
    expect(usos.length).toBeGreaterThanOrEqual(4);
  });

  it.each(usos.map((u) => [`${u.ruta.split('packages')[1]} → ${u.especificador}`, u]))(
    '%s existe',
    (_nombre, uso) => {
      const { especificador } = uso as { especificador: string };
      const archivo =
        especificador === 'tokens.css'
          ? join(RAIZ, 'styles', 'tokens.css')
          : join(RAIZ, especificador);

      expect(existsSync(archivo)).toBe(true);
    },
  );

  it('el Footer importa su imagen por una ruta relativa que existe tanto en src como en dist', () => {
    // `src/Footer.tsx` y `dist/Footer.js` están a la misma profundidad: `../assets` sirve a los dos.
    const footer = readFileSync(join(RAIZ, 'src', 'Footer.tsx'), 'utf8');
    const relativo = footer.match(/from '(\.\.\/assets\/[\w.-]+)'/)?.[1];

    expect(relativo).toBeDefined();
    expect(existsSync(join(RAIZ, 'src', relativo as string))).toBe(true);
  });
});
