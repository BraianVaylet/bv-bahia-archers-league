# Plan de acción — Sexta ronda: auditoría

Implementación de [`INFORME.md`](INFORME.md). Mismas convenciones que [`ref-5`](../ref-5/ACTION_PLAN.md).

**Convención de IDs:** `REF6-N` · **Prioridad:** `P0` antes del próximo torneo y del deploy de `INF-4` → `P1` necesario → `P2` mejora · **Estado:** `[ ]` `[~]` `[x]` · **Esfuerzo:** `S` ≤ ½ día · `M` 1-2 días · `L` 3+ días

Cada tanda referencia los hallazgos del informe por ID (`S-1`, `P-1`, …).

---

## Contexto

El proyecto pasa lint, tipos y 1331 tests. Lo que queda **no lo ve ningún test**, y eso define el orden: las tandas `P0` son las que pueden romper un torneo o un resultado, y cada una **empieza por el test que hoy falta** —regla 10: se lo ve fallar por la razón correcta antes de tocar el código—.

Las cuatro decisiones de [`INFORME.md`](INFORME.md) §5 se confirman antes de arrancar `REF6-1`, `REF6-6` y `REF6-11`.

---

## Resumen

| Tanda | Qué | Hallazgos | Prioridad | Esfuerzo |
|---|---|---|---|---|
| `REF6-1` | Nada se escribe después de cerrar | `S-1` | **P0** | M |
| `REF6-2` | Un rate limit que no frene el torneo | `S-2` `S-3` `T-3` | **P0** | M |
| `REF6-3` | El tema sin parpadeo, con la CSP intacta | `U-1` | **P0** | S |
| `REF6-4` | El celular muestra lo que tiene el servidor | `U-2` `U-3` `P-2` | **P0** | M |
| `REF6-5` | Sync que aguanta la latencia | `P-1` `T-5` | **P0** | M |
| `REF6-6` | Entradas públicas endurecidas | `S-4` `S-5` `S-6` | P1 | M |
| `REF6-7` | PIN y audit log | `S-7` `S-9` `C-7` `U-6` | P1 | M |
| `REF6-8` | Entrega de assets y PWA | `P-3` `P-4` `P-5` `U-4` `S-8` | P1 | M |
| `REF6-9` | Cobertura que bloquea y E2E en celular | `T-1` `T-2` `T-6` | P1 | M |
| `REF6-10` | La regla 3 sin excepciones | `B-1` | P1 | S |
| `REF6-11` | WAFA: páginas chicas y contratos tipados | `C-1` `C-2` `C-3` `C-4` | P2 | L |
| `REF6-12` | Navegación accesible y pantalla encendida | `U-5` `U-7` | P2 | S |
| `REF6-13` | Limpieza del backend | `B-3` `B-4` `B-5` `C-5` `C-6` `P-6` | P2 | M |
| `REF6-14` | Calidad continua | `C-8` `C-9` `P-7` `S-10` `T-7` | P2 | M |
| `REF6-15` | Los docs dicen la verdad | `B-2` | P2 | S |

---

# P0 — Antes del próximo torneo

### `[x] REF6-1` · Nada se escribe después de cerrar · **P0** · M

**Hallazgo:** `S-1`. **Skill:** `tdd`, `/security-review`.
**Archivos:** `api/src/services/syncService.ts`, `api/src/services/publishService.ts`, `api/src/lib/errors.ts`, `api/tests/seguridad.test.ts`

- [x] `aplicarScore` y `aplicarFirma` rechazan op por op si la patrulla está `cerrada` → código nuevo `PATROL_CLOSED`. El estado se lee **una vez por lote** y un `close` del mismo lote cuenta para las ops que siguen
- [x] `aplicarScore` rechaza si el participante ya tiene firma → `SIGNATURE_LOCKED` *(decisión 1)*
- [x] `publish` recalcula el `scorecardHash` de cada firmado y no publica si alguno no coincide → `SIGNATURE_MISMATCH` con el nombre
- [x] El rechazo llega al líder por el indicador de sincronización del encabezado («Problema al sincronizar: …» + el mensaje del servidor), que es el camino que ya existe para cualquier rechazo. *(El plan decía «en el blanco»; verificado: el `error` de cada puntaje no se dibuja ahí. No se tocó el cliente.)*

**DoD:** ninguna op modifica un puntaje de una patrulla cerrada ni de un arquero firmado · publicar un torneo con un hash alterado falla con un error que dice quién.
**Tests:** score tras cierre → `rejected` y rollups intactos · firma tras cierre → `rejected` · score en el mismo lote que el cierre · score sobre firmado → `rejected` (y el que no firmó sigue pudiendo) · publicar con un score alterado en la base → rechazado y no queda publicado.
**Mutaciones:** sacar el chequeo de `cerrada` en score · idem en firma · seguir el `close` dentro del lote · sacar `SIGNATURE_LOCKED` · publicar sin verificar el hash. Las cinco detectadas, y otras tres sobre el código extraído.

> Es el único hallazgo que deja publicar un resultado que **nadie firmó**. Va primero.

> **Efecto colateral que hay que decidir:** con esto no hay manera de corregir un puntaje firmado por error. La UI ya lo impedía; ahora el servidor también. Ver la bitácora.

> Es el único hallazgo que deja publicar un resultado que **nadie firmó**. Va primero.

---

### `[x] REF6-2` · Un rate limit que no frene el torneo · **P0** · M

**Hallazgos:** `S-2`, `S-3`, `T-3`. **Skill:** `tdd`, `/security-review`.
**Archivos:** `api/src/app.ts`, `api/src/middleware/rateLimit.ts`, `api/src/lib/ip.ts` (nuevo), `api/src/lib/session.ts`, `api/src/env.ts`, `e2e/ingreso-masivo.spec.ts` (nuevo), `e2e/servidor.ts`, `docs/SECURITY.md` §3.3, `docs/CONFIG.md`, `.env.example`

- [x] El límite de login aplica **sólo** a `POST /admin/login` y `/patrol/login` (cupo compartido) y `/admin/recover` (cupo propio); `/me`, `/csrf`, `/logout` y el cambio de password salen del cupo
- [x] Se cuentan **intentos fallidos** (`401`) por IP, no requests; la fuerza bruta la sigue frenando el bloqueo por cuenta. `RATE_LIMIT_LOGIN` pasa de 10 a **60**; la recuperación tiene `RATE_LIMIT_RECOVER` = **5**
- [x] **El cupo se reserva al entrar y se devuelve si no fue un fallo.** La primera versión miraba al entrar y anotaba al salir: una ráfaga de 30 simultáneos pasaba contra un cupo de 5. Lo encontré revisando mi propio diseño, con el test escrito antes del arreglo
- [x] ~~`TRUSTED_PROXY_HOPS`~~ → **`TRUSTED_IP_HEADER`**, por defecto `x-real-ip` en producción. La documentación de Railway (*Specs & Limits → Request Headers*) da `X-Real-IP` como la IP del cliente y no menciona `X-Forwarded-For`; contar saltos habría sido adivinar. **Pendiente de verificar en el primer deploy** que el borde pise un `X-Real-IP` mandado por el cliente (`SECURITY.md` §3.3)
- [x] El `Map` de contadores tiene tope duro (10 000), con desalojo del más viejo *(no LRU estricto: no se reordena al leer)*
- [x] La misma IP alimenta el cupo, las sesiones y el audit log (`lib/ip.ts`)
- [x] `e2e/servidor.ts` ya no sube `RATE_LIMIT_LOGIN`: el E2E corre con el límite real

**DoD:** 15 patrullas distintas entran desde la misma IP con la configuración **de producción** · un `X-Forwarded-For` inventado no cambia de cubeta · el `Map` no pasa del tope.
**Tests:** ingresos correctos y `/me`/`/csrf` no gastan cupo · 10 fallos → 429 aun con la clave correcta · por IP · el 429 de la cuenta bloqueada no cuenta · recuperación con cupo propio · XFF inventado no cambia de cubeta, IPs reales distintas sí · tope y desalojo · ráfaga de 30 contra un cupo de 5 · E2E de 15 patrullas.
**Mutaciones:** no registrar fallos · contar cualquier error · contar los exitosos · cupo global · sin default de producción · ignorar el header de confianza · sin tope · desalojar el contador recién abierto · sin el límite público enchufado · nunca devolver el lugar · devolver también el de los fallos · no reservar. Todas detectadas, salvo una que resultó **equivalente** (una guarda que escribí y era código muerto: se sacó). El E2E se verificó contra el comportamiento viejo: con el límite de 10 contando ingresos correctos falla en la patrulla 10.

> `SECURITY.md` §3.3: ante la duda entre seguridad y disponibilidad durante el torneo, **gana la disponibilidad**. El bloqueo por cuenta ya cubre la fuerza bruta.

---

### `[x] REF6-3` · El tema sin parpadeo, con la CSP intacta · **P0** · S

**Hallazgo:** `U-1`.
**Archivos:** `app/index.html`, `landing/index.html`, `app/public/theme-init.js` (reescrito), `landing/public/theme-init.js` (nuevo), `shared/src/navegador.ts` (nuevo), `shared/package.json`, `app/src/main.tsx`, `landing/src/main.tsx`, `shared/tests/tema.test.ts`, `shared/tests/navegador.test.ts` (nuevo), `e2e/tema-sin-parpadeo.spec.ts` (nuevo)

- [x] El script del tema pasa a un archivo del mismo origen, **clásico y bloqueante** en el `<head>` — la CSP actual (`script-src 'self'`) ya lo permite. Vite lo emite con el `base` (`/app/theme-init.js`) y la PWA lo precachea: sin señal, el tema también llega
- [x] Usa `TEMA_KEY` (`bal_tema`) y **el mismo criterio que `resolverTema`**; se borran las otras copias. *(Ver abajo: las copias inline no decidían lo mismo.)*
- [x] Sin `'unsafe-inline'` y sin hashes que mantener a mano
- [x] **Segunda violación de CSP, no prevista en el plan: `script-src → eval`.** Zod 4 sondea `new Function('')` al construir cada schema. Se resolvió con `@bal/shared/navegador` (`z.config({ jitless: true })`), importado **primero** en el `main.tsx` de cada frontend. Sólo en el navegador: el backend se beneficia del JIT

**DoD:** en el stack de producción, con tema oscuro, el primer pintado ya es oscuro · cero violaciones de CSP en las dos apps.
**Tests:** E2E con `colorScheme: 'dark'`, en `/`, `/app/`, `/app/wafl` y `/app/wafa`: el tema se escribe **antes** de que React ponga su primer hijo en `#root` (un `MutationObserver` anota el orden; `DOMContentLoaded` no servía, porque el módulo de React corre antes) y cero eventos `securitypolicyviolation` · el script **ejecutado** en un `vm` coincide con `resolverTema` en las 10 combinaciones de valor guardado × sistema, y con `localStorage` bloqueado · las dos copias son idénticas · los HTML no tienen script inline y cargan el del tema antes del bundle · construir los schemas no intenta compilar código.
**Mutaciones:** clave `bal-theme` · copias distintas · un valor corrupto deja de seguir al sistema · lecturas en un solo `try` · script inline de vuelta · `defer` · script después del bundle · el import de Zod después de `./App` (lo detecta el E2E). Todas detectadas.

---

### `[x] REF6-4` · El celular muestra lo que tiene el servidor · **P0** · M

**Hallazgos:** `U-2`, `U-3`, `P-2`. **Skill:** `tdd`.
**Archivos:** `app/src/wafl/sesion.ts`, `app/src/offline/syncWorker.ts`, `api/src/services/syncService.ts`, `app/src/offline/offline.test.ts`, `app/src/wafl/wafl.test.tsx`, `api/tests/wafl.test.ts`, `e2e/dos-dispositivos.spec.ts`, `e2e/ayudas.ts`

- [x] `sembrarPuntajes` recomputa inner, X, 10 y M con `validateTargetScore` y la modalidad del blanco del bundle. El `total` sigue siendo el del servidor (regla 1)
- [x] `superseded` devuelve las flechas ganadoras; el cliente las escribe como `synced`
- [x] `duplicate` de un score devuelve **lo que el servidor tiene hoy** en la celda, y el cliente se alinea con eso. *(El plan decía «marca el puntaje local como `synced`» a secas: eso esconde un rechazo si la respuesta original se perdió. Ver la bitácora.)*
- [x] **No pisa una edición más nueva** que todavía está en camino para la misma celda
- [x] El POST de sync tiene plazo de 20 s, con `setTimeout` propio y no `AbortSignal.timeout` (no se puede controlar con relojes falsos), y cubre el pedido entero, token CSRF incluido. El corte es reintentable
- [x] El `duplicate` **no devuelve el puntaje de un arquero de otra patrulla** (se detecta por `opId` antes de autorizar; hace falta comprobarlo)

**DoD:** tras cambiar de celular, la pantalla de resultados muestra los mismos X/10/M que el servidor · después de un conflicto, **los dos** dispositivos muestran el puntaje ganador · un request colgado no traba el outbox más de 20 s.
**Tests:** re-sembrar con `X` y `M` → conteos correctos · el total del servidor manda sobre el recalculado · `superseded` y `duplicate` alinean flechas y totales · limpian un error previo · no pisan una edición más nueva · el plazo corta a los 20 s, no antes, y el outbox se vacía al volver la señal · servidor: las flechas vigentes en `superseded` y `duplicate`, y nada de puntajes ajenos · **E2E: los dos celulares terminan con las mismas pantallas de resultados**.
**Mutaciones:** conteos en cero · modalidad equivocada en la siembra · no alinear · alinear pisando una edición en camino · error viejo pegado · sin plazo, plazo de 5 s y de 60 s · plazo tratado como rechazo definitivo · servidor sin flechas · servidor filtrando puntajes ajenos · servidor sin detalle en el duplicado. Todas detectadas, salvo una que resultó **equivalente** (una guarda que había escrito y era código muerto: se sacó). Una más, el plazo de 5 s, sobrevivió al principio por un defecto del **test**, que se rehízo. El E2E se verificó contra el bug: con la alineación apagada, el celular que perdió muestra 39 contra 48.

> Es la pantalla que el arquero mira **para firmar**. Lo que ve tiene que ser lo que se guarda.

---

### `[~] REF6-5` · Sync que aguanta la latencia · **P0** · M

> **Estado: hecho, salvo un punto del DoD que no se cumple y es decisión del dueño** (el presupuesto de 400 ms, ver abajo).

**Hallazgos:** `P-1`, `T-5` (parcial). **Skill:** `tdd`.
**Archivos:** `api/src/services/syncService.ts`, `api/src/repositories/scoreRepo.ts`, `api/src/db/client.ts`, `api/src/routes/health.ts`, `api/tests/sync-viajes.test.ts` (nuevo), `api/bench/sync.ts` (nuevo), `docs/CONFIG.md` §3, §7 y §10, `docs/TECHNICAL.md` §5

- [x] El avance de la patrulla (`targetsCompleted`) se calcula **una vez por lote**, al final, en su propia transacción corta, y no dentro de cada op. Sólo si el lote trae algún score que no se rechazó; **los `duplicate` cuentan**, así un reenvío repara un avance que quedó desactualizado
- [x] Las transacciones por op se mantienen: el aislamiento de fallas no se negocia
- [x] Los rollups son **una** escritura en vez de dos: `normalizedPct` sale del total que la op ya leyó en su transacción, sin releer el documento
- [x] Benchmark con latencia inyectada: `pnpm --filter @bal/api bench:sync`, **a demanda y no en CI** (el tiempo depende de la máquina; un umbral de reloj sería inestable). La guarda en CI es determinista: `tests/sync-viajes.test.ts` cuenta los comandos que el driver manda y falla si crecen
- [x] `CONFIG.md` exige Railway y Atlas en la misma región, con la tabla medida, y dice cómo verificarlo: `curl …/api/health` y mirar `dbMs`
- [ ] **El presupuesto de 400 ms para 20 ops no se cumple: 487 ms** a 2 ms de RTT (ver la tabla en `TECHNICAL.md` §5)

**DoD:** viajes por op de score de 10 a 6 ✅ (medido: 204 → 128 comandos en 20 ops) · avance exacto ✅ · **lote de 20 ops < 400 ms p95 ❌** (487 ms, peor de 3, en esta máquina).
**Tests:** viajes por lote y por op (y que el costo por op no crezca con el tamaño del lote) · lote mixto con una op rechazada deja el avance exacto · un reenvío todo-`duplicate` repara un avance desactualizado · un lote sin cambios no recalcula · `normalizedPct` acumula entre blancos y baja al corregir · `dbMs` en el healthcheck.
**Mutaciones:** no recalcular al final · recalcular sólo si TODAS las ops se aplicaron · recalcular siempre · no contar los duplicados · recalcular dentro de cada op · `normalizedPct` sin el total previo. Todas detectadas; la última **sobrevivía** hasta que se escribió un test que acumulara entre blancos (el existente aplicaba una sola op, donde `totalPrevio + delta` y `delta` valen lo mismo).

---

# P1 — Necesario

### `[x] REF6-6` · Entradas públicas endurecidas · **P1** · M

**Hallazgos:** `S-4`, `S-5`, `S-6`. **Skill:** `tdd`, `/security-review`.
**Archivos:** `api/src/app.ts`, `api/src/middleware/validate.ts`, `api/src/routes/publico.ts`, `api/src/services/{archerService,authService,patrolAuthService}.ts`, `api/src/repositories/{userRepo,patrolRepo}.ts`, `landing/src/pages/ArcherRegister.tsx`

- [x] `bodyLimit` de Hono sobre `/api/*`: 1 MB en sync, 64 KB en el resto. Cuenta bytes reales, no el `Content-Length` declarado; responde con la misma forma de error que el resto de la API
- [x] Alta pública: misma respuesta para DNI nuevo y repetido *(decisión 2)*. El duplicado no crea nada, devuelve un `_id` inventado y deja `archer.register_duplicate` en el audit log
- [ ] **El duplicado no se ve en la cola de WAFA.** La decisión 2 decía «el admin ve el duplicado en la cola»; hoy sólo queda en el audit log, que ninguna pantalla muestra. Mostrarlo pide una pantalla o un filtro nuevo. **`REF6-7` audita pero no muestra el log** (su lista no incluye esa pantalla), así que esto no tiene tarea asignada: falta una pantalla de auditoría en WAFA
- [x] Rate limit propio de `POST /api/public/archers` (`RATE_LIMIT_REGISTER`, 20 por hora e IP) y campo *honeypot* `sitioWeb`, que se acepta en silencio
- [x] Bloqueo por **(cuenta, IP)** con backoff progresivo, para admin (15 → 60 min) y patrulla (5 → 20 min), más un tope por cuenta de 30 fallos entre todas las IPs en la base
- [x] El bloqueo **reserva el intento al entrar**: una ráfaga de 30 contra una cuenta deja pasar cinco. Se aplica también a cuentas que no existen (si no, el bloqueo sería un oráculo de usuarios)
- [x] Recuperar el password y regenerar el PIN sueltan el bloqueo de todas las IPs de esa cuenta
- [ ] **No se topó la cola de altas pendientes.** El rate limit frena el volumen por IP, pero un atacante con muchas IPs puede llenar la cola. No estaba en el plan; queda como decisión si aparece

**DoD:** un body chunked que se pasa se corta sin leerse entero ✅ · el alta no revela si un DNI existe ✅ · cinco intentos desde una IP no bloquean a la cuenta desde otra ✅.
**Tests:** body chunked sin `Content-Length` → 413 · respuesta idéntica en los dos casos de DNI · honeypot lleno → descartado sin error visible · cupo por IP del alta · bloqueo por par, ráfaga, cuenta inexistente, tope por cuenta, ingreso correcto que reinicia, torneo en mayúsculas, y recuperar/regenerar que sueltan.
**Mutaciones:** Bloqueo (13): sin reserva · clave sin IP · sin liberar al entrar (admin y patrulla) · recuperar y regenerar sin soltar · torneo sin canonizar · tope de la base en 5 y en 1000 (admin y patrulla) · sin Retry-After. Límite de body (3): sólo Content-Length · el del sync para todo · el general para el sync. Alta pública (6): devolver el 409 · duplicado sin auditar · honeypot sin efecto · honeypot que responde error · sin cupo propio · landing sin el campo. **Todas detectadas**, pero una **sobrevivía**: el tope de la base en 1000 para las patrullas, porque el test de «muchas IPs» sólo existía para el admin; ahora existe también para la patrulla.

---

### `[x] REF6-7` · PIN y audit log · **P1** · M

**Hallazgos:** `S-7`, `S-9`, `C-7`, `U-6`. **Skill:** `tdd`.
**Archivos:** `api/src/routes/admin.ts`, `api/src/services/{patrolAdminService,tournamentEditService,tournamentStateService,paymentService,archerService,authService,seasonService}.ts` (`seasonService` es nuevo), `api/src/services/syncService.ts`, `api/src/routes/wafl.ts`, `api/src/db/types.ts`, `app/src/wafa/pages/{Tournament,Patrols}.tsx`, `app/src/wafa/refrescoPeriodico.ts` (nuevo)

- [x] `GET /patrols` sin PIN por defecto; `?pins=1` los trae y es lo único que se acepta (otro valor o parámetro: `400`). El `PUT` que guarda desde la pantalla de credenciales sigue devolviéndolos
- [x] Se auditan: borrar torneo, iniciar y volver atrás, marcar pago (con el estado y el torneo), CRUD de arqueros y de temporadas, y los ingresos **correctos** del admin. Cada entrada con actor e IP; el `meta` sin nombres ni DNI
- [x] El cierre se registra como `patrol.close`, con la IP de quien cerró (antes `patrol.manual_edit` con `closed:true`)
- [x] El seguimiento del torneo se refresca cada 30 s mientras la pestaña está visible y el torneo está en curso. Un fallo del refresco no muestra error ni borra el de la última acción
- [ ] **Los ingresos fallidos del admin no se registran.** Es a propósito (un `401` por request llenaría el log de ruido de bots), pero el plan decía «login de admin» a secas; queda anotado en `SECURITY.md` §9 bis

**DoD:** abrir el seguimiento no escribe `patrol.pin.reveal` ni recibe un PIN ✅ · cada acción listada deja su entrada con actor e IP ✅.
**Tests:** `/patrols` sin parámetro no trae `pin` (ni la clave) y no escribe en el log · parámetro estricto · publicado no expone aun pidiéndolo · cada acción auditada, con su actor, su IP y su `meta` · lo que falla no deja entrada · el `meta` no copia datos personales · `patrol.close` con IP · el hook de refresco (ritmo, pausa, vuelta, render nuevo, desmontaje) y su uso en la pantalla (sin PIN, error silencioso, sólo en curso, pestaña oculta).
**Mutaciones (24):** login sin registrar o sin IP · el alta copia el nombre · archivar↔restaurar y cerrar↔reabrir al revés · IP nula en padrón, inicio y cierre · borrar sin nombre · pago con estado fijo · cierre con el nombre viejo · PIN siempre · guardar sin PIN · query no estricta · `pins=0` válido · hook sin pausa, con 60 s, sin refresco al volver, con función vieja · refresco que muestra el error, que no mira el estado, que borra el error de la acción · el seguimiento pidiendo PIN · credenciales sin pedirlos. **Todas detectadas**; tres **sobrevivían** y apuntaban a huecos reales: archivar↔restaurar y cerrar↔reabrir (el test sólo comprobaba que existiera una entrada de cada una, no que cada endpoint dejara la suya) y el refresco que borraba el error de la última acción (sin test).

---

### `[x] REF6-8` · Entrega de assets y PWA · **P1** · M

> **Estado: hecho, con dos puntos sin verificar** (si el borde de Railway ya comprime; la auditoría Lighthouse en sí). Ver abajo.

**Hallazgos:** `P-3`, `P-4`, `P-5`, `U-4`, `S-8`. **Skill:** `tdd`.
**Archivos:** `api/src/middleware/{estaticos,compresion}.ts` (`compresion` es nuevo), `api/src/app.ts`, `app/vite.config.ts`, `app/index.html`, `app/src/App.tsx`, `app/public/` (íconos), `shared/src/{configuracionZod,schemas,navegador}.ts`, `scripts/{precomprimir,presupuesto,imagenes}.mjs`, `package.json`

- [x] Compresión: `scripts/precomprimir.mjs` (al final de `pnpm build`) deja `.br` y `.gz` junto a cada asset de texto, y `serveStatic({ precompressed: true })` los entrega; `gzip` para el JSON de la API si pasa de 1 KB. JS de la PWA: 439 → 109 KB en brotli
- [ ] **«Primero verificar si el borde de Railway ya comprime» no se hizo**: no hay un deploy contra el cual medirlo. El servidor comprime de todos modos. Queda para el primer deploy: `curl -sI -H 'Accept-Encoding: br' …/app/assets/<index>.js`
- [x] `Cache-Control`: `immutable` para `/assets/*` (hay hash), `no-cache` para todo lo demás (`index.html`, `sw.js`, el manifest, los íconos); `Vary: Accept-Encoding` siempre; los dos `index.html` en memoria
- [x] `React.lazy` para `WafaApp` y `WaflApp`. **Landing: probado y revertido.** Las tres pantallas candidatas pesan ~4 KB gz entre todas y la carga inicial no bajó (102,2 contra 101,9 KB): un `React.lazy` que no baja el inicial sólo agrega una espera
- [x] `globPatterns` incluye `webp` y `png`; manifest con PNG 192/512 y un maskable aparte con zona segura (nuevo, generado por `imagenes.mjs`), `apple-touch-icon` enlazado, `theme_color` igual al de la página
- [x] Se borra `runtimeCaching`
- [x] **No estaba en el plan, y hizo falta:** el code splitting rompió el orden en que se apagaba el JIT de Zod (`REF6-3`) y volvió el `eval` en la CSP. `schemas.ts` ahora trae su propia configuración (`configuracionZod.ts`), con un test por lado (con DOM sin JIT, sin DOM con JIT)

**DoD:** WAFL no descarga el código de WAFA ✅ (E2E y presupuesto) · el logo del CBA se ve sin señal ✅ (E2E con el celular sin conexión) · **Lighthouse «installable» en verde ❌ no se corrió** (se cubre lo que mira: manifest con PNG 192/512, maskable, `start_url`, `display`, SW registrado, íconos que existen) · los presupuestos se miden sobre lo que una pantalla descarga ✅.
**Medido:** pantalla de elegir rol 99 KB gz · **WAFL 111** (antes 126, todo junto) · WAFA 119 · landing 102.
**Tests:** E2E `entrega-de-assets.spec.ts` (10): sin código de la otra app en las tres entradas, caché, brotli, íconos, apple-touch, `theme_color`, imágenes sin conexión, `sw.js` sin reglas para la API · `presupuesto.mjs` falla si WAFL baja WAFA o pasa su presupuesto · `estaticos.test.ts` (caché, `Vary`, precomprimidos, index en memoria, compresión del JSON) · `navegador-orden` y `navegador-backend`.
**Mutaciones (18):** servidor y Zod (11): assets sin caché larga · todo inmutable · sólo la landing inmutable · sin `Vary` · sin precomprimidos · index leído por request · fallback sin revalidar · compresión sin declarar el largo · sin compresión de la API · el backend sin JIT · schemas sin su configuración. Presupuesto (1): el import estático de WAFA. PWA (6, por E2E): sin `webp` en el glob · `runtimeCaching` de vuelta · `theme_color` oscuro · maskable junto con `any` · sin `apple-touch-icon` · el build sin precomprimir. **Todas detectadas.** La primera mutación del import estático no compilaba (`WafaApp` sin usar) y el presupuesto no cambió: se rehízo con un `void WafaApp`.

---

### `[~] REF6-9` · Cobertura que bloquea y E2E en celular · **P1** · M

> **Estado: hecho, salvo una cosa que no pude verificar:** el proyecto `iPhone 14` (WebKit) está configurado y listado, pero **no se corrió**: WebKit no está instalado en esta máquina y bajarlo es una descarga que no hice sin tu OK. El CI lo instala.

**Hallazgos:** `T-1`, `T-2`, `T-6`. **Skill:** `tdd`.
**Archivos:** `api/vitest.config.ts`, `app/vitest.config.ts`, `{app,landing}/package.json`, `package.json`, `.github/workflows/ci.yml`, `playwright.config.ts`, `e2e/{ayudas,flujo-corto}.ts`, `app/src/offline/offline.test.ts`, `api/tests/auth-middleware.test.ts` (nuevo)

- [x] `thresholds` por carpeta según `TESTING.md` §8: `api` → `services/**` 85/80 y `middleware/auth.ts` 100; `app` → `offline/**` 90/85. «Autorización de sync» no se puede separar de `syncService.ts` por carpeta: queda bajo el de `services/`
- [x] El job `quality` corre `pnpm test:coverage` en todos los paquetes (script nuevo en la raíz, en `app` y en `landing`; a `landing` hubo que agregarle `@vitest/coverage-v8`)
- [x] `offline/` sube de **75,5 a 89,2 %** de ramas y `middleware/auth` de 88 a **100 %**. Son tests de comportamiento (qué pasa sin recorrido descargado, con la red caída mientras se aísla una op, qué dispara el worker), no de líneas
- [~] Proyectos `Pixel 7` y `iPhone 14` para `offline-recarga`, `objetivos-tactiles` y un flujo corto (`flujo-corto.spec.ts`, nuevo). **Pixel 7 corrió: 9/9. iPhone 14 (WebKit) no se corrió.** El CI instala Chromium y WebKit
- [x] Fuera `--passWithNoTests` de `app` y `landing`

**DoD:** bajar la cobertura de `offline/` rompe el CI ✅ (con los tests en verde y la cobertura en 75,5 %, `vitest --coverage` sale con 1) · **los E2E móviles corren en cada PR** ⚠️ configurado, verificado en Pixel 7 y **sin verificar en WebKit**.
**Medido:** `shared` 99,6 / 98,1 · `api` services 97,2 / 85,5 · `app` offline 99,3 / 89,2. Tests: `api` 405 (+5), `app` 522 (+17), `shared` 499, `landing` 53, `ui` 61. E2E: `chromium` 43 + `Pixel 7` 9 = 52/52.
**Mutaciones:** sacar los tests nuevos de `offline/` → `Coverage for branches (75.53%) does not meet "src/offline/**" threshold (85%)`, exit 1 · sacar `auth-middleware.test.ts` → `branches (88.23%) does not meet "src/middleware/auth.ts" threshold (100%)`, exit 1 · un glob que no encuentra tests → exit 1 sin `--passWithNoTests`, 0 con él. **No se pudo probar contra el CI real** (no hay corrida de GitHub Actions a mano): se probó el comando que corre.

---

### `[x] REF6-10` · La regla 3 sin excepciones · **P1** · S

**Hallazgo:** `B-1`. **Skill:** `tdd`.
**Archivos:** `api/src/routes/{publico,admin,health}.ts`, `api/src/services/{rankingService,tournamentQueryService,saludService}.ts` (nuevos), `api/src/services/{seasonService,tournamentStateService,tournamentEditService,tournamentService,publishService,syncService,patrolAdminService}.ts`, `api/src/repositories/{tournamentRepo,saludRepo}.ts`, `api/src/db/sesion.ts` (nuevo), `scripts/verificar-capas.mjs` (nuevo), `api/tests/capas.test.ts` (nuevo), `.github/workflows/ci.yml`

- [x] `GET /public/seasons` usa `seasonService.listar()` (que usa `seasonRepo.list()`); WAFA comparte la misma lista
- [x] El armado del ranking público y de la ficha del arquero pasa a `rankingService`; las lecturas de torneo de la landing y de WAFA (listado, detalle, resultados, blancos bloqueados) a `tournamentQueryService`
- [x] `scripts/verificar-capas.mjs` falla si algo fuera de `repositories/` y `db/` importa `db/client`, y corre en el CI (paso «Capas del backend»)
- [x] **Más de lo que decía el plan, y hizo falta para que el chequeo no tuviera excepciones:** (a) el script también prohíbe que una **ruta** importe repositorios o sesiones —eran 8 imports más, en `admin.ts` y `publico.ts`—; (b) siete servicios importaban `db/client` para abrir una transacción o, dos de ellos, para **consultar** (`tournamentStateService`, `tournamentEditService`): las consultas pasaron a `tournamentRepo.updateIfStatus` y las sesiones a `db/sesion.iniciarSesion()`, que no expone colecciones; (c) el healthcheck consultaba la base desde la ruta: ahora `saludService` → `saludRepo`

**DoD:** cero imports de `db/client` fuera de las capas permitidas, verificado en CI ✅ (13 infracciones antes, 0 ahora) · **las respuestas no cambian un byte ✅**: se congelaron 30 respuestas (landing y WAFA, incluidos los 404 y las cabeceras de caché) antes del refactor y se compararon después: 33 218 bytes, idénticos.
**Tests:** `capas.test.ts` (13): el script prohíbe el import estático y el dinámico, en rutas y en servicios; lo permite en `repositories/`, `db/` e `index.ts`; no se deja engañar por un comentario ni corre los números de línea; y **el `src` real lo cumple** (rojo con las 13 infracciones antes del refactor) · los tests de rutas existentes, sin tocar. `@bal/api` 418 (+13).
**Mutaciones (11):** quitar la regla de `db/client` · quitar la de las rutas · dejar de reconocer `index.ts` · permitir los servicios · no detectar el import dinámico · no ignorar los comentarios · los comentarios que corren las líneas · las rutas abriendo sesiones · prohibir también los tipos y las sesiones · una ruta que vuelve a consultar Mongo · un servicio que vuelve a importar el cliente. **Todas detectadas.** E2E: 43/43 en Chromium de escritorio.

---

# P2 — Mejora

### `[x] REF6-11` · WAFA: páginas chicas y contratos tipados · **P2** · L

> **Estado: hecho, con un alcance recortado a propósito:** los tipos de punta a punta cubren **WAFA**, que es lo que dice el título de la tanda. La landing sigue con `useRecurso<T>(path)` (ver «Queda» abajo). Se entregó en tres partes, cada una verde por sí sola.

**Hallazgos:** `C-1`, `C-2`, `C-3`, `C-4`. **Skill:** `vercel-react-best-practices`.

**Entrega 1 — hecha: un cliente y un hook** (`C-2`, `C-4`)
- [x] **Un solo cliente HTTP con CSRF y un solo `ApiError`**: paquete nuevo `@bal/cliente`. `apiClient.ts` y `api.ts` quedan delgados
- [x] **`useCarga`** (WAFA) y `useRecurso` (landing): carga con cancelación, conserva lo que se ve al recargar, recarga silenciosa. Opción `conservarDatos` para los filtros de una lista *(decisión 3: hook propio)*
- [x] **Fuera `@tanstack/react-query`**: estaba declarada y no se importaba en ningún lado

**Entrega 2 — hecha: páginas chicas** (`C-1`, y el resto de `C-2`)
- [x] `Tournament` (624 → 144 líneas), `Archers` (668 → 146), `TournamentCreate` (527 → 144) y `Patrols` (486 → 106), más `Ranking` (311 → 141), `Publish` (260 → 159) y `Seasons` (256 → 111). **La más grande de WAFA ahora tiene 173 líneas.** Cada una quedó como composición: los datos salen de un hook (`useTorneo`, `usePadron`, `usePatrullas`, `useRanking`) y cada pieza vive en su carpeta (`detalle/`, `padron/`, `crear/`, `distribucion/`, `ranking/`, `publicacion/`, `temporadas/`)
- [x] **Todas las cargas de WAFA usan `useCarga`**: se migraron también `Home`, `Payments` y `SelectorDeArqueros`, que no estaban en la lista pero dejaban tres `useState` + `useEffect` a mano
- [x] El warning de complejidad cognitiva de `Tournament.tsx` desapareció, y no hay ninguno en `app/src`

**Entrega 3 — hecha: tipos de punta a punta** (`C-3`)
- [x] **Cliente RPC de Hono (`hc`) en WAFA**: `apiClient.ts` queda para WAFL y `lib/rpc.ts` es el de WAFA. Las ~40 llamadas de WAFA (lecturas y escrituras) van por ahí; ya no queda un `api.get<T>('/admin/…')` en `wafa/`
- [x] **`@bal/api/tipos`**: el único archivo del backend que otro paquete puede importar, y sólo como tipo. Exporta `RutasDeAdmin`, `RutasDeAuth` y `RutasPublicas`. Alias en `tsconfig.base.json`, sin dependencia declarada (declararla haría de `@bal/api` una «librería compilada» para `verificar-workspace`)
- [x] **`fetch` propio en `@bal/cliente`** (`crearCliente(…).fetch`): `hc` arma la URL y el cuerpo, y el CSRF y el `ApiError` siguen resolviéndose en un solo lugar. `request` quedó escrito sobre el mismo núcleo
- [x] **Los cuerpos y las consultas también están tipados**: `bodyValidado` y `consultaValidada` mueven `parseJsonBody` / `parseQuery` a un middleware, con la misma validación y los mismos errores (15 rutas). Hono ve el schema en el tipo de la ruta; antes no inferían nada
- [x] **`verificar-capas` mira los frontends**: sólo `import type` de `@bal/api/tipos`, y nada más del backend. `import { type X }` no vale (con `verbatimModuleSyntax` deja un import vacío que el bundler carga)
- [x] **`contratos.test-d.ts`**: aserciones de tipos que `tsc` comprueba; si `rpc` degenerara en `any`, los `@ts-expect-error` dejan de cumplirse y el typecheck se pone rojo

**DoD:** ninguna página de WAFA pasa de 250 líneas ✅ (173) · cambiar el nombre de un campo en una ruta rompe el `typecheck` del frontend ✅ (probado con mutaciones: renombrar `tournament` en el detalle y `normalizedPct` en los resultados) · los tests de UI existentes siguen verdes sin cambios de comportamiento ✅ (**no se modificó ningún test de UI**; la única edición a un test existente es una línea del fixture tipado de `torneo.test.ts`, que traía un `participantId` que el servidor nunca manda).

**Tests nuevos de esta entrega:** `@bal/cliente` +18 (`fetch`: CSRF, `ApiError`, `Request`, señal, portal cautivo) · `@bal/api` +27 (`entrada-tipada` 11 y la guarda de los frontends 16) · `@bal/app` +16 (`rpc.test.ts` 15: URL, parámetros, consulta, CSRF, cuerpo, señal, errores; y `podios` con filas como las manda el servidor).
**Mutaciones (15, todas detectadas por la causa esperada):** 7 sobre el `fetch` del cliente (sin CSRF, sin `ApiError`, método del `Request`, URL sin convertir, headers del `Request`, sin credenciales, mensaje invertido) · 4 sobre los middlewares y una ruta sin validador · 4 sobre los tipos (renombrar `tournament` y `normalizedPct` rompen el typecheck del frontend; degradar `RutasDeAdmin` a `any` y sacar el validador de `POST /seasons` ponen rojo `contratos.test-d.ts`).
**Verificación:** tipos y Biome sin errores · tests: cliente 57, shared 499, api 445, ui 61, app 576, landing 53 · E2E: Chromium de escritorio 43/43 (3.4 min).

**Qué destapó la migración** (tres desfases que ningún mock podía ver):
- `/results` **nunca mandó `participantId`**, y `ResultadoParticipante` lo daba por hecho. `podios` desempataba por un campo siempre `undefined`: el orden de dos arqueros iguales en todo dependía de cómo llegaran. Ahora `podios` usa `id`; el tipo dejó de mentir
- El servidor **ensanchaba `category`, `stake`, `unit` y `position` a `string`** en las vistas de arqueros, patrullas, pagos y ranking, aunque la base los guarda como unión. Corregido sólo en tipos
- `PatrullaVista.pin?: string` no aceptaba el `pin?: string | undefined` que infiere Hono con `exactOptionalPropertyTypes`

**Peso:** WAFA 126.21 → 128.27 KB gz (+2.06; presupuesto 135). WAFL 118.06 → 118.18 y landing 108.6 → 108.71 (el núcleo del cliente). El cliente RPC está **sólo** en el chunk de WAFA: ni WAFL ni la pantalla de elegir rol lo bajan.

**Queda (no es de esta tanda):**
- **La landing** sigue con `useRecurso<T>(path)` y el tipo escrito a mano en cada página. Tiparla pide cambiar la firma del hook compartido (de una ruta a una función) y suma ~2 KB a un bundle que está en 108.7 de 120
- **WAFL** queda con `api` / `request`: su flujo de datos es IndexedDB y la cola de operaciones (regla 6), no una llamada por pantalla
- **El presupuesto de «pantalla de elegir rol» está en 105.08 KB contra un tope de 105** y el CI corre `presupuesto.mjs`. **Ya estaba en 105.09 antes de esta entrega** (medido sobre el `dist` del commit anterior); no lo causó esta tanda ni lo arregla. Hay que recortar la entrada o subir el tope con su registro en `TECHNICAL.md` §5: decisión del dueño

---

### `[~] REF6-12` · Navegación accesible y pantalla encendida · **P2** · S

> **Estado: hecho, salvo una cosa que no pude verificar:** la pantalla encendida **no se probó en un celular real**. La decisión 4 pedía probarlo antes de fijarlo; acá hay tests con la API simulada, no un teléfono.

**Hallazgos:** `U-5`, `U-7`. **Skill:** `web-design-guidelines` *(no se corrió: el cambio no es visual)*.

- [x] `useTituloDePagina` en **cada pantalla** de la landing, de WAFA y de WAFL, y en la de elegir rol. Las que dependen de un dato lo usan cuando llega (el nombre del torneo, el del arquero). Un test lee el código y falla si una pantalla nueva se olvida de declararlo
- [x] Al cambiar de ruta: el `scrollTop` del contenedor a 0 y el foco al `h1` (o, si la pantalla no tiene, al título del encabezado). `useAlCambiarDeRuta` en `@bal/ui`, montado dentro del router de la landing y de la PWA
- [~] Wake Lock en `TargetPage` y en ningún otro lado (un test lo fija), re-adquirido en `visibilitychange`. **Sin probar en un celular real**

**DoD:** cada pantalla tiene su título ✅ · se entra a cada página desde arriba ✅ (en la landing, que es donde fallaba: el `main` se comparte entre rutas) · la pantalla no se apaga mientras se anota un blanco ⚠️ (con la API simulada; **sin celular real**).
**Tests nuevos:** `@bal/ui` +16 (título, scroll, foco, h1 tardío, plazo, no robar el foco al que escribe) · `@bal/app` +40 (`useWakeLock` 12, títulos de las ~17 pantallas, navegación con `Screen` y `Encabezado` reales, `TargetPage` pide y suelta, solo `TargetPage` la usa) · `@bal/landing` +11 (títulos por ruta, scroll, foco en la `App` de verdad).
**Mutaciones (23, todas detectadas):** 7 sobre `useTituloDePagina` / `useAlCambiarDeRuta`, 8 sobre `useWakeLock`, y 8 de cableado (sin la marca de scroll o de título, sin `NavegacionAccesible`, una pantalla sin título, `TargetPage` sin Wake Lock). Una "sobrevivió" y era una mutación mía equivalente; se reemplazó por una que de verdad rompe el reintento.
**Verificación:** tipos y Biome sin errores · tests: cliente 57, shared 499, api 445, ui 77, app 616, landing 64 · E2E: Chromium de escritorio 43/43 (3.4 min).

**Queda:**
- **Probar la pantalla encendida en un celular real** (y medir el costo de batería de un recorrido). Sin eso, la decisión 4 no está cerrada
- **Seis pantallas de WAFA no tienen `h1`** (`Archers`, `Home`, `Payments`, `Ranking`, `Seasons`, `TournamentCreate`): su título es el `span` del `Encabezado`. El foco cae ahí, pero un lector de pantalla no las lista como encabezado. Arreglarlo sin duplicar el `h1` de las que ya lo tienen es decisión de diseño
- **WAFL solo recibe títulos.** Su navegación es estado, no rutas, y mover el foco en medio de una carga no se justifica
- **El presupuesto de «pantalla de elegir rol» sigue sobre el tope** (105.53 KB contra 105; ya lo estaba antes de esta tanda, y esta suma ~0.45). Ver `REF6-11`

---

### `[ ] REF6-13` · Limpieza del backend · **P2** · M

**Hallazgos:** `B-3`, `B-4`, `B-5`, `C-5`, `C-6`, `P-6`.

- [ ] Apagado ordenado: esperar `server.close` con plazo de gracia antes de `disconnect`
- [ ] Dedup de sync con estado `processing` y reproceso tras 30 s
- [ ] Logger estructurado que respete `LOG_LEVEL`; una línea por lote de sync con ops, duración y rechazos
- [ ] `esClaveDuplicada(error)` con `MongoServerError.code === 11000`
- [ ] Fuera `WEB_DIST_*` y `VITE_APP_NAME` (`validateBody` ya salió en `REF6-11`: `bodyValidado` ocupa su lugar)
- [ ] `/public/tournaments` filtra en la consulta, con proyección; LRU de rankings invalidada al publicar

---

### `[ ] REF6-14` · Calidad continua · **P2** · M

**Hallazgos:** `C-8`, `C-9`, `P-7`, `S-10`, `T-7`.

- [ ] Biome en cero warnings y `--error-on-warnings` en CI
- [ ] Lo visual de `@bal/shared` (`paleta`, `tema`, `tokens.css`, assets) pasa a `@bal/ui`
- [ ] `memo` en `ArrowRow` y `ScoreKeypad`; `TargetPage` lee por índice; medición de «registrar una flecha»
- [ ] CI con `permissions: contents: read`, actions fijadas por SHA, Renovate o Dependabot; imagen base por digest; cerrar `aikido:scan` de `BE-14`
- [ ] Stryker nocturno sobre `@bal/shared` y `syncService`

---

### `[ ] REF6-15` · Los docs dicen la verdad · **P2** · S

**Hallazgo:** `B-2`.

Al cerrar las tandas anteriores, cada fila de la tabla de `INFORME.md` §3.5 `B-2` termina en uno de dos estados: **implementado**, o **el doc corregido** con su entrada en [`BITACORA.md`](../../BITACORA.md). Ninguna queda prometiendo lo que el código no hace.

---

## Orden recomendado

```
REF6-1 ─┐
REF6-2 ─┼─ antes del próximo torneo y del deploy (INF-4)
REF6-3 ─┤
REF6-4 ─┤
REF6-5 ─┘
REF6-9 ── en paralelo con las P0: es la red de las que siguen
REF6-6 → REF6-7 → REF6-8 → REF6-10
REF6-11 → REF6-12 → REF6-13 → REF6-14 → REF6-15
```

`REF6-1`, `REF6-2` y `REF6-3` no comparten archivos y pueden ir en PRs paralelos. `REF6-4` y `REF6-5` tocan `syncService.ts` los dos: van en serie.

---

## Verificación

Cada tanda, antes de su PR:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

```bash
CI=1 pnpm exec playwright test
```

```bash
pnpm build && pnpm budget
```

Más `/security-review` en `REF6-1`, `REF6-2`, `REF6-6` y `REF6-7`, y `aikido:scan` sobre el código nuevo.

Al terminar cada tarea: `[x]` acá **y** entrada en [`BITACORA.md`](../../BITACORA.md).

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Cambiar el contrato de `/sync` rompe celulares con la versión vieja instalada** | Códigos nuevos (`PATROL_CLOSED`, `SIGNATURE_LOCKED`) caen en el `rejected` genérico que el cliente ya maneja; los campos nuevos de `superseded` son opcionales |
| **Aflojar el rate limit abre la fuerza bruta** | El bloqueo por cuenta sigue en 5 intentos; `REF6-6` lo refina por par (cuenta, IP) |
| **Mover el avance de patrulla al final del lote deja un número viejo si el lote falla a la mitad** | Se recalcula también en el `catch`; el test del lote mixto lo cubre |
| **Code splitting rompe WAFL offline** | El SW ya precachea todos los `.js`; el E2E `offline-recarga` lo verifica en la misma tanda |
| **El refactor de WAFA (`REF6-11`) cambia comportamiento** | Una página por PR, sin tocar tests de UI salvo por renombres |
