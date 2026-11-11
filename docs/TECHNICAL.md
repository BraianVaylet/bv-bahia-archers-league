# Documentación técnica — BV Bahía Archers League

Esquemas, contratos y convenciones. Para el porqué de las decisiones ver [`ARCHITECTURE.md`](ARCHITECTURE.md); para el protocolo offline, [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md).

---

## 1. Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Lenguaje | TypeScript `strict` en todo el monorepo | **5.9.3** |
| Runtime | Node | ≥ 20 LTS · CI e imagen: **22** |
| Monorepo | pnpm workspaces | **9.15.0** |
| Backend | Hono | 4.x |
| Base de datos | MongoDB Atlas (replica set) + driver oficial `mongodb` | server 7.x · driver **7.x** |
| Validación | Zod `.strict()` | **4.x** |
| Frontend | **React 19**, **Vite 8**, Tailwind CSS 4, React Router 7 (la carga de datos es un hook propio, `@bal/cliente`) | — |
| PWA | `vite-plugin-pwa` (Workbox) | **1.x** |
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
  sex: "masculino" | "femenino" | null, // null: padrón viejo, no se inventa el valor
  dni: "30123456" | null,               // 7-8 dígitos, sin puntos. null: padrón viejo
  registrationStatus: "pendiente" | "aprobado",   // ver decisión 7 de ACTION_PLAN.md Fase 8
  searchKey: "perez juan",              // normalizado sin acentos, para buscar
  archivedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```
Índices: `{ archivedAt: 1, lastName: 1, firstName: 1 }` · `{ searchKey: 1 }` · `{ category: 1 }` · `{ dni: 1, category: 1 }` **unique, parcial** (sólo `dni: { $type: 'string' }` — dos arqueros viejos con `dni: null` no chocan entre sí). Único es el par, no el DNI solo: la misma persona puede anotarse en más de una categoría — es un `ArcherDoc` por categoría, mismo DNI — pero no dos veces en la misma.

Un arquero creado por el admin nace `registrationStatus: "aprobado"`. El autoregistro público (`BE-20`) lo crea `"pendiente"`, y sólo entra al padrón que usa el wizard de torneo (`archerRepo.list` con el filtro por defecto) una vez que `BE-22` lo aprueba.

`sex`/`dni` en `null` no bloquean nada: el arquero sigue participando de torneos igual. `archerService.ArcherView` expone `profileIncomplete: true` cuando falta alguno de los dos, para que WAFA lo señale sin que nadie tenga que adivinarlo.

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
  sex: "masculino" | "femenino" | null,  // null si el arquero no lo tenía cargado

  // asignación
  stake: "azul",
  unit: "A",                            // A tira primero
  position: "izquierda" | "derecha",

  // rollups denormalizados — actualizados por delta en la transacción del score
  total: 0,
  innerCount: 0,                        // X + 6 (campo) + 11
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
  appliedAt: Date,                      // cuándo se marcó; con "processing", desde cuándo se procesa
  result: "processing" | "applied" | "superseded" | "rejected",
  expiresAt: Date                       // la marca + 7 días
}
```

**La marca nace `processing`** (`REF6-13` / `B-4`) y termina `applied` o `rejected` cuando la transacción termina. Una op que sigue `processing` pasados **30 s** se da por abandonada (el proceso murió) y se reprocesa; una `processing` reciente es de otro request que sigue vivo y no se contesta —el cliente trata una op ausente de la respuesta como «reintentar más tarde»—. Antes nacía `applied`, y si el proceso moría antes del commit el reintento recibía `duplicate` y el puntaje se perdía en silencio.
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
  sex: "masculino" | "femenino" | null,  // snapshot del arquero, para el ranking por sexo

  tournamentsPlayed: 3,

  bestNormalizedPct: 78.4,              // el mejor SUELTO de la temporada
  bestRawScore: 259,
  bestTournamentId: ObjectId,

  topNPcts: [82.1, 78.4, 71.0],         // los `bestN` mejores, de mayor a menor

  totalX: 14, totalTens: 22, totalM: 3,
  updatedAt: Date
}
```
Índices: `{ seasonId: 1, archerId: 1, category: 1 }` **unique** · `{ archerId: 1 }`.

`topNPcts` guarda los `bestN` mejores porcentajes y **no** su promedio: el acumulado se construye de forma incremental, torneo por torneo, y para saber si el que llega desplaza a alguno hay que conocer a los que están. El promedio lo deriva `bestNAvgPct` al serializar, así que no hay dos copias del mismo número que puedan separarse. `bestN` es `LEAGUE_BEST_N` (`BE-18`), no una constante — por eso no hay un `2` fijo en ningún lado de este documento.

> **Baja de `ix_ranking_puntaje` e `ix_ranking_posicion` (2026-10-24).** Existían índices sobre `bestNormalizedPct` y `leaguePoints` para los modos de ranking que se fueron retirando. Ninguno lo usó nunca ninguna consulta: la landing trae la temporada entera con `find({ seasonId })` y la ordena en memoria con `sortStandings`/`sortStandingsByGender` —son cientos de documentos, no millones— así que el índice que sirve es el del prefijo `seasonId`. El segundo retiro, además, borró los campos que el índice indexaba: `leaguePoints` y `podiums` ya no existen en este documento (ver `BITACORA.md`, entrada del 2026-10-24 sobre `SH-9`). **En cualquier Mongo donde `ix_ranking_posicion` ya se haya creado, queda huérfano** — este proyecto no tiene un mecanismo para dropear índices de un entorno ya desplegado; hay que borrarlo a mano.

### 2.11 `auditLog`

```js
{
  _id: ObjectId,
  at: Date,
  actorType: "admin" | "patrol" | "system",
  actorId: ObjectId | null,
  action: String,                       // la lista completa y qué guarda cada una: SECURITY.md §9 bis
                                        // p. ej. "tournament.start" | "payment.set" | "patrol.close"
  entity: "tournament" | "patrol" | "participant" | "user" | "archer" | "season",
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
| `GET` | `/api/admin/archers?archived=false&q=&status=` | Listado con búsqueda. Sin `status`, excluye `pendiente` (no se puede sumar a un torneo un arquero sin aprobar) |
| `POST` | `/api/admin/archers` | `{ firstName, lastName, category, sex, dni }` — nace `registrationStatus: "aprobado"` |
| `PATCH` | `/api/admin/archers/:id` | Edición |
| `POST` | `/api/admin/archers/:id/archive` | Archivar |
| `POST` | `/api/admin/archers/:id/restore` | Restaurar |
| `POST` | `/api/admin/archers/:id/approve` | `pendiente` → `aprobado` (`BE-22`) |
| `POST` | `/api/admin/archers/:id/reject` | Borra un `pendiente` (`BE-22`) |
| `DELETE` | `/api/admin/archers/:id` | **409** si participó de algún torneo |
| `GET` `POST` `PATCH` | `/api/admin/seasons[/:id]` | CRUD de temporadas |

Un DNI repetido **en la misma categoría** en `POST /api/admin/archers` devuelve **409** `ARCHER_DNI_DUPLICATE`. En el alta **pública** (`POST /api/public/archers`) no: responde igual que para un DNI nuevo, para no confirmar quién está en el padrón (`SECURITY.md` §15). El mismo DNI en otra categoría se permite: es como una misma persona se anota en más de una.

### 3.3 Admin — torneos

| Método | Ruta | Notas |
|---|---|---|
| `POST` | `/api/admin/tournaments` | Crea torneo + participantes + patrullas + credenciales (transacción) |
| `GET` | `/api/admin/tournaments?status=&seasonId=` | Listado |
| `GET` | `/api/admin/tournaments/:id` | Detalle + avance + resumen |
| `PATCH` | `/api/admin/tournaments/:id` | Qué campos, según el estado: `camposEditables` de `@bal/shared` (`SH-11`/`BE-24`). Un campo de más → `409 FIELD_NOT_EDITABLE`. En `en_proceso`, los blancos con puntajes no se tocan (`TARGET_LOCKED`) |
| `PUT` | `/api/admin/tournaments/:id/participants/:participantId/scores/:targetIndex` | Corrección del admin contra la planilla de papel (`BE-25`). Cuerpo `{ arrows, reason }`, `.strict()`: ningún total. Sólo `completado` (`FIELD_NOT_EDITABLE` si no). Valida contra la modalidad del blanco, escribe por el mismo camino que el sync (`escrituraDePuntaje`) y audita `score.admin_correct` con antes, después y motivo. La firma no se borra |
| `GET` | `/api/admin/tournaments/:id/participants/:participantId/scorecard` | Tarjeta del arquero para el admin, en cualquier estado, con `corrected` (los blancos que el admin corrigió). Sin firma ni pago |
| `POST` | `/api/admin/tournaments/:id/start` | `sin_iniciar` → `en_proceso` |
| `POST` | `/api/admin/tournaments/:id/publish` | `completado` → `publicado` (transacción, materializa standings) |
| `POST` | `/api/admin/tournaments/:id/unpublish` | Revierte. Auditado. Si estaba archivado, lo desarchiva |
| `POST` | `/api/admin/tournaments/:id/archive` | `{ reason }`. Sólo `publicado` no archivado (`BE-26`). Sigue publicado, pero sale del ranking de la temporada (recálculo en transacción) y de la landing. Auditado |
| `POST` | `/api/admin/tournaments/:id/unarchive` | `{ reason }`. La vuelta: vuelve a sumar y a verse. Auditado |
| `DELETE` | `/api/admin/tournaments/:id` | Solo `sin_iniciar` |

### 3.4 Admin — patrullas

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/api/admin/tournaments/:id/patrols` | Composición y avance. **Sin PIN** por defecto; con `?pins=1` trae el PIN descifrado y lo registra en el audit log (`SECURITY.md` §9). Cualquier otro parámetro es un `400` |
| `PUT` | `/api/admin/tournaments/:id/patrols` | Reemplaza la distribución. Solo `sin_iniciar`. Devuelve violaciones sin bloquear, y las patrullas **con PIN** (se guarda desde la pantalla de credenciales) |
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
| `GET` | `/api/public/tournaments` | Publicados y en proceso. Sin los archivados (`BE-26`): su detalle, sus tarjetas y su fila en la ficha del arquero tampoco se ven (`resultadosVisibles`) |
| `GET` | `/api/public/tournaments/upcoming` | Próximas fechas (`BE-28`): `sin_iniciar` con fecha de hoy (en Bahía Blanca) en adelante, el más cercano primero, hasta 6. Sólo la convocatoria: nombre, fecha, descripción, `registrationUrl`, `payment`, cantidad de blancos y modalidades |
| `GET` | `/api/public/tournaments/:id` | Detalle. Sin puntajes si no está publicado |
| `GET` | `/api/public/tournaments/:id/participants/:participantId` | Tarjeta de puntajes: cada flecha de cada blanco, con su valor. Sólo torneos **publicados**; 404 en cualquier otro caso (sin distinguir). Lista blanca: sin firma, pago, DNI ni `archerId`. `participantId` es el `id` de cada fila de `results` en el detalle del torneo |
| `GET` | `/api/public/archers/:id` | Ficha histórica |

### 3.7 Salud

| `GET` | `/api/health` | `{ status, version, db: "ok" \| "degraded", dbMs, uptime }`. Usado por el healthcheck de Railway. `dbMs` es lo que tardó el `ping` a la base (`null` si está caída): sirve para comprobar que Railway y Atlas están en la misma región |

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
- **Sin caché propia de rankings** (`REF6-13` / `P-6`, decisión). Se había previsto un LRU en memoria invalidado al publicar, y se descartó: la consulta es una lectura indexada de unos cientos de documentos, la respuesta ya sale con `ETag` y `Cache-Control`, y el único escritor (`replaceSeason`) corre dentro de una transacción, así que invalidar antes del commit deja que un lector recachee datos viejos. El riesgo de un ranking desactualizado tras publicar no compensa el ahorro. Se reabre si se mide que la consulta pesa.
- **Compresión.** Los estáticos van **precomprimidos**: `scripts/precomprimir.mjs` (al final de `pnpm build`) deja un `.br` y un `.gz` junto a cada archivo de texto del `dist`, y `serveStatic({ precompressed: true })` entrega el que el cliente acepta, sin comprimir nada por request. El JS de la PWA pasa de 439 KB a 109 KB en brotli. El JSON de la API se comprime con `gzip` si pasa de 1 KB (`middleware/compresion.ts`; `hono/compress` sólo mira el umbral si la respuesta trae `Content-Length`, y `c.json()` no lo trae, así que el middleware lo declara antes).
- **Caché de los estáticos** (`middleware/estaticos.ts`): lo que está bajo `/assets/` lleva el hash en el nombre y va `public, max-age=31536000, immutable`; todo lo demás —`index.html`, `sw.js`, el manifest, los íconos— va `no-cache` (se guarda y se pregunta antes de usar: con `Last-Modified` cuesta un `304`). `Vary: Accept-Encoding` siempre. Los dos `index.html` se leen una vez al montar, no en cada fallback de SPA.

### Frontend
- Code splitting con `React.lazy`. WAFA y WAFL son chunks separados (`WafaApp-<hash>.js`, `WaflApp-<hash>.js`): entrar como líder no descarga el código de administración. Sin señal sigue funcionando: el service worker precachea **todos** los `.js` al instalarse. **La landing no se partió**: se probó con el formulario de alta, la ficha del arquero y la tarjeta de puntajes, y no ganó nada —esas tres pantallas pesan ≈4 KB gz entre las tres; lo pesado es una librería compartida (`api-*.js`, 42 KB gz) que se necesita en todas— y la carga inicial no bajó (102,2 KB gz contra 101,9 del chunk único: la sobrecarga de partirlo se come lo que se saca). Un `React.lazy` que no baja el inicial sólo agrega una espera.
- **`@bal/shared` declara sus `sideEffects`** (`REF6-15`): sólo `configuracionZod.js` y `navegador.js`, que configuran Zod al evaluarse. Sin la declaración, el empaquetador no puede descartar `schemas.ts` (sus `z.object(...)` son llamadas de nivel superior), así que cualquier import suelto del barril —un `enlaceEntreApps` en la pantalla de elegir rol— arrastraba **362 KB de Zod** (≈ 23 KB gz) a una pantalla que no valida nada. Esa es la primera pantalla que ve un líder de patrulla, con la peor señal del torneo. Si se agrega un módulo con un efecto de verdad (configurar algo, registrar algo), **hay que sumarlo a esa lista**, o el empaquetador lo descarta.
- `memo` en las filas de scoring (`ArrowRow`, comparando las flechas por contenido: IndexedDB devuelve arreglos nuevos en cada lectura) y en el teclado, con callbacks estables y la lectura de los puntajes por el índice `by-target`, no del almacén entero (`REF6-14` / `P-7`).
- La UI de scoring lee de IndexedDB: no hay estado de carga en el camino crítico.
- Tailwind purga el CSS no usado.
- Iconos como SVG inline; sin librería de iconos.

### Presupuestos

El encabezado decía «se verifican en CI», y sólo cuatro de estas filas se verifican ahí. La columna de la derecha dice qué pasa con cada una (`REF6-15`).

| Métrica | Presupuesto | Medido | Cómo se verifica |
|---|---|---|---|
| Registrar una flecha (percibido) | **< 50 ms** | mediana 16 ms (jsdom) | `wafl/rendimiento.test.tsx`, que falla sobre 150 ms. Es el orden de magnitud, no el celular: **la cifra del teléfono no se mide** |
| Navegar entre blancos | < 100 ms | — | **No se mide** |
| Primera carga de WAFL en 3G simulado | < 2.5 s | — | **No se mide** |
| JS que baja la pantalla de elegir rol (`/app/`) | < 90 KB gz | 82.8 | `scripts/presupuesto.mjs` en el CI. Era 105.5 y estaba en rojo: bajaba Zod sin usarlo (ver más abajo) |
| JS que baja WAFL (inicial + su chunk) | **< 125 KB** gz | 119.1 | `presupuesto.mjs` en el CI |
| JS que baja WAFA (inicial + su chunk) | < 140 KB gz | 136.2 | `presupuesto.mjs` en el CI. **Era 135 hasta `FE-34`** (2026-11-11, decisión del autor): la corrección de puntajes trae el teclado de WAFL y dejó a WAFA en 136,2. Cargarla con `React.lazy` no sirvió —el bundler mueve el teclado a un chunk compartido y la que se pasaba era WAFL, 125,04— ni tampoco el wizard. WAFA es la app del admin, con wifi del club o computadora; el límite que cuida al predio es el de WAFL, que no cambia |
| JS inicial de la landing | < 120 KB gz | 109.2 | `presupuesto.mjs` en el CI |
| LCP de la landing | < 2.5 s | — | **No se mide** (la auditoría de Lighthouse sigue pendiente) |
| `GET /api/public/rankings` p95 | < 200 ms | — | **No se mide** |
| `POST /api/wafl/sync` (batch de 20 ops) p95 | < 400 ms | 487 ms con 2 ms de RTT a la base — **no se cumple** | `pnpm --filter @bal/api bench:sync`, a demanda. Lo que sí corre en cada PR es el conteo de comandos (`sync-viajes.test.ts`) |
#### Sincronización, medida (`REF6-5`)

`pnpm --filter @bal/api bench:sync` pone un proxy con retardo entre la API y MongoDB y mide un lote de ops de score. `tests/sync-viajes.test.ts` cuenta los comandos y falla si crecen. Cada comando es una ida y vuelta, **en serie**.

| RTT a la base | ops | antes | después |
|---|---|---|---|
| 0 ms | 20 | 204 comandos · 291 ms | 128 comandos · 227 ms |
| 2 ms | 20 | 204 comandos · 707 ms | 128 comandos · **487 ms** |
| 30 ms | 50 | 554 comandos · 17,6 s | 309 comandos · 9,9 s |
| 120 ms | 50 | 554 comandos · 67,6 s | 309 comandos · 37,8 s |

*Peor de 3 corridas a 20 ops; una a 50. Windows, `mongod` en memoria, API y proxy en el mismo proceso: sirve para comparar antes y después, no como cifra absoluta de producción. Re-medir contra el despliegue real.*

> **Desde `REF6-13` cada lote suma un comando más** (el `updateMany` que confirma las ops aplicadas): 129 a 20 ops, no 128. La tabla de arriba es la medición de `REF6-5`, anterior a ese cambio, y no se repitió.

- **−37 % de comandos a 20 ops, −44 % a 50.** Por score: 10 → 6 (el avance de la patrulla se cuenta una vez por lote, y los rollups son una escritura en vez de dos).
- **El presupuesto de 400 ms no se cumple:** 487 ms a 2 ms de RTT. Con 6 comandos por op y ~2 ms de procesamiento por comando en esta máquina, 20 ops no bajan de ~230 ms ni con RTT cero, y cada ms de RTT suma 128. Cumplirlo pide ~5 comandos por op, y eso es tocar la idempotencia (dedup en bloque con `insertMany`) o unir las transacciones de un lote: decisiones de diseño, no de ajuste. O recalibrar el número: se escribió antes de medir.

Los presupuestos de bundle los verifica `scripts/presupuesto.mjs` en CI. **Mide lo que una pantalla descarga**, no lo que hay en `assets/`: arma el grafo de chunks del `index.html` (entrada y `modulepreload`) más, para WAFL y WAFA, el chunk de su app y lo que éste importa de forma estática. Y falla si WAFL baja código de WAFA, o al revés: es lo que detecta que alguien volvió a un `import` estático. Hasta `REF6-8` sumaba todo el JS del `dist`, que con las dos apps en un solo chunk coincidía con la carga inicial y con el code splitting dejó de hacerlo.

---

## 6. Convenciones de código

- TypeScript `strict`. Sin `any` salvo justificación en comentario.
- **Ninguna consulta a MongoDB fuera de `repositories/`.** Sin excepciones, y `scripts/verificar-capas.mjs` lo comprueba en el CI (`ARCHITECTURE.md` §4). Las rutas no importan repositorios: hablan con servicios.
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
| `FIELD_NOT_EDITABLE` | 409 | Editar un dato del torneo que su estado no permite (`camposEditables`, `SH-11`). `details.campos` lista todos los rechazados |
| `ARCHER_IN_USE` | 409 | Eliminar un arquero que participó de un torneo |
| `SIGNATURES_MISSING` | 409 | Cerrar el circuito sin todas las firmas |
| `SIGNATURE_MISMATCH` | 409 | El puntaje cambió después de firmarse: lo devuelven el cierre del circuito y publicar |
| `SIGNATURE_LOCKED` | 409 | Op de score sobre un arquero que ya firmó (`/sync`, por op) |
| `PATROL_CLOSED` | 409 | Op de score o de firma sobre una patrulla que ya cerró el circuito (`/sync`, por op) |
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
