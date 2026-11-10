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
- Bloqueo por (cuenta, IP) tras 5 intentos fallidos: 15 minutos, que se duplican con cada bloqueo seguido hasta una hora. Más un tope por cuenta de 30 fallos entre todas las IPs. Ver §3.3.

#### Recuperación del acceso

**Se recupera desde el login, con el código de `ADMIN_INITIAL_PASSWORD`.** Es la única vía: no hay recupero por mail —la liga no guarda mails de nadie— ni un segundo administrador que pueda rescatar al primero.

`POST /api/auth/admin/recover` recibe el código y el password nuevo. Es la **única ruta sin sesión que cambia una credencial**, y por eso:

- La comparación del código es de **tiempo constante** (`timingSafeEqual` sobre los digest). Un `===` sobre strings corta en el primer carácter distinto, y esa diferencia deja adivinar el código de a un carácter por vez contra el servidor.
- Se comparan **digest y no valores**: `timingSafeEqual` exige largos iguales, y pasarle los secretos crudos expondría el largo del código por la forma de fallar.
- El error es **el mismo** que el de un login fallido. Distinguir «código incorrecto» de «password inválido» convierte el endpoint en un oráculo.
- Se cierran **todas** las sesiones del admin. Si el motivo de recuperar es que alguien más entró, dejar su sesión viva no arregla nada.
- Se levanta el bloqueo por intentos fallidos: es justo el escenario previo típico a una recuperación.
- Hereda el rate limit de `/api/auth/*` —el mismo que frena la fuerza bruta contra el login— y la protección CSRF de `/api/*`.
- Los intentos **fallidos también se auditan** (`admin.recovery_failed`): alguien probando el código contra el servidor es exactamente lo que hay que poder ver después.
- Ni el código ni el password quedan en el audit log.

> **El código de recuperación tiene que ser aleatorio, no memorable.**
>
> Antes de esto, `ADMIN_INITIAL_PASSWORD` sólo se usaba al sembrar y no era alcanzable desde afuera. Ahora **está expuesto a internet**: un valor elegido a mano y adivinable convierte la recuperación en la puerta más débil del sistema.
>
> Se genera con `openssl rand -base64 18` y se trata como lo que es: una credencial de administrador.

> **El acceso al panel de variables del proveedor sigue siendo equivalente al acceso de administrador**, ahora sin necesidad de redesplegar.

> **Lo que se sacó, y por qué.** Una versión anterior reseteaba el password **al arrancar**, cuando cambiaba la variable. Era inútil el día del torneo —exigía un redeploy, que es justo lo que nadie va a hacer con la patrulla esperando— y con la recuperación por interfaz pasó a ser **dañino**: rotar el código habría borrado el password del admin en el próximo deploy, sin que nadie lo pidiera.

### 3.2 Líder de patrulla

- Usuario `patrullaN` + **PIN de 6 dígitos** (10⁶ combinaciones).
- PIN generado con `crypto.randomInt` — nunca secuencial, nunca derivado del número de patrulla.
- Hasheado con **argon2id**, igual que el password de admin.
- **Alcance temporal:** la credencial solo funciona mientras el torneo está `en_proceso`. Antes de iniciar y después de completar, no autentica.
- **Alcance de datos:** la sesión solo puede escribir sobre participantes de su propia patrulla, en su propio torneo. Verificado en cada op (§4).
- Bloqueo por (patrulla, IP) tras 5 intentos fallidos: 5 minutos, que se duplican con cada bloqueo seguido hasta 20. Más un tope por patrulla de 30 fallos entre todas las IPs. El techo es corto a propósito: un líder trabado en el monte es un torneo parado. Ver §3.3.
- El admin puede **regenerar** el PIN en cualquier momento; invalida las sesiones activas de esa patrulla.

> **Cambio respecto del brief.** El brief especifica 4 dígitos: 10.000 combinaciones, rompibles por fuerza bruta en minutos. Se elevó a 6 dígitos manteniendo el mismo flujo de uso. Con el rate limit y el bloqueo, un ataque de fuerza bruta requiere años.

### 3.3 Rate limiting sin romper el torneo

Este es un balance delicado: un rate limit mal calibrado es un **denial of service autoinfligido el día del torneo**.

| Endpoint | Límite | Motivo |
|---|---|---|
| `POST /api/auth/admin/login` y `POST /api/auth/patrol/login` | 60 intentos **fallidos** / 15 min por IP (cupo compartido), **y** el bloqueo de cada par (cuenta, IP) tras 5 intentos, **y** un tope de 30 fallos por cuenta entre todas las IPs | Fuerza bruta. Los ingresos correctos no gastan nada: el wifi del club es una sola IP para todas las patrullas |
| `POST /api/auth/admin/recover` | 5 intentos **fallidos** / 15 min por IP, cupo aparte | Es la única ruta sin sesión que cambia una credencial y **no tiene bloqueo por cuenta**: el cupo de la IP es lo único que frena adivinar el código |
| `POST /api/wafl/sync` | **300 / min por sesión** (la cookie), **y** 6000 / min por IP | Generoso a propósito: una patrulla que vuelve de 3 horas sin señal envía cientos de ops de golpe. Nunca debe ser rechazada. **El cupo es de la sesión** porque el wifi del club es una sola IP para todas las patrullas, y uno por IP las cortaría entre sí al vaciar el outbox. **El tope por IP** (20 veces el de la sesión) existe porque una cookie inventada tiene su propio cupo: sin él, quien rota la cookie en cada request no gastaría nunca el mismo (`REF6-15`) |
| `/api/public/*` | 120 / min por IP | Scraping |
| `POST /api/public/archers` | **20 / hora por IP** (`RATE_LIMIT_REGISTER`), además del anterior | El alta escribe y cada una es una fila que el admin revisa. Generoso: el día de la inscripción varios arqueros se anotan desde el wifi del club |

Los límites viven en variables de entorno para poder ajustarlos sin redeploy si algo se calibra mal en el campo.

**`/api/admin/*` no tiene rate limit** (`REF6-15`). El doc decía «60 / min por sesión» y el código nunca lo tuvo. No se agregó: es una sola persona, autenticada, con CSRF, y un tope no protege de una sesión robada —quien la tiene hace lo que el admin puede hacer, a ritmo humano— mientras que sí puede cortar a un administrador legítimo cargando un torneo grande. Si alguna vez hace falta, la clave del límite es la sesión, como en `sync` (`clavePorSesion`).

**Qué cuenta y qué no (`REF6-2`).** Antes el límite de login se aplicaba a todo `/api/auth/*` y contaba cada request, así que `/me` y `/csrf` —que la app pide en cada carga— y los ingresos correctos gastaban el mismo cupo que un ataque: la patrulla 11 que entraba desde el wifi del club quedaba afuera por culpa de las diez anteriores. Ahora el cupo cuenta sólo las respuestas `401` (credenciales equivocadas) de las tres rutas de ingreso. Un `429` del bloqueo de la cuenta, un `403` de CSRF o un `409` de torneo no iniciado **no** cuentan.

**El cupo se reserva al entrar y se devuelve si no fue un fallo.** No alcanza con mirar el contador al entrar y anotar el fallo al salir: una ráfaga de requests simultáneos mira el contador antes de que el primero termine y pasan todos (en la primera versión, treinta intentos contra un cupo de cinco). En la recuperación del password, que no tiene bloqueo por cuenta, eso dejaba adivinar el código sin otro freno que el tamaño de la ráfaga. Por eso cada intento suma uno apenas llega y lo resta si la respuesta no fue `401`. El costo: los intentos *en vuelo* cuentan unos milisegundos, así que hacen falta tantos ingresos simultáneos como el cupo para cortar a uno legítimo (60 en el login).

#### El bloqueo de la cuenta (`REF6-6`)

Era por cuenta sola: cinco intentos fallidos, **desde cualquier lado**, dejaban afuera a su dueño 15 minutos. El usuario del admin es `admin` y los de las patrullas los publica `/api/public/tournaments/:id`, así que dejar afuera al admin en pleno torneo —cuando necesita desbloquear una firma o regenerar un PIN— costaba cinco requests. Ahora son **dos capas**:

1. **Por par (cuenta, IP), en memoria** (`lib/bloqueoDeIngreso.ts`). Cinco intentos y el sexto dispara el bloqueo; cada bloqueo seguido dura el doble (admin: 15 → 30 → 60 min; patrulla: 5 → 10 → 20 min) y un ingreso correcto, o una hora sin intentos, reinicia el castigo. Quien insiste se bloquea a sí mismo; el dueño, que entra desde otra IP, no se entera. Insistir *mientras* está bloqueado no lo alarga.
2. **Por cuenta, en la base**, con el umbral en **30** fallos entre todas las IPs. Es la red de seguridad de la primera: sin ella, adivinar un PIN de seis dígitos desde muchas IPs —cinco intentos por cada una— no tendría techo. Tiene que ser mucho más alto que cinco: a cinco, volvía a ser lo de antes y cualquiera dejaba afuera al dueño con cinco requests.

**El intento se reserva al entrar** y no se anota al salir: mirar el contador antes de verificar y sumar el fallo después dejaba que una ráfaga de treinta requests simultáneos pasara entera (cada uno miraba el contador antes de que el primero terminara). El costo: **un mismo par no admite más de cinco intentos en vuelo a la vez**; el sexto simultáneo recibe `429` aunque la clave sea buena. Un humano no manda seis ingresos al mismo tiempo desde la misma IP y para la misma cuenta, y argon2 tarda lo bastante como para que la ventana sea corta.

**Se aplica igual a una cuenta que no existe** (`nadie`, `patrulla99`). Si sólo se bloquearan las cuentas reales, que el bloqueo aparezca o no distinguiría un usuario válido de uno inventado: un oráculo para enumerarlos. La clave de una patrulla usa el id **canónico** del torneo y no el texto del request: el esquema acepta el hexadecimal en mayúsculas, y el mismo torneo escrito de otra forma daría un cupo nuevo.

**Recuperar el acceso suelta el bloqueo** de todas las IPs de la cuenta: recuperar el password (`recoverAdminPassword`) y regenerar el PIN (`regeneratePin`). Que el dueño siga esperando después de eso no tiene sentido.

> **Límites de la capa en memoria.** Se pierde al reiniciar el proceso y no se comparte entre instancias; alcanza para el despliegue de un solo contenedor (`ARCHITECTURE.md` §3). La capa de la base sí sobrevive. Tiene un tope de 10 000 pares: sin él, una IP inventada por request lo hacía crecer sin límite. Si se escala a más de una instancia, el bloqueo por par pasa a la base.

**La IP del cliente.** El código tomaba el primer valor de `X-Forwarded-For`, y los proxies *agregan* al final: el primero lo escribe quien hace el request, así que un valor distinto en cada intento esquivaba el cupo. Ahora se usa `TRUSTED_IP_HEADER`, por defecto `x-real-ip` en producción —el header que Railway documenta como la IP del cliente en *Specs & Limits → Request Headers*—, y el mismo valor alimenta las sesiones y el audit log. El `Map` de contadores tiene un tope de 10 000 claves: sin él, una IP inventada por request lo hacía crecer sin límite.

> **Pendiente de verificar en el primer deploy (`INF-4`).** La documentación de Railway dice que `X-Real-IP` identifica la IP del cliente, pero **no dice que el borde pise un `X-Real-IP` mandado por el cliente**. Antes de dar el cupo por bueno: iniciar sesión como admin con `curl -H 'X-Real-IP: 1.2.3.4' -H 'x-csrf-token: …' …/api/auth/admin/login` y mirar el campo `ip` de la sesión recién creada en la colección `sessions` (es la IP que ve el servidor, la misma que usa el cupo). Si guardó `1.2.3.4`, el borde no reescribe el header: hay que usar otro o poner un proxy que lo haga.

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
- Tamaño máximo del body, **medido en bytes reales** (`middleware/limiteDeBody.ts`): **64 KB** en cualquier ruta salvo `POST /api/wafl/sync`, que admite **1 MB**. Antes sólo se miraba el `Content-Length` que declara el cliente: con `Transfer-Encoding: chunked` no hay header, y el body entero se leía a memoria antes de decidir nada. Ahora se cuentan los bytes que llegan y se corta apenas se pasa del máximo. El sync es la excepción porque un lote de 200 operaciones con firmas pesa cientos de KB y una patrulla que vuelve de tres horas sin señal **nunca** debe ser rechazada por esto. Máximo 200 ops por batch de sync.
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
- Al publicar, se verifica de nuevo para todos los participantes firmados. Si alguno difiere, publicar se rechaza con `SIGNATURE_MISMATCH` y el mensaje dice de quién. *(Desde `REF6-1`: esta línea estaba escrita y el código no lo hacía.)*
- **Lo firmado no se escribe.** Una op de score sobre un arquero que ya firmó se rechaza con `SIGNATURE_LOCKED`, y toda op de score o de firma sobre una patrulla cerrada, con `PATROL_CLOSED`. Antes el hash se comparaba una sola vez, en el cierre, y lo que llegara después no lo miraba nadie. La firma desbloqueada por el admin cuenta como firmada.
- `SIGNATURE_MISMATCH` queda entonces como **defensa en profundidad**: salta cuando el dato cambia por un camino que no es `/sync` (una corrección a mano en la base, un script, un bug).

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
- El frontend obtiene el token con `GET /api/auth/csrf` antes de la primera mutación. Lo lee de la cookie; si el navegador todavía no la muestra en `document.cookie` (WebKit en Linux, justo después de la respuesta), usa el `csrfToken` del cuerpo de esa misma respuesta. Es el mismo valor que la cookie, que el navegador manda igual: el par cookie/header sigue coincidiendo.
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
- Cada visualización queda registrada en `auditLog` (`patrol.pin.reveal`). **Una visualización es una decisión** (`REF6-7` / `S-7`): `GET /api/admin/tournaments/:id/patrols` **no trae los PIN** salvo que se pidan con `?pins=1` (y con ese valor y ningún otro: otro valor o un parámetro desconocido es un `400`). Antes los traía siempre, y como la pantalla del torneo la usa para mostrar el avance, cada vistazo —y cada refresco— descifraba todos los PIN y escribía en el log: el registro se llenaba de ruido y dejaba de servir para lo que está. Sólo piden `?pins=1` la pantalla de credenciales de la patrulla, y el `PUT` que guarda una redistribución (se hace desde esa misma pantalla). Publicado el torneo, no se devuelven ni pidiéndolos.
- El admin puede **regenerar** el PIN en cualquier momento.

**Lo que esto significa.** Quien obtenga *a la vez* un volcado de la base **y** la variable de entorno puede leer los PINs. Es una degradación real frente a "solo hash".

**Por qué se acepta.** El activo protegido es un PIN de torneo de un día, de alcance acotado a una patrulla, cuya única capacidad es escribir puntajes de sus 4 miembros — puntajes que además quedan firmados y auditados. La alternativa — que el admin no pueda recuperar el PIN — llevaría inevitablemente a que los PINs terminen anotados en un papel o en un chat de WhatsApp, que es estrictamente peor.

La alternativa superior existe y está en el backlog como P2: **acceso por QR con token firmado**, que elimina la necesidad de mostrar el PIN.

---

## 9 bis. Qué queda en el audit log

El log existe para contestar «quién hizo esto, cuándo y desde dónde». Cada entrada guarda el actor, la acción, la entidad, el momento y la IP (la de `TRUSTED_IP_HEADER`, ver §3.3). El `meta` guarda **qué pasó, nunca datos de las personas**: sin nombres, DNI, tokens, hashes ni PIN. (`REF6-7` / `S-9` completó la lista: antes sólo se auditaban publicar, desbloquear firmas, PIN y sync.)

| Quién | Acciones |
|---|---|
| Admin | `admin.login` (sólo los correctos) · `tournament.create/start/unstart/delete/update/publish/unpublish/target_edit/participants_edit` (`update` con los campos cambiados, sin sus valores) · `patrol.pin.reveal/regenerate`, `patrol.manual_edit` (redistribución) · `signature.unlock` · `payment.set` (con el estado resultante y el torneo) · `archer.create/update/archive/restore/delete/approve/reject` · `season.create/update/close/reopen` · `admin.password_recovered` |
| Patrulla | `patrol.close` (con la IP de quien cerró) · `sync.forbidden` · `sync.conflict` |
| Público | `archer.register_duplicate` |

**Qué no se registra, a propósito.** Los ingresos **fallidos**: un `401` por request llenaría el log con el ruido de cualquier bot, y ya tienen su freno (§3.3). Las lecturas, salvo la de los PIN. Los puntajes uno por uno: el sync ya los guarda con su `opId`, su autor y su `clientUpdatedAt`.

**Lo que el log no hace todavía:** ninguna pantalla lo muestra. Está en la base y se consulta ahí. Mostrarlo al admin es lo siguiente.

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
- **El JIT de Zod se apaga en el navegador desde `schemas.ts`, no desde el punto de entrada** (`REF6-8`). Zod 4 prueba `new Function('')` al construir cada schema, y con la CSP sin `'unsafe-eval'` el navegador lo reporta como violación en cada carga. `REF6-3` lo evitaba con un `import` de efecto puesto primero en cada `main.tsx`; con `React.lazy` el chunk de los schemas se evalúa **antes** que el cuerpo de la entrada y la violación volvió. Ahora `schemas.ts` importa `configuracionZod.ts`, que apaga el JIT si hay un DOM (el backend lo conserva: valida hasta 200 ops por lote). `e2e/tema-sin-parpadeo.spec.ts` sigue mirando las cuatro rutas.
- **La PWA no cachea nada de la API** (`REF6-8` / `S-8`). Había una regla `runtimeCaching` que nunca matcheaba; si alguien la «arreglaba», habría guardado 24 h `/api/admin/*` —con los PIN en claro— en Cache Storage, y el logout no lo limpia. Se borró, y un test E2E mira que `sw.js` no tenga ninguna. Ver `OFFLINE_SYNC.md` §8.
- **Compresión de `/api/*` y BREACH.** El JSON de la API puede ir comprimido con gzip. BREACH necesita un secreto y datos del atacante reflejados en el mismo cuerpo; `/api/auth/csrf`, la única respuesta con un token, no refleja nada del request. Si esa respuesta cambia, hay que revisarlo.
- El script anti-FOUC del tema es un **archivo externo del mismo origen** (`theme-init.js`), no un script inline: la CSP se queda en `script-src 'self'`, sin `'unsafe-inline'` y sin hashes que mantener a mano. *(Hasta `REF6-3` los `index.html` lo llevaban inline y la CSP no tenía el hash: el navegador lo bloqueaba en producción.)*
- **Cero violaciones de CSP en la consola.** Zod 4 sondea `eval` con `new Function('')` al construir cada schema, y la CSP no lo permite: el `try` atrapaba el error pero el navegador lo reportaba igual. Los frontends importan `@bal/shared/navegador` primero, que pone `jitless`. Sólo en el navegador: el backend corre sin CSP y se beneficia del JIT.
- HTTPS obligatorio. Railway termina TLS.

---

## 11. Datos personales

PII mínima **por diseño**:

- De los arqueros: nombre, apellido, categoría, sexo y DNI.
- **Sin** emails, teléfonos, direcciones ni fechas de nacimiento.
- Las firmas son imágenes de trazo, no datos biométricos identificatorios.
- No hay cuentas de usuario para los arqueros.

> **Ampliado el 2026-10-24.** `sexo` y `dni` se agregaron para el ranking por sexo (`SH-10`) y para poder deduplicar altas del autoregistro público (§15) sin depender de nombre y apellido, que no son únicos. Son **opcionales** —el padrón anterior no los tiene— y nunca se inventan. El `dni` **nunca sale de una ruta sin sesión**: sólo lo devuelven los endpoints de `/api/admin/*`. Los endpoints de `/api/public/*` (landing) exponen `sexo` —es lo que alimenta el ranking por sexo, que es público por diseño— pero no `dni` ni `registrationStatus`.

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
- [x] El bloqueo es por (cuenta, IP): quien insiste no deja afuera al dueño desde otra IP. — bloqueo-de-cuentas.test.ts
- [x] Una ráfaga simultánea contra una cuenta no pasa de cinco intentos. — bloqueo-de-cuentas.test.ts
- [x] Muchas IPs contra una cuenta terminan en el tope por cuenta (30). — bloqueo-de-cuentas.test.ts
- [x] Una cuenta que no existe se bloquea igual que una real. — bloqueo-de-cuentas.test.ts
- [x] Recuperar el password y regenerar el PIN sueltan el bloqueo. — bloqueo-de-cuentas.test.ts
- [x] Credencial de patrulla **no funciona** si el torneo no está `en_proceso`. — wafl.test.ts
- [x] Regenerar el PIN invalida las sesiones activas de esa patrulla. — ciclo.test.ts
- [x] En producción, arrancar sin `ADMIN_INITIAL_PASSWORD` **falla el arranque**. — env.test.ts
- [x] El primer login de admin obliga a cambiar el password. — auth.test.ts

### Autorización
- [x] La patrulla 3 enviando una op de un participante de la patrulla 5 → op `rejected`, registrada en el audit log. — wafl.test.ts · **seguridad.test.ts**
- [x] Un batch mixto (ops propias + ajenas) aplica **solo** las propias. — wafl.test.ts
- [x] Un `duplicate` (mismo `opId`) que apunta a un arquero de **otra** patrulla no devuelve su puntaje. El duplicado se detecta por `opId` antes de autorizar nada, y desde `REF6-4` devuelve el puntaje vigente de la celda: sin comprobar de quién es el arquero, reenviar un `opId` propio con el `participantId` ajeno leería los puntajes de otra patrulla. — wafl.test.ts
- [x] Un recurso de otro torneo → 404, no 403. — **seguridad.test.ts**

### Integridad del puntaje
- [x] `total` falseado por el cliente → **ignorado**, recalculado en el servidor. — wafl.test.ts
- [x] Token `11` en un blanco de sala → rechazado con `INVALID_TOKEN`. — wafl.test.ts
- [x] Token `X` en un blanco 3D → rechazado. — wafl.test.ts
- [x] Cantidad de flechas distinta a la del blanco → `ARROW_COUNT`. — wafl.test.ts
- [x] Op de score sobre un arquero que ya firmó → `rejected` con `SIGNATURE_LOCKED`; el que no firmó sigue pudiendo corregir. — **seguridad.test.ts**
- [x] Op de score o de firma con la patrulla cerrada → `rejected` con `PATROL_CLOSED`, también dentro del mismo lote que el cierre. — **seguridad.test.ts**
- [x] Cambiar un puntaje después de firmar, por fuera de `/sync` → `SIGNATURE_MISMATCH` al cerrar. — **seguridad.test.ts**
- [x] Publicar un torneo con un puntaje alterado después de firmarse → `SIGNATURE_MISMATCH`, y no queda publicado. — **seguridad.test.ts**
- [x] Cerrar el circuito sin todas las firmas → `SIGNATURES_MISSING`. — wafl.test.ts
- [x] Publicar un torneo que no está `completado` → `INVALID_STATE_TRANSITION`. — ciclo.test.ts

### Validación e inyección
- [x] Payload con una propiedad extra → rechazado por `.strict()`. — app.test.ts
- [x] `{ "username": { "$ne": null } }` en el login → rechazado por Zod, **sin** llegar a la base. — auth.test.ts
- [x] Clave con `$` o `.` en un objeto anidado → rechazada. — **seguridad.test.ts**
- [x] `ObjectId` malformado → 400, sin excepción del driver. — tournaments.test.ts
- [x] Firma que no es un PNG real → rechazada. — wafl.test.ts
- [x] Body > 1 MB → 413. — app.test.ts
- [x] Body > 64 KB fuera del sync → 413, también con `Transfer-Encoding: chunked` y sin `Content-Length`. — limite-de-body.test.ts

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
- [x] El contenedor corre como usuario no root. — job `imagen` del CI, bloqueante: construye la imagen y verifica el `uid` **corriendo el contenedor**. `USER node` declarado en el `Dockerfile` no probaba nada mientras nadie lo construyera, y de hecho la imagen **no construía**

---

## 14. Proceso

- **`/security-review` sobre el diff antes de cada merge relevante.** Bloqueante si aparece algo HIGH o MEDIUM.
- **`aikido:scan`** después de generar código nuevo.
- Este checklist se ejecuta completo antes de cada release.
- Cualquier desviación de un control de este documento se discute y se documenta **antes** de implementarse, nunca después.

---

## 15. Alta pública de arqueros — la primera ruta sin sesión que escribe

`POST /api/public/archers` (`BE-20`, `docs/FUNCTIONAL.md` §5.5). Hasta este cambio, todo `/api/public/*` era de **sólo lectura**: el peor caso de un bug ahí era mostrar mal un dato público. Una ruta que escribe sin sesión es una superficie distinta, y se la trata como tal:

- **Nunca queda usable de inmediato.** Nace `registrationStatus: 'pendiente'` (decisión 7, `ACTION_PLAN.md` Fase 8) y no entra al padrón que alimenta el wizard de torneo (`archerRepo.list` filtra por `'aprobado'` salvo que se pida lo contrario) hasta que un admin la aprueba desde WAFA (`BE-22`). El peor abuso posible —un bot creando cientos de arqueros falsos— no contamina ningún torneo real: queda en una cola que el admin revisa, no en producción.
- **`.strict()` impide autoaprobarse.** El cuerpo acepta exactamente `{ firstName, lastName, dni, sex, category }`. Un request con `registrationStatus: 'aprobado'` o `isAdmin: true` se rechaza antes de llegar al servicio — no hay una rama de código que decida "confío en este campo si viene"; Zod lo descarta estructuralmente.
- **El DNI duplicado no es un oráculo (`REF6-6`).** Un DNI nuevo y uno ya anotado en esa categoría reciben **la misma respuesta**: `200` con un arquero de forma idéntica. Antes era `409 ARCHER_DNI_DUPLICATE`, y aunque el mensaje no decía el nombre, el solo hecho de que el alta falle confirmaba que ese DNI estaba en el padrón —un oráculo para saber si una persona puntual está inscripta, información que el club no decidió hacer pública—. Cuando es un duplicado no se crea nada: se devuelve un `_id` inventado y se deja una entrada `archer.register_duplicate` en el audit log, para que quede registrado que alguien intentó anotar de nuevo a ese DNI. El índice único sigue siendo `{dni, category}` —la misma persona puede anotarse en más de una categoría—, y `POST /api/admin/archers` sigue devolviendo `409`: el admin tiene sesión y no hay nada que ocultarle.
- **Rate limit propio (`REF6-6`).** Además de `RATE_LIMIT_PUBLIC` (por minuto), `RATE_LIMIT_REGISTER` (20 por hora y por IP, `scope: 'alta'`). Antes se había decidido no tener uno propio porque «el freno real es la cola de aprobación», pero la cola es un freno *humano*: cada alta basura es una fila que el admin tiene que revisar y descartar. Quien manda mil altas no contamina ningún torneo, pero sí le hace perder la tarde al admin. 20 por hora alcanza para el wifi del club el día de la inscripción.
- **Campo trampa (*honeypot*).** El formulario lleva un `sitioWeb` oculto —fuera de pantalla, `aria-hidden`, `tabIndex={-1}`, `autoComplete="off"`—. Una persona no lo ve ni lo completa; un bot que llena todo lo que encuentra, sí. Si llega con contenido, el servidor responde **igual que si hubiera funcionado** (mismo `200`, `_id` inventado) y no guarda nada: un error le avisaría al bot que lo detectaron. No es una defensa contra alguien que lea el formulario, pero filtra el grueso del ruido automático.
- **Sin caché.** `publicCache` (que agrega `Cache-Control`/`ETag` a `/api/public/*`) está escrito para GETs idempotentes; se lo acotó a no tocar un método que no sea `GET`, así una respuesta de creación nunca queda con cabeceras de caché que invitarían a un intermediario a servirla de nuevo.

## 16. Link de pre-inscripción — un dato del admin que el sitio público usa como `href`

`registrationUrl` del torneo (`BE-27`, `2026-11-10`): el link a un formulario o planilla externa donde los arqueros se pre-anotan. Lo carga el admin en WAFA y la landing lo dibuja como botón. Es **el primer dato que entra por un formulario y sale como enlace en el sitio público**; el resto de lo que carga el admin se renderiza como texto, que React escapa solo. Un `href`, no: React **no** bloquea un `javascript:` en un atributo.

- **Sólo `https:`** (`RegistrationUrlSchema`, en `@bal/shared`). `javascript:` y `data:` serían XSS almacenado contra cada visitante de la landing; `http:` mandaría al arquero a cargar su DNI en un formulario sin cifrar. Se valida al guardar, en el servidor, con el mismo esquema que usa el cliente: lo que está en la base ya pasó el filtro, y el endpoint público lo devuelve tal cual.
- **Tope de 500 caracteres**, para que no sirva de depósito de texto arbitrario.
- **Quién lo carga es admin con sesión**: el riesgo no es un visitante anónimo sino una sesión de admin robada. La validación existe para que ni así se pueda usar la landing contra sus visitantes.
- **La landing no lo reconstruye ni lo «arregla»**: lo usa tal cual llegó, con `target="_blank" rel="noopener noreferrer"` (`FE-36`), así el sitio externo no recibe `window.opener` ni la URL de la landing.
- Los torneos creados antes no tienen la clave; se leen como `null` (sin botón).
