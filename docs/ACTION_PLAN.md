# Plan de acción — BV Bahía Archers League

Tareas pequeñas, priorizadas y **autocontenidas**. Cada una se puede tomar de forma aislada, sin leer las demás ni la conversación que las originó.

**Convención de IDs:** `INF` infra · `SH` dominio compartido · `BE` backend · `FE` frontend · `TEST` calidad.
**Prioridad:** `P0` bloqueante (MVP) → `P1` necesario → `P2` mejora.
**Estado:** `[ ]` pendiente · `[~]` en curso · `[x]` hecho.

---

## Antes de empezar cualquier tarea

1. Leer [`CLAUDE.md`](../CLAUDE.md) — reglas del proyecto.
2. Leer el documento que la tarea referencia.
3. Si la tarea toca lógica de dominio, **usar la skill `tdd`**: el test se escribe primero y se lo ve fallar.
4. Al terminar, marcar la tarea acá y **anotar en [`BITACORA.md`](BITACORA.md)** qué se hizo y qué se decidió.
5. Antes de mergear: `pnpm lint && pnpm typecheck && pnpm test`, más `/security-review` si la tarea toca auth, datos o entrada del usuario.

**Reglas que no se rompen:**
- Ninguna consulta a MongoDB fuera de `repositories/`.
- Ninguna regla de negocio fuera de `@bal/shared`.
- El servidor nunca acepta un `total` del cliente.
- Ningún `await fetch()` en el camino de anotar un puntaje.
- Ningún objeto del request llega a un filtro de Mongo sin pasar por Zod.

---

# Fase 0 — Fundaciones · P0

### `[x] INF-1` · Monorepo
**Objetivo:** dejar el repositorio listo para trabajar.
**Archivos:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `.gitignore`, `.env.example`
**Cómo:** portar la configuración de `bv-easy-archery-battle` (raíz). Cuatro paquetes: `shared`, `api`, `app`, `landing`.
**DoD:** `pnpm install` sin errores · `pnpm lint` corre · `.env.example` con todas las variables de [`CONFIG.md`](CONFIG.md) §2.
_(Hecho. `pnpm install` ok; `pnpm lint` sale 0 sobre Biome 2.5.7 con config v2 (`files.includes` con negaciones, `assist.actions.source.organizeImports`, `linter.rules.preset`). `tsconfig.base.json` con `strict` + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters` y alias `@bal/shared`. Las 22 variables de `CONFIG.md` §2 verificadas contra `.env.example`. Versiones fijadas: TS 5.9.3, Biome 2.5.7, pnpm 9.15.0.)_

### `[x] INF-2` · Scaffolds de los paquetes
**Objetivo:** los cuatro paquetes existen y compilan vacíos.
**Archivos:** `packages/{shared,api,app,landing}/package.json` + `tsconfig.json` + `src/index.ts`
**DoD:** `pnpm -r build` pasa · `pnpm -r typecheck` pasa · los nombres son `@bal/shared`, `@bal/api`, `@bal/app`, `@bal/landing`.
_(Hecho. `shared` emite a `dist` con `tsc`; `api` usa `module: NodeNext` para que `node dist/index.js` corra sin bundler (imports relativos con `.js`); `app` y `landing` con Vite 8 + React 19, `base: '/app/'` y `base: '/'` respectivamente, y proxy de `/api` en dev. `pnpm typecheck` 4/4 · `pnpm build` completo · `pnpm start` arranca · `pnpm lint` limpio sobre 25 archivos. Bundle inicial de ambos frontends: 60 KB gz (baseline de React), contra presupuestos de 150 KB y 120 KB.)_

### `[x] SH-1` · Catálogos de dominio
**Objetivo:** modalidades, categorías y estacas como única fuente de verdad.
**Archivos:** `packages/shared/src/{constants,domain,types}.ts`
**Referencia:** [`DOMAIN_WA.md`](DOMAIN_WA.md) §1, §3, §4
**Contenido:** las 4 modalidades con `defaultArrows`, `maxPerArrow`, `scoringSet`, `innerToken`, `tiebreakTokens`; las 7 categorías con su orden; el `stakeMap` por defecto.
**DoD:** exports tipados, sin `any` · un test verifica que cada modalidad tiene el set y los defaults de la tabla de `DOMAIN_WA.md` §1.
_(Hecho con TDD. `domain.ts`: tipos, tokens y catálogos (`MODALITIES`, `BOW_CATEGORIES`, `STAKES`, `UNITS`, `POSITIONS`, estados, `DomainError`). `constants.ts`: `SCORING` con las 4 modalidades escritas explícitas para poder cotejarlas contra el reglamento, `CATEGORY_INFO` con `senior` (sostiene `H3`), `DEFAULT_STAKE_MAP`, `stakeForCategory` con mapeo editable, `LEAGUE_POINTS_BY_POSITION`, `MIN_TOURNAMENTS_FOR_RANKING`. **56 tests, cobertura 100%** de líneas, ramas y funciones. Los tests se vieron fallar primero, y además se verificó que no son vacuos mutando `defaultArrows` del 3D y el `stakeMap` — ambas mutaciones detectadas.)_

### `[x] SH-2` · Scoring · **TDD**
**Objetivo:** validar y computar el puntaje de un blanco.
**Archivos:** `packages/shared/src/scoring.ts` + `tests/scoring.test.ts`
**Referencia:** [`DOMAIN_WA.md`](DOMAIN_WA.md) §1, §7 · casos en [`TESTING.md`](TESTING.md) §3.1
**Base:** portar de `bv-easy-archery-battle/packages/shared/src/scoring.ts`, renombrando `end` → `target` y agregando el token `X6`.
**API:** `tokenValue` · `isValidToken` · `validateTargetScore` · `maxTargetScore` · `maxPossibleScore` · `sortArrowsDescending`
**DoD:** todos los casos de `TESTING.md` §3.1 verdes, incluidos los cruces de token entre modalidades (`11` en sala, `X` en 3D, `7` en campo) · cobertura de ramas ≥ 95%.
_(Hecho con TDD. **107 tests en el paquete, cobertura 100%** de líneas, ramas y funciones. Los 9 cruces de token entre modalidades cubiertos. `maxPossibleScore` verificado contra el caso de referencia del brief: 6×3D(2) + 6×campo(3) + aire libre(6) + sala(3) = **330**. Guarda de prototipo con `Object.hasOwn`: sin ella un token `"toString"` pasaba por válido. Se documentó en [`DOMAIN_WA.md`](DOMAIN_WA.md) §8 qué cuenta como "10" (la `X` entra porque vale 10), que estaba ambiguo. Tres mutaciones verificadas: `tenCount` sobre el token equivocado, `lookupValue` sin guarda de prototipo, y `sortArrowsDescending` ignorando el inner — las tres detectadas.)_

### `[ ] BE-1` · Conexión e índices de MongoDB
**Objetivo:** conectar, crear índices, sembrar, resetear.
**Archivos:** `packages/api/src/db/{client,indexes,seed,reset,reconcile}.ts`, `packages/api/src/env.ts`
**Referencia:** [`TECHNICAL.md`](TECHNICAL.md) §2 · [`CONFIG.md`](CONFIG.md) §2
**Contenido:** pool a nivel de módulo (nunca por request); `createIndexes` idempotente con **todos** los índices de `TECHNICAL.md` §2; `env.ts` valida las variables con Zod y **falla el arranque** si falta una requerida en producción.
**DoD:** `db:indexes` crea todos los índices · `db:seed` crea el admin con `mustChangePassword: true` · `db:reset` **falla** si `NODE_ENV=production` · test de que arrancar sin `ADMIN_INITIAL_PASSWORD` en producción tira error.

### `[ ] BE-2` · Base de Hono y middlewares de seguridad
**Objetivo:** el servidor arranca seguro desde el primer commit.
**Archivos:** `packages/api/src/{app,index}.ts`, `src/lib/{crypto,session,csrf,tokens,errors,time}.ts`, `src/middleware/{error,security,validate,rateLimit,cache}.ts`, `src/routes/health.ts`
**Referencia:** [`SECURITY.md`](SECURITY.md) §3, §5, §10 · [`TECHNICAL.md`](TECHNICAL.md) §7
**Base:** portar de `bv-easy-archery-battle/packages/api/src/{lib,middleware}/*`.
**Contenido:** argon2id, AES-256-GCM para `PIN_ENC_KEY`, sesión con `sha256(token)`, CSRF, headers de seguridad, rate limit configurable por env, manejador de errores tipados.
**DoD:** `GET /api/health` responde 200 con `db: "ok"` · todos los headers de `SECURITY.md` §10 presentes · una mutación sin `x-csrf-token` devuelve 403 · errores en producción sin stack trace.

---

# Fase 1 — Dominio puro · P0

> Toda esta fase es **TDD estricto**. El dominio es la columna vertebral del sistema y el lugar más barato de encontrar un bug.

### `[ ] SH-3` · Armado de patrullas · **TDD** ⭐
**Objetivo:** la tarea más crítica del dominio.
**Archivos:** `packages/shared/src/patrolling.ts` + `tests/patrolling.test.ts`
**Referencia:** [`DOMAIN_WA.md`](DOMAIN_WA.md) §5 · casos en [`TESTING.md`](TESTING.md) §3.2
**API:** `buildPatrols(participants, stakeMap, targetCount): PatrolPlan` · `validatePatrols(patrols): Violation[]`
**Escribir primero** los 12 casos normativos de `TESTING.md` §3.2 (5 válidos + 7 inválidos), verlos fallar, y recién ahí implementar.
**DoD:**
- Los 12 casos normativos verdes.
- **Determinismo probado**: el mismo input barajado produce el mismo output, byte a byte.
- Ninguna patrulla generada automáticamente viola `H1..H4`.
- Sin seniors suficientes → `requiresManualReview: true` + warning `ESCUELA_SIN_SENIOR`, y **cero patrullas 100% escuela**.
- Casos extremos cubiertos: todos escuela, 2 participantes, impares en cada categoría.
- Cobertura de ramas **≥ 95%**.

### `[ ] SH-4` · Ranking de torneo · **TDD**
**Archivos:** `packages/shared/src/ranking.ts` + tests
**Referencia:** [`DOMAIN_WA.md`](DOMAIN_WA.md) §8 · [`TESTING.md`](TESTING.md) §3.3
**Base:** portar de `bv-easy-archery-battle/packages/shared/src/ranking.ts`.
**DoD:** orden y desempate (inner → 10 → menos M) correctos · **puesto compartido** verificado: dos primeros, el siguiente es 3º · ranking por categoría y por estaca.

### `[ ] SH-5` · Liga y temporada · **TDD**
**Archivos:** `packages/shared/src/league.ts` + tests
**Referencia:** [`DOMAIN_WA.md`](DOMAIN_WA.md) §9 · [`TESTING.md`](TESTING.md) §3.4
**API:** `leaguePointsForPosition` · `normalizedPct` · `buildStandings` · `sortStandings(mode)`
**DoD:** reparto 5-4-3-2-1 · puesto compartido reparte los puntos de esa posición a ambos · mínimo de 2 torneos aplicado · el mejor `%` no se pisa con uno peor · escuela rankea igual.

### `[ ] SH-6` · Estadísticas · **TDD**
**Archivos:** `packages/shared/src/stats.ts` + tests
**Referencia:** [`DOMAIN_WA.md`](DOMAIN_WA.md) §10 · [`TESTING.md`](TESTING.md) §3.5
**Base:** portar de `bv-easy-archery-battle/packages/shared/src/stats.ts`, agregando el desglose por modalidad.
**DoD:** la suma del desglose por modalidad es igual al total · mejor y peor blanco · evolución en orden.

### `[ ] SH-7` · Schemas Zod compartidos
**Archivos:** `packages/shared/src/schemas/*.ts`
**Referencia:** [`TECHNICAL.md`](TECHNICAL.md) §4
**Contenido:** `auth`, `archer`, `season`, `tournament`, `patrol`, `sync`. **Todos `.strict()`**, con longitudes y cantidades máximas.
**DoD:** un objeto con propiedad extra es rechazado · `{ $ne: null }` en un campo string es rechazado · los mismos schemas se importan desde `api`, `app` y `landing`.

---

# Fase 2 — Backend núcleo · P0

### `[ ] BE-3` · Autenticación de admin
**Archivos:** `src/routes/auth.ts`, `src/services/authService.ts`, `src/repositories/userRepo.ts`, `src/middleware/auth.ts`
**Referencia:** [`SECURITY.md`](SECURITY.md) §3.1, §8 · [`TESTING.md`](TESTING.md) §4.1
**DoD:** register no existe (el admin se siembra) · login timing-safe verificado con comparación estadística · `mustChangePassword` bloquea toda otra ruta · bloqueo tras 5 intentos · logout invalida en base · en base **no** existe el password en claro.

### `[ ] BE-4` · Arqueros y temporadas
**Archivos:** `src/routes/admin/{archers,seasons}.ts`, servicios y repositorios correspondientes
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.4, §6.5 · [`TECHNICAL.md`](TECHNICAL.md) §3.2
**DoD:** CRUD completo · archivar y restaurar · **eliminar un arquero que participó devuelve `ARCHER_IN_USE`** · búsqueda por `searchKey` normalizado · todas las rutas exigen sesión de admin.

### `[ ] BE-5` · Crear torneo ⭐
**Archivos:** `src/routes/admin/tournaments.ts`, `src/services/tournamentService.ts`, `src/repositories/{tournamentRepo,patrolRepo,participantRepo}.ts`
**Referencia:** [`ARCHITECTURE.md`](ARCHITECTURE.md) §6.1 · [`TESTING.md`](TESTING.md) §4.4
**Contenido:** transacción completa — insertar torneo → `buildPatrols` → insertar participantes con snapshot y estaca → generar PIN de 6 dígitos con `crypto.randomInt` → argon2id + AES-GCM → insertar patrullas con blanco de inicio → audit log.
**DoD:**
- `maxPossibleScore` correcto en el caso de referencia (6×3D+6×campo+1×aire libre+1×sala = **330**).
- Snapshot verificado: cambiar la categoría del arquero **no** altera el participante.
- **Rollback probado**: si el armado falla, no queda ningún documento huérfano.
- Descifrar `pinEnc` devuelve el PIN original.
- Los warnings del armado llegan en la respuesta.

### `[ ] BE-6` · Estados y edición del torneo
**Archivos:** `src/services/tournamentService.ts`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §8
**DoD:** matriz completa de transiciones; toda inválida devuelve `INVALID_STATE_TRANSITION` · editar un blanco con puntajes devuelve `TARGET_LOCKED` · editar un blanco virgen en `en_proceso` recalcula `maxPossibleScore` · eliminar solo permitido en `sin_iniciar`.

### `[ ] BE-7` · Patrullas y credenciales
**Archivos:** `src/routes/admin/patrols.ts`, `src/services/patrolService.ts`
**Referencia:** [`TECHNICAL.md`](TECHNICAL.md) §3.4 · [`SECURITY.md`](SECURITY.md) §9
**DoD:** listar patrullas con el PIN descifrado, **solo** bajo sesión de admin y con el torneo no publicado, **registrando en el audit log** · `PUT` de la distribución solo en `sin_iniciar`, devolviendo violaciones sin bloquear · regenerar PIN invalida las sesiones de esa patrulla.

### `[ ] BE-8` · Login de patrulla
**Archivos:** `src/routes/auth.ts`, `src/services/authService.ts`, `src/middleware/auth.ts`
**Referencia:** [`SECURITY.md`](SECURITY.md) §3.2, §3.3
**DoD:** solo autentica con el torneo `en_proceso` · bloqueo por patrulla **y** por IP, independientes · la sesión lleva `patrolId` y `tournamentId` · una sesión de patrulla en `/api/admin/*` devuelve 403.

### `[ ] BE-9` · Bundle de WAFL
**Archivos:** `src/routes/wafl/bundle.ts`
**Referencia:** [`TECHNICAL.md`](TECHNICAL.md) §3.5
**DoD:** devuelve todo lo del contrato, con los blancos **ordenados desde `startTargetIndex`** · incluye `serverTime` · responde en < 300 ms con 20 participantes · nunca expone datos de otra patrulla.

### `[ ] BE-10` · Sincronización ⭐⭐
**La tarea más crítica del backend.**
**Archivos:** `src/routes/wafl/sync.ts`, `src/services/syncService.ts`, `src/repositories/{scoreRepo,syncOpRepo}.ts`
**Referencia:** [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §6 · [`TESTING.md`](TESTING.md) §4.5
**Los 6 pasos por op** están especificados en `OFFLINE_SYNC.md` §6. Implementarlos en ese orden exacto.
**DoD:**
- Dedup por `_id = opId`, aprovechando el `E11000` (**sin** `findOne` previo).
- **Autorización dentro del loop**, por op: participante de otra patrulla → `rejected` + audit log.
- Validación contra la modalidad del blanco **leída del torneo en base**.
- El servidor **recalcula** los totales; enviar `total: 999` no cambia nada.
- LWW por `clientUpdatedAt`, desempate determinista por `opId` mayor.
- Rollups actualizados por delta en la **misma transacción**.
- **El batch nunca falla entero**: siempre 200 con el resultado individual de cada op.
- Batch de 200 ops procesado sin caer en rate limit.
- Todos los casos de `TESTING.md` §4.5 verdes.

### `[ ] BE-11` · Firmas y cierre de circuito
**Archivos:** `src/services/signatureService.ts`
**Referencia:** [`SECURITY.md`](SECURITY.md) §7 · [`TESTING.md`](TESTING.md) §4.6
**DoD:** `scorecardHash` calculado **server-side** · modificar un score post-firma → `SIGNATURE_MISMATCH` al cerrar · cerrar sin todas las firmas → `SIGNATURES_MISSING` · cerrar sin todos los blancos → rechazado · la última patrulla cerrada pasa el torneo a `completado` · desbloqueo del admin registra `unlockedBy`, `unlockReason` y audit log · un PNG falso es rechazado (magic bytes).

### `[ ] BE-12` · Publicar y despublicar
**Archivos:** `src/services/publishService.ts`, `src/repositories/standingRepo.ts`
**Referencia:** [`ARCHITECTURE.md`](ARCHITECTURE.md) §6.5 · [`TESTING.md`](TESTING.md) §4.7
**DoD:** transacción que materializa `standings` · publicar dos veces **nunca** duplica puntos · **despublicar revierte exactamente** al estado previo (verificado comparando snapshots) · invalida la caché pública · audit log en ambas.

### `[ ] BE-13` · Endpoints públicos
**Archivos:** `src/routes/public/*.ts`, `src/services/{rankingService,statsService}.ts`
**Referencia:** [`TECHNICAL.md`](TECHNICAL.md) §3.6
**DoD:** un torneo no publicado **no** expone puntajes · el ranking excluye a quienes tienen < 2 torneos y los devuelve en una lista aparte · `Cache-Control` + `ETag` · caché en memoria invalidada al publicar · p95 < 200 ms · `explain()` sin `COLLSCAN`.

---

# Fase 3 — WAFL · P0 · **la app crítica**

### `[ ] FE-1` · Bootstrap de la PWA
**Archivos:** `packages/app/{vite.config.ts,index.html}`, `src/{main,App,theme}.tsx`, `src/styles/index.css`, `public/*`
**Referencia:** [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) · [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §8
**Contenido:** Vite + React + Tailwind 4 + tokens CSS del design system + tema claro/oscuro con anti-FOUC (**hash en CSP**, no `unsafe-inline`) + VitePWA con **`registerType: 'prompt'`** y `scope: '/app/'` + fuentes autohospedadas.
**DoD:** la app monta · conmutador de tema funciona sin parpadeo · manifest válido y app instalable · `registerType` es `prompt`, verificado en un test · versión visible en la UI.

### `[ ] FE-2` · Capa offline ⭐⭐
**La tarea más crítica del frontend.**
**Archivos:** `src/offline/{db,outbox,syncWorker,useSyncStatus}.ts`
**Referencia:** [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §3, §4, §5
**Contenido:** esquema de IndexedDB con `idb` · `writeScore` / `writeSignature` / `requestClose` escribiendo score **y** op en **una sola transacción de IndexedDB** · `syncWorker` con backoff, jitter y los cuatro disparadores · corrección de reloj con `clockSkewMs` · `navigator.storage.persist()`.
**DoD:**
- Escribir con `onLine === false` persiste y encola, sin error.
- El outbox sobrevive a remontaje, recarga y actualización del service worker.
- Un **401 no descarta ops**.
- Backoff exponencial con jitter verificado.
- `nudge()` **no se espera con `await`** desde la UI.
- Todos los casos de `TESTING.md` §5.3 verdes.
- Cobertura ≥ 90%.

### `[ ] FE-3` · Infraestructura de frontend
**Archivos:** `src/lib/{apiClient,queryClient,cn,errorMessage}.ts`, `src/auth/{useSession,AdminRoute,PatrolRoute}.tsx`, `src/components/{AppShell,ui/*}.tsx`
**Base:** portar de `bv-easy-archery-battle/packages/web/src/{lib,auth,components/ui}`.
**DoD:** `apiClient` adjunta el token CSRF automáticamente · rutas protegidas por rol redirigen correctamente · componentes de UI con los tokens del design system.

### `[ ] FE-4` · Login de WAFL
**Archivos:** `src/wafl/pages/Login.tsx`
**DoD:** entra con usuario y PIN, descarga el bundle y lo persiste en IndexedDB · con el bundle ya presente permite entrar **sin conexión**, avisando la fecha de los datos · errores claros: torneo no iniciado, credencial incorrecta, bloqueo temporal.

### `[ ] FE-5` · Home de WAFL — el circuito
**Archivos:** `src/wafl/pages/Circuit.tsx`, `src/wafl/components/{CircuitRing,SyncBadge}.tsx`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §7.2 · [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §6.4, §6.5
**DoD:** los blancos aparecen **ordenados desde el de inicio** de la patrulla · cada uno con número, glifo de modalidad, flechas y estado · `SyncBadge` fijo con los cuatro estados · `CircuitRing` refleja el avance real · todo leído de IndexedDB.

### `[ ] FE-6` · Página de blanco y teclado ⭐
**Archivos:** `src/wafl/pages/Target.tsx`, `src/wafl/components/{ScoreKeypad,ArrowRow,UnitCard,TargetHeader}.tsx`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §7.3 · [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §6.1, §7 · [`TESTING.md`](TESTING.md) §5.1, §5.2
**DoD:**
- El teclado ofrece **los tokens de la modalidad de ese blanco**.
- Disposición en arcos para 3D y campo, grilla para sala y aire libre, **detrás de una prop** para poder cambiar con una línea.
- Flechas ordenadas de mayor a menor.
- Se puede corregir una flecha cargada.
- **Cada toque escribe en IndexedDB. Sin `await fetch`. Sin spinner.**
- Continuar deshabilitado hasta que todos tengan puntaje, indicando quién falta.
- Objetivos táctiles **≥ 56px verificados sobre estilos computados** en un test.
- Feedback háptico donde esté disponible.

### `[ ] FE-7` · Seguimiento y resultados finales
**Archivos:** `src/wafl/pages/{Progress,FinalResults}.tsx`
**DoD:** puntaje acumulado, `X`, `10`, `M` y desglose por blanco de cada arquero · resultados finales habilitados solo con el recorrido completo · todo desde IndexedDB.

### `[ ] FE-8` · Firma y cierre
**Archivos:** `src/wafl/pages/Sign.tsx`, `src/wafl/components/SignaturePad.tsx`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §7.5 · [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §5.5
**DoD:** canvas captura el trazo y genera PNG · el puntaje que se firma está visible sobre el canvas · Finalizar habilitado solo con todas las firmas · **el cierre se bloquea si hay ops pendientes**, mostrando el progreso de sincronización · sin señal, avisa que hace falta conexión aclarando que los puntajes ya están guardados.

---

# Fase 4 — WAFA · P0 / P1

### `[ ] FE-9` · Login y cambio de password · P0
**Archivos:** `src/wafa/pages/{Login,ChangePassword}.tsx`
**DoD:** `mustChangePassword` redirige y **no deja navegar** a ninguna otra ruta hasta cambiarlo · mínimo 12 caracteres validado en cliente y servidor.

### `[ ] FE-10` · Home de WAFA · P0
**Archivos:** `src/wafa/pages/Home.tsx`
**DoD:** torneos agrupados por estado · accesos a crear torneo, arqueros y temporadas.

### `[ ] FE-11` · Crear torneo (wizard) · P0
**Archivos:** `src/wafa/pages/TournamentCreate.tsx` + componentes de paso
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.3 · [`TESTING.md`](TESTING.md) §5.5
**DoD:** los 4 pasos · las flechas se precargan con el default al elegir la modalidad de cada blanco · se pueden reordenar, agregar y eliminar blancos · **el máximo posible se actualiza en vivo** · se pueden crear arqueros sin salir del wizard · paso de revisión editable.

### `[ ] FE-12` · Arqueros y temporadas · P0
**Archivos:** `src/wafa/pages/{Archers,ArcherForm,Seasons}.tsx`
**DoD:** CRUD, archivar, restaurar, búsqueda · eliminar deshabilitado con explicación si el arquero participó.

### `[ ] FE-13` · Patrullas y credenciales · P0
**Archivos:** `src/wafa/pages/Patrols.tsx`, `src/wafa/components/PatrolEditor.tsx`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.6
**DoD:** composición completa con unidades, posiciones, estacas y blanco de inicio · edición manual solo en `sin_iniciar` · **validador en vivo que muestra las violaciones sin bloquear el guardado** · credenciales visibles con botón de regenerar · vista imprimible para repartir en el club.

### `[ ] FE-14` · Detalle y seguimiento del torneo · P0
**Archivos:** `src/wafa/pages/Tournament.tsx`
**DoD:** vista por estado según `FUNCTIONAL.md` §6.7 · avance por patrulla · un blanco con puntajes aparece bloqueado con explicación · desbloqueo de firma pidiendo motivo.

### `[ ] FE-15` · Publicar · P0
**Archivos:** `src/wafa/pages/Publish.tsx`
**DoD:** vista previa de podios y de los puntos de liga que se aplicarían · confirmación explícita · despublicar disponible con advertencia clara de lo que revierte.

### `[ ] FE-16` · Ranking en WAFA · P1
**Archivos:** `src/wafa/pages/Ranking.tsx`
**DoD:** mismos datos y modos que la landing.

---

# Fase 5 — Landing · P1

### `[ ] FE-17` · Bootstrap de la landing
**Archivos:** `packages/landing/*`
**DoD:** Vite + React + tokens compartidos · **sin service worker** · JS inicial < 120 KB gz · LCP < 2.5 s.

### `[ ] FE-18` · Introducción y ranking
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §5.1, §5.2
**DoD:** accesos a WAFA y WAFL · ranking por categoría con los dos modos y selector de temporada · los de < 2 torneos en una lista aparte con la explicación del requisito.

### `[ ] FE-19` · Torneos
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §5.3
**DoD:** listado y detalle · un torneo en proceso muestra patrullas y avance, **nunca puntajes**.

### `[ ] FE-20` · Ficha de arquero
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §5.4
**DoD:** estadísticas históricas y evolución torneo a torneo.

---

# Fase 6 — Calidad, seguridad y deploy

### `[ ] TEST-1` · E2E con tramo offline · **P0** ⭐
**Archivos:** `packages/app/tests/e2e/flujo-completo.spec.ts`, `playwright.config.ts`
**Referencia:** [`TESTING.md`](TESTING.md) §6
**DoD:** los 23 pasos del flujo, **incluyendo `context.setOffline(true)` para cargar el recorrido completo sin conexión** y la verificación de que todo sincroniza al reconectar · verde en CI.

### `[ ] TEST-2` · E2E de escenarios adicionales · P1
**DoD:** los 5 escenarios de `TESTING.md` §6 (recarga offline, dos dispositivos, sesión vencida, blanco bloqueado, PWA instalable).

### `[ ] BE-14` · Auditoría de seguridad · **P0**
**Referencia:** [`SECURITY.md`](SECURITY.md) §13
**DoD:** **el checklist completo de `SECURITY.md` §13 verde**, cada ítem con su test · `/security-review` sobre el diff sin HIGH ni MEDIUM · `aikido:scan` limpio.

### `[ ] FE-21` · Auditoría de UI y accesibilidad · P1
**Referencia:** [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §11
**DoD:** skills `web-design-guidelines` y `audit-website` sin issues críticos · contraste verificado en ambos temas · objetivos táctiles medidos · probado en Android e iPhone reales.

### `[ ] INF-3` · Dockerfile · P0
**Referencia:** [`CONFIG.md`](CONFIG.md) §6
**DoD:** multi-stage · imagen final slim, **usuario no root**, sin toolchain · sirve `/api` + `/app` + `/` · `HEALTHCHECK` a `/api/health` · `.dockerignore` correcto.

### `[ ] INF-4` · Deploy en Railway · P0
**Referencia:** [`CONFIG.md`](CONFIG.md) §7
**DoD:** `railway.json` · desplegado y accesible por HTTPS · variables seteadas · healthcheck verde · **checklist de puesta en producción de `CONFIG.md` §10 completo**.

### `[ ] INF-5` · CI · P0
**Referencia:** [`CONFIG.md`](CONFIG.md) §8
**DoD:** los 4 jobs (`quality`, `e2e`, `audit`, `budget`) · bloquean el merge según `TESTING.md` §8 · umbrales de cobertura aplicados.

### `[ ] INF-6` · Backups · P1
**Referencia:** [`CONFIG.md`](CONFIG.md) §9
**DoD:** procedimiento documentado y **restauración verificada al menos una vez**.

---

# Fase 7 — Mejoras · P2

- `[ ] FE-22` QR de acceso a patrulla (elimina la necesidad de mostrar el PIN — ver [`SECURITY.md`](SECURITY.md) §9).
- `[ ] FE-23` Exportar y compartir podios (Web Share API + impresión).
- `[ ] FE-24` Gráficos de evolución en la ficha de arquero (SVG puro, sin dependencias).
- `[ ] FE-25` Comparativas entre arqueros y contra el promedio de la categoría.
- `[ ] BE-15` Exportación del torneo a CSV.
- `[ ] FE-26` Modo pantalla grande para proyectar resultados en el club.
- `[ ] INF-7` Migrar a **TypeScript 7** (reescritura nativa). Verificar antes que Vite, Vitest y Biome lo soporten. **DoD:** `pnpm typecheck` y `pnpm test` verdes en los cuatro paquetes; tiempo de compilación medido antes y después. Ver [`BITACORA.md`](BITACORA.md), entrada `INF-1`.

---

## Orden recomendado de ejecución

**Camino crítico** — lo que sostiene todo lo demás:

```
INF-1 → INF-2 → SH-1 → SH-2 → SH-3 → BE-1 → BE-2 → BE-5 → BE-8 → BE-9 → BE-10
   → FE-1 → FE-2 → FE-4 → FE-5 → FE-6 → BE-11 → FE-8 → TEST-1
```

**En paralelo, sin bloquear el camino crítico:**
- `SH-4`, `SH-5`, `SH-6`, `SH-7` — apenas termine `SH-2`.
- `BE-3`, `BE-4`, `BE-6`, `BE-7` — apenas termine `BE-2`.
- `FE-3`, `FE-9`..`FE-16` (WAFA) — apenas termine `FE-1`.
- `BE-12`, `BE-13`, `FE-17`..`FE-20` (landing) — después de `BE-11`.
- `INF-3`, `INF-5` — en cualquier momento después de `INF-2`.

**Cuatro tareas mandan sobre el resto:** `SH-3` (patrullas), `BE-10` (sync), `FE-2` (offline) y `FE-6` (teclado). Son las que definen si la app funciona el día del torneo. Se les da el tiempo que pidan y se cubren con tests antes de construir nada encima.

---

## Definición de terminado — aplica a toda tarea

- [ ] Los tests especificados en el DoD de la tarea, verdes.
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` verdes.
- [ ] Sin `any` sin justificar. Sin `console.log` olvidados.
- [ ] Sin SQL/Mongo fuera de `repositories/`. Sin reglas de negocio fuera de `shared`.
- [ ] `/security-review` si la tarea toca auth, datos o entrada del usuario.
- [ ] Tarea marcada `[x]` acá **y** anotada en [`BITACORA.md`](BITACORA.md).
