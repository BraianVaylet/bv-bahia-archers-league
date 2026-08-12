/**
 * Presupuestos de tamaño de bundle, y que cada frontend emita lo que tiene que
 * emitir.
 *
 * El chequeo del `.css` no es un capricho: la PWA estuvo semanas construyéndose
 * **sin hoja de estilos** porque `main.tsx` no la importaba, y ningún test podía
 * verlo. Lo delató mirar la salida del build a mano. Esto lo mira solo.
 *
 * Ver `docs/TECHNICAL.md` §5 y `docs/BITACORA.md`, entrada de `FE-17`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** Presupuestos de `docs/TECHNICAL.md` §5. */
const PRESUPUESTOS = [
  { nombre: 'WAFA + WAFL', dist: 'packages/app/dist', jsMaxKb: 150, exigeCss: true },
  { nombre: 'landing', dist: 'packages/landing/dist', jsMaxKb: 120, exigeCss: true },
];

const kb = (bytes) => Math.round((bytes / 1024) * 100) / 100;

/** Suma el tamaño gzip de todos los archivos con una extensión. */
function pesoGz(dir, extension) {
  if (!existsSync(dir)) return { bytes: 0, archivos: [] };

  const archivos = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) =>
    f.endsWith(extension),
  );

  const bytes = archivos.reduce(
    (total, f) => total + gzipSync(readFileSync(join(dir, f))).length,
    0,
  );
  return { bytes, archivos };
}

let hayFallas = false;

for (const { nombre, dist, jsMaxKb, exigeCss } of PRESUPUESTOS) {
  const assets = join(dist, 'assets');

  if (!existsSync(join(dist, 'index.html'))) {
    console.error(`✗ ${nombre}: no está construido (falta ${dist}/index.html).`);
    hayFallas = true;
    continue;
  }

  // Sólo `assets/`: el service worker y su runtime viven en la raíz del `dist`
  // y no son carga inicial, se descargan después del primer pintado.
  const js = pesoGz(assets, '.js');
  const css = pesoGz(assets, '.css');

  if (kb(js.bytes) > jsMaxKb) {
    console.error(`✗ ${nombre}: ${kb(js.bytes)} KB gz de JS, presupuesto ${jsMaxKb} KB.`);
    hayFallas = true;
  } else {
    console.info(`✓ ${nombre}: ${kb(js.bytes)} KB gz de JS (presupuesto ${jsMaxKb} KB).`);
  }

  if (exigeCss && css.archivos.length === 0) {
    console.error(
      `✗ ${nombre}: el build NO emitió ninguna hoja de estilos. Suele significar que el punto de entrada no importa su CSS.`,
    );
    hayFallas = true;
  } else if (exigeCss) {
    console.info(
      `✓ ${nombre}: ${kb(css.bytes)} KB gz de CSS en ${css.archivos.length} archivo(s).`,
    );
  }
}

if (hayFallas) {
  console.error('\nPresupuestos incumplidos.');
  process.exit(1);
}

console.info('\nTodos los presupuestos en verde.');
