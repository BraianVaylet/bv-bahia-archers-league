import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La pantalla encendida es sólo del blanco (`REF6-12` / `U-7`, decisión 4).
 *
 * Tiene un costo de batería, y el recorrido dura horas: encendida en el circuito, los resultados o
 * WAFA gastaría batería sin que nadie anote nada. Por eso se pide en `TargetPage` y en ningún otro
 * lado. Si alguien la quiere en otra pantalla, este test lo obliga a decidirlo a la vista.
 */

const RAIZ = join(process.cwd(), 'src');

const fuentes = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return fuentes(ruta);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [ruta] : [];
  });

describe('pantalla encendida', () => {
  it('sólo TargetPage la pide', () => {
    const usan = fuentes(RAIZ)
      .filter((ruta) => !ruta.endsWith('useWakeLock.ts'))
      .filter((ruta) => /\buseWakeLock\(/.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => relative(RAIZ, ruta).replaceAll(sep, '/'));

    expect(usan).toEqual(['wafl/TargetPage.tsx']);
  });
});
