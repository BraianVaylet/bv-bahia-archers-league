/**
 * Que los docs no prometan lo que el código no hace (`REF6-15` / `B-2`).
 *
 * Para un proyecto que le pide a cada modelo de IA leer los docs **antes** de tocar código, un doc que
 * miente es un bug: el próximo implementa sobre la promesa. `INFORME.md` §3.5 `B-2` contó once casos.
 * Casi todos eran una afirmación que alguna vez fue cierta y dejó de serlo sin que nada avisara.
 *
 * No se puede verificar un documento entero, pero sí lo que está **escrito a mano en dos lugares** y
 * ya se desfasó más de una vez:
 *
 * 1. **Las versiones de `TECHNICAL.md` §1** contra lo instalado: el doc decía driver de MongoDB 6,
 *    React Router 6 y `vite-plugin-pwa` 0.21 cuando eran 7, 7 y 1. Se compara la versión mayor, salvo
 *    en TypeScript, pnpm y Biome, que el doc fija exacta.
 * 2. **Los topes de bundle de `TECHNICAL.md` §5** contra `scripts/presupuesto.mjs`.
 *
 * Sólo mira esas dos cosas, a propósito: una verificación que pretende leer el doc entero termina
 * rota por cada frase que se reescribe, y alguien la desactiva.
 *
 * ```bash
 * node scripts/verificar-docs.mjs
 * ```
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DOC = 'docs/TECHNICAL.md';

const leerJson = (raiz, ruta) => {
  const archivo = join(raiz, ruta);
  return existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : {};
};

/** `^19.2.8` → `19.2.8`. */
const limpia = (version) => String(version ?? '').replace(/^[\^~>=\s]+/, '');

/** Lo que dice una fila de la tabla de §1, o `undefined` si no está. */
function filaDe(seccion, nombre) {
  const fila = seccion.split('\n').find((l) => l.startsWith(`| ${nombre} |`));
  return fila;
}

/**
 * Cada regla: en qué fila del doc, qué patrón saca la versión, y dónde está instalada.
 * `exacta`: el doc fija la versión completa y no sólo la mayor.
 */
const REGLAS_DE_VERSION = [
  {
    fila: 'Lenguaje',
    etiqueta: 'TypeScript',
    doc: /(\d+\.\d+\.\d+)/,
    de: ['package.json', 'typescript'],
    exacta: true,
  },
  {
    fila: 'Monorepo',
    etiqueta: 'pnpm',
    doc: /(\d+\.\d+\.\d+)/,
    de: ['package.json', 'packageManager'],
    exacta: true,
  },
  { fila: 'Backend', etiqueta: 'Hono', doc: /(\d+)\.x/, de: ['packages/api/package.json', 'hono'] },
  {
    fila: 'Base de datos',
    etiqueta: 'driver de MongoDB (mongodb)',
    doc: /driver \*{0,2}(\d+)\.x/,
    de: ['packages/api/package.json', 'mongodb'],
  },
  {
    fila: 'Validación',
    etiqueta: 'Zod',
    doc: /(\d+)\.x/,
    de: ['packages/api/package.json', 'zod'],
  },
  {
    fila: 'Frontend',
    etiqueta: 'React',
    doc: /React (\d+)/,
    de: ['packages/app/package.json', 'react'],
  },
  {
    fila: 'Frontend',
    etiqueta: 'Vite',
    doc: /Vite (\d+)/,
    de: ['packages/app/package.json', 'vite'],
  },
  {
    fila: 'Frontend',
    etiqueta: 'Tailwind',
    doc: /Tailwind CSS (\d+)/,
    de: ['packages/app/package.json', 'tailwindcss'],
  },
  {
    fila: 'Frontend',
    etiqueta: 'React Router (react-router-dom)',
    doc: /React Router (\d+)/,
    de: ['packages/app/package.json', 'react-router-dom'],
  },
  {
    fila: 'PWA',
    etiqueta: 'vite-plugin-pwa',
    doc: /(\d+)(?:\.x|\.\d+\+)/,
    de: ['packages/app/package.json', 'vite-plugin-pwa'],
  },
  { fila: 'Offline', etiqueta: 'idb', doc: /(\d+)\.x/, de: ['packages/app/package.json', 'idb'] },
  {
    fila: 'Hash',
    etiqueta: 'argon2 (@node-rs/argon2)',
    doc: /(\d+)\.x/,
    de: ['packages/api/package.json', '@node-rs/argon2'],
  },
  {
    fila: 'Lint y format',
    etiqueta: 'Biome',
    doc: /(\d+\.\d+\.\d+)/,
    de: ['package.json', '@biomejs/biome'],
    exacta: true,
  },
  {
    fila: 'Tests',
    etiqueta: 'Vitest',
    doc: /Vitest (\d+)/,
    de: ['packages/api/package.json', 'vitest'],
  },
];

/** La versión instalada de una dependencia o del `packageManager`, o `undefined`. */
function instalada(raiz, [ruta, nombre]) {
  const json = leerJson(raiz, ruta);
  if (nombre === 'packageManager') return limpia(String(json.packageManager ?? '').split('@')[1]);
  return limpia({ ...json.dependencies, ...json.devDependencies }[nombre]) || undefined;
}

function versiones(raiz, doc) {
  const seccion = doc.split(/^## 1\. /m)[1]?.split(/^## 2\. /m)[0] ?? '';
  const malas = [];

  for (const regla of REGLAS_DE_VERSION) {
    const fila = filaDe(seccion, regla.fila);
    if (!fila) {
      malas.push({
        doc: DOC,
        mensaje: `${regla.etiqueta}: no encuentro la fila «${regla.fila}» en la tabla de §1.`,
      });
      continue;
    }

    const enElDoc = fila.match(regla.doc)?.[1];
    const real = instalada(raiz, regla.de);
    if (enElDoc === undefined || real === undefined) {
      malas.push({
        doc: DOC,
        mensaje: `${regla.etiqueta}: no pude leer la versión (doc: ${enElDoc ?? '—'}, instalada: ${real ?? '—'}).`,
      });
      continue;
    }

    const esperada = regla.exacta ? real : real.split('.')[0];
    if (enElDoc !== esperada) {
      malas.push({
        doc: DOC,
        mensaje: `${regla.etiqueta}: el doc dice ${enElDoc} y lo instalado es ${real}${regla.exacta ? '' : ` (mayor ${esperada})`}.`,
      });
    }
  }
  return malas;
}

/** Cómo se llama cada tope en `presupuesto.mjs` y cómo se lo reconoce en la tabla de §5. */
const TOPES = [
  {
    nombre: 'pantalla de elegir rol',
    fila: /\| JS que baja la pantalla de elegir rol[^|]*\| \**< (\d+) KB/,
  },
  { nombre: 'WAFL (líder de patrulla)', fila: /\| JS que baja WAFL[^|]*\| \**< (\d+) KB/ },
  { nombre: 'WAFA (administrador)', fila: /\| JS que baja WAFA[^|]*\| \**< (\d+) KB/ },
  { nombre: 'inicial', fila: /\| JS inicial de la landing[^|]*\| \**< (\d+) KB/ },
];

function topes(raiz, doc) {
  const archivo = join(raiz, 'scripts/presupuesto.mjs');
  if (!existsSync(archivo)) {
    return [
      { doc: DOC, mensaje: 'No encuentro scripts/presupuesto.mjs para comparar los topes de KB.' },
    ];
  }

  // Sólo las cargas (tienen `chunk:`): el `nombre` del frontend entero no lleva tope propio.
  const enElScript = new Map(
    [
      ...readFileSync(archivo, 'utf8').matchAll(/nombre: '([^']+)',\s*chunk:[^}]*?maxKb: (\d+)/g),
    ].map((m) => [m[1], m[2]]),
  );

  return TOPES.flatMap(({ nombre, fila }) => {
    const enElDoc = doc.match(fila)?.[1];
    const real = enElScript.get(nombre);
    if (enElDoc === undefined || real === undefined) {
      return [
        {
          doc: DOC,
          mensaje: `Tope «${nombre}»: no pude leerlo (doc: ${enElDoc ?? '—'} KB, presupuesto.mjs: ${real ?? '—'} KB).`,
        },
      ];
    }
    return enElDoc === real
      ? []
      : [
          {
            doc: DOC,
            mensaje: `Tope «${nombre}»: el doc dice ${enElDoc} KB y presupuesto.mjs ${real} KB.`,
          },
        ];
  });
}

/** Todo lo que el doc dice distinto del código, dada la raíz del repositorio. */
export function inconsistencias(raiz) {
  const archivo = join(raiz, DOC);
  if (!existsSync(archivo)) return [{ doc: DOC, mensaje: `No existe ${DOC}.` }];

  const doc = readFileSync(archivo, 'utf8');
  return [...versiones(raiz, doc), ...topes(raiz, doc)];
}

function main() {
  const raiz = fileURLToPath(new URL('..', import.meta.url));
  const malas = inconsistencias(raiz);

  if (malas.length === 0) {
    console.info(
      '✓ Los docs dicen lo que hay: versiones de TECHNICAL.md §1 y topes de bundle de §5.',
    );
    return;
  }

  for (const m of malas) console.error(`✗ ${m.doc} — ${m.mensaje}`);
  console.error(`\n${malas.length} inconsistencia(s) entre los docs y el código.`);
  process.exit(1);
}

// Importable desde un test sin que corra solo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
