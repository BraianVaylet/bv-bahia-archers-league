/**
 * Preparación de los assets de imagen.
 *
 * **No hay herramienta de imágenes en el repo, y no se agregó una.** Playwright
 * ya está acá para los E2E y trae un Chromium completo: abrir el archivo en un
 * canvas, reescalarlo y volver a exportarlo hace exactamente lo que haría
 * `sharp`, sin sumar un binario nativo al monorepo para tres archivos.
 *
 * Es idempotente y **no toca los originales**: lee de `packages/logos/` y de
 * `origen/`, y escribe en `packages/ui/assets/` y en los `public/`. Correrlo
 * dos veces da el mismo resultado.
 *
 * ```bash
 * node scripts/imagenes.mjs
 * ```
 *
 * Al terminar imprime el peso de cada salida. Si algo se pasa del presupuesto,
 * sale con código 1: una imagen de 2,8 MB en una PWA que tiene que abrir en el
 * monte no es un detalle de tamaño, es la diferencia entre abrir y no abrir.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Arte canónico de la marca. Todo lo demás se deriva de acá. */
const LOGO = 'packages/ui/assets/liga.svg';

/**
 * Copias literales del logo.
 *
 * El manifest de la PWA declaraba `/app/icon.svg` y **ese archivo no existía**:
 * la app se anunciaba instalable con un ícono que daba 404. El test del
 * manifest no lo veía porque verificaba los campos declarados, no que el ícono
 * resolviera.
 */
const COPIAS = [
  { destino: 'packages/app/public/icon.svg', porQue: 'ícono de la PWA (manifest)' },
  { destino: 'packages/landing/public/favicon.svg', porQue: 'favicon de la landing' },
];

/**
 * Rasterizados, con su presupuesto en KB.
 *
 * El del CBA es de un club, no del proyecto: se reescala y nada más, sin
 * reinterpretarlo.
 */
const RASTER = [
  {
    origen:
      'packages/logos/circulo-bahiense-de-arqueria-vector-logo-seeklogo/circulo-bahiense-de-arqueria-seeklogo.png',
    destino: 'packages/ui/assets/cba.webp',
    ancho: 192,
    calidad: 0.85,
    maxKb: 30,
    porQue: 'logo del CBA para los pies de página',
  },
  {
    origen: 'origen/wallpaper.png',
    destino: 'packages/ui/assets/portada.webp',
    ancho: 1120,
    calidad: 0.62,
    maxKb: 150,
    porQue: 'portada de la landing',
  },
];

/**
 * El logo, rasterizado a PNG.
 *
 * **No es sólo para material de presentación.** El manifest declaraba
 * únicamente el SVG, y iOS no lo usa: al agregar la app a la pantalla de inicio
 * en un iPhone quedaba sin ícono propio. Y `REF4-4` explica en la interfaz cómo
 * instalarla justamente ahí.
 *
 * El arte trae su propia placa oscura con esquinas redondeadas, así que el PNG
 * se exporta **con transparencia**: lo que queda fuera del redondeo no se
 * rellena.
 */
const PNG_DEL_LOGO = [
  {
    destino: 'packages/app/public/apple-touch-icon.png',
    lado: 180,
    maxKb: 16,
    porQue: 'ícono al agregar a inicio en iOS',
  },
  {
    destino: 'packages/app/public/icon-192.png',
    lado: 192,
    maxKb: 16,
    porQue: 'ícono del manifest',
  },
  {
    destino: 'packages/app/public/icon-512.png',
    lado: 512,
    maxKb: 40,
    porQue: 'ícono grande del manifest y de la tienda',
  },
  {
    destino: 'packages/ui/assets/liga-1024.png',
    lado: 1024,
    maxKb: 120,
    porQue: 'marca en alta, para presentaciones e impresión',
  },
];

/**
 * El ícono *maskable*: el arte, a pantalla completa y con aire alrededor.
 *
 * Android recorta los íconos maskable con la forma que elija el fabricante
 * (círculo, gota, cuadrado redondeado), y sólo garantiza ver un círculo central
 * del 80 % del lado. El ícono común trae su propia placa con esquinas
 * redondeadas y transparencia fuera: recortado, deja un marco. Éste pinta el
 * color de la placa en **todo** el cuadrado y dibuja el logo al 60 %, dentro de
 * la zona segura.
 */
const FONDO_MASKABLE = '#16170f';
const ESCALA_MASKABLE = 0.6;

const MASKABLE = {
  destino: 'packages/app/public/icon-maskable-512.png',
  lado: 512,
  maxKb: 40,
  porQue: 'ícono maskable del manifest (zona segura)',
};

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

/**
 * Reescala en un canvas de Chromium.
 *
 * El `<img>` se espera con `decode()`, no con el evento `load`: `load` dispara
 * cuando llegaron los bytes y `decode()` cuando la imagen se puede dibujar. Con
 * `load` a secas, un PNG grande se dibuja a veces en blanco.
 */
async function reescalar(pagina, bytesOrigen, { ancho, calidad, destino }) {
  const base64 = bytesOrigen.toString('base64');
  const tipo = destino.endsWith('.webp')
    ? 'image/webp'
    : destino.endsWith('.jpg')
      ? 'image/jpeg'
      : 'image/png';

  const dataUrl = await pagina.evaluate(
    async ({ base64, ancho, calidad, tipo }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();

      const escala = Math.min(1, ancho / img.naturalWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * escala);
      canvas.height = Math.round(img.naturalHeight * escala);

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';

      // El JPEG no tiene transparencia: sin fondo, lo transparente sale negro.
      // El WebP sí la tiene, así que el logo del CBA conserva su recorte.
      if (tipo === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL(tipo, calidad);
    },
    { base64, ancho, calidad, tipo },
  );

  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

/**
 * Rasteriza el SVG del logo a PNG, cuadrado y con fondo transparente.
 *
 * Se dibuja el SVG en un canvas en vez de sacarle una captura a la página: la
 * captura arrastra el fondo del navegador y el redondeo de la placa terminaría
 * sobre blanco. En el canvas, lo que el SVG no pinta queda transparente.
 *
 * El `decode()` es el mismo cuidado que en `reescalar`: `load` dispara cuando
 * llegaron los bytes, `decode()` cuando la imagen se puede dibujar.
 */
async function rasterizarLogo(pagina, svg, lado) {
  const base64 = Buffer.from(svg).toString('base64');

  const dataUrl = await pagina.evaluate(
    async ({ base64, lado }) => {
      const img = new Image();
      img.src = `data:image/svg+xml;base64,${base64}`;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = lado;
      canvas.height = lado;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, lado, lado);

      return canvas.toDataURL('image/png');
    },
    { base64, lado },
  );

  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

/** Como `rasterizarLogo`, pero sobre un fondo sólido y con margen. */
async function rasterizarMaskable(pagina, svg, { lado }) {
  const base64 = Buffer.from(svg).toString('base64');

  const dataUrl = await pagina.evaluate(
    async ({ base64, lado, fondo, escala }) => {
      const img = new Image();
      img.src = `data:image/svg+xml;base64,${base64}`;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = lado;
      canvas.height = lado;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = fondo;
      ctx.fillRect(0, 0, lado, lado);

      const tamano = Math.round(lado * escala);
      const margen = Math.round((lado - tamano) / 2);
      ctx.drawImage(img, margen, margen, tamano, tamano);

      return canvas.toDataURL('image/png');
    },
    { base64, lado, fondo: FONDO_MASKABLE, escala: ESCALA_MASKABLE },
  );

  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

function escribir(destino, bytes) {
  const ruta = join(RAIZ, destino);
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, bytes);
}

async function main() {
  const problemas = [];

  const logo = readFileSync(join(RAIZ, LOGO));
  for (const { destino, porQue } of COPIAS) {
    escribir(destino, logo);
    console.info(`✓ ${destino} · ${kb(logo.length)} KB · ${porQue}`);
  }

  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();

  try {
    for (const tarea of PNG_DEL_LOGO) {
      const salida = await rasterizarLogo(pagina, logo, tarea.lado);
      escribir(tarea.destino, salida);

      const marca = kb(salida.length) > tarea.maxKb ? '\u2717' : '\u2713';
      console.info(
        `${marca} ${tarea.destino} \u00b7 ${kb(salida.length)} KB ` +
          `(m\u00e1x ${tarea.maxKb}) \u00b7 ${tarea.lado}px \u00b7 ${tarea.porQue}`,
      );

      if (kb(salida.length) > tarea.maxKb) {
        problemas.push(`${tarea.destino} pesa ${kb(salida.length)} KB, m\u00e1ximo ${tarea.maxKb}`);
      }
    }

    {
      const salida = await rasterizarMaskable(pagina, logo, MASKABLE);
      escribir(MASKABLE.destino, salida);

      const marca = kb(salida.length) > MASKABLE.maxKb ? '\u2717' : '\u2713';
      console.info(
        `${marca} ${MASKABLE.destino} \u00b7 ${kb(salida.length)} KB ` +
          `(m\u00e1x ${MASKABLE.maxKb}) \u00b7 ${MASKABLE.lado}px \u00b7 ${MASKABLE.porQue}`,
      );
      if (kb(salida.length) > MASKABLE.maxKb) {
        problemas.push(
          `${MASKABLE.destino} pesa ${kb(salida.length)} KB, m\u00e1ximo ${MASKABLE.maxKb}`,
        );
      }
    }

    for (const tarea of RASTER) {
      const origen = join(RAIZ, tarea.origen);
      if (!existsSync(origen)) {
        problemas.push(`falta el origen ${tarea.origen}`);
        continue;
      }

      const antes = statSync(origen).size;
      const salida = await reescalar(pagina, readFileSync(origen), tarea);
      escribir(tarea.destino, salida);

      const marca = kb(salida.length) > tarea.maxKb ? '✗' : '✓';
      console.info(
        `${marca} ${tarea.destino} · ${kb(antes)} KB → ${kb(salida.length)} KB ` +
          `(máx ${tarea.maxKb}) · ${tarea.ancho}px · ${tarea.porQue}`,
      );

      if (kb(salida.length) > tarea.maxKb) {
        problemas.push(`${tarea.destino} pesa ${kb(salida.length)} KB, máximo ${tarea.maxKb}`);
      }
    }
  } finally {
    await navegador.close();
  }

  if (problemas.length > 0) {
    console.error(`\n✗ ${problemas.join('\n✗ ')}`);
    process.exit(1);
  }

  console.info('\nTodas las imágenes dentro de presupuesto.');
}

await main();
