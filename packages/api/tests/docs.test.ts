import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Los docs no prometen lo que el código no hace (`REF6-15` / `B-2`).
 *
 * Para un proyecto que le pide a cada modelo de IA leer los docs **antes** de tocar código, un doc
 * que miente es un bug: el próximo implementa sobre la promesa. Dos cosas se habían desfasado más de
 * una vez porque están escritas a mano en dos lugares: las versiones de `TECHNICAL.md` §1 (decía
 * driver de MongoDB 6, React Router 6 y `vite-plugin-pwa` 0.21 cuando eran 7, 7 y 1) y los topes de
 * bundle (el doc y `presupuesto.mjs`). `scripts/verificar-docs.mjs` las compara; estos tests prueban
 * que **las compara bien** y que el repo real las cumple.
 */

interface Inconsistencia {
  doc: string;
  mensaje: string;
}
interface Verificador {
  inconsistencias: (raiz: string) => Inconsistencia[];
}

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_REAL = join(AQUI, '..', '..', '..');
const SCRIPT = join(RAIZ_REAL, 'scripts', 'verificar-docs.mjs');

const cargar = async (): Promise<Verificador> =>
  (await import(pathToFileURL(SCRIPT).href)) as Verificador;

const TABLA_DE_VERSIONES = (filas: Record<string, string>) =>
  [
    '## 1. Stack',
    '',
    '| Capa | Tecnología | Versión |',
    '|---|---|---|',
    ...Object.entries(filas).map(([capa, resto]) => `| ${capa} | ${resto}`),
    '',
    '## 2. Modelo de datos',
  ].join('\n');

const TABLA_DE_TOPES = (rol: number, wafl: number, wafa: number, landing: number) =>
  [
    '### Presupuestos',
    '',
    '| Métrica | Presupuesto | Medido | Cómo se verifica |',
    '|---|---|---|---|',
    `| JS que baja la pantalla de elegir rol (\`/app/\`) | < ${rol} KB gz | 99 | ci |`,
    `| JS que baja WAFL (inicial + su chunk) | **< ${wafl} KB** gz | 111 | ci |`,
    `| JS que baja WAFA (inicial + su chunk) | < ${wafa} KB gz | 119 | ci |`,
    `| JS inicial de la landing | < ${landing} KB gz | 102 | ci |`,
    '',
    '#### Sincronización',
  ].join('\n');

const PRESUPUESTO = (rol: number, wafl: number, wafa: number, landing: number) =>
  [
    "{ nombre: 'pantalla de elegir rol', chunk: null, excluye: /^Waf[al]App-/, maxKb: " +
      rol +
      ' },',
    "{ nombre: 'WAFL (líder de patrulla)', chunk: /^WaflApp-/, excluye: /^WafaApp-/, maxKb: " +
      wafl +
      ' },',
    "{ nombre: 'WAFA (administrador)', chunk: /^WafaApp-/, excluye: /^WaflApp-/, maxKb: " +
      wafa +
      ' },',
    "cargas: [{ nombre: 'inicial', chunk: null, excluye: null, maxKb: " + landing + ' }],',
  ].join('\n');

/** Un repo de mentira con los archivos que se pidan. */
function repoCon(archivos: Record<string, string>): string {
  const raiz = mkdtempSync(join(tmpdir(), 'bal-docs-'));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = join(raiz, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido);
  }
  return raiz;
}

const paquete = (dependencies: Record<string, string>, extra: object = {}) =>
  JSON.stringify({ dependencies, ...extra });

const BASE = {
  'package.json': JSON.stringify({
    packageManager: 'pnpm@9.15.0',
    devDependencies: { '@biomejs/biome': '2.5.7', typescript: '5.9.3' },
  }),
  'packages/app/package.json': paquete({
    react: '^19.2.8',
    vite: '^8.3.5',
    tailwindcss: '^4.3.3',
    'react-router-dom': '^7.18.2',
    'vite-plugin-pwa': '^1.3.0',
    idb: '^8.0.3',
  }),
  'packages/api/package.json': paquete({
    hono: '^4.13.14',
    mongodb: '^7.5.0',
    zod: '^4.6.7',
    '@node-rs/argon2': '^2.0.2',
    vitest: '^4.1.12',
  }),
  'scripts/presupuesto.mjs': PRESUPUESTO(105, 125, 135, 120),
};

const FILAS_OK = {
  Lenguaje: 'TypeScript `strict` | **5.9.3** |',
  Monorepo: 'pnpm workspaces | **9.15.0** |',
  Backend: 'Hono | 4.x |',
  'Base de datos': 'MongoDB Atlas + driver oficial `mongodb` | server 7.x · driver **7.x** |',
  Validación: 'Zod `.strict()` | **4.x** |',
  Frontend: '**React 19**, **Vite 8**, Tailwind CSS 4, React Router 7 | — |',
  PWA: '`vite-plugin-pwa` (Workbox) | **1.x** |',
  Offline: '`idb` | 8.x |',
  Hash: '**`@node-rs/argon2`** (argon2id) | 2.x |',
  'Lint y format': 'Biome | **2.5.7** |',
  Tests: '**Vitest 4** · Testing Library | — |',
};

const docCon = (filas: Record<string, string>, topes = TABLA_DE_TOPES(105, 125, 135, 120)) =>
  `${TABLA_DE_VERSIONES(filas)}\n\n${topes}\n`;

describe('verificar-docs: versiones de TECHNICAL.md §1', () => {
  it('no se queja si el doc dice lo que hay instalado', async () => {
    const { inconsistencias } = await cargar();
    const raiz = repoCon({ ...BASE, 'docs/TECHNICAL.md': docCon(FILAS_OK) });

    expect(inconsistencias(raiz)).toEqual([]);
  });

  it.each([
    [
      'el driver de MongoDB',
      'Base de datos',
      'MongoDB Atlas | server 7.x · driver **6.x** |',
      /mongodb/i,
    ],
    [
      'React',
      'Frontend',
      '**React 18**, **Vite 8**, Tailwind CSS 4, React Router 7 | — |',
      /^React:/,
    ],
    [
      'Vite',
      'Frontend',
      '**React 19**, **Vite 6**, Tailwind CSS 4, React Router 7 | — |',
      /^Vite:/,
    ],
    [
      'Tailwind',
      'Frontend',
      '**React 19**, **Vite 8**, Tailwind CSS 3, React Router 7 | — |',
      /tailwind/i,
    ],
    [
      'React Router',
      'Frontend',
      '**React 19**, **Vite 8**, Tailwind CSS 4, React Router 6 | — |',
      /react-router/i,
    ],
    ['vite-plugin-pwa', 'PWA', '`vite-plugin-pwa` (Workbox) | 0.21+ |', /vite-plugin-pwa/i],
    ['Zod', 'Validación', 'Zod `.strict()` | **3.x** |', /zod/i],
    ['Hono', 'Backend', 'Hono | 3.x |', /hono/i],
    ['Vitest', 'Tests', '**Vitest 3** · Testing Library | — |', /vitest/i],
    ['Biome', 'Lint y format', 'Biome | **2.0.0** |', /biome/i],
    ['TypeScript', 'Lenguaje', 'TypeScript `strict` | **5.0.0** |', /typescript/i],
    ['pnpm', 'Monorepo', 'pnpm workspaces | **8.0.0** |', /pnpm/i],
    ['idb', 'Offline', '`idb` | 7.x |', /^idb:/],
    ['argon2', 'Hash', '**`@node-rs/argon2`** (argon2id) | 1.x |', /argon2/i],
  ])('detecta %s desactualizado', async (_nombre, capa, filaRota, patron) => {
    const { inconsistencias } = await cargar();
    const raiz = repoCon({
      ...BASE,
      'docs/TECHNICAL.md': docCon({ ...FILAS_OK, [capa as string]: filaRota as string }),
    });

    const malas = inconsistencias(raiz);

    expect(malas.length).toBeGreaterThan(0);
    expect(malas.some((m) => (patron as RegExp).test(m.mensaje))).toBe(true);
  });

  it('una fila que falta del doc también es una inconsistencia', async () => {
    const { inconsistencias } = await cargar();
    const { Frontend: _quitada, ...sinFrontend } = FILAS_OK;
    const raiz = repoCon({ ...BASE, 'docs/TECHNICAL.md': docCon(sinFrontend) });

    expect(inconsistencias(raiz).some((m) => /Frontend/.test(m.mensaje))).toBe(true);
  });
});

describe('verificar-docs: topes de bundle de TECHNICAL.md §5', () => {
  it('no se queja si coinciden con presupuesto.mjs', async () => {
    const { inconsistencias } = await cargar();
    const raiz = repoCon({ ...BASE, 'docs/TECHNICAL.md': docCon(FILAS_OK) });

    expect(inconsistencias(raiz).filter((m) => /KB/.test(m.mensaje))).toEqual([]);
  });

  it.each([
    ['la pantalla de elegir rol', TABLA_DE_TOPES(100, 125, 135, 120)],
    ['WAFL', TABLA_DE_TOPES(105, 120, 135, 120)],
    ['WAFA', TABLA_DE_TOPES(105, 125, 130, 120)],
    ['la landing', TABLA_DE_TOPES(105, 125, 135, 100)],
  ])('detecta un tope distinto en %s', async (_nombre, topes) => {
    const { inconsistencias } = await cargar();
    const raiz = repoCon({ ...BASE, 'docs/TECHNICAL.md': docCon(FILAS_OK, topes) });

    const malas = inconsistencias(raiz).filter((m) => /KB/.test(m.mensaje));

    expect(malas).toHaveLength(1);
  });

  it('si el doc o el script no se pueden leer, lo dice y no se calla', async () => {
    const { inconsistencias } = await cargar();
    const raiz = repoCon({ ...BASE, 'docs/TECHNICAL.md': 'sin tablas' });

    expect(inconsistencias(raiz).length).toBeGreaterThan(0);
  });
});

it('el repo real cumple', async () => {
  const { inconsistencias } = await cargar();

  expect(inconsistencias(RAIZ_REAL)).toEqual([]);
});
