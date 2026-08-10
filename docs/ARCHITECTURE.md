# Arquitectura — BV Bahía Archers League

Cómo está construido el sistema y por qué. Para el detalle de esquemas y endpoints ver [`TECHNICAL.md`](TECHNICAL.md); para el protocolo offline, [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md).

---

## 1. Principios

1. **La red nunca está en el camino crítico de anotar un puntaje.** Todo lo demás se subordina a esto.
2. **Dominio puro y compartido.** Las reglas (scoring, patrullas, ranking) viven en un solo lugar, sin I/O, y las usan tanto el frontend como el backend. Cero duplicación, cero divergencia.
3. **El servidor es la autoridad.** El cliente propone tokens de flecha; el servidor deriva los valores y recalcula los totales. Nunca se confía en un total del cliente.
4. **Monolítica y desplegable como un contenedor**, pero modular: separar frontend y backend en repos distintos más adelante no debe requerir reescribir nada.
5. **Performance y seguridad no son features.** Son restricciones. Ver [`SECURITY.md`](SECURITY.md).

---

## 2. Por qué este diseño

Espeja **`bv-easy-archery-battle`** (mismo autor), que ya resuelve auth con sesión httpOnly + CSRF, tema claro/oscuro anti-FOUC, PWA instalable, scoring WA y monorepo pnpm con paquete `shared`. Eso baja el riesgo y el tiempo de arranque de forma significativa.

Los cambios respecto de esa base son deliberados y responden a este dominio:

| Cambio | Motivo |
|---|---|
| **MongoDB Atlas** en vez de SQLite local | El brief lo pide. Atlas además da replica set → transacciones ACID, que hacen falta para crear y publicar torneos de forma atómica. |
| **Modalidad por blanco** en vez de por torneo | Los torneos multitarget mezclan modalidades en un mismo recorrido. Esto atraviesa el modelo de datos, la validación y la UI de scoring. |
| **Offline-first real** en vez de online-only | Es el requisito duro del proyecto. Trae IndexedDB, outbox, sincronización idempotente y resolución de conflictos. |
| **Patrullas con líder** en vez de un único usuario | Múltiples escritores concurrentes en el mismo torneo, cada uno con permiso acotado a su patrulla. |
| **Liga multi-torneo** | Rankings acumulados por temporada, materializados al publicar. |
| **3 aplicaciones** en vez de 1 | Públicos y superficies de ataque distintas. |

---

## 3. Topología

```
┌──────────────────── Railway — contenedor único (Node 20) ────────────────────┐
│                                                                              │
│   Hono  (@bal/api)                                                           │
│    ├─ /api/auth/*      sesión admin, CSRF                                    │
│    ├─ /api/admin/*     torneos, arqueros, temporadas, patrullas, publicar    │
│    ├─ /api/wafl/*      bundle, sync, firmas, cierre  ← sesión de patrulla    │
│    ├─ /api/public/*    rankings, torneos, fichas     ← sin auth, cacheado    │
│    ├─ /api/health      healthcheck de Railway                                │
│    │                                                                          │
│    ├─ /app/*   →  build PWA  (WAFA + WAFL)   service worker scope=/app        │
│    └─ /*       →  build landing (público, headers de caché largos)            │
│                                                                              │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │ TLS · driver mongodb
                                     ▼
                    ┌────────────────────────────────┐
                    │  MongoDB Atlas (replica set)   │
                    │  → transacciones multi-doc     │
                    └────────────────────────────────┘
```

**Un solo origen.** Sin CORS, cookies simples con `SameSite=Lax`, y el frontend habla con `/api` en relativo. Esto elimina una categoría entera de bugs y de vectores de ataque.

### Por qué dos builds de frontend

| | Landing | App (WAFA + WAFL) |
|---|---|---|
| Ruta | `/` | `/app` |
| Público | Cualquiera | Admin y líderes |
| Service worker | Ninguno (solo headers de caché) | Sí, `scope=/app`, `registerType: 'prompt'` |
| Instalable | No | Sí |
| Objetivo | Carga rápida y pública | Funcionar sin red |

Separarlas evita que un visitante cargue el bundle de administración, mantiene la landing liviana, y acota el service worker a donde realmente hace falta. WAFA y WAFL comparten build porque comparten el 70% de su infraestructura (auth, tema, UI, cliente de API) y se separan por routing según el rol de la sesión — el código específico de cada una se carga con `React.lazy`.

---

## 4. Monorepo (pnpm workspaces)

```
bv-bahia-archers-league/
├─ package.json              scripts raíz (dev / build / test / lint / typecheck)
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ biome.json                lint + format
├─ Dockerfile                multi-stage
├─ railway.json
├─ .env.example
├─ CLAUDE.md                 contexto permanente para modelos de IA
├─ docs/                     esta documentación
└─ packages/
   ├─ shared/    @bal/shared    dominio puro, sin I/O
   ├─ api/       @bal/api       Hono + mongodb + Zod
   ├─ app/       @bal/app       React PWA — WAFA + WAFL
   └─ landing/   @bal/landing   React público
```

### `@bal/shared` — el dominio

Sin una sola importación de Node ni del navegador. Todo función pura. Es el paquete con la cobertura de tests más alta del repo.

```
src/
  constants.ts     modalidades, categorías, estacas, defaults, sets de scoring
  domain.ts        tipos y catálogos
  scoring.ts       tokenValue · validateTargetScore · maxTargetScore · sortArrowsDescending
  patrolling.ts    buildPatrols · validatePatrols   (H1..H4, S1..S3)
  ranking.ts       orden y desempate dentro de un torneo
  league.ts        puntos de liga, normalización, mínimo de torneos, desempates de temporada
  stats.ts         agregaciones de torneo, participante y arquero
  schemas/         Zod .strict() de todos los inputs
  types.ts         DTOs de la API
```

**Regla:** si una lógica de negocio puede vivir acá, vive acá. El backend orquesta y persiste; no decide reglas.

### `@bal/api` — el backend

Tres capas, estrictas:

```
routes         HTTP + validación Zod + extracción de la sesión
   ↓
services       negocio, orquestación, transacciones
   ↓
repositories   único lugar donde se toca MongoDB
```

```
src/
  app.ts  index.ts  env.ts
  db/            client (pool), indexes, migrations/, seed, reset
  lib/           crypto (argon2id, AES-GCM), session, csrf, tokens, errors, time
  middleware/    auth (admin | patrol), csrf, validate, error, security, rateLimit, cache
  repositories/  userRepo · archerRepo · seasonRepo · tournamentRepo · patrolRepo
                 participantRepo · scoreRepo · syncOpRepo · standingRepo · auditRepo
  services/      authService · archerService · seasonService · tournamentService
                 patrolService · syncService · signatureService · publishService
                 rankingService · statsService
  routes/        auth · admin/* · wafl/* · public/* · health
```

**Ninguna consulta a Mongo fuera de `repositories/`.** Esto es lo que hace posible auditar la seguridad de la capa de datos en un solo lugar.

### `@bal/app` — WAFA + WAFL

```
src/
  main.tsx  App.tsx  theme.tsx
  lib/         apiClient (CSRF) · queryClient · pwaInstall · cn · errorMessage
  offline/     db.ts (IndexedDB) · outbox.ts · syncWorker.ts · useSyncStatus.ts
  auth/        useSession · AdminRoute · PatrolRoute
  wafa/        pages/ (Login, Home, TournamentCreate, Tournament, Patrols,
               Archers, Seasons, Publish) · hooks/
  wafl/        pages/ (Login, Circuit, Target, Progress, FinalResults, Sign)
               components/ (ScoreKeypad, ArrowRow, UnitCard, SyncBadge, SignaturePad)
  components/  ui/ · AppShell · ThemeMenu · InstallPrompt · UpdatePrompt
```

WAFL lee **siempre de IndexedDB**, nunca directamente de la red. Esa es la propiedad que hace que funcione offline sin código condicional esparcido por toda la UI.

### `@bal/landing` — público

SPA liviana con React Router. Consume solo `/api/public/*`. Sin service worker propio; se apoya en headers de caché y en respuestas cacheadas del servidor.

---

## 5. Modelo de datos

Detalle completo de campos, índices y ejemplos en [`TECHNICAL.md`](TECHNICAL.md). Acá el mapa de relaciones y las decisiones.

```
users ──< sessions >── patrols
seasons ──< tournaments ──< patrols ──< participants >── archers  (snapshot)
                        │                    │
                        │                    └──< scores
                        └──< auditLog

standings   ← materializado al publicar (seasonId × categoría × archer)
syncOps     ← idempotencia del outbox (TTL 7 días)
```

### Decisión 1 — Blancos embebidos en el torneo

`tournaments.targets[]` es un array embebido, no una colección aparte.

**Por qué:** son entre 14 y 28 por torneo, siempre se leen junto con el torneo y nunca se consultan de forma independiente. Embebidos, leer un torneo es **una sola lectura**. El límite de 16 MB por documento está a órdenes de magnitud de distancia.

### Decisión 2 — Snapshot del arquero en `participants`

Al crear el torneo se congela nombre, apellido y categoría de cada arquero dentro de su documento de participante.

**Por qué:** si un arquero cambia de categoría el año que viene, o se archiva, o corrige la grafía de su apellido, el histórico no debe moverse. Un torneo publicado es un registro inmutable de lo que pasó ese día. `archerId` se conserva como referencia para agregar la ficha del arquero, pero el dato que se muestra en el torneo es el snapshot.

### Decisión 3 — Rollups denormalizados

`participants` mantiene `total`, `xCount`, `tenCount`, `innerCount`, `mCount`, `targetsCompleted` y `normalizedPct` actualizados por delta en la misma transacción en que se escribe un puntaje.

**Por qué:** podios y estadísticas se resuelven en O(participantes) leyendo una sola colección, sin recorrer flechas ni agregar `scores`. Con 20-40 participantes eso es una lectura de milisegundos. El costo es mantener la coherencia, que se paga con transacciones y con un comando de reconciliación (`db:reconcile`) que recalcula desde `scores` si algo se desalinea.

### Decisión 4 — `standings` materializado al publicar

El ranking de liga no se calcula al vuelo en cada visita a la landing: se materializa en la transacción de publicación.

**Por qué:** la landing es lo único público y lo que más tráfico recibe. Materializar convierte el ranking en una consulta indexada directa. Publicar es una operación rara (una por mes); calcular ahí es gratis.

### Decisión 5 — `syncOps` con TTL

Cada operación del outbox lleva un `opId` único que se persiste con TTL de 7 días.

**Por qué:** hace la sincronización **idempotente**. Si un batch se envía dos veces porque se cortó la conexión justo después de que el servidor lo procesó, la segunda vez no duplica nada. El TTL evita que la colección crezca sin límite; 7 días cubre con holgura cualquier reintento realista.

---

## 6. Flujos críticos

### 6.1 Crear torneo — transacción

```
POST /api/admin/tournaments
  │
  ├─ Zod .strict() valida el input
  ├─ calcula maxPossibleScore desde targets[]
  │
  └─ withTransaction:
       1. insert tournament (status = sin_iniciar)
       2. buildPatrols(participantes, stakeMap)        ← @bal/shared, determinista
       3. insert participants  (snapshot + estaca + patrulla + unidad + posición)
       4. genera credenciales: PIN 6 dígitos crypto → argon2id + AES-256-GCM
       5. insert patrols (con blanco de inicio repartido)
       6. insert auditLog
  │
  └─ devuelve el torneo + warnings del armado (ej. escuela sin senior)
```

Todo o nada. Si el armado de patrullas falla, no queda un torneo huérfano.

### 6.2 Anotar un puntaje — el camino crítico

```
   TOQUE DEL LÍDER
        │
        ├──▶ 1. escribe en IndexedDB           ← ~1 ms
        ├──▶ 2. la UI re-renderiza desde IDB   ← < 50 ms percibidos  ✔ acá termina lo que el usuario espera
        └──▶ 3. encola op en el outbox
                    │
                    └╌╌▶ (asincrónico, cuando haya red)
                          POST /api/wafl/sync  { ops: [...] }
                             ├─ verifica sesión de patrulla
                             ├─ dedup por opId (índice único en syncOps)
                             ├─ autoriza: ¿este participante es de MI patrulla?
                             ├─ validateTargetScore(modalidad del blanco, arrows)
                             ├─ recalcula total y contadores           ← el server manda
                             ├─ LWW por clientUpdatedAt
                             ├─ upsert score + delta a los rollups     ← misma transacción
                             └─ devuelve el estado aplicado
```

El paso 3 puede fallar, reintentarse mil veces o quedar pendiente días. Nada de eso afecta al usuario anotando.

### 6.3 Sincronización

Detalle completo en [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md). En resumen: batch de ops idempotentes, autorización por op, last-write-wins sobre `clientUpdatedAt`, el servidor siempre recalcula.

### 6.4 Cerrar el circuito de una patrulla

```
POST /api/wafl/close   (llega como op del outbox)
  └─ withTransaction:
       1. verifica que TODOS los blancos tienen puntaje de TODOS los participantes
       2. verifica que existen TODAS las firmas
       3. patrol.status = 'cerrada'
       4. si todas las patrullas del torneo están cerradas
            → tournament.status = 'completado'
       5. auditLog
```

Las dos verificaciones son server-side. El cliente puede habilitar el botón cuando quiera; el servidor decide.

### 6.5 Publicar — transacción

```
POST /api/admin/tournaments/:id/publish
  └─ withTransaction:
       1. exige status = 'completado'
       2. calcula podios por categoría          ← ranking.ts
       3. reparte puntos de liga 5-4-3-2-1      ← league.ts
       4. upsert standings (seasonId × categoría × archerId):
            leaguePoints += puntos
            bestNormalizedPct = max(actual, el de este torneo)
            tournamentsPlayed += 1
       5. tournament.status = 'publicado', publishedAt, publishedBy
       6. invalida la caché de /api/public/*
       7. auditLog
```

`despublicar` es la inversa exacta, en una transacción equivalente, y también auditada.

---

## 7. Estado y caché en el frontend

| Capa | WAFA | WAFL | Landing |
|---|---|---|---|
| Estado del servidor | TanStack Query | **IndexedDB** (fuente de verdad local) | TanStack Query |
| Escrituras | Directas a la API | Outbox → sync | — |
| Sin conexión | Lectura de caché; escrituras bloqueadas con aviso | **Totalmente funcional** | Última respuesta cacheada |
| Estado local | tema, preferencias (`localStorage`) | ídem + estado de sync | tema |

En WAFL, TanStack Query se usa solo para la descarga inicial del bundle y para reflejar el estado de sincronización. **Toda la UI de scoring lee de IndexedDB.** Esta es la decisión que hace que el modo offline no requiera ramas condicionales por toda la aplicación: no hay un "modo offline", hay un solo modo que resulta funcionar sin red.

---

## 8. Service worker y actualizaciones

- `vite-plugin-pwa` con **`registerType: 'prompt'`**. Nunca `autoUpdate`.
- **Por qué:** `autoUpdate` recarga la aplicación cuando detecta una versión nueva. Hacer eso a mitad de un recorrido es inaceptable. La actualización se ofrece con un aviso y la aplica el usuario cuando quiere.
- Precache del app shell y los assets. Runtime caching `NetworkFirst` con timeout corto para `GET /api` — irrelevante para WAFL, que lee de IndexedDB, pero útil para WAFA.
- Actualizar el service worker **no toca IndexedDB**. Los datos pendientes sobreviven a cualquier actualización.
- La versión de la aplicación se inyecta en build y se muestra en la UI, para poder diagnosticar en el campo.

---

## 9. Reutilización desde `bv-easy-archery-battle`

Rutas relativas a `C:\Users\braia\projects\bv-easy-archery-battle`.

| Qué | Origen | Adaptación necesaria |
|---|---|---|
| `tokenValue`, `validateEndScore`, `maxEndScore`, `sortArrowsDescending` | `packages/shared/src/scoring.ts` | Renombrar `end` → `target`; agregar el token `X6` de campo |
| Catálogos de modalidades y categorías | `packages/shared/src/domain.ts` `constants.ts` | Agregar categorías del club; estacas del club |
| Ranking y desempates | `packages/shared/src/ranking.ts` | Reusable casi tal cual |
| Estadísticas | `packages/shared/src/stats.ts` | Agregar desglose por modalidad |
| Pareo por estaca | `packages/shared/src/pairing.ts` | **Reescribir**: base útil, pero las reglas de patrulla del club son distintas |
| Sesión httpOnly, CSRF, argon2id, rate limit, headers de seguridad | `packages/api/src/{lib,middleware}/*` | Portar; agregar el tipo de sesión `patrol` |
| `apiClient` con CSRF, `queryClient`, `useAuth`, rutas protegidas | `packages/web/src/{lib,auth}/*` | Portar; agregar guard por rol |
| `ScoreKeypad`, `EndRow`, `PairCard`, `StatTile`, `PodiumList`, `EvolutionChart` | `packages/web/src/components/*` | Portar; el keypad debe volverse dependiente de la modalidad del blanco |
| Tema claro/oscuro anti-FOUC | `packages/web/src/theme.tsx` + `public/theme-init.js` | Portar tal cual |
| PWA (VitePWA) | `packages/web/vite.config.ts` | Portar; cambiar a `registerType: 'prompt'` y `scope: '/app'` |
| Monorepo, Biome, tsconfig, Dockerfile, `railway.json` | raíz | Portar; el Dockerfile cambia (sin binario nativo de SQLite) |

**No se reutiliza:** toda la capa de persistencia (SQLite → MongoDB) y todo lo relacionado con offline (no existe en el origen).

---

## 10. Camino a separar frontend y backend en repos distintos

Contemplado desde el día uno, sin costo hoy:

1. `@bal/shared` se publica como paquete versionado (registry privado o dependencia git).
2. `@bal/api`, `@bal/app` y `@bal/landing` lo consumen como dependencia externa.
3. Cada uno se muda a su repo. Los frontends pasan a apuntar a la URL del backend por variable de entorno (`VITE_API_BASE`, ya contemplada) y el backend habilita CORS con origen explícito.

Ningún cambio de lógica de negocio. Es la razón por la que el dominio está aislado en `shared` y por la que el frontend nunca importa nada de `api`.

---

## 11. Alternativas evaluadas y descartadas

| Alternativa | Por qué se descartó |
|---|---|
| **MongoDB en el plugin de Railway** | El template es standalone: sin replica set no hay transacciones multi-documento. Crear y publicar un torneo dejarían de ser atómicos. Atlas M0 es gratis y sí es replica set. |
| **Mongoose** | Agrega peso y una capa de magia sobre queries que queremos poder auditar línea por línea. Con repositorios tipados y Zod ya tenemos validación y tipos; el ODM no aporta lo suficiente. |
| **Una sola SPA para las tres apps** | La landing cargaría el bundle de administración y el service worker. Peor first-load público y mayor superficie de ataque. |
| **Tres builds separados** | WAFA y WAFL comparten demasiada infraestructura; tres pipelines y un paquete común extra por un aislamiento que el routing por rol y `React.lazy` ya dan. |
| **Solo caché de assets, sin sincronización** | La PWA cargaría sin red pero no se podría anotar. Es exactamente el modo de falla que el proyecto existe para evitar. |
| **CRDTs para resolver conflictos** | Una patrulla es un único escritor. LWW sobre `clientUpdatedAt` resuelve el caso real (un líder con dos dispositivos) con una fracción de la complejidad. |
| **WebSockets para el seguimiento en vivo** | El admin refrescando cada pocos segundos alcanza. Un socket abierto en el celu del líder consume batería y agrega un modo de falla, a cambio de nada que el torneo necesite. |
| **`registerType: 'autoUpdate'` en la PWA** | Recargaría la app a mitad de recorrido. Inaceptable. |
| **Guardar solo al firmar** (literal al brief) | Un celu que se apaga se lleva el recorrido completo de la patrulla. Ver `FUNCTIONAL.md` §7.5. |
