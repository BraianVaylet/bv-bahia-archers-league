# Documentación técnica — BV Bahía Archers League

Esquemas, contratos y convenciones. Para el porqué de las decisiones ver [`ARCHITECTURE.md`](ARCHITECTURE.md); para el protocolo offline, [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md).

---

## 1. Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Lenguaje | TypeScript `strict` en todo el monorepo | **5.9.3** |
| Runtime | Node | ≥ 20 LTS |
| Monorepo | pnpm workspaces | **9.15.0** |
| Backend | Hono | 4.x |
| Base de datos | MongoDB Atlas (replica set) + driver oficial `mongodb` | server 7.x · driver 6.x |
| Validación | Zod `.strict()` | **4.x** |
| Frontend | **React 19**, **Vite 8**, Tailwind CSS 4, TanStack Query 5, React Router 6 | — |
| PWA | `vite-plugin-pwa` (Workbox) | 0.21+ |
| Offline | `idb` (wrapper de IndexedDB) | 8.x |
| Hash | **`@node-rs/argon2`** (argon2id) | 2.x |
| Lint y format | Biome | **2.5.7** |
| Tests | **Vitest 4** · Testing Library · `mongodb-memory-server` · `fake-indexeddb` · Playwright | — |
| Deploy | Docker multi-stage sobre Railway | — |

> **Sobre TypeScript 7.** Existe y está publicado como `latest`, pero la compatibilidad del resto del toolchain (Vite, Vitest, Biome) con la reescritura nativa no está verificada. El proyecto arranca en **5.9.3** y la migración a 7 queda como tarea `P2`. Ver [`BITACORA.md`](BITACORA.md), entrada `INF-1`.

---

## 2. Modelo de datos (MongoDB)

### Convenciones

- `_id`: `ObjectId` nativo. Se serializa a string en la API.
- Timestamps: `Date` de BSON. En la API viajan como ISO 8601.
- Enums: `string` con validación en Zod y en `$jsonSchema` del validador de colección.
- Todas las colecciones tienen `createdAt`; las mutables, `updatedAt`.
- Los índices se crean en el arranque de forma idempotente (`createIndexes`).
- Se aplica **JSON Schema validation** a nivel de colección como red de seguridad; la validación real es Zod en el borde.

### 2.1 `users` — administradores

```js
{
  _id: ObjectId,
  username: "admin",                    // único, lowercase
  passwordHash: "$argon2id$...",
  mustChangePassword: true,             // fuerza el cambio al primer login
  lastLoginAt: Date | null,
  failedAttempts: 0,
  lockedUntil: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```
Índices: `{ username: 1 }` **unique**.

### 2.2 `sessions` — admin y patrulla

```js
{
  _id: ObjectId,
  tokenHash: "sha256hex",               // NUNCA el token en claro
  subjectType: "admin" | "patrol",
  subjectId: ObjectId,                  // userId o patrolId
  tournamentId: ObjectId | null,        // solo para patrol
  expiresAt: Date,
  createdAt: Date,
  ip: String | null,
  userAgent: String | null
}
```
Índices: `{ tokenHash: 1 }` **unique** · `{ expiresAt: 1 }` **TTL `expireAfterSeconds: 0`** · `{ subjectType: 1, subjectId: 1 }`.

El índice TTL limpia las sesiones vencidas sin ningún trabajo de la aplicación.

### 2.3 `seasons` — temporadas de liga

```js
{
  _id: ObjectId,
  name: "Liga Bahiense 2026",
  startsAt: Date,
  endsAt: Date,
  status: "activa" | "cerrada",
  createdAt: Date,
  updatedAt: Date
}
```
Índices: `{ status: 1, startsAt: -1 }`.

### 2.4 `archers` — padrón

```js
{
  _id: ObjectId,
  firstName: "Juan",
  lastName: "Pérez",
  category: "razo",                     // ver DOMAIN_WA.md §3
  searchKey: "perez juan",              // normalizado sin acentos, para buscar
  archivedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```
Índices: `{ archivedAt: 1, lastName: 1, firstName: 1 }` · `{ searchKey: 1 }` · `{ category: 1 }`.

### 2.5 `tournaments`

```js
{
  _id: ObjectId,
  seasonId: ObjectId,
  name: "3ª fecha — Liga Bahiense",
  date: Date,
  description: String,
  status: "sin_iniciar" | "en_proceso" | "completado" | "publicado",

  payment: { required: true, amount: 15000 },   // monto ÚNICO para todos

  targets: [                            // EMBEBIDO — 14 a 28 elementos
    { index: 1,  modality: "3d",         arrows: 2, description: "Jabalí" },
    { index: 7,  modality: "campo",      arrows: 3, description: null },
    { index: 13, modality: "aire_libre", arrows: 6, description: null },
    { index: 14, modality: "sala",       arrows: 3, description: null }
  ],

  maxPossibleScore: 330,                // congelado; recalculado si se edita un blanco virgen
  stakeMap: {                           // editable por torneo
    roja:     ["recurvo", "compuesto", "cazador"],
    azul:     ["razo", "tradicional", "longbow"],
    amarilla: ["escuela"]
  },
  distances: { roja: 45, azul: 30, amarilla: 15 },   // informativo

  patrolCount: 5,
  participantCount: 20,

  createdAt: Date,
  startedAt: Date | null,
  completedAt: Date | null,
  publishedAt: Date | null,
  publishedBy: ObjectId | null
}
```
Índices: `{ status: 1, date: -1 }` · `{ seasonId: 1, status: 1 }` · `{ date: -1 }`.

`targets[].index` es 1-based, contiguo y único dentro del torneo. Es la clave por la que se referencia un blanco en `scores`.

### 2.6 `patrols`

```js
{
  _id: ObjectId,
  tournamentId: ObjectId,
  number: 3,
  startTargetIndex: 10,
  username: "patrulla3",
  pinHash: "$argon2id$...",             // verificación del login
  pinEnc: "base64(iv|ciphertext|tag)",  // AES-256-GCM — ver SECURITY.md §3
  pinUpdatedAt: Date,
  status: "pendiente" | "en_curso" | "pendiente_firma" | "cerrada",
  failedAttempts: 0,
  lockedUntil: Date | null,
  targetsCompleted: 0,
  closedAt: Date | null,
  manualOverride: false,                // true si el admin editó la patrulla a mano
  createdAt: Date,
  updatedAt: Date
}
```
Índices: `{ tournamentId: 1, number: 1 }` **unique** · `{ tournamentId: 1, username: 1 }` **unique** · `{ tournamentId: 1, status: 1 }`.

### 2.7 `participants` — snapshot + rollups

```js
{
  _id: ObjectId,
  tournamentId: ObjectId,
  patrolId: ObjectId,
  archerId: ObjectId,                   // referencia; el dato mostrado es el snapshot

  // snapshot congelado al crear el torneo
  firstName: "Juan",
  lastName: "Pérez",
  category: "razo",

  // asignación
  stake: "azul",
  unit: "A",                            // A tira primero
  position: "izquierda" | "derecha",

  // rollups denormalizados — actualizados por delta en la transacción del score
  total: 0,
  innerCount: 0,                        // X + X6 + 11
  xCount: 0,
  tenCount: 0,
  mCount: 0,
  targetsCompleted: 0,
  normalizedPct: 0,                     // total / tournament.maxPossibleScore * 100
  byModality: { sala: 0, aire_libre: 0, campo: 0, "3d": 0 },

  status: "activo" | "ausente",
  paid: false,                          // sólo el booleano; el monto es del torneo

  signature: {
    pngDataUrl: "data:image/png;base64,...",   // ≤ 40 KB, comprimido
    signedAt: Date,
    scorecardHash: "sha256hex",                // hash del puntaje al firmar
    unlockedBy: ObjectId | null,               // si el admin desbloqueó
    unlockReason: String | null
  } | null,

  createdAt: Date,
  updatedAt: Date
}
```
Índices: `{ tournamentId: 1, patrolId: 1 }` · `{ tournamentId: 1, category: 1, total: -1 }` · `{ archerId: 1 }` · `{ tournamentId: 1, archerId: 1 }` **unique**.

El índice `{ tournamentId, category, total: -1 }` resuelve los podios por categoría con un solo recorrido de índice.

### 2.8 `scores` — un documento por (participante, blanco)

```js
{
  _id: ObjectId,
  tournamentId: ObjectId,
  patrolId: ObjectId,
  participantId: ObjectId,
  targetIndex: 7,
  modality: "campo",                    // copiado del blanco al momento de cargar
  arrows: ["6", "5", "M"],              // tokens; el orden no importa

  // TODO lo siguiente lo calcula el servidor. Nunca se acepta del cliente.
  total: 11,
  innerCount: 0,
  xCount: 0,
  tenCount: 0,
  mCount: 1,

  clientUpdatedAt: Date,                // reloj del cliente — para LWW
  lastOpId: "uuid-v7",
  updatedAt: Date,                      // reloj del servidor
  createdAt: Date
}
```
Índices: `{ participantId: 1, targetIndex: 1 }` **unique** · `{ tournamentId: 1, targetIndex: 1 }` · `{ patrolId: 1 }`.

### 2.9 `syncOps` — idempotencia

```js
{
  _id: "uuid-v7-del-cliente",           // el opId ES la clave primaria
  patrolId: ObjectId,
  type: "score" | "signature" | "close",
  appliedAt: Date,
  result: "applied" | "superseded" | "rejected",
  expiresAt: Date                       // appliedAt + 7 días
}
```
Índices: `{ expiresAt: 1 }` **TTL** · `{ patrolId: 1, appliedAt: -1 }`.

Usar el `opId` del cliente como `_id` hace que la deduplicación sea un `insert` que falla con `E11000`. No hace falta un `findOne` previo.

### 2.10 `standings` — ranking materializado

```js
{
  _id: ObjectId,
  seasonId: ObjectId,
  category: "razo",
  archerId: ObjectId,
  firstName: "Juan",                    // desnormalizado para render directo
  lastName: "Pérez",

  leaguePoints: 12,
  tournamentsPlayed: 3,
  podiums: { first: 1, second: 1, third: 0 },

  bestNormalizedPct: 78.4,              // el mejor SUELTO de la temporada
  bestRawScore: 259,
  bestTournamentId: ObjectId,

  topTwoPcts: [82.1, 78.4],             // los dos mejores, de mayor a menor

  totalX: 14, totalTens: 22, totalM: 3,
  updatedAt: Date
}
```
Índices: `{ seasonId: 1, category: 1, leaguePoints: -1 }` · `{ seasonId: 1, archerId: 1, category: 1 }` **unique** · `{ archerId: 1 }`.

`topTwoPcts` guarda los dos mejores porcentajes y **no** su promedio: el acumulado se construye de forma incremental, torneo por torneo, y para saber si el que llega desplaza a alguno hay que conocer a los dos que están. El promedio lo deriva `bestTwoAvgPct` al serializar, así que no hay dos copias del mismo número que puedan separarse.

> **Baja de `ix_ranking_puntaje`.** Existía un índice sobre `bestNormalizedPct` para «el otro modo de ranking». Nunca lo usó ninguna consulta: la landing trae la temporada entera con `find({ seasonId })` y la ordena en memoria con `sortStandings` —son cientos de documentos, no millones— así que el índice que sirve es el del prefijo `seasonId`. Con «mejor de 2» el campo además dejó de ordenar ningún ranking.

### 2.11 `auditLog`

```js
{
  _id: ObjectId,
  at: Date,
  actorType: "admin" | "patrol" | "system",
  actorId: ObjectId | null,
  action: "tournament.publish" | "tournament.unpublish" | "signature.unlock"
        | "patrol.pin.regenerate" | "patrol.manual_edit" | "tournament.target_edit"
        | "sync.conflict",
  entity: "tournament" | "patrol" | "participant",
  entityId: ObjectId,
  meta: Object,                         // sin datos sensibles
  ip: String | null
}
```
Índices: `{ at: -1 }` · `{ entity: 1, entityId: 1, at: -1 }`.

---

## 3. API

Base `/api`. JSON. Errores con forma uniforme:

```json
{ "error": { "code": "INVALID_STATE_TRANSITION", "message": "...", "details": {} } }
```

**Reglas transversales:**
- Toda mutación exige el header `x-csrf-token`.
- Toda entrada se valida con Zod `.strict()`.
- Toda ruta de `/api/admin/*` exige sesión `admin`; toda ruta de `/api/wafl/*` exige sesión `patrol` **y** verifica que el recurso pertenezca a esa patrulla.
- `/api/public/*` no requiere auth y responde con `Cache-Control` según §5.

### 3.1 Auth

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/auth/csrf` | Asegura la cookie CSRF y devuelve el token |
| `POST` | `/api/auth/admin/login` | `{ username, password }` → cookie de sesión |
| `POST` | `/api/auth/admin/password` | `{ currentPassword, newPassword }` — obligatorio si `mustChangePassword` |
| `POST` | `/api/auth/patrol/login` | `{ tournamentCode, username, pin }` → cookie de sesión de patrulla |
| `GET` | `/api/auth/me` | Sujeto de la sesión actual, o 401 |
| `POST` | `/api/auth/logout` | Invalida la sesión |

### 3.2 Admin — arqueros y temporadas

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/api/admin/archers?archived=false&q=` | Listado con búsqueda |
| `POST` | `/api/admin/archers` | `{ firstName, lastName, category }` |
| `PATCH` | `/api/admin/archers/:id` | Edición |
| `POST` | `/api/admin/archers/:id/archive` | Archivar |
| `POST` | `/api/admin/archers/:id/restore` | Restaurar |
| `DELETE` | `/api/admin/archers/:id` | **409** si participó de algún torneo |
| `GET` `POST` `PATCH` | `/api/admin/seasons[/:id]` | CRUD de temporadas |

### 3.3 Admin — torneos

| Método | Ruta | Notas |
|---|---|---|
| `POST` | `/api/admin/tournaments` | Crea torneo + participantes + patrullas + credenciales (transacción) |
| `GET` | `/api/admin/tournaments?status=&seasonId=` | Listado |
| `GET` | `/api/admin/tournaments/:id` | Detalle + avance + resumen |
| `PATCH` | `/api/admin/tournaments/:id` | Solo `sin_iniciar`, o blancos sin puntajes si `en_proceso` |
| `POST` | `/api/admin/tournaments/:id/start` | `sin_iniciar` → `en_proceso` |
| `POST` | `/api/admin/tournaments/:id/publish` | `completado` → `publicado` (transacción, materializa standings) |
| `POST` | `/api/admin/tournaments/:id/unpublish` | Revierte. Auditado |
| `DELETE` | `/api/admin/tournaments/:id` | Solo `sin_iniciar` |

### 3.4 Admin — patrullas

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/api/admin/tournaments/:id/patrols` | Composición + credenciales (PIN descifrado) |
| `PUT` | `/api/admin/tournaments/:id/patrols` | Reemplaza la distribución. Solo `sin_iniciar`. Devuelve violaciones sin bloquear |
| `POST` | `/api/admin/patrols/:id/pin/regenerate` | Nuevo PIN; invalida sesiones de esa patrulla |
| `POST` | `/api/admin/participants/:id/signature/unlock` | `{ reason }` — desbloqueo auditado |

### 3.4.1 Admin — pagos

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/api/admin/tournaments/:id/payments` | Quién pagó, y la recaudación **derivada** (pagos × monto) |
| `POST` | `/api/admin/participants/:id/payment` | `{ paid }` — **sólo el booleano**. El monto es el del torneo y lo lee el servidor |

Van bajo `/admin` y no en el endpoint público: quién pagó y quién no es información del club, no del ranking.

### 3.5 WAFL

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/api/wafl/bundle` | **Todo** lo necesario para el recorrido completo. Se llama una vez, al entrar |
| `POST` | `/api/wafl/sync` | Batch de ops idempotentes. Ver [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) |
| `GET` | `/api/wafl/state` | Estado server-side de la patrulla (para reconciliar tras cambiar de dispositivo) |

`GET /api/wafl/bundle` devuelve:

```jsonc
{
  "tournament": { "id": "...", "name": "...", "date": "...", "maxPossibleScore": 330,
                  "targets": [ /* ordenados desde startTargetIndex */ ] },
  "patrol":     { "id": "...", "number": 3, "startTargetIndex": 10, "status": "en_curso" },
  "participants": [ { "id": "...", "firstName": "...", "lastName": "...",
                      "category": "razo", "stake": "azul", "unit": "A", "position": "izquierda" } ],
  "scores":     [ { "participantId": "...", "targetIndex": 10, "arrows": ["6","5","M"] } ],
  "signatures": [ { "participantId": "...", "signedAt": "..." } ],
  "serverTime": "2026-08-10T13:00:00.000Z"
}
```

`serverTime` permite al cliente calcular el desfase de reloj y corregir `clientUpdatedAt` antes de encolar.

### 3.6 Público (landing)

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/api/public/seasons` | Temporadas disponibles |
| `GET` | `/api/public/rankings?seasonId=&mode=position\|best_two` | Ranking por categoría. `best_two` es el promedio de los dos mejores porcentajes |
| `GET` | `/api/public/tournaments` | Publicados y en proceso |
| `GET` | `/api/public/tournaments/:id` | Detalle. Sin puntajes si no está publicado |
| `GET` | `/api/public/archers/:id` | Ficha histórica |

### 3.7 Salud

| `GET` | `/api/health` | `{ status, version, db: "ok" \| "degraded", uptime }`. Usado por el healthcheck de Railway |

### 3.8 Ejemplo — sync

```http
POST /api/wafl/sync
x-csrf-token: <token>
Content-Type: application/json

{
  "ops": [
    { "opId": "0192f3a1-...", "type": "score", "clientUpdatedAt": "2026-08-10T14:22:31.004Z",
      "participantId": "66b...", "targetIndex": 7, "arrows": ["6","5","M"] }
  ]
}
```

```json
{
  "results": [
    { "opId": "0192f3a1-...", "status": "applied",
      "score": { "total": 11, "innerCount": 0, "xCount": 0, "tenCount": 0, "mCount": 1 } }
  ],
  "patrol": { "status": "en_curso", "targetsCompleted": 3 },
  "serverTime": "2026-08-10T14:25:02.100Z"
}
```

`status` por op: `applied` · `superseded` (llegó una versión más nueva) · `duplicate` (ya aplicada) · `rejected` (con `error`).

---

## 4. Validación

`@bal/shared/schemas/*` define los Zod que usan **tanto el frontend** (formularios y tipos) **como el backend** (parseo del request). Todos con `.strict()`.

```ts
export const TargetConfigSchema = z.object({
  index:       z.number().int().min(1).max(60),
  modality:    z.enum(['sala', 'aire_libre', 'campo', '3d']),
  arrows:      z.number().int().min(1).max(12),
  description: z.string().max(120).nullable(),
}).strict();

export const CreateTournamentSchema = z.object({
  seasonId:    z.string().regex(/^[a-f\d]{24}$/i),
  name:        z.string().trim().min(3).max(120),
  date:        z.coerce.date(),
  description: z.string().max(1000).default(''),
  targets:     z.array(TargetConfigSchema).min(1).max(60),
  archerIds:   z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(2).max(200),
  stakeMap:    StakeMapSchema.optional(),
  distances:   DistancesSchema.optional(),
}).strict();

export const SyncOpSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('score'),
    opId: z.string().uuid(),
    clientUpdatedAt: z.coerce.date(),
    participantId: z.string().regex(/^[a-f\d]{24}$/i),
    targetIndex: z.number().int().min(1).max(60),
    arrows: z.array(z.string().max(2)).min(1).max(12),
  }).strict(),
  z.object({
    type: z.literal('signature'),
    opId: z.string().uuid(),
    clientUpdatedAt: z.coerce.date(),
    participantId: z.string().regex(/^[a-f\d]{24}$/i),
    pngDataUrl: z.string().max(60_000).startsWith('data:image/png;base64,'),
  }).strict(),
  z.object({
    type: z.literal('close'),
    opId: z.string().uuid(),
    clientUpdatedAt: z.coerce.date(),
  }).strict(),
]);

export const SyncBatchSchema = z.object({
  ops: z.array(SyncOpSchema).min(1).max(200),
}).strict();
```

**Nunca** se validan los tokens de flecha contra una lista fija en el schema: se validan contra el set de la modalidad **del blanco correspondiente**, que el servidor lee del torneo. Un `11` es válido en un blanco 3D e inválido en el de sala del mismo torneo.

---

## 5. Performance

### Base de datos
- Todos los índices de §2. `explain()` obligatorio en cada consulta de las rutas públicas: **cero `COLLSCAN`**.
- Blancos embebidos → leer un torneo es una sola operación.
- Rollups denormalizados → podios y estadísticas sin agregaciones sobre `scores`.
- `standings` materializado al publicar → el ranking es una consulta indexada directa.
- Pool de conexiones reutilizado a nivel de módulo, nunca por request.

### Backend
- Respuestas públicas con `Cache-Control: public, max-age=60, stale-while-revalidate=300` + `ETag`.
- Caché en memoria (LRU, TTL 60 s) para rankings, invalidada al publicar.
- Compresión Brotli/gzip para respuestas > 1 KB.

### Frontend
- Code splitting por ruta con `React.lazy`. WAFA y WAFL son chunks separados: entrar como líder no descarga el código de administración.
- `memo` en las filas de scoring y en el teclado.
- La UI de scoring lee de IndexedDB: no hay estado de carga en el camino crítico.
- Tailwind purga el CSS no usado.
- Iconos como SVG inline; sin librería de iconos.

### Presupuestos — se verifican en CI

| Métrica | Presupuesto |
|---|---|
| Registrar una flecha (percibido) | **< 50 ms** |
| Navegar entre blancos | < 100 ms |
| Primera carga de WAFL en 3G simulado | < 2.5 s |
| JS inicial de WAFL | **< 150 KB** gz |
| JS inicial de la landing | < 120 KB gz |
| LCP de la landing | < 2.5 s |
| `GET /api/public/rankings` p95 | < 200 ms |
| `POST /api/wafl/sync` (batch de 20 ops) p95 | < 400 ms |

Los presupuestos de bundle se hacen fallar el build con `rollup-plugin-visualizer` + un check de tamaño.

---

## 6. Convenciones de código

- TypeScript `strict`. Sin `any` salvo justificación en comentario.
- **Ninguna consulta a MongoDB fuera de `repositories/`.** Sin excepciones.
- **Ninguna regla de negocio fuera de `@bal/shared`.** Los servicios orquestan y persisten; no deciden.
- Programación funcional donde aplique: funciones puras, sin mutación de los argumentos, composición sobre herencia.
- Nombres: componentes `PascalCase`, hooks `useX`, módulos de dominio `camelCase`, colecciones en plural.
- Errores tipados con `code`; nunca strings sueltos.
- Biome para lint y formato; CI bloquea si falla.
- Comentarios en español, en el código y en los tests.

---

## 7. Manejo de errores

| Código | HTTP | Cuándo |
|---|---|---|
| `UNAUTHORIZED` | 401 | Sin sesión válida |
| `FORBIDDEN` | 403 | Sesión válida pero sin permiso sobre el recurso |
| `CSRF_INVALID` | 403 | Falta o no coincide `x-csrf-token` |
| `NOT_FOUND` | 404 | Recurso inexistente o de otra patrulla (no se distingue: evita enumeración) |
| `VALIDATION_ERROR` | 400 | Zod rechazó el input; `details` trae los campos |
| `ARROW_COUNT` | 400 | Cantidad de flechas distinta a la del blanco |
| `INVALID_TOKEN` | 400 | Token no válido para la modalidad de ese blanco |
| `INVALID_STATE_TRANSITION` | 409 | Ej. publicar un torneo que no está `completado` |
| `TARGET_LOCKED` | 409 | Editar un blanco que ya tiene puntajes |
| `ARCHER_IN_USE` | 409 | Eliminar un arquero que participó de un torneo |
| `SIGNATURES_MISSING` | 409 | Cerrar el circuito sin todas las firmas |
| `RATE_LIMITED` | 429 | Excedido el límite; `Retry-After` en la respuesta |
| `INTERNAL` | 500 | Inesperado. Se loguea con `requestId`, se responde sin detalle |

Ningún mensaje de error revela si un usuario existe, ni expone stack traces, ni nombres de colecciones.

---

## 8. Scripts

Raíz:

```jsonc
{
  "dev":       "concurrently -n api,app,landing ...",
  "build":     "pnpm --filter @bal/shared build && pnpm -r --filter '!@bal/shared' build",
  "start":     "pnpm --filter @bal/api start",
  "test":      "pnpm -r test",
  "test:e2e":  "pnpm --filter @bal/app test:e2e",
  "typecheck": "pnpm -r typecheck",
  "lint":      "biome check .",
  "format":    "biome format --write ."
}
```

`@bal/api`: `dev` (tsx watch) · `build` · `start` · `db:indexes` · `db:seed` · `db:reset` · `db:reconcile` · `test`.
`@bal/app` y `@bal/landing`: `dev` · `build` · `preview` · `test` · (`test:e2e` en app).
`@bal/shared`: `build` (tsc) · `test`.

`db:reconcile` recalcula todos los rollups de `participants` desde `scores`. Es la red de seguridad ante cualquier desalineación.

---

## 9. Testing

Estrategia completa en [`TESTING.md`](TESTING.md). Resumen: cobertura casi total del dominio en `@bal/shared` con TDD estricto, integración del backend con `mongodb-memory-server` en modo replica set (necesario para probar transacciones), RTL con `fake-indexeddb` para el frontend, y un E2E de Playwright que **incluye un tramo offline real**.
