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

### `[ ] REF6-4` · El celular muestra lo que tiene el servidor · **P0** · M

**Hallazgos:** `U-2`, `U-3`, `P-2`. **Skill:** `tdd`.
**Archivos:** `app/src/wafl/sesion.ts`, `app/src/offline/syncWorker.ts`, `api/src/services/syncService.ts`, `app/src/offline/offline.test.ts`, `e2e/dos-dispositivos.spec.ts`

- [ ] `sembrarPuntajes` recomputa inner, X, 10 y M con `validateTargetScore` y la modalidad del blanco del bundle
- [ ] `superseded` devuelve las flechas ganadoras; el cliente las escribe como `synced`
- [ ] `duplicate` marca el puntaje local como `synced`
- [ ] El POST de sync lleva `AbortSignal.timeout(20_000)`; el aborto es reintentable

**DoD:** tras cambiar de celular, la pantalla de resultados muestra los mismos X/10/M que el servidor · después de un conflicto, **los dos** dispositivos muestran el puntaje ganador · un request colgado no traba el outbox más de 20 s.
**Tests:** re-sembrar un blanco con `X` y `M` → conteos correctos · `superseded` pisa lo local · `duplicate` deja `synced` · `post` que nunca resuelve → a los 20 s se programa reintento · el E2E de dos dispositivos compara las dos pantallas.
**Mutaciones:** dejar los conteos en 0 · ignorar `superseded` · sacar el timeout.

> Es la pantalla que el arquero mira **para firmar**. Lo que ve tiene que ser lo que se guarda.

---

### `[ ] REF6-5` · Sync que aguanta la latencia · **P0** · M

**Hallazgos:** `P-1`, `T-5` (parcial). **Skill:** `tdd`.
**Archivos:** `api/src/services/syncService.ts`, `api/src/repositories/scoreRepo.ts`, `api/tests/` (benchmark nuevo), `docs/CONFIG.md` §7

- [ ] El avance de la patrulla (`targetsCompleted`) se calcula **una vez por lote**, al final, y no dentro de cada op
- [ ] Las transacciones por op se mantienen: el aislamiento de fallas no se negocia
- [ ] Benchmark de un lote de 50 ops con latencia inyectada a la base, con umbral
- [ ] `CONFIG.md` exige Railway y Atlas en la misma región, y dice cómo verificarlo

**DoD:** viajes a la base por op de score de ~10 a ≤ 6 · lote de 20 ops < 400 ms p95 en misma región (`TECHNICAL.md` §5) · el avance de la patrulla sigue siendo exacto.
**Tests:** el «7 de 8» de siempre sigue verde · un lote mixto (scores de varios blancos + una op rechazada) deja `targetsCompleted` correcto · benchmark con umbral.
**Mutaciones:** no recalcular al final del lote · recalcular sólo si todas las ops se aplicaron.

---

# P1 — Necesario

### `[ ] REF6-6` · Entradas públicas endurecidas · **P1** · M

**Hallazgos:** `S-4`, `S-5`, `S-6`. **Skill:** `tdd`, `/security-review`.
**Archivos:** `api/src/app.ts`, `api/src/middleware/validate.ts`, `api/src/routes/publico.ts`, `api/src/services/{archerService,authService,patrolAuthService}.ts`, `api/src/repositories/{userRepo,patrolRepo}.ts`, `landing/src/pages/ArcherRegister.tsx`

- [ ] `bodyLimit` de Hono sobre `/api/*`: 1 MB en sync, 64 KB en el resto
- [ ] Alta pública: misma respuesta para DNI nuevo y repetido *(decisión 2)*; el duplicado se marca para el admin
- [ ] Rate limit propio de `POST /api/public/archers` y campo *honeypot*
- [ ] Bloqueo por **(cuenta, IP)** con backoff progresivo, para admin y patrulla
- [ ] El bloqueo por cuenta **reserva el intento al entrar** (hoy lo evalúa antes de verificar y lo anota después, y una ráfaga contra una cuenta pasa de cinco; `REF6-2` ya lo corrigió para el cupo de la IP, no para esto)

**DoD:** un body chunked de 5 MB se corta sin leerse entero · el alta no revela si un DNI existe · cinco intentos desde una IP no bloquean a la cuenta desde otra.
**Tests:** body chunked sin `Content-Length` → 413 · respuesta idéntica en los dos casos de DNI · honeypot lleno → descartado sin error visible · bloqueo por par.
**Mutaciones:** chequear sólo `Content-Length` · devolver `ARCHER_DNI_DUPLICATE`.

---

### `[ ] REF6-7` · PIN y audit log · **P1** · M

**Hallazgos:** `S-7`, `S-9`, `C-7`, `U-6`.
**Archivos:** `api/src/routes/admin.ts`, `api/src/services/{patrolAdminService,tournamentEditService,tournamentStateService,paymentService,archerService,authService}.ts`, `api/src/services/syncService.ts`, `app/src/wafa/pages/{Tournament,Patrols}.tsx`

- [ ] `GET /patrols` sin PIN por defecto; los PIN, sólo desde la pantalla de credenciales
- [ ] Se auditan: borrar torneo, iniciar y volver atrás, marcar pago, CRUD de arqueros y temporadas, login de admin
- [ ] El cierre se registra como `patrol.close`
- [ ] El seguimiento del torneo se refresca cada 30 s mientras la pestaña está visible

**DoD:** abrir el seguimiento no escribe `patrol.pin.reveal` ni recibe un PIN · cada acción listada deja su entrada con actor e IP.
**Tests:** `/patrols` sin parámetro no trae `pin` · cada acción auditada tiene su test · el refresco se pausa en `hidden`.

---

### `[ ] REF6-8` · Entrega de assets y PWA · **P1** · M

**Hallazgos:** `P-3`, `P-4`, `P-5`, `U-4`, `S-8`.
**Archivos:** `api/src/middleware/estaticos.ts`, `app/vite.config.ts`, `landing/vite.config.ts`, `app/src/App.tsx`, `landing/src/App.tsx`, `app/public/` (íconos), `scripts/presupuesto.mjs`

- [ ] Compresión: precomprimir en el build y `serveStatic({ precompressed: true })`; `compress` para el JSON — **primero verificar si el borde de Railway ya comprime**
- [ ] `Cache-Control`: `immutable` para `/assets/*`, `no-cache` para `index.html`, `sw.js` y el manifest; `index.html` en memoria
- [ ] `React.lazy` para `WafaApp`, `WaflApp` y las rutas pesadas de la landing
- [ ] `globPatterns` incluye `webp` y `png`; manifest con PNG 192/512, maskable aparte y `apple-touch-icon`; `theme_color` coherente
- [ ] Se borra `runtimeCaching`

**DoD:** WAFL no descarga el código de WAFA · el logo del CBA se ve sin señal · Lighthouse «installable» en verde · los presupuestos se miden sobre el chunk inicial.
**Tests:** E2E offline verifica que todas las imágenes del login de WAFL cargan · `presupuesto.mjs` falla si WAFL inicial supera su presupuesto · test de headers de caché en `estaticos.test.ts`.
**Mutaciones:** volver al import estático · sacar `webp` del glob.

---

### `[ ] REF6-9` · Cobertura que bloquea y E2E en celular · **P1** · M

**Hallazgos:** `T-1`, `T-2`, `T-6`.
**Archivos:** `*/vitest.config.ts`, `*/package.json`, `.github/workflows/ci.yml`, `playwright.config.ts`

- [ ] `thresholds` por glob según `TESTING.md` §8 en `api` y `app`
- [ ] El job `quality` corre `test:coverage` en todos los paquetes
- [ ] Subir `offline/` a 85% de ramas y `middleware/auth` a 100%
- [ ] Proyectos `Pixel 7` y `iPhone 14` (WebKit) para `offline-recarga`, `objetivos-tactiles` y un flujo corto
- [ ] Fuera `--passWithNoTests`

**DoD:** bajar la cobertura de `offline/` rompe el CI · los E2E móviles corren en cada PR.
**Mutaciones:** borrar un test de `offline/` → CI rojo.

> Es lo que habría encontrado `REF6-4` antes que esta auditoría.

---

### `[ ] REF6-10` · La regla 3 sin excepciones · **P1** · S

**Hallazgo:** `B-1`.
**Archivos:** `api/src/routes/{publico,admin}.ts`, `api/src/services/` (`rankingService.ts`, `tournamentQueryService.ts` nuevos), `scripts/verificar-capas.mjs` (nuevo), `.github/workflows/ci.yml`

- [ ] `GET /public/seasons` usa `seasonRepo.list()`
- [ ] El armado del ranking público y las lecturas de torneo de `admin.ts` pasan a servicios
- [ ] Un script de CI falla si algo fuera de `repositories/` y `db/` importa `db/client`

**DoD:** cero imports de `db/client` fuera de las capas permitidas, verificado en CI · las respuestas no cambian un byte.
**Tests:** los de rutas existentes, sin tocar · el script falla con el import actual de `publico.ts`.

---

# P2 — Mejora

### `[ ] REF6-11` · WAFA: páginas chicas y contratos tipados · **P2** · L

**Hallazgos:** `C-1`, `C-2`, `C-3`, `C-4`. **Skill:** `vercel-react-best-practices`.

- [ ] Un hook de carga común para WAFA *(decisión 3)*; fuera `@tanstack/react-query`
- [ ] `Tournament`, `Archers`, `TournamentCreate` y `Patrols` partidos en subcomponentes y hooks; sin warning de complejidad
- [ ] Tipos de respuesta de punta a punta: `AppType` exportado y cliente RPC de Hono, o DTOs en un paquete compartido
- [ ] Un solo cliente HTTP con CSRF y un solo `ApiError`

**DoD:** ninguna página de WAFA pasa de 250 líneas · cambiar el nombre de un campo en una ruta rompe el `typecheck` del frontend · los tests de UI existentes siguen verdes sin cambios de comportamiento.
**Riesgo:** refactor amplio sin cambio funcional — una página por PR, con los tests de UI como red.

---

### `[ ] REF6-12` · Navegación accesible y pantalla encendida · **P2** · S

**Hallazgos:** `U-5`, `U-7`. **Skill:** `web-design-guidelines`.

- [ ] `useTituloDePagina` en cada ruta de la landing y de WAFA
- [ ] Al cambiar de ruta: `scrollTop` del contenedor a 0 y foco al `h1`
- [ ] Wake Lock en `TargetPage`, re-adquirido en `visibilitychange` *(decisión 4)*

**DoD:** cada pantalla tiene su título · se entra a cada página desde arriba · la pantalla no se apaga mientras se anota un blanco.
**Tests:** título por ruta · scroll en 0 tras navegar desde una página scrolleada · wake lock pedido al montar y liberado al desmontar.

---

### `[ ] REF6-13` · Limpieza del backend · **P2** · M

**Hallazgos:** `B-3`, `B-4`, `B-5`, `C-5`, `C-6`, `P-6`.

- [ ] Apagado ordenado: esperar `server.close` con plazo de gracia antes de `disconnect`
- [ ] Dedup de sync con estado `processing` y reproceso tras 30 s
- [ ] Logger estructurado que respete `LOG_LEVEL`; una línea por lote de sync con ops, duración y rechazos
- [ ] `esClaveDuplicada(error)` con `MongoServerError.code === 11000`
- [ ] Fuera `validateBody`, `WEB_DIST_*` y `VITE_APP_NAME`
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
