/**
 * Configuración de Zod que `schemas.ts` trae consigo (`REF6-8`, sobre `REF6-3`).
 *
 * Zod 4 compila cada schema de objeto con `new Function` cuando puede, y para
 * saberlo lo prueba con `new Function('')` dentro de un `try`. La CSP de producción
 * no permite `eval` (`script-src 'self'`): el `try` atrapa el error y todo sigue
 * andando, pero el navegador igual lo reporta como violación en cada carga.
 * `jitless` evita el probe y deja a Zod en su camino sin compilación.
 *
 * **Tiene que estar puesto antes de construir el primer schema**, y por eso lo
 * importa `schemas.ts` y no cada `main.tsx`: un import de efecto en el punto de
 * entrada dependía de que el empaquetador evaluara ese módulo antes que el chunk
 * de los schemas. Con un solo chunk era cierto; con `React.lazy` el chunk de los
 * schemas es una dependencia estática de la entrada y se evalúa antes que su
 * cuerpo. Que un módulo dependa de otro sí es un orden garantizado.
 *
 * **Sólo si hay un DOM** (`document` en `globalThis`: el paquete no trae los tipos del navegador). El backend corre sin CSP y se beneficia del JIT: valida
 * hasta 200 operaciones por lote de sincronización. `navegador-backend.test.ts`
 * vigila que siga encendido.
 *
 * Ver `docs/SECURITY.md` §10.
 */

import { z } from 'zod';

if ('document' in globalThis) {
  z.config({ jitless: true });
}
