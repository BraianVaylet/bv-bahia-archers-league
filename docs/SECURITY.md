# Seguridad — BV Bahía Archers League

La seguridad **no es negociable**. Este documento lista los controles, las amenazas que mitigan, los tradeoffs asumidos de forma consciente, y un checklist verificable que debe estar verde antes de cada release.

Base reutilizada de `bv-easy-archery-battle` (sesión httpOnly + CSRF + argon2id + rate limit + headers), extendida para el modelo multi-actor de este sistema.

---

## 1. Modelo de amenazas

Qué protegemos y de quién. Sin esto, los controles son ritual.

| Activo | Amenaza | Impacto | Control |
|---|---|---|---|
| Puntajes de un torneo | Un participante falsea su propio puntaje | Alto — corrompe el ranking de la liga | §2, §5, §6 |
| Puntajes de otra patrulla | La patrulla 3 escribe puntajes de la patrulla 5 | Alto | §4 — autorización por op |
| Cuenta de admin | Alguien publica rankings falsos o borra un torneo | Crítico | §3 |
| Credenciales de patrulla | Fuerza bruta sobre el PIN | Alto | §3.2 |
| Base de datos | Inyección NoSQL | Crítico | §6 |
| Firmas | Se altera un puntaje después de firmado | Alto — invalida la validación del arquero | §7 |
| Datos personales | Filtración | Bajo — la PII es mínima por diseño | §8 |
| Disponibilidad durante el torneo | DoS, rate limit mal calibrado | **Crítico** — el torneo se detiene | §3.3 |

> **Nota sobre el actor realista.** El atacante probable acá no es un profesional: es un participante curioso con el celu en la mano que descubre que puede editar un request. Los controles están calibrados para eso, sin dejar agujeros que un atacante serio pueda usar.

---

## 2. El servidor es la autoridad del puntaje

El control más importante del sistema.

- El cliente envía **tokens de flecha** (`"X"`, `"9"`, `"M"`, `"11"`). Nada más.
- El servidor deriva el valor de cada token, suma el total y cuenta `X`, `10`, `M` e inner.
- **El servidor nunca lee un `total` del request.** Aunque el cliente lo mande, se descarta.
- Los tokens se validan contra el set de la modalidad **del blanco correspondiente**, leído del torneo en base — no de lo que diga el cliente. Enviar `"11"` a un blanco de sala se rechaza.
- La cantidad de flechas se valida contra `targets[i].arrows` del torneo, no contra lo que venga en el payload.

Sin esto, falsear un puntaje sería tan simple como editar un JSON en devtools.

---

## 3. Autenticación

### 3.1 Administrador

- Password con **argon2id** (`memoryCost` 19 MiB, `timeCost` 2, `parallelism` 1 — parámetros OWASP mínimos).
- El admin inicial se siembra desde `ADMIN_INITIAL_PASSWORD`, **nunca desde el código**. Si la variable no está en producción, el arranque falla explícitamente.
- `mustChangePassword: true` en el seed: al primer login la app **obliga** a cambiar el password antes de permitir cualquier otra acción.
- Password mínimo 12 caracteres, validado server-side.
- **Lookup timing-safe**: si el usuario no existe, se compara igual contra un `DUMMY_HASH` para que el tiempo de respuesta no revele la existencia de la cuenta.
- Bloqueo temporal tras 5 intentos fallidos (15 minutos, escalando).

> **Cambio respecto del brief.** El brief especifica `admin` / `CBA2026` fijo. Un password conocido y presente en el repositorio compromete la totalidad del sistema: crear, borrar y publicar torneos. `CBA2026` queda **solo como default de desarrollo local**; en producción es obligatorio setear la variable de entorno.

### 3.2 Líder de patrulla

- Usuario `patrullaN` + **PIN de 6 dígitos** (10⁶ combinaciones).
- PIN generado con `crypto.randomInt` — nunca secuencial, nunca derivado del número de patrulla.
- Hasheado con **argon2id**, igual que el password de admin.
- **Alcance temporal:** la credencial solo funciona mientras el torneo está `en_proceso`. Antes de iniciar y después de completar, no autentica.
- **Alcance de datos:** la sesión solo puede escribir sobre participantes de su propia patrulla, en su propio torneo. Verificado en cada op (§4).
- Bloqueo tras 5 intentos fallidos: 5 minutos, escalando a 30. Contador **por patrulla** y **por IP**, de forma independiente.
- El admin puede **regenerar** el PIN en cualquier momento; invalida las sesiones activas de esa patrulla.

> **Cambio respecto del brief.** El brief especifica 4 dígitos: 10.000 combinaciones, rompibles por fuerza bruta en minutos. Se elevó a 6 dígitos manteniendo el mismo flujo de uso. Con el rate limit y el bloqueo, un ataque de fuerza bruta requiere años.

### 3.3 Rate limiting sin romper el torneo

Este es un balance delicado: un rate limit mal calibrado es un **denial of service autoinfligido el día del torneo**.

| Endpoint | Límite | Motivo |
|---|---|---|
| `POST /api/auth/admin/login` | 10 / 15 min por IP | Fuerza bruta |
| `POST /api/auth/patrol/login` | 10 / 15 min por IP **y** 5 / 15 min por patrulla | Fuerza bruta del PIN |
| `POST /api/wafl/sync` | **300 / min por sesión de patrulla** | Generoso a propósito: una patrulla que vuelve de 3 horas sin señal envía cientos de ops de golpe. Nunca debe ser rechazada. |
| `/api/admin/*` (escritura) | 60 / min por sesión | Abuso |
| `/api/public/*` | 120 / min por IP | Scraping |

Los límites viven en variables de entorno para poder ajustarlos sin redeploy si algo se calibra mal en el campo.

**Regla:** ante la duda entre seguridad y disponibilidad en `/api/wafl/sync`, gana la disponibilidad. Ese endpoint está protegido por la autenticación y la autorización, no por el rate limit.

---

## 4. Autorización

### Sesiones

```
subjectType: 'admin'   → acceso completo a /api/admin/*
subjectType: 'patrol'  → acceso a /api/wafl/*, ACOTADO a su patrolId y tournamentId
```

### Verificación por operación

En `POST /api/wafl/sync`, **cada op del batch** se verifica de forma independiente:

```ts
const participant = await participantRepo.findById(op.participantId);
if (!participant
    || !participant.patrolId.equals(session.patrolId)
    || !participant.tournamentId.equals(session.tournamentId)) {
  audit('sync.forbidden', { opId: op.opId, patrolId: session.patrolId });
  return { opId: op.opId, status: 'rejected', error: FORBIDDEN };
}
```

Verificar solo al abrir la sesión no alcanza: un batch puede traer 200 ops y cualquiera de ellas podría apuntar a un participante ajeno. **Esto es lo que impide el IDOR entre patrullas**, y es la razón por la que la verificación va dentro del loop y no antes.

### Enumeración

Un recurso que existe pero no pertenece al solicitante responde **404**, no 403. No se distingue "no existe" de "no es tuyo".

---

## 5. Validación de entrada

- **Zod `.strict()` en absolutamente todo input.** Rechaza propiedades no declaradas → sin mass assignment, sin contaminación del documento.
- Longitudes máximas en todos los strings. Cantidad máxima de elementos en todos los arrays.
- Tamaño máximo del body: 1 MB. Máximo 200 ops por batch de sync.
- Firmas: máximo 60 KB de data URL, prefijo `data:image/png;base64,` obligatorio, y validación de que el contenido decodificado es un PNG real (magic bytes) antes de persistir.
- IDs validados con regex de `ObjectId` (`/^[a-f\d]{24}$/i`) antes de construir cualquier `ObjectId`, para que un valor malformado no llegue al driver.

---

## 6. Capa de datos — inyección NoSQL

La vulnerabilidad más subestimada de un stack Node + Mongo.

| Regla | Ejemplo de lo que previene |
|---|---|
| **Nunca** pasar un valor del request directo a un filtro sin validarlo con Zod primero | `{ username: { $ne: null } }` en el login devolvería el primer usuario |
| Todos los IDs se construyen con `new ObjectId(validatedString)` | Un objeto en lugar de un string se convierte en un operador |
| Rechazar claves que empiecen con `$` o contengan `.` en cualquier objeto que llegue del cliente | Inyección de operadores en objetos anidados |
| Prohibido `$where`, `mapReduce` y `$function` | Ejecución de JavaScript arbitrario en el servidor de base |
| `$jsonSchema` a nivel de colección como segunda barrera | Un documento malformado no llega a persistir aunque falle una validación de aplicación |

Zod `.strict()` con tipos primitivos explícitos (`z.string()`, no `z.any()`) resuelve la mayoría por construcción: si el schema dice `string` y llega `{ $ne: null }`, Zod lo rechaza antes de que toque la base.

**Transacciones** en toda operación compuesta: crear torneo, aplicar un score con sus rollups, cerrar circuito, publicar, despublicar.

---

## 7. Integridad de las firmas

Una firma valida un puntaje. Si el puntaje puede cambiar después de firmado, la firma no vale nada.

```ts
scorecardHash = sha256(JSON.stringify({
  participantId,
  scores: sortedByTargetIndex.map(s => ({ t: s.targetIndex, a: s.arrows, total: s.total })),
  total, innerCount, xCount, tenCount, mCount,
}));
```

- Se calcula **server-side** al recibir la firma y se guarda junto a ella.
- Al cerrar el circuito, se **recalcula y se compara**. Si difiere, el cierre se rechaza con `SIGNATURE_MISMATCH`: el puntaje cambió después de firmarse.
- Al publicar, se verifica de nuevo para todos los participantes.

**Desbloqueo por el admin:** si un arquero se fue sin firmar, el admin puede desbloquear indicando el motivo. Se registra `unlockedBy`, `unlockReason` y una entrada en `auditLog`. El participante queda marcado como firmado por excepción, y eso es visible en el detalle del torneo — no se oculta.

---

## 8. Sesiones y cookies

- Token de sesión: 32 bytes de `crypto.randomBytes`, en base64url.
- En la cookie va el token; en la base se guarda **`sha256(token)`**. Una filtración de la base no permite suplantar sesiones.
- Cookie: `HttpOnly` · `Secure` (producción) · `SameSite=Lax` · `Path=/` · expiración explícita.
- TTL: 12 h para admin, **duración del torneo** para patrulla (con máximo de 24 h).
- Índice TTL en `sessions.expiresAt`: MongoDB borra las vencidas sin trabajo de la aplicación.
- Logout invalida la sesión en base, no solo borra la cookie.

### CSRF

- Token CSRF en cookie legible por JavaScript + header **`x-csrf-token` obligatorio** en toda mutación (`POST`, `PUT`, `PATCH`, `DELETE`).
- El frontend obtiene el token con `GET /api/auth/csrf` antes de la primera mutación.
- Falta o no coincide → **403**.
- `SameSite=Lax` es la primera línea; el token es la segunda. Defensa en profundidad.

---

## 9. Tradeoff asumido — el PIN cifrado en reposo

**El problema.** El admin necesita **volver a ver** el PIN de cada patrulla días después de crear el torneo, para dictarlo en el campo. Con solo un hash argon2id, eso es imposible por definición.

**La solución.** Se guardan **ambos**:

```js
pinHash: "$argon2id$..."                    // verificación del login
pinEnc:  "base64(iv | ciphertext | tag)"    // AES-256-GCM, para mostrarlo
```

**Controles alrededor del descifrado:**
- La clave `PIN_ENC_KEY` (32 bytes) vive **solo** en variables de entorno, nunca en la base ni en el repositorio.
- El descifrado ocurre **únicamente** bajo sesión de administrador autenticada.
- **Solo** mientras el torneo no está `publicado`.
- Cada visualización queda registrada en `auditLog`.
- El admin puede **regenerar** el PIN en cualquier momento.

**Lo que esto significa.** Quien obtenga *a la vez* un volcado de la base **y** la variable de entorno puede leer los PINs. Es una degradación real frente a "solo hash".

**Por qué se acepta.** El activo protegido es un PIN de torneo de un día, de alcance acotado a una patrulla, cuya única capacidad es escribir puntajes de sus 4 miembros — puntajes que además quedan firmados y auditados. La alternativa — que el admin no pueda recuperar el PIN — llevaría inevitablemente a que los PINs terminen anotados en un papel o en un chat de WhatsApp, que es estrictamente peor.

La alternativa superior existe y está en el backlog como P2: **acceso por QR con token firmado**, que elimina la necesidad de mostrar el PIN.

---

## 10. Cabeceras y transporte

```
Content-Security-Policy: default-src 'self';
                         script-src 'self';
                         style-src 'self' 'unsafe-inline';
                         img-src 'self' data: blob:;
                         connect-src 'self';
                         frame-ancestors 'none';
                         base-uri 'self';
                         form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: same-origin
X-Frame-Options: DENY
Permissions-Policy: geolocation=(), microphone=(), camera=(self)
Strict-Transport-Security: max-age=31536000; includeSubDomains    (solo producción)
```

- `img-src data: blob:` es necesario para las firmas en canvas.
- `camera=(self)` es necesario para el escaneo de QR (P2). Si esa función no se implementa, se quita.
- El script anti-FOUC del tema va con **hash en la CSP**, no con `'unsafe-inline'`.
- HTTPS obligatorio. Railway termina TLS.

---

## 11. Datos personales

PII mínima **por diseño**:

- De los arqueros: nombre, apellido y categoría. Nada más.
- **Sin** emails, teléfonos, DNI, direcciones ni fechas de nacimiento.
- Las firmas son imágenes de trazo, no datos biométricos identificatorios.
- No hay cuentas de usuario para los arqueros.

Los logs **nunca** contienen tokens, hashes, PINs ni passwords. Los errores en producción se responden sin stack trace; se loguean con un `requestId` correlacionable.

---

## 12. Dependencias y build

- Lockfile fijo, `pnpm install --frozen-lockfile` en CI.
- `pnpm audit` en cada PR. Vulnerabilidades **críticas o altas bloquean el merge**.
- **Sin secretos en el repositorio.** `.env` en `.gitignore`; `.env.example` con valores de ejemplo, nunca reales.
- Escaneo con `aikido:scan` sobre el código generado (SAST + detección de secretos).
- Dockerfile: imagen slim, corre como usuario **no root**, sin herramientas de build en la imagen final.

---

## 13. Checklist de verificación

Debe estar **completamente verde** antes de cada release. Cada ítem es un test automatizado o una verificación manual documentada.

### Autenticación y sesión
- [x] Request mutante **sin `x-csrf-token`** → 403. — app.test.ts
- [x] Request **sin sesión** a un recurso protegido → 401. — auth.test.ts
- [x] Sesión de patrulla intentando acceder a `/api/admin/*` → 403. — auth.test.ts
- [x] Login de admin con usuario inexistente tarda **lo mismo** que con uno existente. — auth.test.ts
- [x] Password de admin almacenado con argon2id; en base **no existe** el password en claro. — auth.test.ts
- [x] Token de sesión en base es `sha256`, no el token de la cookie. — auth.test.ts
- [x] Cookies con `HttpOnly`, `Secure` (prod) y `SameSite=Lax`. — auth.test.ts · env.test.ts
- [x] Logout invalida la sesión **en base**. — auth.test.ts
- [x] Bloqueo tras 5 intentos fallidos, en admin y en patrulla. — auth.test.ts · wafl.test.ts
- [x] Credencial de patrulla **no funciona** si el torneo no está `en_proceso`. — wafl.test.ts
- [x] Regenerar el PIN invalida las sesiones activas de esa patrulla. — ciclo.test.ts
- [x] En producción, arrancar sin `ADMIN_INITIAL_PASSWORD` **falla el arranque**. — env.test.ts
- [x] El primer login de admin obliga a cambiar el password. — auth.test.ts

### Autorización
- [x] La patrulla 3 enviando una op de un participante de la patrulla 5 → op `rejected`, registrada en el audit log. — wafl.test.ts · **seguridad.test.ts**
- [x] Un batch mixto (ops propias + ajenas) aplica **solo** las propias. — wafl.test.ts
- [x] Un recurso de otro torneo → 404, no 403. — **seguridad.test.ts**

### Integridad del puntaje
- [x] `total` falseado por el cliente → **ignorado**, recalculado en el servidor. — wafl.test.ts
- [x] Token `11` en un blanco de sala → rechazado con `INVALID_TOKEN`. — wafl.test.ts
- [x] Token `X` en un blanco 3D → rechazado. — wafl.test.ts
- [x] Cantidad de flechas distinta a la del blanco → `ARROW_COUNT`. — wafl.test.ts
- [x] Cambiar un puntaje después de firmar → `SIGNATURE_MISMATCH` al cerrar. — **seguridad.test.ts**
- [x] Cerrar el circuito sin todas las firmas → `SIGNATURES_MISSING`. — wafl.test.ts
- [x] Publicar un torneo que no está `completado` → `INVALID_STATE_TRANSITION`. — ciclo.test.ts

### Validación e inyección
- [x] Payload con una propiedad extra → rechazado por `.strict()`. — app.test.ts
- [x] `{ "username": { "$ne": null } }` en el login → rechazado por Zod, **sin** llegar a la base. — auth.test.ts
- [x] Clave con `$` o `.` en un objeto anidado → rechazada. — **seguridad.test.ts**
- [x] `ObjectId` malformado → 400, sin excepción del driver. — tournaments.test.ts
- [x] Firma que no es un PNG real → rechazada. — wafl.test.ts
- [x] Body > 1 MB → 413. — app.test.ts

### Cabeceras y transporte
- [x] CSP presente y sin `'unsafe-inline'` en `script-src`. — app.test.ts
- [x] `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` presentes. — app.test.ts
- [x] HSTS presente en producción. — **seguridad.test.ts**
- [x] Sin stack traces en respuestas de producción. — app.test.ts

### Disponibilidad
- [x] `POST /api/wafl/sync` con 200 ops de golpe → **no** cae en rate limit. — wafl.test.ts
- [x] Una patrulla que vuelve de 3 h sin señal sincroniza sin ser bloqueada. — wafl.test.ts

### Dependencias
- [x] `pnpm audit` sin vulnerabilidades críticas ni altas. — job `audit` del CI, bloqueante
- [ ] Sin secretos en el repositorio (`aikido:scan` limpio). — **pendiente**: el escaneo exige iniciar sesión en Aikido desde el navegador, que es del dueño del proyecto
- [ ] El contenedor corre como usuario no root. — el `Dockerfile` declara `USER node`, pero **la imagen nunca se construyó**: no hay Docker en la máquina de desarrollo. Ver `INF-3`

---

## 14. Proceso

- **`/security-review` sobre el diff antes de cada merge relevante.** Bloqueante si aparece algo HIGH o MEDIUM.
- **`aikido:scan`** después de generar código nuevo.
- Este checklist se ejecuta completo antes de cada release.
- Cualquier desviación de un control de este documento se discute y se documenta **antes** de implementarse, nunca después.
