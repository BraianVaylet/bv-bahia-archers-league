import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Las capas del backend (`REF6-10` / `B-1`).
 *
 * `CLAUDE.md`, regla 3: ninguna consulta a MongoDB fuera de `repositories/`, y las
 * capas son `routes → services → repositories`. Una ruta pública llevaba semanas
 * haciendo `seasons().find(...)` con un repositorio que ya existía para eso, porque
 * la regla sólo estaba escrita. `scripts/verificar-capas.mjs` la mira; estos tests
 * prueban que **la mira bien** (que falla donde tiene que fallar) y que el `src` real
 * la cumple.
 */

interface Infraccion {
  archivo: string;
  linea: number;
  modulo: string;
  motivo: string;
}
interface Verificador {
  violaciones: (srcDir: string) => Infraccion[];
  infraccionesDeFrontend: (ruta: string, codigo: string) => Infraccion[];
  violacionesDeFrontends: (packagesDir: string) => Infraccion[];
  importsDe: (codigo: string) => { modulo: string; linea: number }[];
}

const AQUI = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(AQUI, '..', '..', '..', 'scripts', 'verificar-capas.mjs');
const SRC_REAL = join(AQUI, '..', 'src');

const cargar = async (): Promise<Verificador> =>
  (await import(pathToFileURL(SCRIPT).href)) as Verificador;

/** Un `src` de mentira con los archivos que se pidan. */
function srcCon(archivos: Record<string, string>): string {
  const raiz = mkdtempSync(join(tmpdir(), 'bal-capas-'));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = join(raiz, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido);
  }
  return raiz;
}

const CLIENT = "import { tournaments } from '../db/client.js';\n";

describe('verificar-capas', () => {
  describe('el import de db/client', () => {
    it('lo permite en repositories/ y en db/', async () => {
      const { violaciones } = await cargar();
      const src = srcCon({
        'repositories/seasonRepo.ts': CLIENT,
        'db/indexes.ts': "import { getDb } from './client.js';\n",
      });

      expect(violaciones(src)).toEqual([]);
    });

    it('lo permite en la raíz de composición (index.ts)', async () => {
      const { violaciones } = await cargar();

      expect(
        violaciones(srcCon({ 'index.ts': "import { connect } from './db/client.js';\n" })),
      ).toEqual([]);
    });

    it('lo prohíbe en una ruta, con el archivo y la línea', async () => {
      const { violaciones } = await cargar();
      const src = srcCon({ 'routes/publico.ts': `import { Hono } from 'hono';\n${CLIENT}` });

      const [infraccion] = violaciones(src);
      expect(infraccion).toMatchObject({ archivo: 'routes/publico.ts', linea: 2 });
      expect(infraccion?.motivo).toMatch(/regla 3/);
    });

    it('lo prohíbe en un servicio', async () => {
      const { violaciones } = await cargar();

      expect(violaciones(srcCon({ 'services/x.ts': CLIENT }))).toHaveLength(1);
    });

    // El import dinámico existía de verdad (`patrolAdminService`) y un chequeo que sólo
    // mirara `from '...'` lo habría dejado pasar.
    it('también prohíbe el import dinámico', async () => {
      const { violaciones } = await cargar();
      const src = srcCon({
        'services/x.ts': "const s = (await import('../db/client.js')).getClient();\n",
      });

      expect(violaciones(src)).toHaveLength(1);
    });

    it('no se deja engañar por un comentario que lo nombra', async () => {
      const { violaciones } = await cargar();
      const src = srcCon({
        'services/x.ts':
          "// ver `import { x } from '../db/client.js'`\n/* import { y } from '../db/client.js' */\nexport const a = 1;\n",
      });

      expect(violaciones(src)).toEqual([]);
    });

    it('el número de línea no se corre por los comentarios de arriba', async () => {
      const { violaciones } = await cargar();
      const src = srcCon({ 'services/x.ts': `/**\n * uno\n * dos\n */\n${CLIENT}` });

      expect(violaciones(src)[0]?.linea).toBe(5);
    });
  });

  describe('las rutas', () => {
    it('no importan repositorios', async () => {
      const { violaciones } = await cargar();
      const src = srcCon({
        'routes/admin.ts': "import * as tournamentRepo from '../repositories/tournamentRepo.js';\n",
      });

      const [infraccion] = violaciones(src);
      expect(infraccion?.motivo).toMatch(/servicio/);
    });

    it('no abren sesiones de la base', async () => {
      const { violaciones } = await cargar();
      const src = srcCon({
        'routes/admin.ts': "import { iniciarSesion } from '../db/sesion.js';\n",
      });

      expect(violaciones(src)).toHaveLength(1);
    });

    it('sí hablan con los servicios', async () => {
      const { violaciones } = await cargar();
      const src = srcCon({
        'routes/admin.ts': "import * as seasonService from '../services/seasonService.js';\n",
      });

      expect(violaciones(src)).toEqual([]);
    });
  });

  describe('los servicios', () => {
    it('pueden abrir una sesión para una transacción, que no expone colecciones', async () => {
      const { violaciones } = await cargar();
      const src = srcCon({ 'services/x.ts': "import { iniciarSesion } from '../db/sesion.js';\n" });

      expect(violaciones(src)).toEqual([]);
    });

    it('y pueden importar los tipos de la base', async () => {
      const { violaciones } = await cargar();
      const src = srcCon({ 'services/x.ts': "import type { ArcherDoc } from '../db/types.js';\n" });

      expect(violaciones(src)).toEqual([]);
    });
  });

  // Lo que hace falta para que el CI sirva: el `src` de verdad cumple la regla.
  it('el src real respeta las capas', async () => {
    const { violaciones } = await cargar();

    expect(violaciones(SRC_REAL)).toEqual([]);
  });

  /**
   * Los frontends sólo ven del backend sus **tipos** (`REF6-11` / `C-3`).
   *
   * `@bal/api/tipos` existe para que el cliente RPC de Hono sepa la forma de cada respuesta. Un
   * `import` común del mismo módulo, o de cualquier otro del backend, no falla el typecheck: falla
   * en el bundle, que se llevaría Hono, Mongo y los servicios al celular. Por eso se mira acá.
   */
  describe('los frontends', () => {
    const TIPOS = "import type { RutasDeAdmin } from '@bal/api/tipos';\n";

    it('pueden importar los tipos de la API, con import type', async () => {
      const { infraccionesDeFrontend } = await cargar();

      expect(infraccionesDeFrontend('wafa/rpc.ts', TIPOS)).toEqual([]);
    });

    it('también si el import ocupa varias líneas', async () => {
      const { infraccionesDeFrontend } = await cargar();
      const codigo =
        "import type {\n  RutasDeAdmin,\n  RutasPublicas,\n} from '@bal/api/tipos';\nexport const a = 1;\n";

      expect(infraccionesDeFrontend('lib/rpc.ts', codigo)).toEqual([]);
    });

    it('y re-exportarlos, si es export type', async () => {
      const { infraccionesDeFrontend } = await cargar();

      expect(
        infraccionesDeFrontend('lib/t.ts', "export type { RutasDeAdmin } from '@bal/api/tipos';\n"),
      ).toEqual([]);
    });

    it('un import común de los tipos es una infracción: llega al bundle', async () => {
      const { infraccionesDeFrontend } = await cargar();

      const [infraccion] = infraccionesDeFrontend(
        'lib/rpc.ts',
        "import { RutasDeAdmin } from '@bal/api/tipos';\n",
      );

      expect(infraccion).toMatchObject({ archivo: 'lib/rpc.ts', linea: 1 });
      expect(infraccion?.motivo).toMatch(/import type/);
    });

    // `import { type X }` parece inofensivo y no lo es: con `verbatimModuleSyntax` queda un
    // `import {} from '...'` que el bundler resuelve y carga.
    it('un import { type X } tampoco vale: deja un import vacío que se carga igual', async () => {
      const { infraccionesDeFrontend } = await cargar();

      expect(
        infraccionesDeFrontend(
          'lib/rpc.ts',
          "import { type RutasDeAdmin } from '@bal/api/tipos';\n",
        ),
      ).toHaveLength(1);
    });

    it('export { X } from … sin type, tampoco', async () => {
      const { infraccionesDeFrontend } = await cargar();

      expect(
        infraccionesDeFrontend('lib/t.ts', "export { RutasDeAdmin } from '@bal/api/tipos';\n"),
      ).toHaveLength(1);
    });

    it('el import dinámico y el de efecto secundario son infracciones', async () => {
      const { infraccionesDeFrontend } = await cargar();

      expect(
        infraccionesDeFrontend('lib/a.ts', "const t = await import('@bal/api/tipos');\n"),
      ).toHaveLength(1);
      expect(infraccionesDeFrontend('lib/b.ts', "import '@bal/api/tipos';\n")).toHaveLength(1);
    });

    it.each([
      ['el paquete entero', "import type { createApp } from '@bal/api';\n"],
      ['su build', "import type { x } from '@bal/api/dist/app.js';\n"],
      [
        'un servicio, por ruta relativa',
        "import type { x } from '../../../api/src/services/a.js';\n",
      ],
      [
        'las rutas, por ruta relativa',
        "import type { admin } from '../../api/src/routes/admin.js';\n",
      ],
    ])('no importan nada más del backend: %s', async (_nombre, codigo) => {
      const { infraccionesDeFrontend } = await cargar();

      const [infraccion] = infraccionesDeFrontend('lib/x.ts', codigo);

      expect(infraccion?.motivo).toMatch(/@bal\/api\/tipos/);
    });

    it('un paquete que sólo se parece en el nombre no es el backend', async () => {
      const { infraccionesDeFrontend } = await cargar();

      expect(
        infraccionesDeFrontend(
          'lib/x.ts',
          "import { a } from '@bal/apiary';\nimport { b } from './api/cliente.js';\n",
        ),
      ).toEqual([]);
    });

    it('no se dejan engañar por un comentario que lo nombra', async () => {
      const { infraccionesDeFrontend } = await cargar();
      const codigo = "// import { x } from '@bal/api/tipos'\n/* import { y } from '@bal/api' */\n";

      expect(infraccionesDeFrontend('lib/x.ts', codigo)).toEqual([]);
    });

    it('dice la línea correcta aunque haya comentarios arriba', async () => {
      const { infraccionesDeFrontend } = await cargar();
      const codigo = "/**\n * uno\n */\nimport { x } from '@bal/api/tipos';\n";

      expect(infraccionesDeFrontend('lib/x.ts', codigo)[0]?.linea).toBe(4);
    });

    it('revisa app y landing, incluidos los .tsx', async () => {
      const { violacionesDeFrontends } = await cargar();
      const packages = mkdtempSync(join(tmpdir(), 'bal-front-'));
      const poner = (ruta: string, contenido: string) => {
        mkdirSync(dirname(join(packages, ruta)), { recursive: true });
        writeFileSync(join(packages, ruta), contenido);
      };
      poner('app/src/wafa/A.tsx', "import { x } from '@bal/api/tipos';\n");
      poner('landing/src/lib/b.ts', "import { createApp } from '@bal/api';\n");
      poner('app/src/lib/ok.ts', TIPOS);

      const archivos = violacionesDeFrontends(packages).map((i) => i.archivo);

      expect(archivos.sort()).toEqual(['app/src/wafa/A.tsx', 'landing/src/lib/b.ts']);
    });

    it('el código real de app y landing cumple', async () => {
      const { violacionesDeFrontends } = await cargar();

      expect(violacionesDeFrontends(join(AQUI, '..', '..'))).toEqual([]);
    });
  });
});
