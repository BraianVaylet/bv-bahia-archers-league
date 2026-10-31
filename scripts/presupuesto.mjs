/**
 * Presupuestos de tamaño de bundle, y que cada frontend emita lo que tiene que
 * emitir.
 *
 * **Se mide lo que una pantalla descarga, no lo que hay en `assets/`.** Hasta
 * `REF6-8` se sumaba todo el JS del `dist`, y con las dos apps en un solo chunk eso
 * coincidía con la carga inicial. Con `React.lazy` no: `assets/` incluye lo que el
 * service worker precachea pero que una pantalla nunca pide, y sumarlo mide otra
 * cosa. Acá se arma, para cada entrada, el grafo de chunks que se bajan: el de
 * `index.html` (script de entrada y `modulepreload`) más, para WAFL y WAFA, el
 * chunk de su app y lo que éste importa de forma estática.
 *
 * Y se comprueba lo que el code splitting promete: **WAFL no baja el código de
 * WAFA, ni al revés.** Si alguien vuelve a un `import` estático, esa carga se
 * duplica y el build falla.
 *
 * El chequeo del `.css` no es un capricho: la PWA estuvo semanas construyéndose
 * **sin hoja de estilos** porque `main.tsx` no la importaba, y ningún test podía
 * verlo. Lo delató mirar la salida del build a mano. Esto lo mira solo.
 *
 * Ver `docs/TECHNICAL.md` §5 y `docs/BITACORA.md`, entradas de `FE-17` y `REF6-8`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Presupuestos de `docs/TECHNICAL.md` §5, en KB gzip.
 *
 * `chunk` es el nombre del chunk de la app que se suma a la carga inicial, y
 * `excluye` el que **no** puede aparecer: el código de la otra app.
 */
const FRONTENDS = [
  {
    nombre: 'PWA',
    dist: 'packages/app/dist',
    exigeCss: true,
    cargas: [
      { nombre: 'pantalla de elegir rol', chunk: null, excluye: /^Waf[al]App-/, maxKb: 105 },
      { nombre: 'WAFL (líder de patrulla)', chunk: /^WaflApp-/, excluye: /^WafaApp-/, maxKb: 125 },
      { nombre: 'WAFA (administrador)', chunk: /^WafaApp-/, excluye: /^WaflApp-/, maxKb: 135 },
    ],
  },
  {
    nombre: 'landing',
    dist: 'packages/landing/dist',
    exigeCss: true,
    cargas: [{ nombre: 'inicial', chunk: null, excluye: null, maxKb: 120 }],
  },
];

const kb = (bytes) => Math.round((bytes / 1024) * 100) / 100;

const gz = (ruta) => gzipSync(readFileSync(ruta)).length;

/** Los `.js` que `index.html` carga: la entrada y los `modulepreload`. */
export function chunksDeIndex(html) {
  const archivos = new Set();

  for (const [, ruta] of html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+\.js)"/g)) {
    archivos.add(ruta.split('/').pop());
  }
  for (const [, ruta] of html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+\.js)"/g)) {
    archivos.add(ruta.split('/').pop());
  }
  return [...archivos];
}

/**
 * Los chunks que un chunk importa **de forma estática**.
 *
 * `import{x}from"./otro.js"` y `import"./otro.js"` sí; `import("./otro.js")` no: ése
 * es el `React.lazy`, y justamente no se baja con él.
 */
export function importsEstaticos(codigo) {
  return [...codigo.matchAll(/(?:\bfrom|\bimport)\s*["']\.\/([^"']+\.js)["']/g)].map((m) => m[1]);
}

/** Cierre transitivo: un chunk y todo lo que arrastra al cargarse. */
export function grafoDe(assets, inicio) {
  const vistos = new Set();
  const pendientes = [...inicio];

  while (pendientes.length > 0) {
    const archivo = pendientes.pop();
    if (!archivo || vistos.has(archivo)) continue;

    const ruta = join(assets, archivo);
    if (!existsSync(ruta)) continue;

    vistos.add(archivo);
    pendientes.push(...importsEstaticos(readFileSync(ruta, 'utf8')));
  }
  return [...vistos];
}

const hojasDeEstilo = (assets) =>
  readdirSync(assets, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.css'));

function main() {
  let hayFallas = false;

  for (const { nombre, dist, exigeCss, cargas } of FRONTENDS) {
    const assets = join(dist, 'assets');

    if (!existsSync(join(dist, 'index.html'))) {
      console.error(`✗ ${nombre}: no está construido (falta ${dist}/index.html).`);
      hayFallas = true;
      continue;
    }

    const inicial = chunksDeIndex(readFileSync(join(dist, 'index.html'), 'utf8'));
    const todos = readdirSync(assets).filter((f) => f.endsWith('.js'));

    for (const { nombre: carga, chunk, excluye, maxKb } of cargas) {
      const propios = chunk ? todos.filter((f) => chunk.test(f)) : [];

      if (chunk && propios.length === 0) {
        console.error(
          `✗ ${nombre} · ${carga}: no hay ningún chunk ${chunk}. ` +
            'Si se volvió a un import estático, la app quedó en el chunk principal.',
        );
        hayFallas = true;
        continue;
      }

      const archivos = grafoDe(assets, [...inicial, ...propios]);

      const ajeno = excluye ? archivos.filter((f) => excluye.test(f)) : [];
      if (ajeno.length > 0) {
        console.error(`✗ ${nombre} · ${carga}: baja código de la otra app (${ajeno.join(', ')}).`);
        hayFallas = true;
      }

      const bytes = archivos.reduce((total, f) => total + gz(join(assets, f)), 0);
      if (kb(bytes) > maxKb) {
        console.error(`✗ ${nombre} · ${carga}: ${kb(bytes)} KB gz de JS, presupuesto ${maxKb} KB.`);
        hayFallas = true;
      } else {
        console.info(`✓ ${nombre} · ${carga}: ${kb(bytes)} KB gz de JS (presupuesto ${maxKb} KB).`);
      }
    }

    const css = hojasDeEstilo(assets);
    if (exigeCss && css.length === 0) {
      console.error(
        `✗ ${nombre}: el build NO emitió ninguna hoja de estilos. Suele significar que el punto de entrada no importa su CSS.`,
      );
      hayFallas = true;
    } else if (exigeCss) {
      const bytes = css.reduce((total, f) => total + gz(join(assets, f)), 0);
      console.info(`✓ ${nombre}: ${kb(bytes)} KB gz de CSS en ${css.length} archivo(s).`);
    }
  }

  if (hayFallas) {
    console.error('\nPresupuestos incumplidos.');
    process.exit(1);
  }

  console.info('\nTodos los presupuestos en verde.');
}

main();
