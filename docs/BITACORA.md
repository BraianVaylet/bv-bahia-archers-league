# Bitácora — BV Bahía Archers League

Registro de avance. **Se actualiza al terminar cada tarea de [`ACTION_PLAN.md`](ACTION_PLAN.md).**

Qué anotar en cada entrada:
- Qué se hizo, en una o dos líneas.
- **Decisiones tomadas** que no estaban en la documentación, y por qué.
- **Desvíos** respecto de lo planificado, y su justificación.
- **Deuda técnica** que se deja abierta, con el ID de la tarea que la resolvería.

Qué **no** anotar: el detalle de la implementación (para eso está el código), ni el listado de archivos tocados (para eso está el commit).

Formato: entradas nuevas **arriba**.

---

## 2026-08-10 · `BE-6`, `BE-7`, `BE-11`, `BE-12` y `BE-13` — Ciclo completo del torneo

**Autor:** Claude Opus 5 · **Estado:** completado

Con esto **el backend queda terminado**: crear → iniciar → anotar sin señal → sincronizar → firmar → cerrar → publicar → ver en la landing.

`tournamentEditService`, `patrolAdminService`, `publishService`, `standingRepo` y `routes/publico.ts`.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Publicar | **Recalcula la temporada desde cero**, no suma el delta | Hace que publicar sea idempotente y que despublicar sea exacto: no hay forma de que un doble click aplique los puntos dos veces ni de que revertir deje residuos. El costo es recorrer los torneos de la temporada, que son doce por año. |
| Orden del recálculo | Cronológico | `bestNormalizedPct` se queda con el mejor, pero `bestTournamentId` tiene que apuntar al **primero** que lo logró. |
| Transiciones de estado | El `updateOne` filtra **también por el estado actual** | Si otra request lo cambió entre la lectura y la escritura, no se pisa. Es lo que evita que dos clicks simultáneos en "publicar" apliquen los puntos dos veces. |
| Blanco bloqueado | Tiene que seguir existiendo **y ser idéntico** | No alcanza con que exista: cambiarle la modalidad o las flechas invalidaría puntajes ya firmados. |
| PIN tras publicar | Deja de exponerse | Una vez publicado el torneo la credencial no sirve para nada; no hay motivo para seguir mostrándola. |
| Torneo `completado` sin publicar | **No visible** desde la landing | Todavía no es oficial. Sólo se ven `en_proceso` (sin puntajes) y `publicado` (completo). |

**Un bug propio que encontraron los tests**

El desbloqueo de firma guardaba `scorecardHash: ''`. El cierre compara ese hash contra el actual para detectar que el puntaje haya cambiado después de firmarse, así que el desbloqueo **hacía imposible cerrar**: siempre daba `SIGNATURE_MISMATCH`.

Corregido calculando el mismo hash que en una firma real. El desbloqueo autoriza cerrar sin el trazo, pero **no renuncia** a detectar que el puntaje cambie después.

Aprovechando el arreglo, la función que calcula el hash se movió a `scoreRepo`: la usan **dos** caminos —firmar desde WAFL y desbloquear desde WAFA— y dos implementaciones que tienen que dar el mismo resultado son un bug esperando a pasar.

**Un error mío en un test, que resultó ser comportamiento correcto**

El test de publicación esperaba `[5, 4]` y salía `[5, 5]`. Los dos arqueros del escenario tiraban exactamente lo mismo, así que **empatan**, y el puesto compartido reparte los puntos de esa posición a los dos. El código estaba bien; el test estaba mal.

Se corrigió el escenario para que tiren distinto **y** se agregó un test explícito del empate, que es la regla que más fácil se rompe.

**Tests**

163 tests en `@bal/api` (27 nuevos).

Los que más importan: **un torneo sin publicar nunca expone puntajes**, verificado en los tres estados previos (`sin_iniciar` → 404, `en_proceso` → sin `results`, `completado` → 404) · **publicar dos veces no duplica** · **despublicar revierte del todo** · `TARGET_LOCKED` con el índice del blanco en el error · regenerar el PIN invalida la sesión activa.

**Cinco mutaciones probadas, las cinco detectadas:**

| Mutación | Tests que fallan |
|---|---|
| No bloquea blancos con puntajes | 1 |
| Despublicar no excluye el torneo (quedarían residuos) | 1 |
| La landing expone resultados de torneos sin publicar | 1 |
| Regenerar PIN no invalida sesiones | 1 |
| El PIN se muestra aun con el torneo publicado | 1 |

**Backend terminado.** Lo próximo es el frontend: `FE-1` (bootstrap PWA) y sobre todo **`FE-2`** (capa offline con IndexedDB y outbox), que es el equivalente de `BE-10` del lado del cliente.

---

## 2026-08-10 · `BE-8`, `BE-9` y `BE-10` — WAFL: login, bundle y sincronización

**Autor:** Claude Opus 5 · **Estado:** completado

El tramo que habilita la app crítica. `patrolRepo`, `scoreRepo`, `patrolAuthService`, `waflService`, `syncService`, `tournamentStateService` y `routes/wafl.ts`.

### 🔎 Hallazgo: en Mongo, un `E11000` dentro de una transacción la aborta

El diseño original ponía el dedup **dentro** de la transacción: insertar en `syncOps` con `_id = opId` y capturar el error de clave duplicada. **No funciona.** En MongoDB, un error de escritura dentro de una transacción la aborta, y capturarlo en JavaScript no la revive: las operaciones siguientes fallan.

Reestructurado así:

1. **Dedup fuera de la transacción** — un `insert` suelto contra el índice único. Atómico, sin ventana entre comprobar y escribir.
2. **Escrituras dentro de la transacción.**
3. **Si algo falla, se borra la marca** para que el reintento del cliente vuelva a entrar.

**Riesgo residual, asumido y documentado:** si el proceso muere entre la marca y el commit, la op queda marcada sin haberse aplicado y el reintento la ve como duplicada. La ventana es de milisegundos y el costo es un puntaje: el líder lo ve faltante en la pantalla de resultados y lo vuelve a cargar, lo que genera un `opId` nuevo. Está explicado en el encabezado de `procesarOp`.

### Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| Autorización | **Dentro del loop, por op** | Un batch puede traer 200 y cualquiera podría apuntar a un participante ajeno. Verificar sólo al abrir la sesión no alcanza. Es lo que impide el IDOR entre patrullas. |
| Validación de tokens | Contra la modalidad **del blanco, leída del torneo en base** | Nunca contra lo que diga el cliente. Un `11` es válido en 3D e inválido en sala del mismo torneo. |
| LWW | Gana el `clientUpdatedAt` mayor; a igualdad, el `opId` mayor | El desempate por `opId` hace el resultado determinista ante relojes idénticos. |
| Rollups | Delta que **descuenta lo que había** | Editar un blanco no puede sumar dos veces. Hay test. |
| Una transacción **por op** | No una por batch | Una op inválida no puede revertir las que ya se aplicaron correctamente en el mismo batch. |
| Op rechazada | Queda registrada como `rejected` | Un reenvío con el mismo `opId` responde `duplicate`, no se reprocesa. |
| Firmas | Se verifican los **magic bytes** del PNG | El prefijo `data:image/png;base64,` es texto que el cliente elige. Hay test con un `<script>` disfrazado. |
| Credencial de patrulla | Sólo vale con el torneo `en_proceso` | Antes no hay nada que anotar; después los puntajes están cerrados. |

### Tests

136 tests en `@bal/api` (30 nuevos).

Los que más importan:

- **Idempotencia**: el mismo batch enviado dos veces deja **un** puntaje, no dos, y el total del participante no se duplica.
- **IDOR**: una op de un participante de otra patrulla se rechaza; y en un **batch mixto** se aplican las propias y se rechazan las ajenas.
- **LWW**: una op más vieja no pisa a una más nueva, y devuelve el valor vigente.
- **Editar**: cargar dos veces el mismo blanco deja `targetsCompleted: 1`, no 2.
- **El batch nunca falla entero**: un batch con una op válida, una inválida y un `close` rechazado responde 200 y **aplica la válida**.
- **200 ops de golpe** no caen en rate limit.

### Seis mutaciones probadas, las seis detectadas

| Mutación | Tests que fallan |
|---|---|
| Sin dedup (el reenvío duplica) | 2 |
| Sin autorización por op (IDOR entre patrullas) | 2 |
| LWW invertido (lo viejo pisa lo nuevo) | 3 |
| El delta no descuenta lo anterior (editar suma dos veces) | 1 |
| La firma no verifica magic bytes | 1 |
| La credencial de patrulla vale en cualquier estado | 2 |

**Nota:** `BE-6` (estados del torneo) quedó **parcial**: se implementó `tournamentStateService` con la matriz de transiciones y el `start`, porque el login de patrulla lo necesitaba. Falta el bloqueo de edición de blancos con puntajes (`TARGET_LOCKED`).

**Próximo:** `BE-11` (firmas y cierre desde WAFA), `BE-12` (publicar) o arrancar el frontend con `FE-1`/`FE-2`.

---

## 2026-08-10 · `BE-4` y `BE-5` — Padrón, temporadas y creación de torneos

**Autor:** Claude Opus 5 · **Estado:** completado

Van juntas porque `BE-5` no se puede probar sin un padrón: crear un torneo necesita arqueros y una temporada que existan.

`repositories/{archerRepo,seasonRepo,tournamentRepo,auditRepo}.ts`, `services/{archerService,tournamentService}.ts`, `lib/ids.ts` y `routes/admin.ts`.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| `lib/ids.ts` | Un único `toObjectId` que valida con Zod antes de construir | Nunca se construye un `ObjectId` con un valor del request sin validarlo: un objeto en lugar de un string se convierte en un operador de Mongo. |
| Id malformado | Responde **404**, no 400 | Un id malformado y uno inexistente no se distinguen, así no se puede sondear qué existe probando. |
| Búsqueda de arqueros | Se **escapan los metacaracteres** del término antes de armar el `$regex` | El término viene del usuario. Sin escapar, `.*` hace match con todo y un patrón como `(a+)+$` es un ReDoS. Hay test. |
| Hashear los PIN | **Fuera** de la transacción | Hashear seis PIN con argon2id tarda cientos de milisegundos; mantener la transacción abierta ese tiempo sostiene locks sin necesidad. Los documentos se arman antes y la transacción sólo inserta. |
| `buildPatrols` | También fuera de la transacción | Es puro y determinista. Si la transacción se reintenta, no tiene sentido recalcularlo. |
| Arqueros archivados | No se pueden inscribir | Archivar significa "no incluir en torneos futuros". Ver [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.4. |
| `unassigned` en la respuesta | Los arqueros que el armado no pudo ubicar vuelven **con nombre y apellido** | El admin tiene que poder actuar sobre ellos sin ir a buscarlos. |

**La `ClientSession` es el detalle que decide si hay transacción o no**

Las funciones de `tournamentRepo` reciben la sesión de forma explícita. **Si no se la pasa, la escritura queda fuera de la transacción** y el rollback no la alcanza — el driver no avisa. Es el error más fácil de cometer con Mongo, así que está documentado en el encabezado del repositorio y cubierto por la mutación M1.

**Tests**

106 tests en `@bal/api` (23 nuevos).

El de más valor es el de **rollback**: inyecta un fallo en `insertParticipants` y verifica que no quede **ni torneo, ni patrullas, ni participantes**. Sin transacción quedaría un torneo con patrullas y sin participantes, que es exactamente el estado imposible de diagnosticar después.

También cubierto: `maxPossibleScore` = **330** en el caso de referencia del brief · que el snapshot congela el nombre y la categoría (editar el arquero después no toca el histórico) · que el PIN descifrado coincide con el que verifica el hash · que el PIN no aparece en claro en ningún campo del documento · que con todos los participantes de escuela no se arma ninguna patrulla y los cuatro vuelven en `unassigned` · que el audit log no contiene nada sensible.

**Cuatro mutaciones probadas, las cuatro detectadas:**

| Mutación | Tests que fallan |
|---|---|
| Sin transacción (las escrituras no se revierten) | 1 |
| El PIN se guarda en claro | 3 |
| No se chequea si el arquero participó | 1 |
| Se permite inscribir arqueros archivados | 1 |

**Próximo:** `BE-6` (estados del torneo) y `BE-7` (patrullas y credenciales), o directo a `BE-8`/`BE-9`/`BE-10` para habilitar la WAFL.

---

## 2026-08-10 · `BE-3` — Autenticación de admin

**Autor:** Claude Opus 5 · **Estado:** completado

`repositories/{userRepo,sessionRepo}.ts`, `lib/session.ts`, `middleware/auth.ts`, `services/authService.ts` y `routes/auth.ts`.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Login timing-safe | Si el usuario no existe, se compara igual contra un hash de referencia | Sin eso, un login contra una cuenta inexistente responde en microsegundos y uno contra una real tarda lo que tarda argon2id. Esa diferencia permite **enumerar cuentas midiendo el tiempo**. |
| Mensaje de error | El **mismo** para usuario inexistente y para password incorrecto | Hay un test que compara los dos cuerpos de respuesta byte a byte. |
| Bloqueo por intentos | 5 fallidos → 15 minutos, y el 6º falla **aun con el password correcto** | Si el bloqueo se levantara al acertar, no serviría de nada contra fuerza bruta. |
| Contador de intentos | Se incrementa con `findOneAndUpdate` atómico | Dos intentos simultáneos no pueden pisarse el contador. |
| `mustChangePassword` | Bloquea con **403** toda ruta protegida salvo el propio cambio de password | El password con el que se hizo el deploy no puede quedar como password permanente. El 403 lleva `details.mustChangePassword` para que el frontend sepa a dónde redirigir. |
| Cambiar el password | Invalida **todas** las sesiones y abre una nueva para quien lo cambió | Si el motivo del cambio es que el password se filtró, dejar vivas las sesiones abiertas no arregla nada. Quien cambió acaba de demostrar que conoce el password, así que su sesión se renueva. |
| Logout | Borra la sesión **en la base**, no sólo la cookie | Si el token se filtró, borrar la cookie del navegador no sirve. |
| Filtro por `expiresAt` al leer la sesión | Explícito, además del índice TTL | Mongo barre los vencidos cada ~60 segundos: entre el vencimiento y el barrido la sesión todavía existe en la colección. Hay test. |

**Tests**

83 tests en `@bal/api` (27 nuevos).

El que más valor tiene es el de **timing**: no verifica por inspección que exista el hash de referencia, sino que **mide** el tiempo de un login contra un usuario existente y contra uno inexistente y exige que sean del mismo orden. Descarta la primera medición, que incluye el cálculo del hash de referencia.

También cubierto: que en la base se guarda `sha256(token)` y nunca el token, que la cookie es `HttpOnly` y `SameSite=Lax`, que una cookie inventada no autentica, y que una sesión vencida no autentica aunque siga en la colección.

**Seis mutaciones probadas, las seis detectadas:**

| Mutación | Tests que fallan |
|---|---|
| Sin hash de referencia (enumeración por tiempo) | 1 |
| Logout no invalida en la base | 1 |
| Se guarda el token en claro en vez del `sha256` | 12 |
| No se filtra por `expiresAt` al leer la sesión | 1 |
| `mustChangePassword` no bloquea | 2 |
| Cambiar el password no invalida las otras sesiones | 2 |

**Nota de proceso:** una de las mutaciones tocó un archivo **nuevo, todavía no trackeado por git**, así que `git checkout` no la revirtió y quedó aplicada. Se detectó al verificar. De acá en adelante, en las pruebas de mutación conviene revertir desde una copia propia, no confiar en git para archivos sin commitear.

**Próximo:** `BE-5` — crear torneo, transaccional. Ya tiene todas sus dependencias listas.

---

## 2026-08-10 · `SH-7` — Schemas Zod compartidos

**Autor:** Claude Opus 5 · **Estado:** completado

`schemas.ts` con los contratos de entrada de auth, padrón, temporadas, torneo, patrullas y sincronización. Todos `z.strictObject`. Con esto el dominio queda cerrado salvo `SH-6` (estadísticas).

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Tokens de flecha | **No** se validan contra una lista fija; sólo se acota la forma (1-2 caracteres) | El set válido depende de la modalidad **de ese blanco**, que el servidor lee del torneo en base. Validarlos acá obligaría a aceptar la unión de las cuatro modalidades, que es más laxo que lo correcto. Ver [`DOMAIN_WA.md`](DOMAIN_WA.md) §7. |
| Tope en el password | 128 caracteres | argon2id sobre un input enorme cuesta caro: sin tope es un vector de DoS barato. |
| Mínimo de arqueros al crear torneo | 2 | Con menos no se puede armar ni una patrulla (`H1`). |
| Índices de blancos | Se exige que sean **contiguos desde 1**, sin huecos ni repetidos | `scores` referencia el blanco por su índice; un hueco rompería la correspondencia. |
| `PatrolDistributionSchema` | Valida la **forma**, no las restricciones `H1`..`H4` | Esas las verifica `validatePatrols`, que informa sin bloquear porque el admin puede tener motivos para una excepción. Ver [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.6. |
| `stakeMap` y `distances` | Escritos explícitos, no generados desde `STAKES` | Las tres estacas son semántica fija del dominio; el schema se lee de un vistazo. Además, generarlos con `Object.fromEntries` y un cast fue justamente lo que rompió (ver abajo). |

**Bug propio, y la lección de proceso**

Al escribir `schemas.ts` importé `MIN_PATROL_SIZE` y `MAX_PATROL_SIZE` desde `constants.ts`, pero vivían en `patrolling.ts`. En runtime llegaban como `undefined`, así que `z.array(...).min(undefined)` producía un issue con `minimum` indefinido y **Zod explotaba al formatear el mensaje de error**: `TypeError: Cannot read properties of undefined (reading 'toString')`. Un error críptico, a tres capas de distancia de la causa.

`tsc` lo habría marcado de inmediato. El problema fue de proceso: corrí los tests antes que el typecheck. **De acá en adelante, typecheck antes de tests** cuando se agregan imports nuevos.

Aprovechando el arreglo, `MIN_PATROL_SIZE` y `MAX_PATROL_SIZE` se movieron a `constants.ts`, que es donde viven el resto de las constantes de dominio. `patrolling.ts` las importa de ahí.

**Tests**

272 tests en el paquete (68 nuevos). **Cobertura 100%** en las cuatro métricas.

El bloque que más importa es el de **inyección NoSQL**: los cuatro schemas que reciben identificadores o nombres rechazan `{ $ne: null }`, y un `$where` no puede colarse como propiedad extra. Sin eso, un operador de Mongo llegaría a un filtro y devolvería el primer documento que encuentre.

También se cubrió: `SyncBatchSchema` acepta 200 ops de golpe —una patrulla que vuelve de tres horas sin señal manda cientos— y rechaza `opId` repetidos dentro del mismo batch.

**Verificación adicional del DoD:** se comprobó que los tres paquetes (`@bal/api`, `@bal/app`, `@bal/landing`) importan los schemas **desde el build**, no desde el fuente, ejecutando un script en cada uno.

**Próximo:** `BE-3` — autenticación de admin.

---

## 2026-08-10 · `SH-4` y `SH-5` — Ranking de torneo y liga

**Autor:** Claude Opus 5 · **Estado:** completado

`ranking.ts`, `league.ts` y `text.ts`. TDD. Van juntas porque `BE-12` (publicar) necesita las dos, y la liga se apoya en el ranking por categoría.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| `text.ts` extraído | Comparación determinista sin `localeCompare`, compartida | `patrolling.ts` ya la tenía, y `ranking.ts` y `league.ts` la necesitaban igual. Tres copias de la misma regla es una de más. |
| Puesto compartido | Una función `asignarPosiciones` que usan ranking y liga | La regla es idéntica en los dos, y es sutil: quien empata hereda la posición del anterior, y el siguiente salta. Tenerla en un solo lugar evita que se implemente distinto en cada uno. |
| Detección de empate | Comparando con los **vecinos**, no contando por posición | La lista está ordenada, así que los que comparten puesto son contiguos. Elimina un `Map` y dos ramas muertas que `noUncheckedIndexedAccess` obligaba a escribir. |
| Participantes `ausente` | Quedan afuera del podio | No puntúan ni entran al ranking. Ver [`FUNCTIONAL.md`](FUNCTIONAL.md) §10. |
| Clave del acumulado | `archerId + categoría`, no sólo `archerId` | Un arquero podría cambiar de categoría entre temporadas, y cada categoría tiene su propio ranking. |
| `notYetEligible` | A los que les faltan torneos se los devuelve **aparte**, no se los descarta | Ocultarlos haría creer que se perdió su resultado. Ver [`FUNCTIONAL.md`](FUNCTIONAL.md) §5.2. |
| `normalizedPct` | Redondeado a dos decimales | Sin redondear, dos porcentajes que deberían empatar difieren por error de punto flotante y el desempate se decide por ruido. |

**Lo que más importa que esté bien**

El **puesto compartido** atraviesa las dos tareas y es la regla que más fácil se implementa mal:

- En el torneo: dos segundos, y el siguiente es **cuarto** — no tercero.
- En la liga: los dos empatados en el primer puesto se llevan **5 puntos cada uno**, y el siguiente queda tercero con **3** — no con 4.

Ambos casos tienen test explícito.

El **mejor puntaje de la temporada se compara por porcentaje, no por bruto**. Hay un test que lo fija con un caso donde el orden se invierte: 200/250 (80%) supera a 240/400 (60%) aunque el bruto sea menor. Es exactamente el escenario que motivó la decisión D7.

**Tests**

204 tests en el paquete (52 nuevos). **Cobertura 100%** en líneas, ramas, funciones y sentencias.

Cinco mutaciones probadas, **las cinco detectadas**:

| Mutación | Tests que fallan |
|---|---|
| Desempate por menos `M` invertido | 2 |
| El puesto compartido no hereda posición (1,2,3,4 en vez de 1,2,2,4) | 16 |
| Mínimo de torneos bajado a 1 | 4 |
| El mejor puntaje se pisa siempre | 1 |
| `normalizedPct` sin redondeo | 1 |

**Próximo:** `BE-5` — crear torneo, transaccional.

---

## 2026-08-10 · `BE-2` — Base de Hono y middlewares de seguridad

**Autor:** Claude Opus 5 · **Estado:** completado

`app.ts`, `index.ts`, `lib/{errors,csrf}.ts`, `middleware/{error,security,csrf,rateLimit,validate,cache}.ts` y `routes/health.ts`.

### Hallazgo: en Hono los errores no se propagan hacia arriba

Se implementó el manejo de errores como middleware con `try { await next() } catch`. **No funciona.** Hono captura los errores del handler dentro de su `compose` y los convierte en respuesta sin propagarlos, así que el `catch` del middleware nunca los ve: todos los errores tipados salían como 500 genérico.

Se detectó porque 15 tests fallaron con `500` donde esperaban `403`, `409` o `400`. Se diagnosticó con un test aislado que confirmó que la variable capturada quedaba en `undefined`.

La forma correcta es `app.onError(handleError)`. Corregido y documentado en el encabezado de `app.ts` y de `middleware/error.ts`, para que no se vuelva a intentar.

### Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| Healthcheck sin rate limit | `/api/health` queda fuera del limitador | Railway lo consulta seguido. Bloquearlo daría de baja el servicio por su propio monitoreo. Hay un test que hace 200 llamadas seguidas y exige 200 en todas. |
| Rate limit de sync | Generoso a propósito (300/min por sesión) | Una patrulla que vuelve de tres horas sin señal manda cientos de operaciones de golpe y **nunca** debe ser rechazada. Ese endpoint está protegido por autenticación y autorización, no por el rate limit. Ver [`SECURITY.md`](SECURITY.md) §3.3. |
| Rate limit en memoria | Estado en el proceso, no en la base | Alcanza para el despliegue de un solo contenedor de [`ARCHITECTURE.md`](ARCHITECTURE.md) §3. **Queda anotado en el código**: si alguna vez se escala a varias instancias, hay que moverlo a Mongo o a Redis. |
| Cookie CSRF legible por JS | `httpOnly: false` a propósito | El frontend tiene que poder copiarla al header. Lo que protege no es el secreto de la cookie sino que un sitio de terceros no puede leerla. |
| Comparación de tokens CSRF | `timingSafeEqual`, con la diferencia de longitud resuelta antes | `timingSafeEqual` exige buffers del mismo tamaño. |
| `NOT_FOUND` para recursos ajenos | Un recurso que existe pero no es tuyo responde 404, no 403 | No se puede enumerar qué existe probando ids. Ver [`SECURITY.md`](SECURITY.md) §4. |
| Errores en producción | Sin stack, sin mensaje original; se loguea con `requestId` correlacionable | Un stack trace en una respuesta le regala al atacante el mapa del sistema. |

### Tests

56 tests en `@bal/api` (27 nuevos). Cubren la parte de esta capa del checklist de [`SECURITY.md`](SECURITY.md) §13:

- Mutación **sin** `x-csrf-token` → 403, en los cuatro verbos.
- Mutación con header que no coincide → 403.
- Todas las cabeceras de seguridad presentes, **también en las respuestas de error**.
- La CSP no permite `unsafe-inline` ni `unsafe-eval` en `script-src`, y sí permite `data:` y `blob:` en `img-src`, que hacen falta para las firmas.
- Sin HSTS fuera de producción.
- Un error inesperado devuelve 500 **sin stack** y con `requestId`.
- Rate limit corta con `Retry-After` y cuenta por IP.
- Zod `.strict()` rechaza propiedades extra **y** `{ $ne: null }` donde se espera un string.
- Body declarado más grande que 1 MB → 413.

**Total del repo: 208 tests verdes.**

**Próximo:** `BE-3` — autenticación de admin.

---

## 2026-08-10 · `BE-1` — Conexión, índices, seed y reconcile

**Autor:** Claude Opus 5 · **Estado:** completado

Base de datos del backend: `env.ts`, `db/{client,types,indexes,seed,reset,reconcile,cli}.ts` y `lib/crypto.ts`.

### 🐛 Bug latente encontrado y corregido

**El build de `@bal/shared` era incargable por Node.**

`tsc` con `moduleResolution: Bundler` emite los imports relativos **sin extensión**, y Node bajo ESM los rechaza. `import('@bal/shared')` fallaba con `ERR_MODULE_NOT_FOUND`. No se había notado porque hasta ahora nada importaba el dominio desde Node: los tests de `shared` corren sobre el código fuente con Vitest, y el scaffold del backend no lo usaba.

Habría explotado en `BE-5`, la primera vez que un servicio importara el dominio — o peor, recién en producción.

Corregido agregando `.js` explícito a los imports relativos de `shared/src`. Verificado con `node -e "import('@bal/shared')"` → 31 exports.

**Decisión relacionada:** el `tsconfig.json` de `@bal/api` anula el alias `paths` de `tsconfig.base.json` con `"paths": {}`. El backend tiene que resolver `@bal/shared` **como lo va a resolver Node en producción**: por los `exports` del paquete hacia `dist`. Apuntar al código fuente ocultaría exactamente esta clase de error de empaquetado. Como contrapartida, `pnpm typecheck` ahora construye `shared` primero.

### Otras decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| `env.ts` | Reúne **todos** los problemas de configuración y los reporta juntos | Quien está configurando un deploy no debería descubrirlos de a uno. |
| Producción | Rechaza explícitamente los valores de desarrollo del `.env.example` (`CBA2026`, el secreto de ejemplo, la clave en ceros), exige `ADMIN_INITIAL_PASSWORD` de 12+ y que `SESSION_SECRET` y `PIN_ENC_KEY` sean distintas | Un servidor de producción que levanta con un secreto de desarrollo es peor que uno que no levanta. |
| `db:reset` | Falla en producción y **no tiene flag para forzarlo** | Si alguna vez hay que vaciar producción, se hace a mano y con backup, no con un comando que se puede tipear por accidente. |
| `seed` | Idempotente, y **nunca pisa** un password ya cambiado | El seed corre en cada arranque del deploy. Pisar el password devolvería la cuenta al valor del `.env`. |
| Argon2 | `@node-rs/argon2`, no `argon2` | Binarios precompilados: `argon2` necesita toolchain de C y falla en Windows y en imágenes slim. |
| Zod 4 | Se adoptó (la doc asumía 3.x) | Verificado antes de apoyarse en él: `.strict()` y `z.strictObject()` rechazan tanto propiedades extra como `{ $ne: null }`. Actualizado [`TECHNICAL.md`](TECHNICAL.md) §1. |
| `syncOps._id` | Es el `opId` del cliente | Deduplicar pasa a ser un `insert` que falla con `E11000`, sin `findOne` previo. Verificado con test. |

### Tests

29 tests contra **MongoDB real en modo replica set** (`mongodb-memory-server`). Sin replica set no hay transacciones, y sin transacciones no se puede probar lo que más importa.

Cubierto: que las transacciones efectivamente funcionan · los 26 índices de `TECHNICAL.md` §2 · idempotencia de `ensureIndexes` · que los índices únicos de patrullas y de `scores` realmente rechazan duplicados (es lo que sostiene la idempotencia de la sincronización) · que el password del admin se guarda hasheado con argon2id y nunca en claro · que `seed` no pisa un password cambiado · que `reset` falla en producción · que `reconcile` recomputa los rollups desde los puntajes crudos.

Sin Docker en el entorno, así que no se pudo probar contra un Atlas real ni correr el CLI `db:indexes` contra una base viva. `mongodb-memory-server` descarga su propio `mongod` 8.2.6 y cubre el caso.

**Deuda saldada:** `--passWithNoTests` sacado de `@bal/api`.

**Próximo:** `BE-2` — base de Hono y middlewares de seguridad.

---

## 2026-08-10 · `SH-3` — Armado de patrullas

**Autor:** Claude Opus 5 · **Estado:** completado

`patrolling.ts` con `buildPatrols` y `validatePatrols`. La tarea más delicada del dominio. TDD.

**Dos reglas que la documentación no explicitaba, y que aparecieron al implementar**

El documento describía el procedimiento a grandes rasgos; escribirlo reveló dos condiciones que, si se ignoran, dejan arqueros sin patrulla. Ambas se agregaron a [`DOMAIN_WA.md`](DOMAIN_WA.md) §5.

1. **Escuela toma primero las unidades senior solitarias.** Una unidad de 1 arquero no puede formar patrulla sola (violaría `H1`); una de 2 sí. Si las unidades de escuela se llevan las senior de a dos, las senior solitarias quedan sin compañero posible. Caso concreto: 2 escuela + 3 razo. Tomando la de a dos quedan 4 arqueros en una patrulla y el razo solitario huérfano; tomando la solitaria salen 3 + 2 y no sobra nadie.

2. **Una unidad solitaria sólo puede llevarse una de a dos si la paridad del resto cierra.** Con `S` solitarias y `P` de a dos, como máximo `min(P, S)` se llevan una, menos uno si `(S - x)` queda impar — porque las solitarias que no se llevan una de a dos tienen que poder emparejarse **entre sí**. Caso concreto: 3 solitarias y 2 pares. Si las tres se llevan un par, falta uno y queda una huérfana. La cuenta da 1: una se lleva un par, las otras dos se emparejan entre sí, y el par restante forma su propia patrulla. Total 3 + 2 + 2, nadie afuera.

**Otras decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Arqueros no ubicables | Van a `unassigned` con warning `ESCUELA_SIN_SENIOR`, **no** se arma la patrulla que violaría `H3` | El documento decía "no se arma una patrulla 100% escuela" pero no decía dónde quedaban esos arqueros. Dejarlos afuera del plan los perdería en silencio. Explícitos, el admin los ubica a mano. |
| Orden determinista | Comparación por `(orden de categoría, apellido, nombre, id)` con normalización NFD propia, **sin `localeCompare`** | `localeCompare` puede variar entre entornos. El armado tiene que ser reproducible en cualquier máquina. |
| `validatePatrols` | Informa, no bloquea. Devuelve la lista de violaciones con el número de patrulla | El admin conoce el terreno y puede tener motivos para una excepción; la decisión queda en el audit log. Ver [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.6. |
| `A` tira primero | Es la unidad de la categoría con menor orden de catálogo | En una patrulla con escuela eso deja siempre al senior tirando primero, que es lo natural. |
| Helper `sacar` | Un único punto con aserción no nula, comentado | `noUncheckedIndexedAccess` obliga a guardas de `undefined` que nunca se ejecutan. Son ramas muertas que ensucian el código y la cobertura. Se concentran en un helper en vez de repartirlas. |

**Tests**

152 tests en el paquete (45 nuevos). **Cobertura 100%** en líneas, ramas y funciones.

Los 12 casos normativos del reglamento del club están traducidos literalmente: 5 patrullas correctas y 7 incorrectas, más los derivados de `H3` (patrulla de 2 y de 3, todas escuela) y de `H1` (patrullas de 1 y de 5).

Determinismo probado con el input barajado y con dos corridas seguidas. Se cubrió el desempate por nombre y por id, que hacen falta con hermanos u homónimos — [`FUNCTIONAL.md`](FUNCTIONAL.md) §10 lo lista como caso borde.

**Mutaciones probadas**

| Mutación | Resultado |
|---|---|
| Sin ajuste de paridad en el cupo de pares | 1 test falla ✔ |
| `validatePatrols` no chequea `H3` | 4 tests fallan ✔ |
| `MAX_PATROL_SIZE` de 4 a 6 | 1 test falla ✔ |
| Escuela toma las unidades senior grandes primero | **Sobrevivió** — era un hueco real. Se agregó el test de 2 escuela + 3 razo y ahora la detecta. |
| `mejorCompañero` ignora la categoría | **Sobrevivió, y es un mutante equivalente.** El pool está ordenado por categoría, así que las unidades de la misma categoría quedan adyacentes y la preferencia por estaca elige exactamente la misma. No se escribió un test artificial: la preferencia por categoría se mantiene porque documenta la intención (`S1`) y porque el invariante de orden podría cambiar. Queda anotado acá para que nadie la borre creyendo que no hace nada. |

**Próximo:** `SH-4` — ranking de torneo.

---

## 2026-08-10 · `SH-2` — Scoring

**Autor:** Claude Opus 5 · **Estado:** completado

`scoring.ts` con `tokenValue`, `isValidToken`, `validateTargetScore`, `maxTargetScore`, `maxPossibleScore` y `sortArrowsDescending`. TDD.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Guarda de prototipo | `lookupValue` usa **`Object.hasOwn`**, no acceso directo al objeto de valores | Los `values` son literales y heredan de `Object.prototype`. Con acceso directo, un token `"toString"` o `"constructor"` devuelve una función, no `undefined`, y **pasa por válido**. Es un agujero real: el token viene del cliente. Hay un test explícito. |
| Qué cuenta como "10" | `tenCount` cuenta las flechas **que valen 10**, así que la `X` entra | El reglamento del club no lo definía. Se siguió la convención de World Archery, donde los 10 incluyen las X. Documentado en [`DOMAIN_WA.md`](DOMAIN_WA.md) §8 para que sea una decisión declarada y no un accidente. |
| Firma de las funciones | Todas reciben la modalidad de forma explícita | Refuerza en el tipo que la modalidad es **del blanco**, no del torneo. Es el error más fácil de cometer en este dominio. |
| `sortArrowsDescending` | Manda los tokens desconocidos al final en vez de fallar | Ordenar no es validar. La validación tiene su propia función y sus propios errores tipados. |
| Bucle de validación | `arrows.entries()` en vez de índice numérico | Con `noUncheckedIndexedAccess`, `arrows[i]` obliga a un `?? ''` que nunca se ejecuta y queda como rama muerta. Se eliminó la rama en vez de escribir un test artificial para cubrirla. |

**Tests**

107 tests en el paquete (56 de `SH-1` + 51 nuevos). **Cobertura 100%** en líneas, ramas y funciones.

Cubierto: los 9 cruces de token entre modalidades (`11` en sala, `X` en 3D, `7` en campo, `X6` en sala, etc.), la precedencia de `ARROW_COUNT` sobre `INVALID_TOKEN`, el índice exacto del primer token inválido, la irrelevancia del orden de entrada, y `maxPossibleScore` contra el caso de referencia del brief (**330**).

Mutaciones verificadas, las tres detectadas:
- `tenCount` contando el token equivocado → 2 tests fallan.
- `lookupValue` sin guarda de prototipo → 2 tests fallan.
- `sortArrowsDescending` ignorando el inner → 1 test falla.

**Próximo:** `SH-3` — armado de patrullas. Es la tarea más delicada del dominio.

---

## 2026-08-10 · `SH-1` — Catálogos de dominio

**Autor:** Claude Opus 5 · **Estado:** completado

Primer módulo de `@bal/shared`, con TDD. `domain.ts` (tipos, tokens, catálogos, `DomainError`) y `constants.ts` (`SCORING`, `CATEGORY_INFO`, `DEFAULT_STAKE_MAP`, `stakeForCategory`, constantes de liga).

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Tablas de `SCORING` | Escritas **explícitas**, no generadas desde el set de tokens | Este archivo se audita contra el reglamento. Una tabla que se lee línea por línea vale más que código ingenioso; el costo de repetir el `values` de sala y aire libre es cero porque comparten constante. |
| `CATEGORY_INFO.senior` | Bandera booleana por categoría, `false` solo en `escuela` | Es lo que va a sostener la restricción `H3` en `SH-3` sin que el algoritmo tenga que conocer el string `'escuela'`. |
| `stakeForCategory` | Recibe un `stakeMap` opcional, con el default como fallback | El mapeo es editable por torneo ([`DOMAIN_WA.md`](DOMAIN_WA.md) §4). Lanza `DomainError('STAKE_MAP_INCOMPLETE')` si el mapeo no cubre la categoría: es un error de configuración y tiene que ser ruidoso. |
| Tokens | `MISS_TOKEN`, `X_TOKEN`, `X6_TOKEN`, `ELEVEN_TOKEN` como constantes exportadas | Evita literales sueltos repartidos por el código de scoring. |

**Tests**

56 tests. **Cobertura 100%** en líneas, ramas, funciones y sentencias — por encima del umbral de 95% de [`TESTING.md`](TESTING.md) §8.

Sobre el rigor del ciclo rojo-verde: el primer rojo fue un fallo de importación (`SCORING` no existía), que hace fallar la recolección **sin ejercitar ninguna aserción individual**. Un rojo así no prueba que los tests sirvan. Se verificó con dos mutaciones sobre el código ya implementado:

- `defaultArrows` del 3D de `2` a `3` → 1 test falla.
- Sacar `cazador` del `DEFAULT_STAKE_MAP` → 3 tests fallan.

Ambas detectadas. Los tests no son vacuos.

**Deuda saldada:** `--passWithNoTests` sacado de `@bal/shared`.

**Próximo:** `SH-2` — scoring, también con TDD.

---

## 2026-08-10 · `INF-2` — Scaffolds de los paquetes

**Autor:** Claude Opus 5 · **Estado:** completado

Los cuatro paquetes existen, compilan y corren: `@bal/shared`, `@bal/api`, `@bal/app`, `@bal/landing`.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Resolución de módulos en `@bal/api` | `module`/`moduleResolution` en **`NodeNext`**, no `Bundler` | El backend se ejecuta con `node dist/index.js`, sin bundler. Con `Bundler` TypeScript acepta imports sin extensión y el build resultante explota en runtime bajo ESM. Consecuencia: **los imports relativos del backend llevan `.js` explícito.** |
| Resolución de `@bal/shared` en desarrollo | Vía `paths` de `tsconfig.base.json`, apuntando a `src` | Permite `typecheck` sin haber construido `shared` antes. En runtime y en los builds resuelve por `exports` a `dist`, así que `pnpm build` y `pnpm dev` construyen `shared` primero. |
| `base` de Vite | `'/app/'` en la PWA, `'/'` en la landing | Acota el service worker al scope `/app` desde el arranque, como define [`ARCHITECTURE.md`](ARCHITECTURE.md) §3. Fijarlo ahora evita una migración de rutas después. |
| React 19 | Se usa 19.2.8 | Es la versión actual. La documentación decía React 18 de forma estimada; se corrigió [`TECHNICAL.md`](TECHNICAL.md) §1. |
| `--passWithNoTests` | Agregado temporalmente a los cuatro `test` | Todavía no hay tests. **Es deuda**: se saca de cada paquete apenas tenga tests reales. |

**Deuda**

| Tema | Detalle | Resuelve |
|---|---|---|
| `--passWithNoTests` en `@bal/shared` | Sacar al escribir los primeros tests | `SH-1` / `SH-2` |
| `--passWithNoTests` en `@bal/api` | Ídem | `BE-1` |
| `--passWithNoTests` en `@bal/app` y `@bal/landing` | Ídem | `FE-3` / `FE-17` |
| Placeholders | `src/index.ts` de `api`, y `App.tsx` de `app` y `landing`, son scaffolds sin contenido real | `BE-2`, `FE-1`, `FE-17` |

**Verificación**

`pnpm typecheck` 4/4 · `pnpm build` completo (shared por `tsc`, api por `tsc`, app y landing por Vite) · `pnpm start` arranca el binario del backend · `pnpm test` verde · `pnpm lint` limpio sobre 25 archivos.

Bundle inicial de ambos frontends: **190 KB crudo / 60 KB gz**, que es el baseline de React. Los presupuestos de [`TECHNICAL.md`](TECHNICAL.md) §5 son 150 KB gz para WAFL y 120 KB gz para la landing, así que hay margen — pero conviene medirlo en cada tarea de frontend, no al final.

Corrección sobre la marcha: `@types/node` faltaba en `app` y `landing`; sus `vite.config.ts` usan `process.env` para el target del proxy.

**Próximo:** `SH-1` — catálogos de dominio.

---

## 2026-08-10 · `INF-1` — Monorepo

**Autor:** Claude Opus 5 · **Estado:** completado

Monorepo pnpm inicializado: `package.json` raíz con los scripts de [`TECHNICAL.md`](TECHNICAL.md) §8, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `.gitignore` y `.env.example`.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| TypeScript | **5.9.3**, no 7.0.2 | TS 7 (reescritura nativa) ya está publicado como `latest`, pero la compatibilidad de Vite, Vitest y Biome con él no está verificada. No es el momento de descubrirlo en la fundación del proyecto. |
| Biome | **2.5.7** con config v2, no la 1.9.4 del repo de referencia | Arrancar un proyecto nuevo dos majors atrás es deuda desde el día uno. La v2 cambia el formato: `files.ignore` → `files.includes` con negaciones, `organizeImports` → `assist.actions.source`, `linter.rules.recommended` → `preset`. Migrado con `biome migrate --write` y verificado. |
| `tsconfig.base.json` | Se agregaron `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes` e `isolatedModules` sobre la base del repo de referencia | Más estrictez cuesta poco al principio y mucho después. |
| Biome — reglas | `noExplicitAny: error` (apagada en tests), `noConsole: warn` permitiendo `error/warn/info`, `noExcessiveCognitiveComplexity: 20` | Alinea el linter con las convenciones de [`CLAUDE.md`](../CLAUDE.md). |

**Desvíos**

Se actualizaron las versiones de [`TECHNICAL.md`](TECHNICAL.md) §1 a las reales instaladas: **Vite 8** (estaba 6), **Vitest 4**, **Biome 2.5.7** (estaba 1.9+), **TS 5.9.3** (estaba "5.6+"), **pnpm 9.15.0**. La documentación se había escrito con versiones estimadas.

Los briefs originales se movieron a `pre/` (commit del usuario `1c7ee9a`). Se corrigieron las referencias en [`../CLAUDE.md`](../CLAUDE.md) y [`README.md`](README.md), que apuntaban a la raíz.

**Deuda**

| Tema | Detalle | Resuelve |
|---|---|---|
| TypeScript 7 | Migrar cuando el toolchain lo soporte de forma verificada. Gana velocidad de compilación de forma significativa | Tarea `P2` a crear |
| pnpm 11 | Hay 11.21.0 disponible; se fijó 9.15.0 para igualar el entorno del autor y el repo de referencia | Cuando se actualice el entorno |

**Verificación**

`pnpm install` sin errores · `pnpm lint` exit 0 · `pnpm typecheck` y `pnpm test` no-op (sin paquetes todavía, corresponde a `INF-2`) · las 22 variables de [`CONFIG.md`](CONFIG.md) §2 cotejadas una a una contra `.env.example` · `.env.example` verificado como trackeable pese al patrón `.env.*` del `.gitignore`.

**Próximo:** `INF-2` — scaffolds de los cuatro paquetes.

---

## 2026-08-10 · Documentación inicial

**Autor:** Claude Opus 5 · **Estado:** completado

Se generó el paquete completo de documentación funcional, técnica y de arquitectura a partir de los briefs `0.prompt`, `1.context.md`, `2.development.md` y `3.stack.md`.

**Documentos creados**

| Documento | Contenido |
|---|---|
| [`FUNCTIONAL.md`](FUNCTIONAL.md) | Actores, glosario, las 3 apps, 9 user stories con criterios de aceptación, máquina de estados, 11 casos borde |
| [`DOMAIN_WA.md`](DOMAIN_WA.md) | Reglamento aplicado, modalidades, estacas, algoritmo de patrullas (`H1..H4`/`S1..S3`), rankings, trazabilidad al brief |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Topología, monorepo, modelo de datos, 5 flujos críticos, reutilización, 9 alternativas descartadas |
| [`TECHNICAL.md`](TECHNICAL.md) | Stack, 11 colecciones con índices, contrato de API completo, schemas Zod, presupuestos de performance |
| [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) | IndexedDB, outbox, contrato de `/sync`, idempotencia, LWW, service worker, 17 escenarios de falla, antipatrones |
| [`SECURITY.md`](SECURITY.md) | Modelo de amenazas, controles por área, tradeoff del PIN cifrado, checklist de 38 ítems |
| [`CONFIG.md`](CONFIG.md) | Variables de entorno, setup local, Atlas, Railway paso a paso, Docker, CI, backups |
| [`TESTING.md`](TESTING.md) | Estrategia TDD, pirámide, casos obligatorios por módulo, umbrales de cobertura |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Dirección visual, paleta, tipografía, componentes, objetivos táctiles, accesibilidad |
| [`ACTION_PLAN.md`](ACTION_PLAN.md) | 57 tareas priorizadas con objetivo, archivos, DoD y tests exigidos |
| `README.md` · `CLAUDE.md` (raíz) | Presentación del proyecto y contexto permanente para modelos de IA |

**Investigación**

- Reglamento World Archery: [Book 4 — Field and 3D (2026-01-27)](https://extranet.worldarchery.sport/documents/index.php/Rules/Rule_Book_versions/2026-01-27/EN-Book_4_-_2026-01-27_Version.pdf), [Archery GB — Field and 3D](https://archerygb.org/about/types-of-archery/field-and-3d-archery). Confirmado: 3D a 2 flechas con zonas 11/10/8/5, campo a 3 flechas con zonas 6→1.
- Estacas roja/azul/amarilla y su asignación por tipo de arco: [Manual del arquero IFAA (español)](https://ifaa-spain.com/wp-content/uploads/2020/08/EL-MANUAL-DEL-ARQUERO-DE-LA-ASOCIACIO%CC%81N-INTERNACIONAL-DE-ARQUERI%CC%81A-DE-CAMPO.pdf).
- Referencia de producto: [Ianseo Scorekeeper NG](https://apps.apple.com/us/app/ianseo-scorekeeper-ng/id1631394400) — scorecard electrónico, página de firma y manejo de desempates.
- **Hallazgo:** el repositorio local `bv-easy-archery-battle` (mismo autor) resuelve aproximadamente el 60% de la infraestructura y usa la misma convención de documentación. Las rutas concretas de reutilización están en [`ARCHITECTURE.md`](ARCHITECTURE.md) §9.

**Decisiones de arquitectura** (consultadas y confirmadas con el usuario)

| # | Decisión | Motivo |
|---|---|---|
| D1 | MongoDB Atlas, no el plugin de Railway | El plugin es standalone: sin replica set no hay transacciones multi-documento |
| D2 | Dos builds de frontend: landing en `/`, PWA en `/app` | La landing pública no debe cargar el bundle de administración ni un service worker |
| D3 | WAFL offline-first total; WAFA online con caché de lectura | Es donde está el requisito real; duplicar el sync en WAFA agregaría conflictos sin beneficio |
| D4 | Hono + driver oficial `mongodb` + Zod | Reutiliza el middleware existente; sin la capa de magia de un ODM |
| D10 | Temporada como entidad creada por el admin | Permite ligas paralelas y temporadas que cruzan años |
| D11 | `escuela` es una categoría más en podios y rankings | Confirmado por el usuario |

**Desvíos respecto del brief original** — cada uno consultado y aprobado

| Brief original | Implementación | Motivo |
|---|---|---|
| PIN de 4 dígitos | **6 dígitos** | 10.000 combinaciones se rompen por fuerza bruta en minutos, y quien entra puede falsear los puntajes de esa patrulla |
| Password de admin `CBA2026` fijo | **Seed por `ADMIN_INITIAL_PASSWORD` + cambio obligatorio** | Un password conocido y presente en el repositorio compromete crear, borrar y publicar torneos. `CBA2026` queda como default de desarrollo local |
| Ranking por mejor puntaje bruto | **Bruto + normalizado %, se muestra el %** | Cada torneo multitarget tiene un máximo distinto; comparar brutos premia al recorrido más largo, no al mejor tiro |
| "Firmas necesarias para poder guardar los datos" | **Autosave siempre; la firma cierra el circuito** | Guardar al final pierde el recorrido completo si se apaga el celular. Sin firmas la patrulla queda `pendiente_firma` y no entra al ranking |

**Aclaración de regla de dominio** — consultada con el usuario

El brief listaba `A:[escuela,escuela] · B:[escuela,escuela]` como patrulla incorrecta sin explicitar la regla. El usuario confirmó: **ninguna patrulla puede ser 100% escuela; siempre debe acompañarlos al menos un arquero senior.** Quedó formalizada como restricción `H3` en [`DOMAIN_WA.md`](DOMAIN_WA.md) §5.

**Deuda y riesgos abiertos**

| Tema | Detalle | Resuelve |
|---|---|---|
| PIN descifrable | Se guarda `pinEnc` (AES-256-GCM) para que el admin pueda volver a mostrar el PIN. Tradeoff documentado en [`SECURITY.md`](SECURITY.md) §9 | `FE-22` (acceso por QR) lo elimina |
| Teclado en arcos | La disposición concéntrica para 3D y campo es una apuesta de usabilidad sin validar | `FE-6` deja la grilla detrás de una prop; se decide con una prueba de campo |
| Network Access de Atlas | Railway no publica IPs de salida fijas; probablemente haya que usar `0.0.0.0/0` con usuario de permisos mínimos | `INF-4` documenta la decisión final |
| Backups en M0 | Sin backup automático en el tier gratuito | `INF-6`; se resuelve solo al pasar a M10 |

**Próximo paso:** ejecutar `INF-1` de [`ACTION_PLAN.md`](ACTION_PLAN.md).

---

## Plantilla para entradas nuevas

```markdown
## AAAA-MM-DD · <ID de tarea> — <título>

**Autor:** · **Estado:** completado | parcial | bloqueado

<Qué se hizo, 1-2 líneas.>

**Decisiones:** <las que no estaban en la documentación, con su porqué.>
**Desvíos:** <respecto de lo planificado, con su justificación.>
**Deuda:** <lo que queda abierto, con el ID que lo resolvería.>
**Tests:** <qué se cubrió; cobertura si aplica.>
```
