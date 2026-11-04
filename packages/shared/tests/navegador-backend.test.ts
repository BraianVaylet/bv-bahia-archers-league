import { describe, expect, it } from 'vitest';

/**
 * El backend conserva el JIT de Zod (`REF6-8`).
 *
 * El JIT importa en el servidor: valida hasta 200 operaciones por lote de
 * sincronización. Sólo hay que apagarlo donde la CSP prohíbe `eval`, que es el
 * navegador; por eso `schemas.ts` lo apaga **si hay un DOM** y no siempre.
 *
 * Es la contracara de `navegador-orden.test.ts`, y existe para que apagarlo
 * incondicionalmente —lo más corto de escribir— no pase desapercibido. Va en su
 * propio archivo porque Zod calcula el probe una sola vez por proceso.
 */
describe('schemas en el backend', () => {
  it('siguen usando el compilado de Zod', async () => {
    const compilaciones: string[] = [];
    const original = globalThis.Function;
    globalThis.Function = new Proxy(original, {
      construct(objetivo, argumentos, nuevoObjetivo) {
        compilaciones.push(argumentos.join(','));
        return Reflect.construct(objetivo, argumentos, nuevoObjetivo);
      },
      apply(objetivo, contexto, argumentos) {
        compilaciones.push(argumentos.join(','));
        return Reflect.apply(objetivo, contexto, argumentos);
      },
    });

    try {
      await import('../src/schemas.js');
    } finally {
      globalThis.Function = original;
    }

    // Zod prueba `new Function('')` para saber si puede compilar: que lo intente
    // es que el JIT está encendido.
    expect(compilaciones.length).toBeGreaterThan(0);
  });
});
