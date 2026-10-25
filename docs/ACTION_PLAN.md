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

### `[x] BE-1` · Conexión e índices de MongoDB
_(Hecho. `env.ts` valida con Zod y reúne **todos** los problemas juntos; en producción rechaza los valores de desarrollo del `.env.example`. `client.ts` con pool a nivel de módulo y accesores tipados por colección. `indexes.ts` con los 26 índices de [`TECHNICAL.md`](TECHNICAL.md) §2, idempotente. `seed.ts` idempotente que **no pisa** un password ya cambiado. `reset.ts` que falla en producción sin flag para forzarlo. `reconcile.ts` que recomputa los rollups desde `scores`. `lib/crypto.ts` con argon2id, AES-256-GCM para el PIN, `sha256` y generación de tokens. **29 tests contra un MongoDB real en modo replica set**, con transacciones verificadas. Se encontró y corrigió un bug latente: el build de `@bal/shared` era incargable por Node — ver [`BITACORA.md`](BITACORA.md).)_
**Objetivo:** conectar, crear índices, sembrar, resetear.
**Archivos:** `packages/api/src/db/{client,indexes,seed,reset,reconcile}.ts`, `packages/api/src/env.ts`
**Referencia:** [`TECHNICAL.md`](TECHNICAL.md) §2 · [`CONFIG.md`](CONFIG.md) §2
**Contenido:** pool a nivel de módulo (nunca por request); `createIndexes` idempotente con **todos** los índices de `TECHNICAL.md` §2; `env.ts` valida las variables con Zod y **falla el arranque** si falta una requerida en producción.
**DoD:** `db:indexes` crea todos los índices · `db:seed` crea el admin con `mustChangePassword: true` · `db:reset` **falla** si `NODE_ENV=production` · test de que arrancar sin `ADMIN_INITIAL_PASSWORD` en producción tira error.

### `[x] BE-2` · Base de Hono y middlewares de seguridad
_(Hecho. `app.ts` con el orden de middlewares documentado, `index.ts` con arranque y apagado ordenado, `lib/{errors,csrf}.ts`, `middleware/{error,security,csrf,rateLimit,validate,cache}.ts` y `routes/health.ts`. **56 tests**, que cubren la parte de esta capa del checklist de [`SECURITY.md`](SECURITY.md) §13. Hallazgo: en Hono los errores del handler **no se propagan** a un `try/catch` en middleware — se enganchan con `app.onError`. El healthcheck queda **fuera** del rate limit a propósito. Ver [`BITACORA.md`](BITACORA.md).)_
**Objetivo:** el servidor arranca seguro desde el primer commit.
**Archivos:** `packages/api/src/{app,index}.ts`, `src/lib/{crypto,session,csrf,tokens,errors,time}.ts`, `src/middleware/{error,security,validate,rateLimit,cache}.ts`, `src/routes/health.ts`
**Referencia:** [`SECURITY.md`](SECURITY.md) §3, §5, §10 · [`TECHNICAL.md`](TECHNICAL.md) §7
**Base:** portar de `bv-easy-archery-battle/packages/api/src/{lib,middleware}/*`.
**Contenido:** argon2id, AES-256-GCM para `PIN_ENC_KEY`, sesión con `sha256(token)`, CSRF, headers de seguridad, rate limit configurable por env, manejador de errores tipados.
**DoD:** `GET /api/health` responde 200 con `db: "ok"` · todos los headers de `SECURITY.md` §10 presentes · una mutación sin `x-csrf-token` devuelve 403 · errores en producción sin stack trace.

---

# Fase 1 — Dominio puro · P0

> Toda esta fase es **TDD estricto**. El dominio es la columna vertebral del sistema y el lugar más barato de encontrar un bug.

### `[x] SH-3` · Armado de patrullas · **TDD** ⭐
_(Hecho. **152 tests en el paquete, cobertura 100%** de líneas, ramas y funciones. Los 12 casos normativos verdes, determinismo probado con el input barajado, y los casos extremos cubiertos. Dos reglas que el documento no explicitaba y que el código descubrió: escuela toma primero las unidades senior **solitarias** (consumir las de a dos deja solitarias huérfanas), y una unidad solitaria sólo puede llevarse una de a dos si la paridad del resto cierra. Ambas documentadas en [`DOMAIN_WA.md`](DOMAIN_WA.md) §5. Los arqueros que no se pueden ubicar quedan en `unassigned` con warning, en vez de perderse. Cinco mutaciones probadas: tres detectadas, una era un hueco real que se cubrió, y una resultó equivalente — ver [`BITACORA.md`](BITACORA.md).)_

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

### `[x] SH-4` · Ranking de torneo · **TDD**
_(Hecho. `compareForRanking`, `rankParticipants`, `rankByCategory`, `rankByStake`, `rankAllByCategory`. Puesto compartido verificado: 1, 2, 2, **4**. Los participantes `ausente` quedan afuera del podio. Se extrajo `text.ts` con la comparación determinista sin `localeCompare`, que `patrolling.ts` tenía duplicada.)_
**Archivos:** `packages/shared/src/ranking.ts` + tests
**Referencia:** [`DOMAIN_WA.md`](DOMAIN_WA.md) §8 · [`TESTING.md`](TESTING.md) §3.3
**Base:** portar de `bv-easy-archery-battle/packages/shared/src/ranking.ts`.
**DoD:** orden y desempate (inner → 10 → menos M) correctos · **puesto compartido** verificado: dos primeros, el siguiente es 3º · ranking por categoría y por estaca.

### `[x] SH-5` · Liga y temporada · **TDD**
_(Hecho. `leaguePointsForPosition`, `normalizedPct`, `applyTournamentToStandings`, `eligibleForRanking`, `sortStandings`. **204 tests en el paquete, cobertura 100%** de líneas, ramas y funciones. El puesto compartido reparte los puntos de esa posición a todos los empatados y el siguiente salta: dos primeros con 5 cada uno, el tercero con 3. El mejor puntaje se compara por **porcentaje**, no por bruto. Los que no llegan al mínimo de 2 torneos van en `notYetEligible`, no se ocultan. Cinco mutaciones probadas, las cinco detectadas.)_
**Archivos:** `packages/shared/src/league.ts` + tests
**Referencia:** [`DOMAIN_WA.md`](DOMAIN_WA.md) §9 · [`TESTING.md`](TESTING.md) §3.4
**API:** `leaguePointsForPosition` · `normalizedPct` · `buildStandings` · `sortStandings(mode)`
**DoD:** reparto 5-4-3-2-1 · puesto compartido reparte los puntos de esa posición a ambos · mínimo de 2 torneos aplicado · el mejor `%` no se pisa con uno peor · escuela rankea igual.

### `[x] SH-6` · Estadísticas · **TDD**
_(Hecho. `participantStats`, `tournamentStats`, `patrolProgress`, `archerCareerStats`. **301 tests en el paquete, cobertura 100%** de líneas, ramas y funciones. **Mejor y peor se miden en porcentaje, nunca en bruto**: un blanco 3D tiene techo 22 y uno de sala 30, así que comparar brutos entre modalidades es el mismo error que comparar torneos entre sí. La evolución respeta el orden en que se tiró, no el número de blanco: la patrulla que arranca en el 7 tiró el 7 primero. El avance de una patrulla es el del arquero **más atrasado**. Los ausentes no entran en los promedios. Un token que no pertenece a la modalidad **revienta** en vez de valer 0: el dato ya pasó por la validación del servidor, así que sólo puede ser corrupción, y un total equivocado con cara de correcto es peor que un error. Nueve mutaciones probadas, las nueve detectadas.)_
**Archivos:** `packages/shared/src/stats.ts` + tests
**Referencia:** [`DOMAIN_WA.md`](DOMAIN_WA.md) §10 · [`TESTING.md`](TESTING.md) §3.5
**Base:** portar de `bv-easy-archery-battle/packages/shared/src/stats.ts`, agregando el desglose por modalidad.
**DoD:** la suma del desglose por modalidad es igual al total · mejor y peor blanco · evolución en orden.

### `[x] SH-7` · Schemas Zod compartidos
_(Hecho. `schemas.ts` con auth, padrón, temporadas, torneo, patrullas y sincronización. **Todos `z.strictObject`**, con topes de largo y de cantidad. **272 tests en el paquete, cobertura 100%.** Los cuatro schemas que reciben identificadores rechazan `{ $ne: null }`, verificado con test. Los tokens de flecha **no** se validan acá contra una lista fija: dependen de la modalidad del blanco, que el servidor lee del torneo. Verificado que los tres paquetes (`api`, `app`, `landing`) los importan desde el build. Se movieron `MIN/MAX_PATROL_SIZE` a `constants.ts`, ver [`BITACORA.md`](BITACORA.md).)_
**Archivos:** `packages/shared/src/schemas/*.ts`
**Referencia:** [`TECHNICAL.md`](TECHNICAL.md) §4
**Contenido:** `auth`, `archer`, `season`, `tournament`, `patrol`, `sync`. **Todos `.strict()`**, con longitudes y cantidades máximas.
**DoD:** un objeto con propiedad extra es rechazado · `{ $ne: null }` en un campo string es rechazado · los mismos schemas se importan desde `api`, `app` y `landing`.

---

# Fase 2 — Backend núcleo · P0

### `[x] BE-3` · Autenticación de admin
_(Hecho. `userRepo`, `sessionRepo`, `lib/session.ts`, `middleware/auth.ts`, `authService`, `routes/auth.ts`. **83 tests en `@bal/api`.** Login timing-safe verificado **midiendo tiempos**, no sólo por inspección. Bloqueo tras 5 intentos que rechaza incluso el password correcto. `mustChangePassword` bloquea toda ruta protegida con 403 salvo el propio cambio. Cambiar el password **invalida las demás sesiones**. Logout invalida en la base, no sólo la cookie. Seis mutaciones probadas, las seis detectadas.)_
**Archivos:** `src/routes/auth.ts`, `src/services/authService.ts`, `src/repositories/userRepo.ts`, `src/middleware/auth.ts`
**Referencia:** [`SECURITY.md`](SECURITY.md) §3.1, §8 · [`TESTING.md`](TESTING.md) §4.1
**DoD:** register no existe (el admin se siembra) · login timing-safe verificado con comparación estadística · `mustChangePassword` bloquea toda otra ruta · bloqueo tras 5 intentos · logout invalida en base · en base **no** existe el password en claro.

### `[x] BE-4` · Arqueros y temporadas
_(Hecho. CRUD de arqueros y temporadas, archivar y restaurar, búsqueda normalizada sin acentos. **Eliminar un arquero que participó devuelve `ARCHER_IN_USE`**, verificado. Los metacaracteres del término de búsqueda se escapan: sin eso una regex del usuario es un vector de ReDoS.)_
**Archivos:** `src/routes/admin/{archers,seasons}.ts`, servicios y repositorios correspondientes
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.4, §6.5 · [`TECHNICAL.md`](TECHNICAL.md) §3.2
**DoD:** CRUD completo · archivar y restaurar · **eliminar un arquero que participó devuelve `ARCHER_IN_USE`** · búsqueda por `searchKey` normalizado · todas las rutas exigen sesión de admin.

### `[x] BE-5` · Crear torneo ⭐
_(Hecho. Transacción completa: torneo → participantes con snapshot → patrullas → credenciales → audit log. **106 tests en `@bal/api`.** `maxPossibleScore` = **330** en el caso de referencia del brief. **Rollback probado** inyectando un fallo: no queda ni torneo, ni patrullas, ni participantes. El PIN se guarda hasheado y cifrado, nunca en claro. Cuatro mutaciones probadas, las cuatro detectadas.)_
**Archivos:** `src/routes/admin/tournaments.ts`, `src/services/tournamentService.ts`, `src/repositories/{tournamentRepo,patrolRepo,participantRepo}.ts`
**Referencia:** [`ARCHITECTURE.md`](ARCHITECTURE.md) §6.1 · [`TESTING.md`](TESTING.md) §4.4
**Contenido:** transacción completa — insertar torneo → `buildPatrols` → insertar participantes con snapshot y estaca → generar PIN de 6 dígitos con `crypto.randomInt` → argon2id + AES-GCM → insertar patrullas con blanco de inicio → audit log.
**DoD:**
- `maxPossibleScore` correcto en el caso de referencia (6×3D+6×campo+1×aire libre+1×sala = **330**).
- Snapshot verificado: cambiar la categoría del arquero **no** altera el participante.
- **Rollback probado**: si el armado falla, no queda ningún documento huérfano.
- Descifrar `pinEnc` devuelve el PIN original.
- Los warnings del armado llegan en la respuesta.

### `[x] BE-6` · Estados y edición del torneo
_(Hecho. Matriz de transiciones completa; toda transición fuera de la tabla devuelve `INVALID_STATE_TRANSITION`. **`TARGET_LOCKED`** verificado: un blanco con puntajes no se puede editar ni eliminar. El `updateOne` filtra también por el estado actual, así dos clicks simultáneos no se pisan.)_
**Archivos:** `src/services/tournamentService.ts`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §8
**DoD:** matriz completa de transiciones; toda inválida devuelve `INVALID_STATE_TRANSITION` · editar un blanco con puntajes devuelve `TARGET_LOCKED` · editar un blanco virgen en `en_proceso` recalcula `maxPossibleScore` · eliminar solo permitido en `sin_iniciar`.

### `[x] BE-7` · Patrullas y credenciales
_(Hecho. Listado con composición, validación `H1..H4` en vivo y PIN descifrado. **El PIN deja de exponerse una vez publicado el torneo** y cada visualización queda en el audit log. Regenerar el PIN invalida las sesiones de esa patrulla, verificado.)_
**Archivos:** `src/routes/admin/patrols.ts`, `src/services/patrolService.ts`
**Referencia:** [`TECHNICAL.md`](TECHNICAL.md) §3.4 · [`SECURITY.md`](SECURITY.md) §9
**DoD:** listar patrullas con el PIN descifrado, **solo** bajo sesión de admin y con el torneo no publicado, **registrando en el audit log** · `PUT` de la distribución solo en `sin_iniciar`, devolviendo violaciones sin bloquear · regenerar PIN invalida las sesiones de esa patrulla.

### `[x] BE-8` · Login de patrulla
_(Hecho. PIN de 6 dígitos, timing-safe con hash de referencia, bloqueo tras 5 intentos por patrulla e IP. **La credencial sólo vale con el torneo `en_proceso`**: antes no hay nada que anotar, después los puntajes están cerrados.)_
**Archivos:** `src/routes/auth.ts`, `src/services/authService.ts`, `src/middleware/auth.ts`
**Referencia:** [`SECURITY.md`](SECURITY.md) §3.2, §3.3
**DoD:** solo autentica con el torneo `en_proceso` · bloqueo por patrulla **y** por IP, independientes · la sesión lleva `patrolId` y `tournamentId` · una sesión de patrulla en `/api/admin/*` devuelve 403.

### `[x] BE-9` · Bundle de WAFL
_(Hecho. Todo el recorrido en una descarga, con los blancos **rotados desde el blanco de inicio** de la patrulla. Incluye `serverTime` para que el cliente corrija el desfase de su reloj.)_
**Archivos:** `src/routes/wafl/bundle.ts`
**Referencia:** [`TECHNICAL.md`](TECHNICAL.md) §3.5
**DoD:** devuelve todo lo del contrato, con los blancos **ordenados desde `startTargetIndex`** · incluye `serverTime` · responde en < 300 ms con 20 participantes · nunca expone datos de otra patrulla.

### `[x] BE-10` · Sincronización ⭐⭐
_(Hecho. Los 6 pasos de [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §6. **136 tests en `@bal/api`.** Dedup por `opId` con índice único, autorización **por op** dentro del loop, validación contra la modalidad del blanco leída de la base, LWW con desempate determinista, rollups por delta en la misma transacción. **El batch nunca falla entero.** Seis mutaciones probadas, las seis detectadas. Hallazgo: en Mongo un `E11000` dentro de una transacción la aborta, así que el dedup vive fuera — ver [`BITACORA.md`](BITACORA.md).)_
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

### `[x] BE-11` · Firmas y cierre de circuito
_(Hecho en `BE-10` (firmas y cierre desde WAFL) y acá el desbloqueo del admin. **El desbloqueo calcula el mismo hash que una firma real**, así que sigue detectando si el puntaje cambia después. Exige motivo, queda en `unlockedBy`/`unlockReason` y en el audit log.)_
**Archivos:** `src/services/signatureService.ts`
**Referencia:** [`SECURITY.md`](SECURITY.md) §7 · [`TESTING.md`](TESTING.md) §4.6
**DoD:** `scorecardHash` calculado **server-side** · modificar un score post-firma → `SIGNATURE_MISMATCH` al cerrar · cerrar sin todas las firmas → `SIGNATURES_MISSING` · cerrar sin todos los blancos → rechazado · la última patrulla cerrada pasa el torneo a `completado` · desbloqueo del admin registra `unlockedBy`, `unlockReason` y audit log · un PNG falso es rechazado (magic bytes).

### `[x] BE-12` · Publicar y despublicar
_(Hecho. Transacción que materializa `standings`. **Recalcula la temporada desde cero**, no por delta: eso hace que publicar sea idempotente y que despublicar sea exacto. Verificado que publicar dos veces no duplica puntos y que despublicar revierte del todo.)_
**Archivos:** `src/services/publishService.ts`, `src/repositories/standingRepo.ts`
**Referencia:** [`ARCHITECTURE.md`](ARCHITECTURE.md) §6.5 · [`TESTING.md`](TESTING.md) §4.7
**DoD:** transacción que materializa `standings` · publicar dos veces **nunca** duplica puntos · **despublicar revierte exactamente** al estado previo (verificado comparando snapshots) · invalida la caché pública · audit log en ambas.

### `[x] BE-13` · Endpoints públicos
_(Hecho. **163 tests en `@bal/api`.** Un torneo sin publicar NUNCA expone puntajes, verificado en los tres estados previos. El ranking separa a los que no llegan al mínimo de torneos en `notYetEligible`. `Cache-Control` + `ETag` en todas las respuestas.)_
**Archivos:** `src/routes/public/*.ts`, `src/services/{rankingService,statsService}.ts`
**Referencia:** [`TECHNICAL.md`](TECHNICAL.md) §3.6
**DoD:** un torneo no publicado **no** expone puntajes · el ranking excluye a quienes tienen < 2 torneos y los devuelve en una lista aparte · `Cache-Control` + `ETag` · caché en memoria invalidada al publicar · p95 < 200 ms · `explain()` sin `COLLSCAN`.

---

# Fase 3 — WAFL · P0 · **la app crítica**

### `[x] FE-1` · Bootstrap de la PWA
_(Hecho. Vite 8 + React 19 + Tailwind 4 con los tokens del design system, tema claro/oscuro con anti-FOUC, y VitePWA con **`registerType: prompt`** y `scope: /app/`. El endpoint de sync queda **excluido** del runtime caching: cachear una escritura podría enmascarar fallos. Build genera precache de 6 entradas.)_
**Archivos:** `packages/app/{vite.config.ts,index.html}`, `src/{main,App,theme}.tsx`, `src/styles/index.css`, `public/*`
**Referencia:** [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) · [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §8
**Contenido:** Vite + React + Tailwind 4 + tokens CSS del design system + tema claro/oscuro con anti-FOUC (**hash en CSP**, no `unsafe-inline`) + VitePWA con **`registerType: 'prompt'`** y `scope: '/app/'` + fuentes autohospedadas.
**DoD:** la app monta · conmutador de tema funciona sin parpadeo · manifest válido y app instalable · `registerType` es `prompt`, verificado en un test · versión visible en la UI.

### `[x] FE-2` · Capa offline ⭐⭐
_(Hecho. `db.ts` (IndexedDB con `idb`), `outbox.ts`, `syncWorker.ts` y `useSyncStatus.ts`. **24 tests.** El puntaje y su op se escriben en **una sola transacción de IndexedDB**. Validación en el cliente antes de encolar. Backoff con jitter; **un error de red o un 401 nunca descartan ops**. El total del servidor pisa al local. El cierre se bloquea con ops pendientes. Cinco mutaciones probadas: tres detectadas de entrada, dos revelaron tests débiles que se corrigieron.)_
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

### `[x] FE-3` · Infraestructura de frontend
_(Hecho. `apiClient` que adjunta el token CSRF automáticamente en toda mutación, y componentes base con los objetivos táctiles del design system. `StakeChip` lleva **siempre** el nombre de la estaca escrito junto al color.)_
**Archivos:** `src/lib/{apiClient,queryClient,cn,errorMessage}.ts`, `src/auth/{useSession,AdminRoute,PatrolRoute}.tsx`, `src/components/{AppShell,ui/*}.tsx`
**Base:** portar de `bv-easy-archery-battle/packages/web/src/{lib,auth,components/ui}`.
**DoD:** `apiClient` adjunta el token CSRF automáticamente · rutas protegidas por rol redirigen correctamente · componentes de UI con los tokens del design system.

### `[x] FE-4` · Login de WAFL
_(Hecho. `LoginPage` + el shell de la app. **Sólo ofrece los torneos `en_proceso`**: mandar al líder a uno publicado sería mandarlo a un rechazo del servidor. El PIN filtra a seis dígitos al tipear. Si el recorrido ya está descargado, la pantalla ofrece **seguir sin conexión** diciendo de cuándo son los datos en palabras («hace 5 horas»), no con una fecha que haya que interpretar. Los errores del servidor se repiten tal cual. **11 tests.**)_
**Archivos:** `src/wafl/pages/Login.tsx`
**DoD:** entra con usuario y PIN, descarga el bundle y lo persiste en IndexedDB · con el bundle ya presente permite entrar **sin conexión**, avisando la fecha de los datos · errores claros: torneo no iniciado, credencial incorrecta, bloqueo temporal.

### `[x] FE-5` · Home de WAFL — el circuito
_(Hecho. `CircuitPage`. Los blancos salen en el orden que manda el backend, desde el de inicio de la patrulla. Un blanco se marca completo **sólo cuando todos** los arqueros lo cargaron: con media patrulla no está listo. Todo leído de IndexedDB.)_
**Archivos:** `src/wafl/pages/Circuit.tsx`, `src/wafl/components/{CircuitRing,SyncBadge}.tsx`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §7.2 · [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §6.4, §6.5
**DoD:** los blancos aparecen **ordenados desde el de inicio** de la patrulla · cada uno con número, glifo de modalidad, flechas y estado · `SyncBadge` fijo con los cuatro estados · `CircuitRing` refleja el avance real · todo leído de IndexedDB.

### `[x] FE-6` · Página de blanco y teclado ⭐
_(Hecho. **46 tests en `@bal/app`.** El teclado ofrece los tokens de la modalidad **de ese blanco**; arcos para 3D y campo, grilla para sala y aire libre, conmutable por prop. Teclas de **56px verificadas sobre el estilo computado**. Cada toque escribe en IndexedDB, sin `await fetch` y sin spinner. Continuar dice **quién** falta. Se encontró y corrigió un bug de doble toque — ver [`BITACORA.md`](BITACORA.md).)_
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

### `[x] FE-7` · Seguimiento y resultados finales
_(Hecho. `ResultsPage`. Total, inner, dieces y emes de cada arquero, con el desglose por blanco. Resultados finales se habilita sólo con el recorrido completo. Todo desde IndexedDB.)_
**Archivos:** `src/wafl/pages/{Progress,FinalResults}.tsx`
**DoD:** puntaje acumulado, `X`, `10`, `M` y desglose por blanco de cada arquero · resultados finales habilitados solo con el recorrido completo · todo desde IndexedDB.

### `[x] FE-8` · Firma y cierre
_(Hecho. `SignaturePad`. El canvas muestra el puntaje que se está firmando **arriba del trazo**: nadie firma algo que no está viendo. No se puede confirmar sin trazo. El cierre exige todas las firmas y dice **quiénes** faltan; con ops pendientes no cierra y aclara que los puntajes ya están guardados. Cinco mutaciones probadas: cuatro detectadas, una reveló un test que pasaba antes de que cargaran los datos — ver [`BITACORA.md`](BITACORA.md).)_
**Archivos:** `src/wafl/pages/Sign.tsx`, `src/wafl/components/SignaturePad.tsx`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §7.5 · [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §5.5
**DoD:** canvas captura el trazo y genera PNG · el puntaje que se firma está visible sobre el canvas · Finalizar habilitado solo con todas las firmas · **el cierre se bloquea si hay ops pendientes**, mostrando el progreso de sincronización · sin señal, avisa que hace falta conexión aclarando que los puntajes ya están guardados.

---

# Fase 4 — WAFA · P0 / P1

### `[x] FE-9` · Login y cambio de password · P0
_(Hecho. La guarda de `mustChangePassword` vive **en un solo lugar**, `WafaApp`: con el cambio pendiente las demás rutas **ni se montan**, así que no hay ruta que se escape. Sin cancelar y sin salir: no hay a dónde ir. Los 12 caracteres se validan en cliente y servidor. Verificado entrando directo a `/wafa/arqueros`: igual aparece el cambio de password.)_
**Archivos:** `src/wafa/pages/{Login,ChangePassword}.tsx`
**DoD:** `mustChangePassword` redirige y **no deja navegar** a ninguna otra ruta hasta cambiarlo · mínimo 12 caracteres validado en cliente y servidor.

### `[x] FE-10` · Home de WAFA · P0
_(Hecho. Los torneos van agrupados por estado con **el que está en proceso arriba**: si hay uno corriendo, es lo único que le importa al admin en ese momento. Los grupos vacíos **dicen que están vacíos** en vez de desaparecer, para que nadie dude de si se perdió algo.)_
**Archivos:** `src/wafa/pages/Home.tsx`
**DoD:** torneos agrupados por estado · accesos a crear torneo, arqueros y temporadas.

### `[x] FE-11` · Crear torneo (wizard) · P0
_(Hecho. Los cuatro pasos, con la lógica en `wizard.ts` —puro, sin React— y la pantalla sólo pintando. Al elegir la modalidad de un blanco **se reponen las flechas del reglamento**, incluso pisando las que el admin había tocado: quien pasa un blanco a 3D espera 2 flechas, no las 3 que traía de sala. Agregar, eliminar y reordenar **renumeran de 1 a N**, porque el backend exige índices contiguos y un hueco se rechazaría recién al confirmar. El **máximo posible se recalcula en vivo**. Se pueden crear arqueros sin salir del wizard. Desde la revisión se vuelve a cualquier paso sin perder nada. El aviso de la regla de escuela **corre `buildPatrols`, el mismo algoritmo que el servidor**, así que no adivina: si quedarían arqueros sin patrulla dice **quiénes** y qué hacer. Un error frena; un aviso no. **46 tests** (29 de lógica + 17 de pantalla). Seis mutaciones probadas, las seis detectadas.)_
**Archivos:** `src/wafa/pages/TournamentCreate.tsx` + componentes de paso
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.3 · [`TESTING.md`](TESTING.md) §5.5
**DoD:** los 4 pasos · las flechas se precargan con el default al elegir la modalidad de cada blanco · se pueden reordenar, agregar y eliminar blancos · **el máximo posible se actualiza en vivo** · se pueden crear arqueros sin salir del wizard · paso de revisión editable.

### `[x] FE-12` · Arqueros y temporadas · P0
_(Hecho. CRUD, archivar, restaurar y búsqueda **contra el servidor**, no filtrando en el cliente: el padrón viene topeado a 500. Eliminar aparece deshabilitado **con el motivo escrito al lado** y ofreciendo archivar, que es lo que sí sirve — un botón gris sin explicación es una pared, no una respuesta. Hizo falta agregar `participated` a la API: sin eso la interfaz sólo podía fallar al apretar el botón. Una sola consulta para todo el padrón.)_
**Archivos:** `src/wafa/pages/{Archers,ArcherForm,Seasons}.tsx`
**DoD:** CRUD, archivar, restaurar, búsqueda · eliminar deshabilitado con explicación si el arquero participó.

### `[x] BE-15` · Redistribución manual de patrullas · P0
_(Hecho con TDD. `PUT /admin/tournaments/:id/patrols`, transaccional, sólo en `sin_iniciar`. **Avisa pero no bloquea**: la respuesta trae las violaciones que el admin acaba de aceptar y quedan en el audit log. Lo que sí bloquea es **perder un arquero**: exige la lista completa y, si falta alguno, dice **quién**. La posición sale del **orden dentro de la unidad**, no de lo que mande el cliente. No crea ni borra patrullas: sus credenciales pueden estar repartidas en papel. **13 tests de integración**, siete mutaciones probadas y detectadas.)_
**Archivos:** `src/routes/admin.ts`, `src/services/patrolAdminService.ts`, `src/repositories/{patrolRepo,tournamentRepo}.ts`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.6 · [`DOMAIN_WA.md`](DOMAIN_WA.md) §5

### `[x] FE-13` · Patrullas y credenciales · P0
_(Hecho. Composición completa con unidades, posiciones, estacas y blanco de inicio. La lógica va en `patrullas.ts`, pura. El **validador en vivo corre `validatePatrols`, el mismo del servidor**, así que lo que se ve es lo que va a quedar registrado. Avisa sin bloquear; lo único que frena es lo que el servidor rechazaría. El destino de un arquero se elige de una lista y no arrastrando: arrastrar con guantes en un celular no es confiable. Credenciales visibles con regenerar, y vista imprimible. **32 tests** (20 de lógica + 12 de pantalla). Seis mutaciones probadas y detectadas; una encontró un bug real de orden — ver [`BITACORA.md`](BITACORA.md).)_
**Archivos:** `src/wafa/pages/Patrols.tsx`, `src/wafa/components/PatrolEditor.tsx`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.6
**DoD:** composición completa con unidades, posiciones, estacas y blanco de inicio · edición manual solo en `sin_iniciar` · **validador en vivo que muestra las violaciones sin bloquear el guardado** · credenciales visibles con botón de regenerar · vista imprimible para repartir en el club.

### `[x] BE-16` · Resultados para WAFA · P0
_(Hecho. `GET /admin/tournaments/:id/results` con los rollups de cada participante y su número de patrulla. A diferencia del endpoint público, acá **sí** se ven los puntajes de un torneo `completado`: el admin tiene que poder revisar lo que está por aplicar a la liga. Marca las firmas **desbloqueadas** como tales, porque el podio se mira distinto si alguien no firmó de puño y letra. Detectado al hacer `FE-15`.)_
**Archivos:** `src/routes/admin.ts`

### `[x] FE-14` · Detalle y seguimiento del torneo · P0
_(Hecho. La pantalla cambia según el estado. En proceso es una **pantalla de mirar**: avance por patrulla con barra, quiénes faltan firmar, y el recorrido con los blancos bloqueados **explicando el motivo** — un blanco gris sin explicación parece un error de la app. El desbloqueo de firma exige un motivo de al menos 5 caracteres, que queda en el audit log. Terminado el torneo no se toca ningún blanco, aunque no tenga puntajes.)_
**Archivos:** `src/wafa/pages/Tournament.tsx`
**DoD:** vista por estado según `FUNCTIONAL.md` §6.7 · avance por patrulla · un blanco con puntajes aparece bloqueado con explicación · desbloqueo de firma pidiendo motivo.

### `[x] FE-15` · Publicar · P0
_(Hecho. Los podios y los puntos de liga se calculan con **las mismas funciones que usa el servidor al publicar** (`rankByCategory`, `leaguePointsForPosition`), así que la vista previa no es una estimación. El empate se muestra como tal: dos primeros con 5 puntos cada uno no es un error de carga. Publicar pide **una confirmación aparte** — aplica los resultados a la liga, no puede pasar de un toque. Despublicar dice **exactamente qué revierte**, no un «¿estás seguro?» genérico, y exige un motivo.)_
**Archivos:** `src/wafa/pages/Publish.tsx`
**DoD:** vista previa de podios y de los puntos de liga que se aplicarían · confirmación explícita · despublicar disponible con advertencia clara de lo que revierte.

### `[x] FE-16` · Ranking en WAFA · P1
_(**Los mismos datos y modos que la landing, contra los mismos endpoints públicos.** Reutilizar los componentes no se pudo literalmente —la landing y la PWA no comparten bundle, a propósito— así que se compartió **la decisión**: `medallaDe` y `ETIQUETA_DE_MODO` salieron a `@bal/shared/src/podio.ts` y la landing dejó de tener su copia. Lo duplicado es el JSX, que además difiere: tabla en la landing, lista en WAFA. El presupuesto de la PWA pasó de 114,45 a 114,46 KB gz — diez bytes, porque sacar el podio compensó lo que sumó la pantalla. 3 controles de mutación, los 3 detectados.)_
**Nota original:** duplica lo que va a mostrar la landing. Conviene hacerlo **después de `FE-18`** y reutilizar sus componentes en vez de escribirlo dos veces.
**Archivos:** `src/wafa/pages/Ranking.tsx`
**DoD:** mismos datos y modos que la landing.

---

# Fase 5 — Landing · P1

### `[x] FE-17` · Bootstrap de la landing
_(Hecho. Vite + React + Tailwind, **sin service worker**. Los tokens del design system se movieron a `@bal/shared/tokens.css`: la PWA y la landing son builds separados y con una copia cada una los colores se irían separando sin que nadie lo note. **97 KB gz** contra el presupuesto de 120. Se conectó el tema claro/oscuro anti-FOUC, que estaba escrito en los tokens pero **nada lo activaba**. Y se encontró que la PWA **nunca importó su CSS** — ver [`BITACORA.md`](BITACORA.md).)_
**Archivos:** `packages/landing/*`
**DoD:** Vite + React + tokens compartidos · **sin service worker** · JS inicial < 120 KB gz · LCP < 2.5 s.

### `[x] FE-18` · Introducción y ranking
_(Hecho. El acceso a **anotar puntajes va primero y grande**: es lo que hace falta el día del torneo. Ranking por categoría con los dos modos y selector de temporada, **pidiéndoselos al servidor** — la landing no reordena por su cuenta. Los que no llegan al mínimo van en una lista aparte **con la explicación del requisito**: esconderlos haría creer que se perdió su resultado.)_
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §5.1, §5.2
**DoD:** accesos a WAFA y WAFL · ranking por categoría con los dos modos y selector de temporada · los de < 2 torneos en una lista aparte con la explicación del requisito.

### `[x] FE-19` · Torneos
_(Hecho. Listado y detalle. Un torneo **en proceso muestra patrullas y avance, ningún puntaje** — lo garantiza el backend, y la pantalla lo explica para que nadie crea que está rota. Los podios se ordenan con `rankByCategory`, el mismo del servidor.)_
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §5.3
**DoD:** listado y detalle · un torneo en proceso muestra patrullas y avance, **nunca puntajes**.

### `[x] FE-20` · Ficha de arquero
_(Hecho. Estadísticas por temporada desde los acumulados. El **porcentaje va primero** y el bruto entre paréntesis: uno es lo comparable, el otro es lo que el arquero recuerda. Un arquero sin torneos publicados **no tiene ficha**: el padrón del club no se filtra hacia afuera.)_
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §5.4
**DoD:** estadísticas históricas y evolución torneo a torneo.

---

# Fase 6 — Calidad, seguridad y deploy

### `[x] BE-17` · La API sirve los frontends · P0
_(Hecho. `/` la landing, `/app/` la PWA, con fallback de SPA en las dos: recargar en `/app/wafl` tenía que devolver el index, no un 404. Un `/api/...` inexistente sigue respondiendo JSON. **Faltaba desde el principio** —`ARCHITECTURE.md` §3 lo pedía— y sin eso no hay stack real que testear ni contenedor que desplegar. 9 tests.)_
**Archivos:** `src/middleware/estaticos.ts`, `src/app.ts`

### `[x] TEST-1` · E2E con tramo offline · **P0** ⭐
_(Hecho. Los 23 pasos, contra el stack real: MongoDB efímero en replica set más la API sirviendo los dos frontends construidos, en un solo origen. **47 s.** Encontró tres bugs que ninguna otra prueba podía encontrar: la sincronización no estaba enchufada, la barra fija tapaba el botón de firmar del último arquero, y `setOffline` no bloquea `localhost`. Ver [`BITACORA.md`](BITACORA.md).)_
**Archivos:** `packages/app/tests/e2e/flujo-completo.spec.ts`, `playwright.config.ts`
**Referencia:** [`TESTING.md`](TESTING.md) §6
**DoD:** los 23 pasos del flujo, **incluyendo `context.setOffline(true)` para cargar el recorrido completo sin conexión** y la verificación de que todo sincroniza al reconectar · verde en CI.

### `[x] TEST-2` · E2E de escenarios adicionales · P1
_(**Los cinco, más los helpers compartidos en `e2e/ayudas.ts`.** Ocho tests E2E en total, 1,7 minutos. Cuatro controles de mutación, uno por escenario, los cuatro detectados. Dos hallazgos: el test de la PWA prohibía `skipWaiting()` a secas y fallaba contra un service worker correcto —con `prompt`, Workbox lo emite detrás del mensaje `SKIP_WAITING`, que es justo lo que hay que verificar— y el flujo original se rompió al compartir la base efímera, por cambiar el password sin fijarse y por abrir el ranking sin decir qué temporada. Ver [`BITACORA.md`](BITACORA.md).)_
**DoD:** los 5 escenarios de `TESTING.md` §6 (recarga offline, dos dispositivos, sesión vencida, blanco bloqueado, PWA instalable).

### `[~] BE-14` · Auditoría de seguridad · **P0**
_(**37 de 38 ítems del checklist verdes, cada uno con su test señalado en [`SECURITY.md`](SECURITY.md) §13.** La mayoría ya estaba cubierta y se mapeó; faltaban cinco, que se escribieron en `tests/seguridad.test.ts`: el rastro en el audit log de una op de otra patrulla, el 404 —no 403— de un recurso ajeno, `SIGNATURE_MISMATCH` al cambiar un puntaje ya firmado, la clave con `$` en un objeto anidado, y HSTS presente en producción. Cuatro mutaciones probadas, las cuatro detectadas. **El pendiente no depende del código:** `aikido:scan` exige iniciar sesión desde el navegador. («Contenedor no root» quedó verde al agregar el job `imagen` al CI, que construye la imagen y mira el `uid` corriendo el contenedor.) `/security-review` corrió sobre el diff sin hallazgos, pero **el diff sólo tiene docs y tests**: el código con superficie de seguridad de esta sesión ya está en `main`, así que esa parte del DoD queda sin cumplir de verdad.)_
**Referencia:** [`SECURITY.md`](SECURITY.md) §13
**DoD:** **el checklist completo de `SECURITY.md` §13 verde**, cada ítem con su test · `/security-review` sobre el diff sin HIGH ni MEDIUM · `aikido:scan` limpio.

### `[ ] FE-21` · Auditoría de UI y accesibilidad · P1
**Referencia:** [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §11
**DoD:** skills `web-design-guidelines` y `audit-website` sin issues críticos · contraste verificado en ambos temas · objetivos táctiles medidos · probado en Android e iPhone reales.

### `[x] INF-3` · Dockerfile · P0
_(**Construido y verificado, en CI.** El job `imagen` lo construye en cada PR, comprueba el `uid` corriendo el contenedor y que sin configuración falle ruidosamente. Al construirlo por primera vez apareció que **no construía**: la etapa de dependencias no copiaba `packages/ui/package.json`, y `@bal/ui` nació después de escribir el Dockerfile. Lo que sigue sin verificarse es servir tráfico real contra Atlas, que es `INF-4`. Detalle original:  Multi-stage en tres etapas (deps → build → runner) sobre `node:22-bookworm-slim`, `USER node`, sin toolchain, `HEALTHCHECK` a `/api/health`, y `.dockerignore`. Los frontends se copian a `packages/api/public/{app,landing}`, que es donde los busca `estaticos.ts` dentro de la imagen — esa detección **sí** está probada (`elegirRutas`). **No se pudo correr `docker build`: no hay Docker en la máquina de desarrollo.** Queda pendiente construir la imagen y arrancarla una vez antes de dar la tarea por cerrada.» — resuelto por el job `imagen`.)_
**Referencia:** [`CONFIG.md`](CONFIG.md) §6
**DoD:** multi-stage · imagen final slim, **usuario no root**, sin toolchain · sirve `/api` + `/app` + `/` · `HEALTHCHECK` a `/api/health` · `.dockerignore` correcto.

### `[~] INF-4` · Deploy en Railway · P0
_(**`railway.json` listo**, con healthcheck y política de reinicio. El deploy en sí **no se hizo**: necesita la cuenta de Railway y el cluster de Atlas, que son del dueño del proyecto. El checklist de puesta en producción de [`CONFIG.md`](CONFIG.md) §10 sigue sin correr.)_
**Referencia:** [`CONFIG.md`](CONFIG.md) §7
**DoD:** `railway.json` · desplegado y accesible por HTTPS · variables seteadas · healthcheck verde · **checklist de puesta en producción de `CONFIG.md` §10 completo**.

### `[x] INF-5` · CI · P0
_(Hecho. `.github/workflows/ci.yml` con los cuatro jobs: `quality` (lint + tipos + tests), `budget` (tamaño de bundle **y que cada frontend emita su `.css`**), `e2e` (Playwright con el tramo offline, subiendo el reporte si falla) y `audit`. El chequeo del `.css` se verificó **borrando la hoja de estilos del build**: falla con exit 1 y explica el motivo probable. Los cuatro corren en verde localmente; el workflow en sí se estrena con este PR.)_
**Referencia:** [`CONFIG.md`](CONFIG.md) §8
**Urgencia comprobada, dos veces:** en `SH-6` se descubrió que `pnpm lint` venía **fallando en `main`** desde `FE-3`, y en `FE-17` que la PWA **se estaba construyendo sin hoja de estilos** desde el mismo momento. Nada lo bloqueaba. Ver [`BITACORA.md`](BITACORA.md).
**Sumar al job `budget`:** verificar que **cada frontend emita su `.css`**. Es lo que habría delatado el segundo problema el día que apareció.
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

# Fase 8 — Padrón público, categoría y estaca nuevas, ranking por sexo y mejor-de-N · P1

> Pedido del 2026-10-24: alta de arqueros desde la landing, categoría `principiantes` (estaca `naranja`), eliminar el ranking de liga **por puntos**, «mejor de 2» configurable por entorno, y rankings Femenino / Masculino / General.

### Decisiones — confirmadas el 2026-10-24

| # | Pregunta | Decisión |
|---|---|---|
| 1 | `principiantes`, ¿`senior: false` como `escuela`? | **Sí.** Se une a la misma bolsa de armado; `H3` la protege igual que a `escuela`. |
| 2 | ¿Generalizar `ESCUELA_SIN_SENIOR`? | **Sí** → `CATEGORIA_SIN_SENIOR`. Cubre `escuela` y `principiantes` con un nombre que no miente. |
| 3 | ¿Qué se borra del ranking por puntos? | **Todo**: `leaguePoints` **y** `podiums` (1º/2º/3º acumulados por temporada). No queda ningún resabio de «puntos de liga» — ni el dato, ni el comparador, ni la columna en ninguna pantalla. |
| 4 | ¿Mínimo de torneos para el ranking = N (mejor-de-N)? | **Sí.** Con `LEAGUE_BEST_N=3`, hacen falta 3 torneos jugados para figurar. |
| 5 | ¿Femenino/Masculino/General también en el podio por torneo? | **No**, sólo en el ranking de liga por temporada. El podio de un torneo individual sigue siendo uno por categoría. |
| 6 | ¿Padrón viejo sin `sexo`/`dni`? | **Quedan opcionales** (`null`), con aviso en el listado de WAFA señalando a quién le falta completar. No se fuerza nada retroactivo. |
| 7 | ¿El alta pública requiere aprobación del admin? | **Sí.** Queda `pendiente` hasta que un admin la aprueba desde WAFA. No se puede sumar a un torneo mientras esté pendiente. **Esto agrega las tareas `BE-22` y `FE-30`, y cambia el alcance de `BE-20` y `FE-27` respecto de la primera versión de este plan.** |

---

### `[x] SH-8` · Dominio: categoría `principiantes`, estaca `naranja` · **TDD**
_(Hecho **parcialmente**: estaca `naranja` y categoría `principiantes`, con TDD. El campo `sexo` del arquero queda para `BE-19`/`SH-10`, que es donde vive el resto del padrón — este ítem sólo cubre lo que es dominio puro. `isEscuela()` ya generalizaba por el flag `senior` de `CATEGORY_INFO`, no por el nombre: el test de que `principiantes` dispara el mismo warning que `escuela` pasó con el primer intento de implementación, sin ajustar la función. Lo que sí hizo falta tocar, fuera de `packages/shared`, para que la estaca no quedara a medio andar: `StakeMapSchema`/`DistancesSchema` en `schemas.ts` (sin la clave `naranja`, un `stakeMap` personalizado con `principiantes` se rechazaba por `.strict()`), el snapshot de `stakeMap` en `tournamentService.ts` (copiaba las tres claves viejas a mano), `StakeChip.tsx` y `tokens.css` (sin esto, la estaca naranja renderizaba `null`), y `ICONO_DE_CATEGORIA` en `packages/ui` (typecheck lo exigía). La etiqueta de `principiantes` es «Iniciación», no «Principiantes»: 13 caracteres no entran en el límite de 11 de `tests/etiquetas.test.ts`. El warning `ESCUELA_SIN_SENIOR` se renombró a `CATEGORIA_SIN_SENIOR` en todo el repo — código y tests, no sólo el comentario.)_
**Objetivo:** estaca y categoría nuevas sin romper el armado de patrullas ni el reglamento de estacas; sexo como dato de dominio.
**Cómo:** primero actualizar `DOMAIN_WA.md` §3 (tabla de categorías: agregar `principiantes` → `naranja`) y §4 (tabla de estacas: agregar `naranja`), y la regla 8 de `CLAUDE.md` (la lista de colores reservados pasa a cuatro). Recién ahí tocar código.
**Archivos:** `packages/shared/src/{domain,constants,paleta}.ts` + tests
**Referencia:** [`DOMAIN_WA.md`](DOMAIN_WA.md) §3, §4, §5 (actualizar primero) · decisiones 1 y 2
**Contenido:**
- `STAKES`: agregar `'naranja'`. `BOW_CATEGORIES`: agregar `'principiantes'`.
- `CATEGORY_INFO.principiantes`: `sort: 8`, `senior: false`.
- `DEFAULT_STAKE_MAP.naranja = ['principiantes']`.
- `paleta.ts`: `TONOS_DE_ESTACA` pasa a cuatro valores; `COLOR_DE_CATEGORIA.principiantes` con un tono que el test de contraste AA apruebe en los dos temas.
- `patrolling.ts`: `ESCUELA_SIN_SENIOR` → `CATEGORIA_SIN_SENIOR` (renombrar el código, no sólo documentarlo).
**DoD:**
- Test que `stakeForCategory('principiantes')` devuelve `'naranja'`.
- Test de armado: una patrulla 100% `principiantes` sin senior dispara el mismo warning que una 100% `escuela` — prueba que `H3` ya generaliza por el flag `senior`, no por nombre.
- Test de contraste del nuevo tono de `paleta.ts`, igual que los otros seis.
- `pnpm test` en `@bal/shared` sigue en 100% de cobertura.

### `[x] SH-9` · Liga: eliminar el ranking por puntos, «mejor de N» configurable · **TDD**
_(Hecho, con un alcance más grande que el escrito: `leaguePointsForPosition` no era sólo del modo retirado, así que la limpieza llegó también a `stats.ts` (`ArcherTournamentResult`/`ArcherCareerStats`, sin llamadores reales), `podio.ts` (`ETIQUETA_DE_MODO` → `etiquetaDeMejorDeN(bestN)`) y `compartir.ts` (`RankingParaCompartir.modo` → `bestN`). Fuera de `@bal/shared`, el compilador obligó a adelantar partes de `BE-18`/`BE-19`/`BE-21`/`FE-28` en el mismo cambio —TypeScript no permite dejar media migración a medio camino—: `env.ts` tiene `LEAGUE_BEST_N`; `db/types.ts` le borró `leaguePoints`/`podiums` a `StandingDoc` (le falta `sex`/`dni`/`registrationStatus`, eso sigue en `BE-19`); `publishService.ts`/`standingRepo.ts`/`indexes.ts` actualizados; `publico.ts` perdió `mode` y expone `bestN` (le falta el split por sexo, eso sigue en `BE-21`); `torneo.ts`/`Publish.tsx`/ambos `Ranking.tsx`/`Tournaments.tsx`/`Archer.tsx` perdieron toda mención a puntos de liga (les falta las pestañas de sexo, eso sigue en `FE-28`). `pnpm -r typecheck`, `pnpm -r test` (1258 tests) y `pnpm lint` verdes en los cinco paquetes. Ver `docs/BITACORA.md`, entrada del 2026-10-24.)_
**Objetivo:** un solo modo de ranking de liga, con el tamaño del promedio como parámetro, no como constante.
**Cómo:** reescribir `DOMAIN_WA.md` §9.1 y §9.2 primero (el §9.1 de puntos por posición se retira del ranking; el §9.2 pasa a hablar de «mejor de N», con N configurable). Actualizar la fila de `DOMAIN_WA.md` §11 que referencia "ranking por puntos".
**Archivos:** `packages/shared/src/{league,stats}.ts` + tests
**Alcance real, más grande de lo que parece:** `leaguePointsForPosition` no es sólo del modo `position` — es una función de **puntos por posición en un torneo**, y se usa también fuera del ranking de temporada: landing `Tournaments.tsx` (columna de puntos en el resultado de un torneo), WAFA `torneo.ts`/`Publish.tsx` (vista previa de «puntos que se aplicarían» al publicar), y `stats.ts` (`ArcherTournamentResult.leaguePoints`, `ArcherCareerStats.leaguePoints` — esto último **sin ningún llamador en `api` ni en los frontends**, confirmado por búsqueda; se le borra el campo sin que haga falta tocar otro paquete). El resto de los consumidores se actualiza en `FE-28`.
**Referencia:** [`DOMAIN_WA.md`](DOMAIN_WA.md) §9 (reescribir primero) · decisiones 3 y 4
**Contenido:**
- `CUANTOS_MEJORES` deja de ser una constante del módulo: `bestTwoAvgPct` y `applyTournamentToStandings` pasan a recibir `bestN: number` como parámetro (igual que `buildPatrols` recibe `stakeMap` — el dominio no lee configuración, la configuración se la pasan). Renombrar a `bestNAvgPct` / `mejoresCon(pcts, nuevo, n)`.
- `StandingsMode` desaparece por completo: `sortStandings` ya no recibe modo, queda con un solo comparador (`compararPorMejorDeN`).
- Se borran: `leaguePointsForPosition`, `compararPorPosicion`, `sumarPodio`, `LEAGUE_POINTS_BY_POSITION` (de `constants.ts`).
- `eligibleForRanking` compara contra el mismo `bestN` recibido, no contra una constante — `MIN_TOURNAMENTS_FOR_RANKING` se borra de `constants.ts`.
- `ArcherStanding` pierde `leaguePoints` **y** `podiums` (decisión 3). Queda: `tournamentsPlayed`, `bestNormalizedPct`/`bestRawScore`/`bestTournamentId`, `topTwoPcts` (renombrar a `topNPcts`), `totalX`/`totalTens`/`totalM`.
**DoD:**
- Con `bestN = 3`: el promedio toma las tres mejores marcas, y con 2 torneos el arquero queda en `notYetEligible` (antes clasificaba con 2).
- Con `bestN = 2` el comportamiento es idéntico al actual — ningún test viejo de «mejor de 2» cambia de resultado, sólo de firma.
- No queda ninguna referencia a `'position'`, `leaguePoints`, `podiums` ni `leaguePointsForPosition` en `@bal/shared` ni en su API pública (`index.ts`).
- Cobertura ≥ 95% de ramas en `league.ts`.

### `[x] SH-10` · Dominio: ranking de liga por sexo (general / femenino / masculino)
_(Hecho. `Sex`/`SEXES` nuevos en `domain.ts`; `Rankable.sex` y `ArcherStanding.sex` opcionales — ningún otro llamador de esos tipos tuvo que cambiar. `sortStandingsByGender` filtra la pool antes de ordenar, no filtra un resultado ya ordenado, verificado con el caso de una arquera 4ª en el general y 1ª en el femenino. `exactOptionalPropertyTypes` —activo en este monorepo— obligó a omitir la clave `sex` en vez de escribirla como `undefined`; el fix quedó en `nuevoStanding` y en el merge de `applyTournamentToStandings`, con comentario explicando por qué. Todavía no hay ningún dato real de `sex` en la base: eso es `BE-19`.)_
**Objetivo:** las mismas funciones de `league.ts`, aplicadas a tres recortes del padrón.
**Archivos:** `packages/shared/src/league.ts` (o un módulo nuevo `genero.ts` si `league.ts` ya es grande) + tests
**Referencia:** decisión 5 de esta fase
**Contenido:** `ArcherStanding` y `Rankable`/`TournamentContribution` incorporan `sex: 'femenino' | 'masculino'` (tipo nuevo en `domain.ts`, ver `SH-8`). Una función `sortStandingsByGender(standings, bestN): { general, femenino, masculino }` que llama a `sortStandings` tres veces: una con la lista completa y dos filtrando por `sex` antes de ordenar — **no** filtrando el resultado ya ordenado, porque el puesto compartido y el salto de posición dependen de la pool exacta que se está rankeando.
**DoD:**
- Con 3 mujeres y 5 hombres en una categoría, el ranking femenino tiene 3 posiciones (1, 2, 3) y el general tiene 8 — ninguno es un subconjunto del otro con los mismos números de puesto.
- Test de que un arquero sin `sex` cargado (padrón viejo, decisión 6) no rompe el cálculo: se excluye de femenino y de masculino, pero aparece en general con un aviso, no con un throw.

### `[x] BE-18` · Variable de entorno `LEAGUE_BEST_N`
_(Hecho como parte de `SH-9` — ver esa entrada. `entero(2)` con `.positive()` ya rechazaba 0 y negativos sin código nuevo. Agregada a `.env.example` y a `CONFIG.md` §2.)_
**Objetivo:** el tamaño del promedio de liga es configuración, no un número en el código.
**Archivos:** `packages/api/src/env.ts`, `.env.example`
**Referencia:** [`CONFIG.md`](CONFIG.md) §2 (agregar la variable a la tabla primero) · decisión 4
**Contenido:** `LEAGUE_BEST_N: entero(2)`, con `min(1)`. Todo el código de `@bal/api` que hoy importaría `MIN_TOURNAMENTS_FOR_RANKING` pasa a leer `env().LEAGUE_BEST_N` y lo inyecta donde `SH-9` pide el parámetro `bestN`.
**DoD:** cambiar `LEAGUE_BEST_N=3` sin tocar código cambia el ranking en `/api/public/rankings` y en `pnpm --filter @bal/api db:reconcile` · con `LEAGUE_BEST_N=0` el arranque falla (Zod) con mensaje claro.

### `[x] BE-19` · Padrón: campos `sexo` y `dni`, propagados a participante y standing
_(Hecho. `ArcherInputSchema.sex`/`.dni` **opcionales** —no obligatorios como decía el plan original— porque el alta del admin (`FE-12`, ya en producción) todavía no manda estos campos; exigirlos habría roto el único flujo de alta que existe hoy, antes de que `FE-29` actualice ese formulario. El autoregistro público (`BE-20`) va a tener su propio esquema, que sí los exige desde el vamos. Probado de punta a punta en `ciclo.test.ts`: `ArcherDoc.sex` → snapshot en `ParticipantDoc` → acumulado en `StandingDoc`, con un arquero sin sexo cargado en el medio sin que nada se rompa. `db:reconcile` no necesitó tocarse: ya recalculaba desde los snapshots con la lógica de merge que dejó `SH-9`/`SH-10`, que es exactamente lo que pedía el DoD. Índice único parcial `uk_dni` con `$type: 'string'` —no `$exists`, que también matchea `null`.)_
> **Parcial ya hecho en `SH-9`:** `StandingDoc` perdió `leaguePoints`/`podiums`, `topTwoPcts` → `topNPcts`, `standingRepo.ts`/`indexes.ts` al día. Lo que queda es todo lo de `sexo`/`dni`/`registrationStatus`: `ArcherDoc`, `ParticipantDoc`, `ArcherInputSchema`, `archerRepo.ts`, `archerService.ts`, snapshot en `tournamentService.ts`.
**Objetivo:** el dato nace en el arquero y viaja congelado por snapshot, igual que `category`.
**Cómo:** actualizar `TECHNICAL.md` §2 (`archers`, `participants`, `standings`) y §3.2 primero.
**Archivos:** `packages/api/src/db/{types,indexes,seed,reconcile}.ts`, `packages/api/src/repositories/{archerRepo,standingRepo}.ts`, `packages/api/src/services/archerService.ts`, `packages/shared/src/schemas.ts` (`ArcherInputSchema` +`sex`+`dni`), `tournamentService.ts` (snapshot)
**Referencia:** [`TECHNICAL.md`](TECHNICAL.md) §2, §3.2 (actualizar primero) · decisiones 3 y 6
**Contenido:**
- `ArcherDoc`: `+ sex: 'femenino' | 'masculino' | null` · `+ dni: string | null`. En el esquema (`ArcherInputSchema`) son **opcionales**: el alta del admin todavía no los manda (`FE-29` pendiente) y exigirlos la habría roto. Los viejos —y los nuevos hasta que alguien los complete— quedan en `null`.
- `dni`: formato argentino, 7–8 dígitos, sin puntos. Índice **único parcial** (sólo sobre documentos con `dni` no nulo) en `indexes.ts`, idempotente.
- `ParticipantDoc` y `StandingDoc`: `+ sex` (snapshot, igual que `firstName`/`lastName`/`category`). `StandingDoc` pierde `leaguePoints` **y** `podiums` (decisión 3, `SH-9`) — `standingRepo.toDomain`/`fromDomain` se actualizan junto.
- `indexes.ts`: se borra `ix_ranking_posicion` (`{seasonId, category, leaguePoints: -1}`), que ordenaba un campo que deja de existir.
- `archerService.ArcherView`: expone `sex`, `dni`, un flag `profileIncomplete` (decisión 6) y `registrationStatus: 'pendiente' | 'aprobado'` (decisión 7, ver `BE-22`). Un arquero creado por el admin nace `aprobado`.
**DoD:**
- Crear un arquero con DNI repetido devuelve un error tipado (`ARCHER_DNI_DUPLICATE`), no un 500 de Mongo.
- Un arquero viejo (sin `dni`/`sex`) sigue participando de torneos sin romper nada; `profileIncomplete: true` en su `ArcherView`.
- `archerRepo.list` (la que alimenta el wizard de `FE-11` para elegir participantes) **excluye por defecto** a los `pendiente` — no se puede sumar a un torneo un arquero sin aprobar.
- `db:reconcile` recalcula `standings` con el `sex` vigente de cada arquero, sin `leaguePoints` ni `podiums`.

### `[x] BE-20` · Alta pública de arqueros desde la landing (queda `pendiente`)
_(Hecho. Encontró y corrigió un bug latente en `middleware/cache.ts`: `publicCache` le agregaba `Cache-Control`/`ETag` a **cualquier** respuesta 200 de `/api/public/*`, sin mirar el método — hasta ahora esa ruta sólo tenía GETs, así que nunca importó. Se lo acotó a `GET` antes de agregar el primer POST. La respuesta nunca devuelve `dni` ni `registrationStatus`, ni siquiera el del propio request — se actualizó `docs/SECURITY.md` §11 y se agregó §15 documentando la superficie nueva. `docs/FUNCTIONAL.md` §5.2 y `docs/TESTING.md` §4.8 estaban desactualizados desde `SH-9` —seguían describiendo el modo "por posición" retirado— y se corrigieron de paso.)_
**Objetivo:** cualquiera puede inscribirse al padrón sin sesión; el registro **no** lo hace usable todavía (decisión 7).
**Cómo:** escribir primero la sección nueva de `FUNCTIONAL.md` §5 (flujo de alta pública) y la entrada correspondiente en `SECURITY.md` (es la primera ruta pública que **escribe**, no sólo lee — documentar qué la distingue de `/api/public/*` existente).
**Archivos:** `packages/api/src/routes/publico.ts`, `packages/shared/src/schemas.ts` (`ArcherSelfRegisterSchema`)
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §5 (nueva sección) · [`SECURITY.md`](SECURITY.md) (nueva entrada) · decisión 7
**Contenido:** `POST /api/public/archers`, cuerpo `{ firstName, lastName, dni, sex, category }` validado con `.strict()`. Reusa `RATE_LIMIT_PUBLIC`. Crea el arquero con `registrationStatus: 'pendiente'` (`BE-19`). DNI duplicado → 409 tipado, mensaje que no confirma ni niega si ese DNI ya existe con otro nombre (evitar que el endpoint sirva para buscar gente por DNI).
**DoD:**
- 200 con el arquero creado **en estado `pendiente`** — no aparece en `archerRepo.list` del wizard de torneo hasta que `BE-22` lo apruebe.
- DNI duplicado → 409 `ARCHER_DNI_DUPLICATE`, sin filtrar el nombre con el que ya está cargado.
- Un objeto con una propiedad extra (ej. `isAdmin: true`, `registrationStatus: 'aprobado'`) es rechazado por el `.strict()` — **quien se autoregistra no puede autoaprobarse**.
- Todos los casos de `TESTING.md` §4.x (agregar la subsección) verdes.

### `[x] BE-21` · Endpoint público de ranking: por sexo, sin `mode` ni puntos de liga
_(Hecho. Cambiar la forma de la respuesta (de `{ranked, notYetEligible}` plano a `{general, femenino, masculino}`) rompía en runtime las dos pantallas de Ranking ya en producción —ningún typecheck lo iba a atrapar, son interfaces TS del frontend, no verificadas contra el contrato real del backend—, así que `FE-28` se adelantó parcialmente: ambas pantallas leen de `.general` ahora, sin pestañas todavía. `/security-review` sin hallazgos: trazado `dni`/`registrationStatus` por `standingRepo.toDomain`/`replaceSeason` y ninguno de los dos existe en `StandingDoc`/`ArcherStanding`, así que no hay forma de que se filtren por la anidación nueva.)_
> **Parcial ya hecho en `SH-9`:** `RankingQuery` perdió `mode`, la respuesta trae `bestN`, `/archers/:id` perdió `leaguePoints`/`podiums`. Lo que queda es el split `general`/`femenino`/`masculino` de `SH-10`.
**Archivos:** `packages/api/src/routes/publico.ts`
**Referencia:** decisiones 3 y 5
**Contenido:** `RankingQuery` pierde `mode` (ya no hay dos modos, `SH-9`). `GET /api/public/rankings` devuelve, por categoría, las tres vistas de `SH-10`: `general`, `femenino`, `masculino`. `GET /api/public/archers/:id` deja de devolver `leaguePoints` y `podiums`.
**DoD:** la respuesta trae `bestN` (el vigente, de `BE-18`) para que la landing no lo tenga que adivinar ni hardcodear "2" en ningún texto.

### `[x] BE-22` · Aprobar o rechazar altas pendientes · P1
_(Hecho. `approveArcher`/`rejectArcher` en `archerService.ts`, mismo patrón que `patrolAdminService.regeneratePin` (actorId por parámetro, sin transacción). `rejectArcher` duplica la guarda de `remove` —`hasParticipated` → `ARCHER_IN_USE`— en vez de reusar `remove` directo, porque son dos acciones semánticamente distintas que comparten la misma regla; no se abstrajo. `GET /admin/archers?status=pendiente` ya funcionaba desde `BE-19`, no hizo falta tocarlo.)_
**Objetivo:** el admin modera el padrón autoregistrado antes de que entre a cualquier torneo.
**Cómo:** agregar `archer.approve` y `archer.reject` a `AuditAction` (`db/types.ts`) y documentar el flujo en `FUNCTIONAL.md` §6.4, junto al CRUD de arqueros.
**Archivos:** `packages/api/src/routes/admin.ts`, `packages/api/src/services/archerService.ts`, `packages/api/src/repositories/archerRepo.ts`, `packages/api/src/repositories/auditRepo.ts`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.4 (ampliar) · decisión 7
**Contenido:** `GET /admin/archers?status=pendiente` (filtro existente, nuevo valor) · `POST /admin/archers/:id/approve` → `registrationStatus: 'aprobado'`, audit log · `POST /admin/archers/:id/reject` → reusa `archerRepo.remove` (un `pendiente` nunca participó, así que siempre se puede borrar), audit log con quién y cuándo. Las dos rutas exigen sesión de admin, como el resto de `/admin/*`.
**DoD:**
- Aprobar un arquero `pendiente` lo hace aparecer en la lista del wizard de torneo (`FE-11`) sin recargar nada manual.
- Rechazar lo borra del padrón; intentar rechazar uno que ya participó (no debería poder pasar, pero se verifica) devuelve `ARCHER_IN_USE`, no un borrado silencioso.
- Las dos acciones quedan en el audit log con `actorId` del admin.

### `[ ] FE-27` · Landing: alta de arquero (queda pendiente de aprobación)
**Objetivo:** el formulario que pide el brief, en la landing, sin autenticación.
**Archivos:** `packages/landing/src/pages/ArcherRegister.tsx`, ruta en `App.tsx`, acceso desde `Home.tsx`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §5 (la sección que escribe `BE-20`) · decisión 7
**DoD:** nombre, apellido, DNI, sexo (femenino/masculino) y categoría — incluida `principiantes` — validados en cliente y servidor · errores del servidor (DNI duplicado) se muestran tal cual, sin reinterpretarlos · la confirmación dice explícitamente que **queda pendiente de que el club lo apruebe** — no "ya estás anotado", porque todavía no lo está.

### `[ ] FE-28` · Quitar puntos de liga de todas las pantallas; ranking con pestañas de sexo
> **Dos de tres partes ya hechas.** «Quitar puntos de liga» (`SH-9`): `torneo.ts`, `Publish.tsx`, los dos `Ranking.tsx`, `Tournaments.tsx` y `Archer.tsx` ya no mencionan puntos de liga. «Leer la respuesta nueva» (`BE-21`): los dos `Ranking.tsx` ya leen `categoria.general.{ranked,notYetEligible}` — lo exigió el cambio de forma de la respuesta, no se podía dejar roto hasta esta tarea. Lo que queda de verdad: **las pestañas General/Femenino/Masculino** en la UI (ahora mismo `femenino`/`masculino` llegan en la respuesta y no se usan para nada).
**Archivos:** `packages/landing/src/pages/{Ranking,Tournaments,Archer}.tsx`, `packages/app/src/wafa/pages/{Ranking,Publish}.tsx`, `packages/app/src/wafa/torneo.ts`
**Referencia:** decisiones 3 y 5 · [`FUNCTIONAL.md`](FUNCTIONAL.md) §5.2 (reescribir)
**Contenido:**
- **Ranking de temporada** (landing y WAFA `Ranking.tsx`): se borra el `<fieldset>` de modo (`position` / `best_two`) y su explicación condicional, y la columna «Puntos». En su lugar, pestañas **General / Femenino / Masculino** por encima de las tarjetas de categoría. El texto de «mejor de N» usa el `bestN` que trae la respuesta (`BE-21`), nunca un «2» escrito en el JSX.
- **Resultado de un torneo** (landing `Tournaments.tsx`): se borra la columna que mostraba `leaguePointsForPosition(e.position)`.
- **Vista previa de publicar** (WAFA `torneo.ts` + `Publish.tsx`): se borra la fila de «puntos que se aplicarían» (`+{f.leaguePoints}`); la vista previa de podios por categoría queda igual.
- **Ficha de arquero** (landing `Archer.tsx`): se borra `<Dato etiqueta="Puntos de liga">` y el componente `<Podios>` con su conteo de 1º/2º/3º (decisión 3 incluyó borrar `podiums`, no sólo `leaguePoints`).
**DoD:** ninguna pantalla de `app` ni de `landing` muestra la palabra «puntos» referida a liga · con `LEAGUE_BEST_N=3` el texto explicativo dice «tres mejores», no «dos» · `data-testid` de cada tarjeta de categoría sigue siendo estable para los tests E2E existentes.

### `[ ] FE-29` · WAFA: sexo y DNI en el padrón
**Archivos:** `packages/wafa/.../pages/{Archers,ArcherForm}.tsx` (`FE-12`)
**Referencia:** decisión 6
**DoD:** alta y edición piden sexo y DNI · el listado marca con un aviso a quién le falta completar alguno de los dos (arqueros viejos) · búsqueda por DNI además de por nombre.

### `[ ] FE-30` · WAFA: cola de aprobación de altas pendientes
**Objetivo:** pantalla para que el admin revise y decida sobre lo que llega de la landing.
**Archivos:** `packages/app/src/wafa/pages/Archers.tsx` (sección nueva o pestaña), consume `BE-22`
**Referencia:** [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.4 · decisión 7
**DoD:** lista separada (o filtro) de arqueros `pendiente`, con los datos que mandó —nombre, DNI, sexo, categoría— y dos acciones, **Aprobar** y **Rechazar**, cada una con su confirmación · un arquero recién aprobado aparece de inmediato disponible en el wizard de torneo (`FE-11`) sin recargar la página.

### `[ ] TEST-3` · Tests de la fase
**Archivos:** `e2e/alta-publica.spec.ts` (nuevo), ajustes en `TEST-1`/`TEST-2` si tocan textos del ranking que cambiaron.
**Referencia:** [`TESTING.md`](TESTING.md) (agregar la subsección de esta fase)
**DoD:** el flujo completo nuevo — alta pública (queda `pendiente`) → admin la aprueba (`FE-30`) → admin lo suma a un torneo → publica → aparece en el ranking de su categoría y de su sexo, sin ningún «puntos de liga» en pantalla — probado de punta a punta, contra el stack real como `TEST-1`. Un segundo caso corto: un alta rechazada **no** aparece nunca en el wizard de torneo.

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
- Fase 8 (`SH-8`..`TEST-3`) — independiente del resto, sobre un sistema ya en producción. Orden interno: `SH-8` → `SH-9` → `SH-10` → `BE-18` → `BE-19` → `BE-20` → `BE-22` → `BE-21` → `FE-27`/`FE-29`/`FE-30` → `FE-28` → `TEST-3`.

**Cuatro tareas mandan sobre el resto:** `SH-3` (patrullas), `BE-10` (sync), `FE-2` (offline) y `FE-6` (teclado). Son las que definen si la app funciona el día del torneo. Se les da el tiempo que pidan y se cubren con tests antes de construir nada encima.

---

## Definición de terminado — aplica a toda tarea

- [ ] Los tests especificados en el DoD de la tarea, verdes.
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` verdes.
- [ ] Sin `any` sin justificar. Sin `console.log` olvidados.
- [ ] Sin SQL/Mongo fuera de `repositories/`. Sin reglas de negocio fuera de `shared`.
- [ ] `/security-review` si la tarea toca auth, datos o entrada del usuario.
- [ ] Tarea marcada `[x]` acá **y** anotada en [`BITACORA.md`](BITACORA.md).
