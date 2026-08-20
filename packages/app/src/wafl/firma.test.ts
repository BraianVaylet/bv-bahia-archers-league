import { afterEach, describe, expect, it, vi } from 'vitest';
import { ESCALAS_DE_FIRMA, exportarDentroDelLimite, puntoEnElCanvas } from './SignaturePad.js';

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

// ── REF4-2 · Dónde cae el trazo ──────────────────────────────────────────────

/**
 * **El punto en el que se dibuja tiene que ser el punto en el que se tocó.**
 *
 * El canvas tiene un buffer fijo de 900×600 y CSS lo muestra al ancho que
 * entre. Sin escalar, un píxel CSS se usaba como coordenada del buffer: en un
 * celular de 360 px el trazo aparecía unas 2,7× corrido hacia abajo y a la
 * derecha, y el arquero firmaba en un lugar mirando otro.
 *
 * La cuenta es pura y se prueba sin DOM: jsdom no tiene canvas, y el
 * `getBoundingClientRect` de un elemento sin layout devuelve todo en cero.
 */
describe('puntoEnElCanvas', () => {
  /** El caso real: buffer de 900×600 mostrado en un celular de 360 px. */
  const CELULAR = { left: 0, top: 0, width: 360, height: 240 };
  const BUFFER = { width: 900, height: 600 };

  it('el centro del recuadro cae en el centro del buffer', () => {
    expect(puntoEnElCanvas({ x: 180, y: 120 }, CELULAR, BUFFER)).toEqual({ x: 450, y: 300 });
  });

  it('la esquina de arriba a la izquierda es el origen', () => {
    expect(puntoEnElCanvas({ x: 0, y: 0 }, CELULAR, BUFFER)).toEqual({ x: 0, y: 0 });
  });

  it('la esquina de abajo a la derecha es el extremo del buffer', () => {
    expect(puntoEnElCanvas({ x: 360, y: 240 }, CELULAR, BUFFER)).toEqual({ x: 900, y: 600 });
  });

  /** El recuadro no arranca en el origen de la ventana: hay header arriba. */
  it('descuenta la posición del recuadro en la pantalla', () => {
    const corrido = { left: 20, top: 100, width: 360, height: 240 };
    expect(puntoEnElCanvas({ x: 200, y: 220 }, corrido, BUFFER)).toEqual({ x: 450, y: 300 });
  });

  /**
   * **Cada eje con su propia razón.**
   *
   * Es la mutación más fácil de escribir sin darse cuenta: calcular una escala
   * con el ancho y usarla también para el alto. Acá el recuadro no es
   * proporcional al buffer, así que las dos razones difieren.
   */
  it('usa la escala de cada eje, no una sola', () => {
    const chato = { left: 0, top: 0, width: 900, height: 300 };
    expect(puntoEnElCanvas({ x: 450, y: 150 }, chato, BUFFER)).toEqual({ x: 450, y: 300 });
  });

  it('si el recuadro mide lo mismo que el buffer, el punto no se mueve', () => {
    const igual = { left: 0, top: 0, width: 900, height: 600 };
    expect(puntoEnElCanvas({ x: 123, y: 456 }, igual, BUFFER)).toEqual({ x: 123, y: 456 });
  });

  /**
   * Un recuadro sin tamaño no puede dividir. Pasa en jsdom y en el instante
   * anterior al primer layout; devolver `NaN` dejaría el canvas sin poder
   * dibujar nunca más, porque `moveTo(NaN, NaN)` rompe el trazo entero.
   */
  it('un recuadro sin tamaño no produce NaN', () => {
    const sinTamano = { left: 0, top: 0, width: 0, height: 0 };
    expect(puntoEnElCanvas({ x: 10, y: 10 }, sinTamano, BUFFER)).toEqual({ x: 0, y: 0 });
  });
});
