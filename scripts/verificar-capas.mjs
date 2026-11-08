/**
 * Las capas del backend, verificadas (`REF6-10` / `B-1`).
 *
 * `CLAUDE.md`, regla 3: «Ninguna consulta a MongoDB fuera de `packages/api/src/
 * repositories/`. Sin excepciones. Es lo que permite auditar la seguridad de la capa de
 * datos en un solo lugar.» Y las capas son `routes` (validación Zod) → `services`
 * (negocio) → `repositories` (Mongo).
 *
 * Una regla que sólo vive en un documento se rompe: una ruta pública llevaba semanas
 * haciendo `seasons().find(...)`, con un repositorio que ya existía para eso. Esto la
 * convierte en algo que el CI mira solo, como `verificar-workspace.mjs`.
 *
 * Qué se comprueba:
 *
 * 1. **Sólo `repositories/` y `db/` importan `db/client`** —el acceso a las colecciones
 *    y al cliente de Mongo—, más `index.ts`, la raíz de composición, que conecta y
 *    desconecta. Un servicio que necesita una transacción usa `db/sesion`, que sólo
 *    abre sesiones y no expone colecciones.
 * 2. **Las rutas no importan repositorios ni `db/`**: hablan con los servicios. Una ruta
 *    que arma la respuesta con repositorios es una regla de negocio fuera de su lugar
 *    (regla 2) y una consulta que no pasó por una capa que valide.
 *
 * 3. **Los frontends sólo ven del backend sus tipos** (`REF6-11` / `C-3`). `@bal/api/tipos`
 *    le da al cliente RPC de Hono la forma de cada respuesta; se importa con `import type`
 *    y nada más del backend se importa. Un `import` común no falla el typecheck: se lleva
 *    Hono, Mongo y los servicios al bundle del celular.
 *
 * Sólo mira lo que se importa, no cada llamada: es barato, no tiene falsos negativos por
 * un alias y alcanza para que la regla no se pueda romper sin que alguien lo vea.
 *
 * ```bash
 * node scripts/verificar-capas.mjs
 * ```
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** La raíz de composición: arranca el proceso y conecta la base. */
const RAIZ_DE_COMPOSICION = 'index.ts';

/** Las carpetas que sí pueden hablar con el cliente de Mongo. */
const CAPAS_DE_DATOS = ['repositories', 'db'];

/** Quita los comentarios sin tocar los saltos de línea, para no mover los números. */
function sinComentarios(codigo) {
  const blanquear = (m) => m.replace(/[^\n]/g, ' ');
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, blanquear)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, antes) => antes + blanquear(m.slice(antes.length)));
}

/** Cada módulo que un archivo importa, con su línea: estático o dinámico. */
export function importsDe(codigo) {
  const limpio = sinComentarios(codigo);
  const encontrados = [];
  const patron = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;

  for (const m of limpio.matchAll(patron)) {
    const linea = limpio.slice(0, m.index).split('\n').length;
    encontrados.push({ modulo: m[1], linea });
  }
  return encontrados;
}

const apuntaA = (modulo, carpeta) => new RegExp(`(^|/)${carpeta}(/|$)`).test(modulo);
const esClientDeMongo = (modulo) => /(^|\/)db\/client(\.js)?$/.test(modulo);
const esSesion = (modulo) => /(^|\/)db\/sesion(\.js)?$/.test(modulo);

/** Las infracciones de un archivo, dado su ruta relativa a `src/`. */
export function infraccionesDe(rutaDelArchivo, codigo) {
  // Siempre con `/`, también en Windows: es lo que se imprime y lo que se compara.
  const rutaRelativa = rutaDelArchivo.split(sep).join('/');
  const partes = rutaRelativa.split('/');
  const carpeta = partes.length > 1 ? partes[0] : '';
  const infracciones = [];

  for (const { modulo, linea } of importsDe(codigo)) {
    if (esClientDeMongo(modulo)) {
      const permitido = CAPAS_DE_DATOS.includes(carpeta) || rutaRelativa === RAIZ_DE_COMPOSICION;
      if (!permitido) {
        infracciones.push({
          archivo: rutaRelativa,
          linea,
          modulo,
          motivo:
            'importa `db/client` fuera de `repositories/` y `db/`: toda consulta va en un repositorio (regla 3)',
        });
      }
    }

    if (carpeta === 'routes' && (apuntaA(modulo, 'repositories') || esSesion(modulo))) {
      infracciones.push({
        archivo: rutaRelativa,
        linea,
        modulo,
        motivo: 'una ruta no importa repositorios ni sesiones de la base: habla con un servicio',
      });
    }
  }
  return infracciones;
}

function archivosDe(dir, extensiones = ['.ts']) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return archivosDe(ruta, extensiones);
    return extensiones.some((x) => e.name.endsWith(x)) && !e.name.endsWith('.d.ts') ? [ruta] : [];
  });
}

// ── Los frontends ───────────────────────────────────────────────────────────

/** Los paquetes que corren en el navegador. */
const FRONTENDS = ['app', 'landing'];

/** Lo único del backend que un frontend puede ver, y sólo como tipo. */
const TIPOS_DE_LA_API = '@bal/api/tipos';

/** Un import que apunta al backend: por el nombre del paquete o por una ruta a su `src`. */
const esDelBackend = (modulo) =>
  /^@bal\/api(\/|$)/.test(modulo) || /(^|\/)api\/src(\/|$)/.test(modulo);

/**
 * Las líneas donde `@bal/api/tipos` entra como `import type` o `export type … from`.
 *
 * `import { type X }` **no** cuenta: con `verbatimModuleSyntax` queda un `import {} from …` que el
 * bundler resuelve y carga igual.
 */
function lineasDeImportDeTipos(limpio) {
  const lineas = new Set();
  const patron = /\b(?:import|export)\s+type\s[^;'"]*?\bfrom\s*["']@bal\/api\/tipos["']/g;

  for (const m of limpio.matchAll(patron)) {
    const posicionDelModulo = m.index + m[0].lastIndexOf(TIPOS_DE_LA_API);
    lineas.add(limpio.slice(0, posicionDelModulo).split('\n').length);
  }
  return lineas;
}

/** Las infracciones de un archivo de un frontend. */
export function infraccionesDeFrontend(rutaDelArchivo, codigo) {
  const delBackend = importsDe(codigo).filter(({ modulo }) => esDelBackend(modulo));
  if (delBackend.length === 0) return [];

  const comoTipo = lineasDeImportDeTipos(sinComentarios(codigo));
  const archivo = rutaDelArchivo.split(sep).join('/');

  return delBackend.flatMap(({ modulo, linea }) => {
    if (modulo !== TIPOS_DE_LA_API) {
      return [
        {
          archivo,
          linea,
          modulo,
          motivo:
            'un frontend no importa el backend: lo único que puede ver son sus tipos, desde `@bal/api/tipos`',
        },
      ];
    }
    if (comoTipo.has(linea)) return [];
    return [
      {
        archivo,
        linea,
        modulo,
        motivo:
          'importa `@bal/api/tipos` sin `import type`: llevaría Hono, Mongo y los servicios al bundle',
      },
    ];
  });
}

/** Las infracciones de los frontends, dada la carpeta `packages`. */
export function violacionesDeFrontends(packagesDir) {
  return FRONTENDS.flatMap((frontend) => {
    const src = join(packagesDir, frontend, 'src');
    if (!statSync(src, { throwIfNoEntry: false })?.isDirectory()) return [];

    return archivosDe(src, ['.ts', '.tsx']).flatMap((ruta) =>
      infraccionesDeFrontend(relative(packagesDir, ruta), readFileSync(ruta, 'utf8')),
    );
  });
}

/** Todas las infracciones bajo una carpeta `src`. */
export function violaciones(srcDir) {
  return archivosDe(srcDir).flatMap((ruta) =>
    infraccionesDe(relative(srcDir, ruta), readFileSync(ruta, 'utf8')),
  );
}

function main() {
  const raiz = fileURLToPath(new URL('..', import.meta.url));
  const src = join(raiz, 'packages', 'api', 'src');

  if (!statSync(src, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`✗ No encuentro ${src}.`);
    process.exit(1);
  }

  const delBackend = violaciones(src).map((i) => ({
    ...i,
    archivo: `packages/api/src/${i.archivo}`,
  }));
  const delFrontend = violacionesDeFrontends(join(raiz, 'packages')).map((i) => ({
    ...i,
    archivo: `packages/${i.archivo}`,
  }));
  const infracciones = [...delBackend, ...delFrontend];

  if (infracciones.length === 0) {
    console.info('✓ Las capas del backend se respetan: sólo repositories/ y db/ tocan Mongo.');
    console.info(
      '✓ Los frontends sólo ven del backend sus tipos (`import type` de @bal/api/tipos).',
    );
    return;
  }

  for (const i of infracciones) {
    console.error(`✗ ${i.archivo}:${i.linea} — ${i.motivo} (${i.modulo})`);
  }
  console.error(`\n${infracciones.length} infracción(es) de las capas.`);
  process.exit(1);
}

// Importable desde un test sin que corra solo.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
