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
});
