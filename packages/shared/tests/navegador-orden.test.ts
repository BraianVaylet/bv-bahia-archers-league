import { describe, expect, it } from 'vitest';

/**
 * Los schemas no sondean `eval` en el navegador **sin depender del orden de carga**
 * (`REF6-8`, sobre `REF6-3` / `U-1`).
 *
 * `REF6-3` apagó el JIT de Zod con un `import '@bal/shared/navegador'` puesto
 * primero en cada `main.tsx`, y lo dejó escrito: «tiene que correr antes de que
 * cargue `schemas.ts`». Era cierto con un solo chunk. Con `React.lazy` el build
 * parte el código, y el chunk que trae `schemas.ts` es una **dependencia estática**
 * del chunk de entrada, así que se evalúa antes que el cuerpo de éste, donde estaba
 * el import de efecto: la CSP volvió a reportar un `eval` en cada carga y los E2E
 * de `tema-sin-parpadeo` lo vieron.
 *
 * Un orden que depende de cómo el empaquetador reparte los módulos no es un orden.
 * Ahora `schemas.ts` lo trae consigo: quien cargue los schemas en un navegador los
 * carga ya sin JIT, venga de donde venga.
 *
 * Se simula el navegador con un `document`, y **no se importa `navegador.js`**: es
 * justamente lo que ya no hace falta. Va en su propio archivo porque Zod calcula el
 * probe una sola vez por proceso.
 */
describe('schemas en un navegador', () => {
  it('no compilan código aunque nadie haya cargado `navegador` antes', async () => {
    Reflect.set(globalThis, 'document', {});

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
      Reflect.deleteProperty(globalThis, 'document');
    }

    expect(compilaciones).toEqual([]);
  });
});
