# Informe de auditoría — Sexta ronda

Revisión del proyecto completo, de punta a punta, sobre seis ejes: **performance, seguridad, UI/UX, legibilidad y calidad de código, buenas prácticas y testing**.

El plan que implementa estos hallazgos está en [`ACTION_PLAN.md`](ACTION_PLAN.md).

> **Pedido, literal:** «Analiza todo el proyecto, de principio a fin. Busca oportunidades de mejora en los siguientes puntos: Performance, Seguridad, UI/UX, Legibilidad y calidad de código, Buenas prácticas, Testing. Crea un informe detallado y plan de acción.»

**Fecha:** 2026-10-27 · **Commit base:** `0dd7ac2` (`main`) · **Autor:** Claude Opus 5.5

---

## 1. Resumen ejecutivo

El proyecto está **maduro y bien cuidado**. Las decisiones duras —servidor como autoridad del puntaje, dominio puro en `@bal/shared`, sincronización idempotente con resultado por op, Zod `.strict()`, argon2id con comparación de tiempo constante, sesión `HttpOnly` hasheada, CSRF de doble envío, PWA con `prompt`— están bien implementadas y documentadas. Lint, tipos y los **1331 tests** pasan.

Lo que encontró esta revisión no es deuda de estilo: son **cinco problemas que pueden aparecer el día del torneo** y que ningún test actual puede ver.

| # | Hallazgo | Eje | Severidad |
|---|---|---|---|
| 1 | Una patrulla que **ya cerró el circuito** puede seguir cambiando puntajes y firmas; el servidor no lo impide y publicar no lo verifica | Seguridad / integridad | **Alta** |
| 2 | El rate limit de `/api/auth/*` cuenta **todo** (login, `/me`, `/csrf`, logout) por IP: la patrulla 11 que entra desde el wifi del club recibe 429 | Seguridad / disponibilidad | **Alta** |
| 3 | La CSP de producción **bloquea el script anti-FOUC** de los dos `index.html`: nadie le pasa los hashes a `createApp()` | UI/UX | **Alta** |
| 4 | El cliente offline **diverge del servidor**: un puntaje `superseded` nunca se corrige en el celular, y los puntajes re-sembrados muestran X/10/M en cero — justo en la pantalla que el arquero mira antes de firmar | UI/UX / integridad | **Media-Alta** |
| 5 | `/wafl/sync` hace ~9 viajes a Mongo **por op** y relee todos los puntajes de la patrulla en cada una: con Railway y Atlas en regiones distintas, un lote de 50 tarda decenas de segundos | Performance | **Alta** |

Y tres brechas de proceso que explican por qué estos llegaron hasta acá:

- Los **umbrales de cobertura** que `TESTING.md` §8 declara bloqueantes **no se ejecutan** en CI. Hoy `offline/` está en 76% de ramas contra un 85% exigido.
- Los **E2E corren sólo en Chromium de escritorio**, para una app que se usa en Android e iPhone.
- Los **E2E relajan los rate limits** de producción (`RATE_LIMIT_LOGIN=100`), así que el hallazgo 2 es invisible por construcción.

---

## 2. Qué se revisó y cómo

| Área | Alcance |
|---|---|
| `@bal/shared` | Los 19 módulos; pureza (sin I/O, sin `Date.now`/`Math.random`), schemas de sync |
| `@bal/api` | `app.ts`, `env.ts`, los 8 middlewares, `lib/`, las 5 rutas, los servicios de auth, sync, publicación, patrullas y padrón; repositorios de arqueros, puntajes y torneos; índices |
| `@bal/app` | Shell, `vite.config.ts` (PWA/Workbox), capa offline completa (`db`, `outbox`, `syncWorker`), WAFL (shell, blanco, resultados, sesión), carga de datos de WAFA |
| `@bal/landing` | Shell, rutas, cliente HTTP, `useRecurso` |
| `@bal/ui` | Assets y componentes compartidos |
| Infra | `Dockerfile`, `.dockerignore`, `railway.json`, CI, `playwright.config.ts`, `e2e/servidor.ts`, scripts de presupuesto |
| Docs | `CLAUDE.md`, `ACTION_PLAN.md`, `SECURITY.md` §3.3 y §13, `TECHNICAL.md` §5, `TESTING.md` §8-9, rondas `ref-1` a `ref-5` |

### Mediciones sobre el commit base

| Comando | Resultado |
|---|---|
| `pnpm lint` | ✅ 0 errores · ⚠️ 11 warnings (6 `useOptionalChain` auto-corregibles, 2 de complejidad cognitiva, 4 `console` en scripts) |
| `pnpm typecheck` | ✅ 5/5 paquetes |
| `pnpm test` | ✅ 1331 tests (shared 476 · api 288 · app 464 · landing 61 · ui 42) |
| `pnpm build && pnpm budget` | ✅ PWA **126 KB gz** de JS (84% de 150) · landing **101 KB gz** (84% de 120). **Un solo chunk** en cada una |
| Cobertura `@bal/api` (medida a mano) | 90% líneas · 79% ramas · `services/` 96% / 83% · `middleware/` 96% / 90% · `routes/` 88% / **65%** |
| Cobertura `@bal/app` (medida a mano) | 89% líneas · 82% ramas · `offline/` 91% / **76%** · `wafl/` **81%** / 78% |

---

## 3. Hallazgos

Severidad: **Alta** — puede romper el torneo o la integridad de un resultado · **Media** — defecto real con impacto acotado · **Baja** — mejora, deuda o higiene.

Cada hallazgo tiene un ID que el plan referencia.

### 3.1 Seguridad

#### `S-1` · Alta · Una patrulla cerrada sigue pudiendo escribir puntajes y firmas

`aplicarScore` y `aplicarFirma` ([`syncService.ts:189`](../../../packages/api/src/services/syncService.ts)) verifican que el participante sea de la patrulla y que el torneo esté `en_proceso`, pero **no** que la patrulla siga abierta ni que el arquero no haya firmado. `loginPatrol` tampoco rechaza una patrulla `cerrada`, así que una sesión nueva sirve igual.

**Escenario:** la patrulla 3 cierra a las 11:00 con todo firmado. El torneo sigue `en_proceso` porque faltan otras. A las 11:30 el líder —con la sesión de 24 h todavía viva, o entrando de nuevo— manda una op de score. El servidor la aplica, recalcula los rollups, y el `scorecardHash` de la firma ya no coincide. **Nadie vuelve a comparar ese hash**: el cierre ya pasó y `publish` no lo verifica. El resultado publicado no es el que el arquero firmó.

Es exactamente la amenaza de `SECURITY.md` §1 «se altera un puntaje después de firmado», y el control (§7) sólo cubre la ventana **antes** del cierre. La UI de WAFL sí bloquea editar a un firmado (`TargetPage`), pero la regla 1 dice que el servidor es la autoridad.

**Recomendación:**
1. Rechazar op por op (nuevo código `PATROL_CLOSED`) toda escritura sobre una patrulla `cerrada`.
2. Rechazar `score` sobre un participante con firma (`SIGNATURE_LOCKED`), espejando la regla que ya aplica la UI. *(Corrección posterior: este informe decía que el camino para corregir es el desbloqueo del admin. No lo es: `unlockSignature` solo sirve para quien **no** firmó y rechaza a quien ya firmó. Hoy no existe ningún camino para corregir un puntaje firmado, ni desde la UI ni desde WAFA; ver la entrada de `REF6-1` en la bitácora.)*
3. Defensa en profundidad: `publish` recalcula el `scorecardHash` de cada participante firmado y se niega a publicar si alguno no coincide.

#### `S-2` · Alta · El rate limit de login es un DoS autoinfligido el día del torneo

[`app.ts:57`](../../../packages/api/src/app.ts) aplica `RATE_LIMIT_LOGIN` (10 cada 15 min) a **todo** `/api/auth/*`, por IP: `POST /patrol/login`, `POST /admin/login`, `GET /me`, `GET /csrf`, `POST /logout`, `POST /admin/password`.

**Escenario:** el día del torneo los líderes entran desde el wifi del club —una sola IP pública— o desde la misma operadora móvil con CGNAT. La patrulla 11 recibe *«Demasiados intentos»* y espera hasta 15 minutos. Un PIN mal tipeado consume el mismo cupo. El admin que recarga WAFA en ese wifi también consume (`GET /me` en cada carga) y puede quedar afuera.

`SECURITY.md` §3.3 dice «10 / 15 min por IP **y** 5 / 15 min por patrulla» **para el login**, no para todo el prefijo, y advierte textualmente que un rate limit mal calibrado es *«un denial of service autoinfligido el día del torneo»*. La fuerza bruta del PIN ya la frena el bloqueo **por cuenta** (5 intentos), que es el control que importa.

**Recomendación:** limitar sólo `POST /admin/login`, `/patrol/login` y `/admin/recover`; contar **intentos fallidos** por IP, no requests; subir el techo por IP (p. ej. 60) y dejar que el bloqueo por cuenta haga el trabajo fino. Test: 15 patrullas distintas entrando desde la misma IP → las 15 entran.

#### `S-3` · Media · La IP del cliente se toma de un header que el cliente controla

[`clientIp`](../../../packages/api/src/middleware/rateLimit.ts) (línea 49) y [`session.ts:43`](../../../packages/api/src/lib/session.ts) usan el **primer** valor de `X-Forwarded-For`. Los proxies *agregan* al final; el primero lo pone quien quiera.

- Cualquiera evade el rate limit mandando un `X-Forwarded-For` distinto en cada request.
- La IP de las sesiones y del audit log (`patrol.pin.reveal`, `signature.unlock`) no es confiable.
- El `Map` de contadores crece sin cota: `limpiarVencidos` sólo borra ventanas vencidas, y con claves inventadas dentro de la ventana nunca vence ninguna.

**Recomendación:** confiar sólo en el valor que agrega el proxy de Railway (el último de la lista, o el header propio de la plataforma — **verificar cuál manda Railway antes de elegir**), con una variable `TRUSTED_PROXY_HOPS`; y poner un tope duro al `Map` (LRU de, p. ej., 10 000 claves).

#### `S-4` · Media · El bloqueo por cuenta se puede usar para dejar afuera al admin o a una patrulla

Cinco intentos fallidos bloquean la cuenta 15 min (admin) o 5 min (patrulla), desde cualquier IP ([`authService.ts:23`](../../../packages/api/src/services/authService.ts), [`patrolAuthService.ts:18`](../../../packages/api/src/services/patrolAuthService.ts)). El usuario del admin es `admin` por defecto, y los de las patrullas los publica `/api/public/tournaments/:id`. Cinco requests cada 15 minutos —por debajo de cualquier rate limit— mantienen al admin afuera durante todo el torneo, que es justo cuando necesita desbloquear firmas o regenerar un PIN.

**Recomendación:** bloquear por **(cuenta, IP)** en vez de por cuenta sola, con backoff progresivo; mantener la recuperación por código como salida.

#### `S-5` · Media · El límite de tamaño del body se puede saltear

`parseJsonBody` ([`validate.ts:30`](../../../packages/api/src/middleware/validate.ts)) compara sólo el `Content-Length` **declarado**. Con `Transfer-Encoding: chunked` no hay header y `c.req.json()` lee todo a memoria.

**Recomendación:** `bodyLimit` de `hono/body-limit` sobre `/api/*` (1 MB en `/wafl/sync`, 64 KB en el resto), que cuenta los bytes reales.

#### `S-6` · Media · El alta pública es un oráculo de DNI y no tiene fricción contra spam

`POST /api/public/archers` responde `409 ARCHER_DNI_DUPLICATE — «Ya existe un arquero con ese DNI»` ([`archerRepo.ts:88`](../../../packages/api/src/repositories/archerRepo.ts)). Cualquiera puede preguntar si un DNI está en el padrón de la liga: 120 por minuto por IP, y más con `S-3`. Y el mismo cupo permite cargar 120 altas pendientes por minuto que el admin tiene que rechazar a mano; el CSRF no frena a un bot, que primero hace un GET y lee la cookie.

**Recomendación:** responder igual para alta nueva y DNI repetido («Recibimos tu pedido») y avisarle al admin en la cola; rate limit propio para esa ruta (p. ej. 5 por hora por IP); un campo *honeypot*; tope de pendientes.

#### `S-7` · Media · Los PIN viajan y se auditan cuando nadie los pidió

La pantalla de seguimiento del torneo ([`Tournament.tsx:199`](../../../packages/app/src/wafa/pages/Tournament.tsx)) usa `GET /admin/tournaments/:id/patrols` para mostrar el avance. Ese endpoint **descifra y devuelve todos los PIN** y escribe `patrol.pin.reveal` en el audit log ([`patrolAdminService.ts:57`](../../../packages/api/src/services/patrolAdminService.ts)) — en cada visita y en cada guardado de patrullas.

El control de `SECURITY.md` §9 es «cada visualización queda en el audit log». Si cada vistazo al avance cuenta como visualización, el registro se llena de ruido y deja de servir para lo que está.

**Recomendación:** `/patrols` sin PIN por defecto; los PIN sólo en la pantalla de credenciales, con un parámetro explícito o un endpoint propio.

#### `S-8` · Baja · Configuración de caché de la PWA muerta, y peligrosa si alguien la «arregla»

`runtimeCaching` ([`vite.config.ts:48`](../../../packages/app/vite.config.ts)) usa `/^\/api\/(?!wafl\/sync)/`. Workbox evalúa la regex contra `url.href` (`https://…/api/…`), así que el `^\/api` **nunca matchea**: hoy no hace nada. Si alguien la corrige, `NetworkFirst` guarda 24 h en Cache Storage las respuestas de `/api/admin/*` —**con los PIN en claro**— y de `/api/auth/me`, y el logout no limpia ese caché.

**Recomendación:** borrar el bloque. WAFL lee de IndexedDB (regla 6) y WAFA es online por diseño: no hay nada que cachear ahí.

#### `S-9` · Baja · Huecos en el audit log

Se auditan publicar, desbloquear firmas, PIN y sync. **No** se auditan: borrar un torneo, iniciarlo y volverlo a `sin_iniciar`, **marcar un pago** (es plata), crear/editar/borrar/archivar arqueros y temporadas, ni los logins de admin.

**Recomendación:** registrar esas acciones en los servicios, con el `actorId` y la IP corregida de `S-3`.

#### `S-10` · Baja · Cadena de suministro del CI

El workflow no declara `permissions:` (el token tiene los permisos por defecto del repo), las actions van por tag (`@v4`) y no por SHA, no hay Dependabot ni Renovate, y la imagen base no está fijada por digest. `aikido:scan` sigue pendiente de `BE-14`.

### 3.2 Performance

#### `P-1` · Alta · `/wafl/sync` escala mal con la latencia a la base

Cada op corre en su propia transacción ([`syncService.ts:145`](../../../packages/api/src/services/syncService.ts)) —decisión correcta para aislar fallas— y además, dentro de cada score, `actualizarAvanceDePatrulla` ([línea 320](../../../packages/api/src/services/syncService.ts)) relee **todos los participantes y todos los puntajes de la patrulla** (hasta 4 × 60 = 240 documentos) para recontar blancos completos.

Por op de score: `claimOp` + `startSession` + `findParticipant` + `findScore` + `upsertScore` + `applyRollupDelta` + `listParticipantsOfPatrol` + `listScoresOfPatrol` + `setTargetsCompleted` + commit ≈ **9-10 viajes**. El cliente manda lotes de 50 ([`syncWorker.ts:32`](../../../packages/app/src/offline/syncWorker.ts)).

| RTT Railway ↔ Atlas | Lote de 50 ops |
|---|---|
| 2 ms (misma región) | ~1 s |
| 30 ms | ~15 s |
| 120 ms (continentes distintos) | **~60 s** |

`TECHNICAL.md` §5 fija «batch de 20 ops p95 < 400 ms» y **nadie lo mide**. La patrulla que vuelve del monte con tres horas de puntajes es la que sufre.

> **Medido en `REF6-5`.** Las cifras de arriba eran estimaciones mías, hechas leyendo el código. Con un proxy que inyecta latencia entre la API y MongoDB, el código de entonces daba **554 comandos y 17,6 s a 30 ms, 67,6 s a 120 ms** para 50 ops: la estimación del 10 por op era correcta (204 comandos para 20 ops) y los tiempos quedaron dentro de ~15 %. Después de la tanda: 309 comandos, 9,9 s y 37,8 s. Detalle y tabla completa en `TECHNICAL.md` §5.

**Recomendación:**
1. Recalcular el avance **una vez por lote**, al final, en una transacción corta — o de forma incremental: un `$inc` cuando un blanco pasa a completo.
2. Dedup en bloque (`insertMany` con `ordered: false`) en vez de un insert por op.
3. Documentar en `CONFIG.md` que Railway y Atlas **tienen que estar en la misma región**, y medirlo.

#### `P-2` · Media · El POST de sync no tiene timeout

`deps.post` ([`syncWorker.ts:120`](../../../packages/app/src/offline/syncWorker.ts)) es un `fetch` sin `signal`. Con señal intermitente un request puede quedar colgado minutos; mientras tanto `corriendo = true` y **ningún otro disparador puede vaciar el outbox**, aunque la señal haya vuelto.

**Recomendación:** `AbortSignal.timeout(20_000)` en el POST de sync, tratado como error reintentable.

#### `P-3` · Media · Sin compresión HTTP

`TECHNICAL.md` §5 pide Brotli/gzip para respuestas de más de 1 KB y no hay ningún middleware de compresión. El JS de la PWA viaja como **438 KB** en vez de 126 KB gz, a menos que el borde de Railway comprima — **verificar con un `curl -H 'Accept-Encoding: br'` contra el deploy**.

**Recomendación:** precomprimir los assets en el build (`.br`/`.gz`) y servirlos con `serveStatic({ precompressed: true })`; `hono/compress` para el JSON de la API.

#### `P-4` · Media · Los assets estáticos no tienen política de caché

`montarEstaticos` ([`estaticos.ts`](../../../packages/api/src/middleware/estaticos.ts)) no pone `Cache-Control`. Los archivos de `/assets/*` tienen hash en el nombre y deberían ir `public, max-age=31536000, immutable`; `index.html`, `sw.js` y `manifest.webmanifest`, `no-cache`. La landing no tiene service worker, así que hoy revalida todo en cada visita. Además, `index.html` se lee de disco en cada fallback de SPA ([línea 83](../../../packages/api/src/middleware/estaticos.ts)); se puede leer una vez al montar.

#### `P-5` · Media · No hay code splitting

[`App.tsx:15-16`](../../../packages/app/src/App.tsx) importa `WafaApp` y `WaflApp` de forma estática: el líder de patrulla descarga todo el panel de administración. `TECHNICAL.md` §5 lo pide explícitamente («entrar como líder no descarga el código de administración»). La landing también va en un solo chunk de 341 KB (101 KB gz, 84% del presupuesto), incluido el formulario de alta y el gráfico de evolución.

**Recomendación:** `React.lazy` para las dos apps y para las rutas pesadas de la landing. El service worker ya precachea todos los `.js`, así que WAFL sigue funcionando offline.

#### `P-6` · Baja · Consultas públicas más anchas de lo necesario

`GET /api/public/tournaments` ([`publico.ts:122`](../../../packages/api/src/routes/publico.ts)) trae hasta 200 torneos completos —con todos sus blancos— y filtra por estado en memoria, teniendo el índice `ix_status_date`. La caché LRU de rankings que pide `TECHNICAL.md` §5 no existe: `publicCache` evita reenviar el body con un 304, pero la consulta y el hash se calculan igual en cada request.

#### `P-7` · Baja · Detalles del camino de scoring

`TargetPage` relee **todos** los puntajes de IndexedDB en cada toque y filtra en memoria; hay índice para hacerlo mejor. Hoy son ≤ 240 registros y no se nota, pero `memo` en filas y teclado (`TECHNICAL.md` §5) no está aplicado y el presupuesto «registrar una flecha < 50 ms» no se mide.

### 3.3 UI/UX

#### `U-1` · Alta · La CSP bloquea el script anti-FOUC en producción

[`index.ts:24`](../../../packages/api/src/index.ts) llama `createApp()` **sin `scriptHashes`**, así que la CSP queda en `script-src 'self'`. Los dos `index.html` (app y landing) traen el script del tema **inline** en el `<head>`. Resultado en producción:

- El script no corre. Quien usa tema oscuro ve la pantalla en claro y el salto a oscuro cuando React monta: el flash que `DESIGN_SYSTEM.md` §9 dice que no existe.
- Cada carga deja una violación de CSP en la consola.

`e2e/servidor.ts` también llama `createApp` sin hashes y con `NODE_ENV=production`, pero ningún test escucha `securitypolicyviolation`, y el test de contraste en oscuro pasa igual porque React aplica el tema después.

Hay además un **tercer** script de tema muerto, [`public/theme-init.js`](../../../packages/app/public/theme-init.js), que usa otra clave (`bal-theme` en vez de `bal_tema`) y otra lógica.

**Recomendación:** mover el script a un archivo externo del mismo origen cargado de forma bloqueante en el `<head>` —la CSP actual ya lo permite, sin hashes que mantener—, con la clave de `TEMA_KEY`, y borrar las copias. Test E2E: con `colorScheme: 'dark'`, `data-theme="dark"` presente en `DOMContentLoaded` y cero eventos `securitypolicyviolation`.

#### `U-2` · Media · Los puntajes re-sembrados muestran X, 10 y M en cero

`sembrarPuntajes` ([`wafl/sesion.ts:126`](../../../packages/app/src/wafl/sesion.ts)) guarda los puntajes que vienen del servidor con `innerCount`, `xCount`, `tenCount` y `mCount` en **0**. `ResultsPage` suma esos campos. Un líder que cambia de celular, o que vuelve a entrar, ve sus X, sus 10 y sus M subcontados **en la pantalla de resultados que el arquero mira para firmar**.

**Recomendación:** recomputar con `validateTargetScore` usando la modalidad del blanco que ya está en el bundle — la misma función que usa el servidor.

#### `U-3` · Media · Un puntaje `superseded` nunca se corrige en el celular que perdió

`aplicarResultados` ([`syncWorker.ts:204`](../../../packages/app/src/offline/syncWorker.ts)) sólo actualiza IndexedDB cuando la op vuelve `applied`. Con `superseded` saca la op del outbox pero deja el valor perdedor con `syncState: 'pending'`, y `sembrarPuntajes` **nunca pisa** un puntaje que no esté `synced`. El celular que perdió el LWW muestra para siempre un número que no es el del servidor; el arquero firma mirando ese número; el servidor guarda el hash del otro. Lo mismo, en menor grado, con `duplicate`: queda `pending` aunque el servidor lo tenga.

**Recomendación:** que `superseded` devuelva también las flechas ganadoras y el cliente las escriba como `synced`; marcar `synced` ante `duplicate`. Que el E2E `dos-dispositivos` verifique que **los dos** celulares terminan mostrando lo mismo.

#### `U-4` · Media · Logos rotos sin señal, e íconos de instalación incompletos

- `globPatterns` ([`vite.config.ts:41`](../../../packages/app/vite.config.ts)) no incluye `webp` ni `png`. `cba.webp` (18 KB, sobre el límite de inline de Vite) lo usan el login de WAFL y el pie, que está **siempre visible**: sin señal se ve la imagen rota.
- El manifest declara un único SVG con `purpose: 'any maskable'`. Android e iOS esperan PNG 192/512 y un ícono maskable aparte con zona segura; iOS usa `apple-touch-icon`. Los PNG ya existen en el árbol de trabajo, sin commitear.
- `theme_color` del manifest (`#16170f`, oscuro) no coincide con el `meta theme-color` (`#fbfaf5`, claro).

#### `U-5` · Media · La navegación SPA no anuncia el cambio de página

- Ninguna ruta actualiza `document.title`: todas las pantallas se llaman igual en el historial, en las pestañas y para el lector de pantalla (WCAG 2.4.2).
- El contenido scrollea dentro de `main` (`h-dvh overflow-hidden`, [`landing/App.tsx:30`](../../../packages/landing/src/App.tsx) y `Screen` en la app), y React Router sólo restaura el scroll de `window`. Al pasar del ranking a la ficha de un arquero se entra **a la mitad de la página**. El foco tampoco se mueve al contenido nuevo.

**Recomendación:** un hook `useTituloDePagina` y un efecto por cambio de `location` que lleve el `scrollTop` del contenedor a 0 y el foco al `h1`.

#### `U-6` · Baja · El seguimiento del torneo no se actualiza solo

En WAFA, la pantalla del torneo en curso carga una vez. Para ver el avance de las patrullas hay que recargar. Un refresco suave (30 s, pausado con `visibilitychange`) lo resuelve — y con `S-7` ya no arrastra los PIN en cada vuelta.

#### `U-7` · Baja · La pantalla se apaga en medio de un blanco

Entre flecha y flecha el celular se bloquea, y desbloquearlo con guantes es exactamente lo que el sistema de diseño intenta evitar. La Screen Wake Lock API, pedida sólo en `TargetPage` y re-adquirida al volver de `visibilitychange`, lo evita sin dejar la pantalla encendida todo el recorrido. **Decisión a confirmar**: costo de batería.

### 3.4 Legibilidad y calidad de código

#### `C-1` · Media · Componentes de página demasiado grandes

`Archers.tsx` (668 líneas, con `ArcherForm` adentro), `Tournament.tsx` (603, con warning de complejidad cognitiva en la línea 172), `TournamentCreate.tsx` (527) y `Patrols.tsx` (486) mezclan carga de datos, estado, reglas de presentación y JSX. Se leen mal y se testean sólo de punta a punta.

**Recomendación:** extraer subcomponentes con nombre y hooks de datos (`useTorneo(id)`), y dejar la página como composición.

#### `C-2` · Media · Carga de datos repetida a mano, y una dependencia que nadie usa

Cada página de WAFA reimplementa `useState` + `useEffect` + `try/catch` + `setError` (19 `useEffect` entre WAFA y landing), sin cancelación salvo en la landing. `@tanstack/react-query` está en las dependencias de `@bal/app` y **no se importa en ningún lado**.

**Recomendación:** decidir una de dos: un `useRecurso` común (ya existe uno, con `AbortController`, en la landing) o adoptar react-query. En cualquier caso, sacar la dependencia que no se usa. **Decisión a confirmar.**

#### `C-3` · Media · Los contratos de la API se repiten a mano en los clientes

Los frontends declaran la forma de cada respuesta en el lugar (`api.get<{ tournament: Torneo }>(…)`), sin un tipo compartido con el backend. Un campo renombrado en una ruta compila igual en los dos lados y falla en runtime. Las rutas ya son Hono encadenado: exportar el tipo de la app y usar el cliente RPC de Hono (`hc<AppType>`) da los tipos de punta a punta sin escribir DTOs.

#### `C-4` · Baja · Dos clientes HTTP

`app/src/lib/apiClient.ts` y `landing/src/lib/api.ts` duplican la lógica de CSRF y tienen dos `ApiError` con formas distintas (uno sin `code` ni `details`). Unificarlos en un módulo compartido.

#### `C-5` · Baja · Detección de duplicados por texto

Tres lugares detectan la clave duplicada con `error.message.includes('E11000')` ([`archerRepo.ts:88,113`](../../../packages/api/src/repositories/archerRepo.ts), [`scoreRepo.ts:176`](../../../packages/api/src/repositories/scoreRepo.ts)). El driver expone `MongoServerError` con `code === 11000`: un helper `esClaveDuplicada(error)`.

#### `C-6` · Baja · Código y configuración muertos

- `validateBody` ([`validate.ts:63`](../../../packages/api/src/middleware/validate.ts)) sin uso.
- `WEB_DIST_APP` y `WEB_DIST_LANDING` se validan en `env.ts` pero las rutas se detectan («se detecta, no se configura»).
- `LOG_LEVEL` se valida y no filtra nada: hay 13 `console.*` directos en la API.
- `VITE_APP_NAME` en `.env.example`, sin uso.
- `public/theme-init.js` (ver `U-1`) y el `runtimeCaching` (ver `S-8`).

#### `C-7` · Baja · Una acción de auditoría con nombre equivocado

El cierre de circuito se registra como `patrol.manual_edit` con `meta: { closed: true }` ([`syncService.ts:482`](../../../packages/api/src/services/syncService.ts)). Buscar en el audit log quién cerró una patrulla obliga a saber eso. → `patrol.close`.

#### `C-8` · Baja · Warnings de lint tolerados

11 warnings que no bloquean. Seis son auto-corregibles. Una vez en cero, correr Biome con `--error-on-warnings` en CI para que no vuelvan.

#### `C-9` · Baja · `@bal/shared` no es sólo dominio

El paquete se describe como «Dominio puro», pero exporta `paleta.ts`, `tema.ts`, `despliegue.ts`, `tokens.css` e imágenes (`assets/*.webp`, `.png`). Son de presentación y de despliegue. Moverlos a `@bal/ui` deja a `shared` con lo que el nombre promete y le saca imágenes a un paquete que también consume el backend.

### 3.5 Buenas prácticas y arquitectura

#### `B-1` · Media · La regla 3 tiene una excepción, y la capa de servicios se saltea

- [`publico.ts:59`](../../../packages/api/src/routes/publico.ts): `seasons().find({}).sort(...)` — **consulta a Mongo dentro de una ruta**. `CLAUDE.md` dice «sin excepciones». `seasonRepo.list()` ya existe.
- Varias rutas llaman repositorios directo y arman la respuesta ahí: el ranking público agrupa y ordena en la ruta; en `admin.ts`, temporadas, resultados y detalle del torneo. La convención es `routes → services → repositories`.

**Recomendación:** usar `seasonRepo`; extraer `rankingService` y un servicio de consultas de torneo. Y un chequeo en CI —como `verificar-workspace.mjs`— que falle si algo fuera de `repositories/` y `db/` importa `db/client`.

#### `B-2` · Media · La documentación promete cosas que el código no hace

| Documento | Dice | El código |
|---|---|---|
| `SECURITY.md` §3.3 | Login: 10/15 min por IP y 5 por patrulla | 10/15 min para **todo** `/api/auth/*` (`S-2`) |
| `SECURITY.md` §3.3 | Sync: 300/min **por sesión** | 300/min **por IP** |
| `SECURITY.md` §3.3 | `/api/admin/*`: 60/min por sesión | Sin rate limit |
| `TECHNICAL.md` §5 | Compresión Brotli/gzip | No existe (`P-3`) |
| `TECHNICAL.md` §5 | LRU de rankings, TTL 60 s | No existe (`P-6`) |
| `TECHNICAL.md` §5 | Code splitting, WAFA y WAFL en chunks separados | Un chunk (`P-5`) |
| `TECHNICAL.md` §5 | `memo` en filas y teclado | No aplicado (`P-7`) |
| `TECHNICAL.md` §5 | `rollup-plugin-visualizer` | No instalado (el chequeo lo hace `presupuesto.mjs`) |
| `TESTING.md` §8 | Umbrales de cobertura que **bloquean** | No se ejecutan (`T-1`) |
| `TESTING.md` §9 | Constructores en `tests/fixtures/` | No existe; hay `tests/helpers.ts` |
| `DESIGN_SYSTEM.md` §9 | Anti-FOUC con hash en la CSP | Bloqueado en producción (`U-1`) |

Para un proyecto que le pide a cada modelo de IA leer los docs **antes** de tocar código, un doc que miente es un bug: el próximo implementa sobre la promesa.

#### `B-3` · Baja · El apagado no espera a los requests en vuelo

[`index.ts:32`](../../../packages/api/src/index.ts): `server.close()` no se espera, y `disconnect()` corta Mongo de inmediato. Un redeploy en medio del torneo aborta las transacciones de sync que estaban corriendo. La idempotencia lo absorbe —el cliente reintenta—, pero el `releaseOp` del `catch` también puede fallar con la conexión cerrada (ver `B-4`). Esperar el `close` con un plazo de gracia antes de desconectar.

#### `B-4` · Baja · La marca de dedup se pone como `applied` antes de aplicar

`claimOp(…, 'applied')` ([`syncService.ts:152`](../../../packages/api/src/services/syncService.ts)) marca la op como aplicada **antes** de la transacción. Si el proceso muere entre la marca y el commit, el reintento recibe `duplicate` y el puntaje se pierde en silencio. El riesgo está documentado en el propio código. Marcar `processing` con timestamp, y reprocesar una op que siga `processing` después de 30 s, lo cierra.

#### `B-5` · Baja · Sin observabilidad para el día del torneo

Logs con `console`, sin formato estructurado, sin `requestId` fuera de los errores, sin nivel. Si el sync anda lento el día del torneo, no hay cómo saber cuántas ops por lote, cuánto tarda cada uno ni cuántas se rechazan. Una línea JSON por lote de sync, con esos tres números, alcanza.

### 3.6 Testing

#### `T-1` · Alta · Los umbrales de cobertura no se aplican

`TESTING.md` §8 los declara bloqueantes. En la práctica:

- El CI corre `pnpm test` → `vitest run`, **sin `--coverage`**.
- Sólo `@bal/shared` tiene `thresholds` configurados, y tampoco corren.
- `@bal/api` y `@bal/app` no tienen ninguno.

| Alcance | Exige | Medido |
|---|---|---|
| `@bal/api` — `services/` | 85% líneas / 80% ramas | 96% / 83% ✅ |
| `@bal/api` — `middleware/auth` | 100% / 100% | 100% / **88%** ❌ |
| `@bal/app` — `offline/` | 90% / 85% | 91% / **76%** ❌ |

**Recomendación:** `thresholds` por glob en cada `vitest.config.ts` y un paso de CI que corra `test:coverage`. Subir primero las ramas de `offline/`, que es donde viven `U-3` y `P-2`.

#### `T-2` · Alta · Los E2E corren sólo en Chromium de escritorio

[`playwright.config.ts:34`](../../../playwright.config.ts) tiene un solo proyecto: `Desktop Chrome`. La app se usa en celulares, y **Safari en iPhone** es justamente donde IndexedDB, el service worker, `storage.persist()` y la política de desalojo de datos se comportan distinto. `FE-21` deja abierta la prueba en dispositivos reales; WebKit en Playwright no la reemplaza, pero encuentra la mayoría de las diferencias antes.

**Recomendación:** proyectos `Pixel 7` y `iPhone 14` para `offline-recarga`, `objetivos-tactiles` y una versión corta del flujo completo.

#### `T-3` · Media · El E2E apaga el rate limit que podría fallar

[`e2e/servidor.ts:38`](../../../e2e/servidor.ts) sube `RATE_LIMIT_LOGIN` a 100 y los de sync y público a 10 000. Es razonable para que el flujo completo corra, pero deja sin probar la configuración real. Un spec con los valores de producción —diez o quince patrullas entrando desde la misma IP— habría encontrado `S-2`.

#### `T-4` · Media · Los hallazgos de este informe no tienen test

Ninguno de `S-1`, `U-1`, `U-2` y `U-3` lo detecta un test hoy. Cada tanda del plan los escribe primero y los ve fallar (regla 10).

#### `T-5` · Media · Los presupuestos de performance no se miden

`TECHNICAL.md` §5 fija sync p95, rankings p95, «registrar una flecha < 50 ms» y «WAFL en 3G < 2,5 s». Sólo el tamaño de bundle se verifica. Un benchmark de sync contra Mongo con latencia inyectada habría mostrado `P-1`; Lighthouse CI sobre la landing cubre LCP.

#### `T-6` · Baja · `--passWithNoTests` en app y landing

Si un cambio de glob deja de encontrar los tests, el paquete da verde con cero tests. Sacar la bandera.

#### `T-7` · Baja · Las mutaciones se prueban a mano

La bitácora registra controles de mutación en casi todas las tareas, hechos a mano. Stryker sobre `@bal/shared` y `syncService`, en un job nocturno, lo vuelve sistemático.

---

## 4. Lo que está bien y no hay que tocar

Para que ninguna tanda del plan lo «mejore» por accidente:

- **Dominio puro.** `@bal/shared` no tiene I/O ni fuentes de no determinismo, y el cliente y el servidor usan la misma `validateTargetScore`.
- **El servidor es la autoridad**: valida tokens contra la modalidad **del blanco**, leída de la base; nunca lee un total del request.
- **Sync idempotente con resultado por op** y una transacción por op: una op mala no arrastra al lote.
- **Outbox que nunca descarta por 401**, aísla la op culpable de un 4xx reenviando de a una, y explica al líder *por qué* no cierra.
- **Credenciales**: argon2id con parámetros OWASP, hash de referencia contra enumeración por tiempo, PIN de 6 dígitos con RNG criptográfico, cifrado AES-256-GCM en reposo, sesiones con el token hasheado y TTL en la base.
- **Validación**: Zod `.strict()` en toda entrada, `toObjectId` que responde 404 y no 400, escape de regex en la búsqueda.
- **CSP sin `unsafe-inline` en scripts**, HSTS en producción, `frame-ancestors 'none'`.
- **PWA con `prompt`** y aviso de versión conectado.
- **CI**: imagen construida y verificada como no root, presupuesto de bundle con chequeo de `.css`, `pnpm audit` bloqueante.
- **Documentación y bitácora** excepcionales: cada decisión tiene su porqué.

---

## 5. Decisiones a confirmar antes de implementar

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿El servidor rechaza un `score` sobre un arquero **ya firmado**, o lo acepta y exige volver a firmar? (`S-1`) | **Rechazar.** Es lo que ya hace la UI. *Corrección: no existe hoy un camino para corregir un firmado (`unlockSignature` solo cubre a quien no firmó); si se necesita, es una función nueva, no algo que ya esté* |
| 2 | ¿Qué ve quien se registra con un DNI que ya está en el padrón? (`S-6`) | El mismo mensaje que un alta nueva; el admin ve el duplicado en la cola |
| 3 | ¿Carga de datos en WAFA con un hook propio o con react-query? (`C-2`) | **Hook propio**, extendiendo `useRecurso`: WAFA es chica, y suma cero bytes al bundle |
| 4 | ¿Wake Lock en la página de blanco? (`U-7`) | **Sí, sólo en `TargetPage`** y probado en un celular real antes de fijarlo |
