/**
 * Precomprime los frontends construidos (`REF6-8` / `P-3`).
 *
 * Junto a cada archivo de texto del `dist` deja un `.br` y un `.gz`, y el servidor
 * (`middleware/estaticos.ts`, `serveStatic({ precompressed: true })`) entrega el que
 * el cliente acepta. Así no se comprime nada por request, y se puede usar el nivel
 * máximo de brotli, que es lento y es el que más achica: el JS de la PWA pasa de
 * ~430 KB a ~110 KB.
 *
 * Sin dependencias: `node:zlib` trae los dos.
 *
 * ```bash
 * node scripts/precomprimir.mjs
 * ```
 *
 * Es idempotente. Corre al final de `pnpm build`, así que la imagen de Docker (que
 * copia los `dist` después del build) ya los lleva.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const DISTS = ['packages/app/dist', 'packages/landing/dist'];

/** Lo que se comprime: texto. Las imágenes ya vienen comprimidas (webp, png). */
const EXTENSIONES = ['.js', '.css', '.html', '.svg', '.json', '.webmanifest', '.txt', '.map'];

/** Por debajo de esto el ahorro no paga el archivo de más ni el ida y vuelta. */
const MINIMO_BYTES = 1024;

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

/** Cada archivo de texto del `dist` que todavía no es un precomprimido. */
export function candidatos(dist) {
  return readdirSync(dist, { recursive: true, encoding: 'utf8' })
    .filter((f) => EXTENSIONES.some((e) => f.endsWith(e)))
    .map((f) => join(dist, f))
    .filter((ruta) => statSync(ruta).isFile() && statSync(ruta).size >= MINIMO_BYTES);
}

/**
 * Escribe `.br` y `.gz` de un archivo.
 *
 * Sólo se conserva el precomprimido si **achica**: uno que pesa igual o más que el
 * original no sirve, y entregarlo sería peor que no tenerlo.
 */
export function precomprimir(ruta) {
  const original = readFileSync(ruta);
  const salidas = [
    [
      '.br',
      brotliCompressSync(original, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
          [constants.BROTLI_PARAM_SIZE_HINT]: original.length,
        },
      }),
    ],
    ['.gz', gzipSync(original, { level: 9 })],
  ];

  const hechas = [];
  for (const [extension, bytes] of salidas) {
    if (bytes.length >= original.length) continue;
    writeFileSync(ruta + extension, bytes);
    hechas.push({ extension, bytes: bytes.length });
  }
  return { original: original.length, hechas };
}

function main() {
  let falta = false;
  let totalOriginal = 0;
  let totalBrotli = 0;

  for (const dist of DISTS) {
    if (!existsSync(join(dist, 'index.html'))) {
      console.error(`✗ ${dist}: no está construido (falta ${dist}/index.html).`);
      falta = true;
      continue;
    }

    for (const ruta of candidatos(dist)) {
      const { original, hechas } = precomprimir(ruta);
      const br = hechas.find((h) => h.extension === '.br');

      totalOriginal += original;
      totalBrotli += br?.bytes ?? original;
    }
  }

  if (falta) process.exit(1);

  console.info(
    `✓ precomprimido: ${kb(totalOriginal)} KB de texto → ${kb(totalBrotli)} KB en brotli.`,
  );
}

// Importable sin que corra solo: sólo se ejecuta si es el programa principal.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
