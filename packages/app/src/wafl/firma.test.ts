import { afterEach, describe, expect, it, vi } from 'vitest';
import { ESCALAS_DE_FIRMA, exportarDentroDelLimite } from './SignaturePad.js';

/**
 * Peso del PNG de la firma.
 *
 * **Esto salió de un defecto real.** En `REF-6` el canvas pasó de 600x240 a
 * 900x600 para que firmar con el dedo no saliera tembloroso, y el PNG dejó de
 * entrar en `MAX_SIGNATURE_BYTES`: una firma de varios trazos pesa ~105 KB
 * contra un límite de 60 KB. El servidor la rechazaba con 400 y la op quedaba
 * trabada en el outbox para siempre.
 *
 * Acá se prueba **la decisión** —qué escala se elige—. El peso de verdad, que
 * depende del PNG real, lo mide el E2E. jsdom no tiene canvas.
 */

/**
 * Canvas de mentira cuyo `toDataURL` pesa proporcional al área, que es como se
 * comporta el de verdad con un trazo que ocupa todo el recuadro.
 */
function canvasFalso(width: number, height: number, bytesPorPixel = 0.2) {
  const ctx = {
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };

  return {
    width,
    height,
    getContext: () => ctx,
    toDataURL: () =>
      `data:image/png;base64,${'A'.repeat(Math.round(width * height * bytesPorPixel))}`,
    _ctx: ctx,
  } as unknown as HTMLCanvasElement & { _ctx: typeof ctx };
}

/** `document.createElement('canvas')` devuelve uno falso del mismo tipo. */
function interceptarCreateElement() {
  const creados: ReturnType<typeof canvasFalso>[] = [];

  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') throw new Error(`inesperado: ${tag}`);
    const c = canvasFalso(0, 0);
    // El tamaño lo fija el código bajo prueba; el peso se recalcula al leerlo.
    Object.defineProperty(c, 'toDataURL', {
      value: () => `data:image/png;base64,${'A'.repeat(Math.round(c.width * c.height * 0.2))}`,
    });
    creados.push(c);
    return c;
  }) as typeof document.createElement);

  return creados;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('exportarDentroDelLimite', () => {
  it('no toca la firma que ya entra', () => {
    const crear = vi.spyOn(document, 'createElement');
    const canvas = canvasFalso(900, 600, 0.0001); // ~54 bytes

    const png = exportarDentroDelLimite(canvas, 60_000);

    expect(png.length).toBeLessThanOrEqual(60_000);
    // Ni siquiera se creó el canvas auxiliar: reescalar de más pierde nitidez.
    expect(crear).not.toHaveBeenCalled();
  });

  /**
   * El caso que rompió: 900x600 a 0.2 bytes/px son 108.000, casi exactamente
   * los 104.942 medidos en Chromium con una firma real.
   */
  it('achica la firma que se pasa, hasta que entra', () => {
    const creados = interceptarCreateElement();

    const png = exportarDentroDelLimite(canvasFalso(900, 600), 60_000);

    expect(png.length).toBeLessThanOrEqual(60_000);
    expect(creados.length).toBeGreaterThan(0);
  });

  it('elige la escala MÁS GRANDE que entra, no la más chica', () => {
    const creados = interceptarCreateElement();

    exportarDentroDelLimite(canvasFalso(900, 600), 60_000);

    // 900x600 a 0.6 = 540x360 = 38.880: entra. No tiene que seguir bajando.
    const ultimo = creados.at(-1);
    expect(ultimo?.width).toBe(540);
    expect(creados).toHaveLength(1);
  });

  it('pinta el fondo blanco antes de copiar', () => {
    const creados = interceptarCreateElement();

    exportarDentroDelLimite(canvasFalso(900, 600), 60_000);

    // Con transparencia el PNG pesa más, y el trazo sale gris en el acta impresa.
    const ctx = creados.at(-1)?._ctx;
    expect(ctx?.fillRect).toHaveBeenCalled();
    expect(ctx?.drawImage).toHaveBeenCalled();
  });

  /**
   * **Ni la más chica entra.** Se manda igual: que el servidor la rechace y el
   * líder vea el motivo es mejor que tirar la firma acá en silencio. Con el
   * arreglo del outbox, eso ya no traba el cierre del circuito.
   */
  it('devuelve la más chica antes que perder la firma', () => {
    interceptarCreateElement();

    const png = exportarDentroDelLimite(canvasFalso(900, 600), 100);

    expect(png.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('las escalas van de mayor a menor y arrancan en 1', () => {
    expect(ESCALAS_DE_FIRMA[0]).toBe(1);
    expect([...ESCALAS_DE_FIRMA]).toEqual([...ESCALAS_DE_FIRMA].sort((a, b) => b - a));
  });
});
