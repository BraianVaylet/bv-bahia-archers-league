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
 * **Ya no es lo único que lo garantiza.** El probe se evalúa al construir cada
 * schema, y este import de efecto dependía de evaluarse antes que `schemas.ts`: con
 * `React.lazy` (`REF6-8`) no es cierto, porque el chunk de los schemas es una
 * dependencia estática de la entrada y corre antes que su cuerpo. Ahora `schemas.ts`
 * importa `configuracionZod.ts`, que hace lo mismo cuando hay un DOM, y el orden no
 * depende de cómo se reparta el código. Este módulo queda como declaración explícita
 * en cada `main.tsx` y para quien lo importe sin los schemas.
 *
 * **Sólo en el navegador.** El backend corre sin CSP y se beneficia del JIT: valida
 * hasta 200 operaciones por lote de sincronización.
 *
 * Ver `docs/SECURITY.md` §10.
 */

import { z } from 'zod';

z.config({ jitless: true });
