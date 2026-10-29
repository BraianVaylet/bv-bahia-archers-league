/**
 * Configuración de `@bal/shared` para el navegador. Se importa **primero** en el
 * `main.tsx` de cada frontend, por su efecto y no por lo que exporta.
 *
 * Zod 4 compila cada schema de objeto con `new Function` cuando puede, y para
 * saberlo lo prueba con `new Function('')` dentro de un `try`. La CSP de
 * producción no permite `eval` (`script-src 'self'`): el `try` atrapa el error y
 * todo sigue andando, pero el navegador igual lo reporta como violación en cada
 * carga. `jitless` evita el probe y deja a Zod en su camino sin compilación.
 *
 * **Tiene que correr antes de que cargue `schemas.ts`**: el probe se evalúa al
 * construir cada schema, no al parsear. De ahí que sea un import de efecto y que
 * tenga que ir antes de todo lo que arrastre `@bal/shared`.
 *
 * **Sólo en el navegador.** El backend corre sin CSP y se beneficia del JIT: valida
 * hasta 200 operaciones por lote de sincronización.
 *
 * Ver `docs/SECURITY.md` §10.
 */

import { z } from 'zod';

z.config({ jitless: true });
