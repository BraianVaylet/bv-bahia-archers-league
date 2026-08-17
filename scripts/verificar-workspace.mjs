/**
 * Coherencia de los scripts de la raíz con los paquetes que hay en el workspace.
 *
 * **Existe porque el mismo olvido pasó dos veces.** `@bal/ui` nació en `REF2-1`
 * y las listas de la raíz siguieron nombrando sólo a `@bal/shared`: primero
 * falló CI con `Failed to resolve import "@bal/ui"`, se arreglaron `build`,
 * `test` y `typecheck` — y quedó `dev` sin tocar. El síntoma en `dev` es peor
 * que en CI, porque no rompe: sirve un `dist/` viejo, así que la pantalla se ve
 * como estaba y parece que el código nuevo no se aplicó.
 *
 * **No hay lista fija acá a propósito.** Los paquetes se descubren leyendo el
 * workspace; una lista escrita a mano es exactamente lo que ya se desactualizó
 * dos veces. Un `@bal/loquesea` nuevo que compile a `dist/` rompe este chequeo
 * hasta que entre en los scripts.
 *
 * Ver `docs/BITACORA.md`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath` y no `.pathname`: en Windows deja un `/C:/` al principio, y
// cualquier espacio en la ruta vendría escapado como `%20`.
const raiz = fileURLToPath(new URL('..', import.meta.url));

const leer = (p) => JSON.parse(readFileSync(p, 'utf8'));

const paquetes = readdirSync(join(raiz, 'packages'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(raiz, 'packages', d.name, 'package.json')))
  .map((d) => leer(join(raiz, 'packages', d.name, 'package.json')));

const porNombre = new Map(paquetes.map((p) => [p.name, p]));

/** Lo que el paquete expone como punto de entrada, sea por `main` o por `exports`. */
const entrada = (p) => p.main ?? p.exports?.['.']?.default ?? '';

/**
 * Una **librería compilada**: no se consume desde el fuente sino desde `dist/`,
 * así que quien la importa ve lo que haya en esa carpeta y nada más. Es la
 * condición que la vuelve sensible a que falte un build.
 */
const esLibreriaCompilada = (p) => entrada(p).includes('/dist/');

/** Y que además alguien del workspace la importe: si no, no hay a quién romperle. */
const laUsaAlguien = (nombre) =>
  paquetes.some(
    (otro) =>
      otro.name !== nombre &&
      { ...otro.dependencies, ...otro.devDependencies }[nombre] !== undefined,
  );

const librerias = paquetes
  .filter((p) => esLibreriaCompilada(p) && laUsaAlguien(p.name))
  .map((p) => p.name)
  .sort();

const scripts = leer(join(raiz, 'package.json')).scripts;

let hayFallas = false;

const exigir = (condicion, mensaje) => {
  if (condicion) return;
  console.error(`✗ ${mensaje}`);
  hayFallas = true;
};

exigir(
  librerias.length > 0,
  'no se detectó ninguna librería compilada; el chequeo no prueba nada.',
);

for (const nombre of librerias) {
  exigir(
    new RegExp(String.raw`--filter ${nombre}\b[^"']*\bbuild\b`).test(scripts['build:libs'] ?? ''),
    `\`build:libs\` no construye ${nombre}. Quien lo importe va a leer un dist/ viejo o inexistente.`,
  );

  exigir(
    new RegExp(String.raw`--filter ${nombre}\b[^"']*\bdev\b`).test(scripts.dev ?? ''),
    `\`dev\` no deja a ${nombre} en modo watch. Editarlo no se va a ver hasta reconstruir a mano.`,
  );
}

/**
 * `dev` tiene que **construir antes de arrancar**, no sólo mirar.
 *
 * `tsc --watch` no emite hasta el primer cambio, así que en un clon limpio los
 * watchers solos dejan a los frontends sin `dist/` que resolver.
 */
exigir(
  /\bbuild:libs\b/.test(scripts.dev ?? ''),
  '`dev` no corre `build:libs` antes de levantar. En un clon limpio no hay dist/ que importar.',
);

for (const guion of ['build', 'test', 'typecheck']) {
  exigir(
    /\bbuild:libs\b/.test(scripts[guion] ?? ''),
    `\`${guion}\` no corre \`build:libs\`. Depende de que alguien haya construido antes.`,
  );
}

/** Que las dependencias entre paquetes existan de verdad. */
for (const p of paquetes) {
  for (const dep of Object.keys({ ...p.dependencies, ...p.devDependencies })) {
    if (!dep.startsWith('@bal/')) continue;
    exigir(porNombre.has(dep), `${p.name} depende de ${dep}, que no existe en el workspace.`);
  }
}

if (hayFallas) {
  console.error('\nLos scripts de la raíz no cubren todo el workspace.');
  process.exit(1);
}

console.info(`✓ Librerías compiladas cubiertas por los scripts: ${librerias.join(', ')}.`);
