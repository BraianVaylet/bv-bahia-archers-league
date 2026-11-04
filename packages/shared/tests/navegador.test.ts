import { describe, expect, it } from 'vitest';

/**
 * Zod no sondea `eval` en el navegador (`REF6-3` / `U-1`).
 *
 * Zod 4 compila cada schema de objeto con `new Function` cuando puede, y para
 * saber si puede lo **prueba**: `new Function('')` dentro de un `try`. Con la
 * CSP de producción (`script-src 'self'`, sin `'unsafe-eval'`) el `try` atrapa el
 * error y todo sigue andando, pero el navegador igual lo reporta como violación
 * (`securitypolicyviolation`) en cada carga. Nada se rompe, la consola queda
 * sucia y un reporte de CSP no distingue una violación inofensiva de un ataque.
 *
 * El probe se evalúa al **construir** cada schema, no al parsear, así que la
 * opción `jitless` tiene que estar puesta antes de que cargue `schemas.ts`.
 *
 * **Va en su propio archivo y con imports dinámicos**: Zod calcula el probe una
 * sola vez por proceso. Un `import` estático de `schemas.ts` —aquí o en cualquier
 * otro test del mismo archivo— lo calcularía antes de que el espía esté puesto.
 */
describe('@bal/shared/navegador', () => {
  it('cargado primero, construir los schemas no intenta compilar código', async () => {
    const compilaciones: string[] = [];
    const original = globalThis.Function;

    // Cada `new Function(...)` o `Function(...)` es un intento de compilar código
    // en tiempo de ejecución: justo lo que una CSP sin `'unsafe-eval'` reporta.
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
      await import('../src/navegador.js');
      await import('../src/schemas.js');
    } finally {
      globalThis.Function = original;
    }

    expect(compilaciones).toEqual([]);
  });
});
