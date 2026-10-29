import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { alternarTema, COLOR_DE_BARRA, resolverTema, TEMA_KEY, type Tema } from '../src/index.js';

/**
 * Decisión del tema (REF-4).
 *
 * La lógica vive acá y no en cada app porque hay **tres** lugares que tienen
 * que coincidir: el script anti-FOUC de cada `index.html` y el control que lo
 * conmuta. Ver docs/DESIGN_SYSTEM.md §9.
 */

describe('TEMA_KEY', () => {
  // El script anti-FOUC de los `index.html` lee esta misma clave, escrita a
  // mano porque corre antes de cualquier import. Si cambia acá y allá no, el
  // tema elegido se pierde en cada recarga.
  it('es la clave que leen los scripts anti-FOUC', () => {
    expect(TEMA_KEY).toBe('bal_tema');
  });
});

describe('resolverTema', () => {
  it('respeta lo que el usuario eligió', () => {
    expect(resolverTema('dark', false)).toBe('dark');
    expect(resolverTema('light', true)).toBe('light');
  });

  it('sin elección, sigue la preferencia del sistema', () => {
    expect(resolverTema(null, true)).toBe('dark');
    expect(resolverTema(null, false)).toBe('light');
  });

  // Un valor corrupto no es una elección: forzar claro ignoraría a alguien que
  // tiene el sistema en oscuro.
  it('un valor que no reconoce lo trata como si no hubiera elección', () => {
    expect(resolverTema('azul', true)).toBe('dark');
    expect(resolverTema('', true)).toBe('dark');
    expect(resolverTema('azul', false)).toBe('light');
  });
});

describe('alternarTema', () => {
  it('va y vuelve', () => {
    expect(alternarTema('light')).toBe('dark');
    expect(alternarTema('dark')).toBe('light');
  });
});

/**
 * El script del tema corre antes que cualquier bundle y no puede importar nada,
 * así que repite a mano la lógica de `resolverTema`. Hay una copia por app
 * (`public/theme-init.js`): Vite sirve cada `public/` bajo su propio origen.
 *
 * **Se ejecuta, no se lee.** Antes este test buscaba texto dentro de los
 * `index.html`: probaba que el archivo nombrara la clave, no que decidiera lo
 * mismo — y de hecho no decidía lo mismo. Con un valor guardado corrupto y el
 * sistema en oscuro, el script pintaba claro y `resolverTema` oscuro; con
 * `localStorage` bloqueado, el script se quedaba en claro y el botón seguía al
 * sistema. En los dos casos, un parpadeo justo donde el script existe para
 * evitarlo.
 *
 * Ver `docs/DESIGN_SYSTEM.md` §9.
 */
describe('los scripts anti-FOUC dicen lo mismo que resolverTema', () => {
  // Relativo a este archivo: `packages/shared/tests/` → `packages/<app>/`.
  const SCRIPTS = ['../../app/public/theme-init.js', '../../landing/public/theme-init.js'] as const;
  const HTML = ['../../app/index.html', '../../landing/index.html'] as const;

  const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

  interface Entorno {
    /** Lo que hay en `localStorage` bajo `TEMA_KEY`; `null` si no hay nada. */
    readonly guardado: string | null;
    readonly sistemaOscuro: boolean;
    /** `localStorage` que tira al leer: modo privado, o datos del sitio bloqueados. */
    readonly sinAlmacenamiento?: boolean;
  }

  /** Corre el script como lo haría el navegador, con un documento de mentira. */
  function correr(ruta: string, entorno: Entorno): { tema: Tema; barra: string } {
    const atributos = new Map<string, string>();
    const barra = { content: COLOR_DE_BARRA.light };

    const global: Record<string, unknown> = {
      localStorage: {
        getItem: (clave: string) => {
          if (entorno.sinAlmacenamiento) throw new Error('bloqueado');
          return clave === TEMA_KEY ? entorno.guardado : null;
        },
      },
      matchMedia: (consulta: string) => ({
        matches: entorno.sistemaOscuro && consulta.includes('dark'),
      }),
      document: {
        documentElement: {
          setAttribute: (nombre: string, valor: string) => void atributos.set(nombre, valor),
        },
        querySelector: (selector: string) =>
          selector === 'meta[name=theme-color]'
            ? {
                setAttribute: (nombre: string, valor: string) => {
                  if (nombre === 'content') barra.content = valor;
                },
              }
            : null,
      },
    };
    global.window = global;

    runInNewContext(leer(ruta), global);

    // El CSS sólo mira `[data-theme='dark']`: claro es la ausencia del atributo.
    return {
      tema: atributos.get('data-theme') === 'dark' ? 'dark' : 'light',
      barra: barra.content,
    };
  }

  const GUARDADOS = [null, 'dark', 'light', 'azul', ''] as const;
  const COMBINACIONES = GUARDADOS.flatMap((g) => [true, false].map((o) => [g, o] as const));

  describe.each(SCRIPTS)('%s', (ruta) => {
    it.each(COMBINACIONES)(
      'guardado=%j, sistema oscuro=%s → el mismo tema y la misma barra que resolverTema',
      (guardado, sistemaOscuro) => {
        const esperado = resolverTema(guardado, sistemaOscuro);
        const { tema, barra } = correr(ruta, { guardado, sistemaOscuro });

        expect(tema).toBe(esperado);
        expect(barra).toBe(COLOR_DE_BARRA[esperado]);
      },
    );

    // Sin `localStorage` no se puede recordar la elección, pero eso no es motivo
    // para ignorar el sistema: es lo que hace `BotonTema`.
    it.each([true, false])(
      'sin acceso a localStorage (sistema oscuro=%s) sigue al sistema',
      (oscuro) => {
        const esperado = resolverTema(null, oscuro);
        const { tema, barra } = correr(ruta, {
          guardado: 'dark',
          sistemaOscuro: oscuro,
          sinAlmacenamiento: true,
        });

        expect(tema).toBe(esperado);
        expect(barra).toBe(COLOR_DE_BARRA[esperado]);
      },
    );
  });

  it('las dos copias son idénticas', () => {
    expect(leer(SCRIPTS[1])).toBe(leer(SCRIPTS[0]));
  });

  describe.each(HTML)('%s', (ruta) => {
    // La CSP de producción es `script-src 'self'`, sin `'unsafe-inline'` ni hashes
    // (`docs/SECURITY.md` §10): un script inline se bloquea y el tema no llega.
    it('no tiene ningún script inline', () => {
      expect(leer(ruta)).not.toMatch(/<script\b(?![^>]*\bsrc=)[^>]*>/);
    });

    // Sin `async`, `defer` ni `type="module"`: tiene que frenar el parseo, o el
    // primer pintado ocurre antes de que el tema esté puesto.
    it('carga el script del tema como clásico y bloqueante, antes del bundle', () => {
      const html = leer(ruta);
      const tema = html.indexOf('<script src="/theme-init.js"></script>');
      const bundle = html.indexOf('type="module"');

      expect(tema).toBeGreaterThan(-1);
      expect(bundle).toBeGreaterThan(tema);
    });

    it('arranca con el color claro en el meta', () => {
      expect(leer(ruta)).toContain(`<meta name="theme-color" content="${COLOR_DE_BARRA.light}" />`);
    });
  });
});
