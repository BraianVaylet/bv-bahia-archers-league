# Offline y sincronización — WAFL

El documento más importante del proyecto. Si algo de acá se implementa mal, la app falla exactamente el día que tiene que funcionar.

---

## 1. El principio

> **La red nunca está en el camino crítico de anotar un puntaje.**

No "la red es opcional". No "hay un modo offline". La red **no participa** de la operación de anotar. El líder toca un token, se escribe en el dispositivo, la pantalla se actualiza. Que eso llegue al servidor es un problema aparte, que se resuelve cuando se puede, sin que nadie lo esté esperando.

De este principio se derivan tres reglas de implementación que no se negocian:

| Regla | Consecuencia |
|---|---|
| **IndexedDB es la fuente de verdad del cliente** | La UI de scoring lee de IndexedDB, nunca de una respuesta HTTP. |
| **No existe un "modo offline"** | No hay ramas `if (online)` en la UI. Hay un solo modo, que resulta funcionar sin red. |
| **Toda escritura genera una op en el outbox** | Nunca se llama a `fetch` directamente desde un handler de la UI. |

---

## 2. Arquitectura del cliente

```
   ┌─────────────────────────────────────────────────────────────┐
   │                       UI (React)                            │
   │   lee ────────────────────────┐          escribe ──────┐    │
   └───────────────────────────────┼────────────────────────┼────┘
                                   ▼                        ▼
                    ┌──────────────────────┐   ┌────────────────────┐
                    │     IndexedDB        │◀──│   writeScore()     │
                    │  (fuente de verdad)  │   │   writeSignature() │
                    │                      │   │   requestClose()   │
                    │  · bundle            │   └─────────┬──────────┘
                    │  · scores            │             │
                    │  · signatures        │             ▼
                    │  · outbox            │◀───── encola op
                    │  · meta              │
                    └──────────┬───────────┘
                               │  lee ops pendientes
                               ▼
                    ┌──────────────────────┐
                    │     syncWorker       │  ← online · focus · intervalo · Background Sync
                    │  batch → POST /sync  │
                    └──────────┬───────────┘
                               │
                               ▼        (si hay red)
                    ┌──────────────────────┐
                    │  POST /api/wafl/sync │
                    └──────────────────────┘
```

---

## 3. Esquema de IndexedDB

Base `bal-wafl`, versión 1. Wrapper: `idb`.

```ts
interface WaflDB extends DBSchema {
  // Snapshot descargado al entrar. Se reemplaza entero al reconciliar.
  bundle: {
    key: 'current';
    value: {
      tournament: TournamentBundle;      // incluye targets ordenados desde el de inicio
      patrol: PatrolBundle;
      participants: ParticipantBundle[];
      fetchedAt: number;
      clockSkewMs: number;               // serverTime - Date.now() al descargar
    };
  };

  // Un registro por (participantId, targetIndex). Clave compuesta.
  scores: {
    key: [string, number];
    value: {
      participantId: string;
      targetIndex: number;
      arrows: string[];
      total: number;                     // calculado localmente con @bal/shared, para mostrar
      innerCount: number; xCount: number; tenCount: number; mCount: number;
      clientUpdatedAt: number;           // epoch ms, ya corregido por clockSkew
      syncState: 'pending' | 'synced' | 'conflict';
    };
    indexes: { 'by-target': number; 'by-sync': string };
  };

  signatures: {
    key: string;                         // participantId
    value: { participantId: string; pngDataUrl: string;
             clientUpdatedAt: number; syncState: 'pending' | 'synced' };
  };

  // Cola FIFO. Sobrevive a recargas, cierres y actualizaciones del service worker.
  outbox: {
    key: string;                         // opId (uuid v7 — ordenable por tiempo)
    value: {
      opId: string;
      type: 'score' | 'signature' | 'close';
      payload: unknown;
      clientUpdatedAt: number;
      attempts: number;
      lastAttemptAt: number | null;
      lastError: string | null;
      createdAt: number;
    };
    indexes: { 'by-created': number };
  };

  meta: {
    key: string;
    value: unknown;                      // lastSyncAt, sessionInfo, appVersion, clockSkewMs
  };
}
```

**Notas de implementación:**
- `opId` es **uuid v7**: ordenable por tiempo de creación, así el outbox se drena en el orden en que ocurrieron las cosas.
- `scores` guarda `total` calculado localmente **solo para mostrar**. El valor autoritativo lo devuelve el servidor y se sobreescribe al sincronizar. Como ambos usan la misma función de `@bal/shared`, coinciden siempre; si alguna vez difieren, gana el servidor y se registra.
- La base **nunca se borra** al actualizar el service worker.

---

## 4. Corrección de reloj

El `clientUpdatedAt` es el criterio de last-write-wins. Si el reloj del celu está desfasado, un cambio viejo puede pisar uno nuevo.

Mitigación:

```ts
// al descargar el bundle
clockSkewMs = new Date(response.serverTime).getTime() - Date.now();

// al encolar cualquier op
clientUpdatedAt = Date.now() + clockSkewMs;
```

Se recalcula en cada sincronización exitosa (el servidor devuelve `serverTime` siempre). No resuelve un reloj que se mueve durante el torneo, pero elimina el caso común: un dispositivo con la fecha mal configurada de entrada.

---

## 5. Ciclo de vida

### 5.1 Entrada (requiere conexión — la única vez)

```
1. POST /api/auth/patrol/login  →  cookie de sesión de patrulla
2. GET  /api/wafl/bundle        →  torneo, blancos ordenados, patrulla, participantes,
                                    scores ya existentes, firmas, serverTime
3. Escribir todo en IndexedDB; calcular clockSkewMs
4. Marcar meta.bootstrappedAt
```

A partir de acá, **cero red requerida** para completar el recorrido.

Si el bundle ya existe en IndexedDB y corresponde al mismo torneo y patrulla, se puede entrar sin conexión reusando el bundle local. Se avisa que se está trabajando con datos de tal fecha.

### 5.2 Anotar un puntaje

```ts
async function writeScore(participantId, targetIndex, arrows) {
  const target = getTargetFromBundle(targetIndex);
  const result = validateTargetScore(target.modality, target.arrows, arrows);  // @bal/shared
  if (!result.ok) return result;                     // se rechaza en el cliente, ni se encola

  const clientUpdatedAt = Date.now() + clockSkewMs;

  await db.transaction(['scores', 'outbox'], 'readwrite', async (tx) => {
    await tx.scores.put({ participantId, targetIndex, arrows, ...result.value,
                          clientUpdatedAt, syncState: 'pending' });
    await tx.outbox.put({ opId: uuidv7(), type: 'score',
                          payload: { participantId, targetIndex, arrows },
                          clientUpdatedAt, attempts: 0, createdAt: Date.now() });
  });

  syncWorker.nudge();          // intenta sincronizar ya, sin bloquear
}
```

La transacción de IndexedDB garantiza que **nunca** queda un puntaje guardado sin su op encolada, ni al revés.

`syncWorker.nudge()` **no se espera con `await`**. La función retorna apenas la transacción local commitea.

### 5.3 Vaciar el outbox

Se dispara ante:
- Evento `online` del navegador.
- La app vuelve a foco (`visibilitychange`).
- Intervalo de 30 s mientras hay ops pendientes.
- `nudge()` explícito tras cada escritura.
- **Background Sync API** (`sync` tag `wafl-outbox`) donde esté disponible: permite que el navegador sincronice incluso con la app cerrada.

```
1. Leer hasta 50 ops del outbox, ordenadas por opId (uuid v7 → orden temporal)
2. POST /api/wafl/sync { ops }
3. Por cada resultado:
     applied    → scores.syncState = 'synced'; escribir totales del servidor; borrar la op
     duplicate  → borrar la op (ya estaba aplicada)
     superseded → borrar la op; refrescar desde el servidor; syncState = 'synced'
     rejected   → NO borrar; marcar syncState = 'conflict'; mostrar el error al usuario
4. Actualizar clockSkewMs con el serverTime de la respuesta
5. Si quedan ops, repetir
```

### 5.4 Reintentos

Backoff exponencial con jitter: `min(2^attempts × 1000ms, 60s) × (0.5 + random × 0.5)`.

- **Errores de red** (`TypeError: Failed to fetch`, timeout): se reintenta indefinidamente. Es el caso normal en el monte.
- **5xx**: se reintenta con backoff.
- **401 / 403**: se detiene la sincronización y se pide reingresar. Las ops **se conservan** y se envían tras reautenticar. Nunca se descarta trabajo por un problema de sesión.
- **408 / 429**: transitorios por definición, se reintentan.
- **400 / 409** (op inválida): no se reintenta. Se marca `conflict` y se muestra al usuario qué pasó y con qué arquero y blanco.

**El 400 llega a nivel de lote, no de op.** La validación de Zod corre sobre el array entero, así que una sola op mala hace fallar el `POST` completo y arrastra a las buenas. Cuando el lote se rechaza con un código que no se reintenta, se **reenvía op por op** para aislar la culpable: el puntaje de un arquero no puede quedar rehén de la firma rota de otro.

La op culpable sale del outbox —si se quedara, taparía todo lo demás y el circuito no se podría cerrar nunca— pero **el dato no se pierde**: el puntaje o la firma quedan en IndexedDB marcados `conflict`, con el motivo a la vista.

> Esta regla estaba escrita desde `FE-2` y **el código no la cumplía**: el `catch` del vaciado trataba cualquier rechazo como error de red. Se detectó con la app en la mano, con cuatro firmas a 38 intentos. Ver `BITACORA.md`, entrada del 2026-08-13.

### 5.5 Cerrar el circuito

`close` es una op más del outbox, pero con dos particularidades:

1. **Solo se encola si el outbox está vacío de ops anteriores.** Si hay puntajes pendientes, la UI muestra "Sincronizando N cambios…" y encola el cierre recién cuando termina. Cerrar sin haber enviado los puntajes dejaría al servidor rechazando por datos incompletos.
2. **Requiere conexión.** Es la segunda y última vez que la app necesita red. Si no hay señal, se avisa: "Buscá señal para cerrar el circuito. Tus puntajes ya están guardados."

El servidor valida server-side que estén todos los puntajes y todas las firmas. El cliente puede pedir el cierre cuando quiera; el servidor decide.

---

## 6. Contrato de `POST /api/wafl/sync`

### Request

```jsonc
{
  "ops": [
    { "opId": "0192f3a1-8c4e-7000-9abc-...", "type": "score",
      "clientUpdatedAt": "2026-08-10T14:22:31.004Z",
      "participantId": "66b1...", "targetIndex": 7, "arrows": ["6","5","M"] },

    { "opId": "0192f3a2-...", "type": "signature",
      "clientUpdatedAt": "2026-08-10T16:10:02.500Z",
      "participantId": "66b1...", "pngDataUrl": "data:image/png;base64,..." },

    { "opId": "0192f3a3-...", "type": "close",
      "clientUpdatedAt": "2026-08-10T16:12:00.000Z" }
  ]
}
```

Máximo **200 ops** por batch, **1 MB** de body. El cliente parte en batches de 50.

### Procesamiento server-side, por op

```
1. DEDUP        insert en syncOps con _id = opId.
                E11000  →  status 'duplicate', se saltea. (Sin findOne previo.)

2. AUTORIZAR    ¿participantId pertenece a la patrulla de ESTA sesión?
                No  →  'rejected' con FORBIDDEN. Se registra en auditLog.
                Esto es lo que impide que la patrulla 3 escriba puntajes de la 5.

3. VALIDAR      modalidad = tournament.targets[targetIndex].modality
                validateTargetScore(modalidad, flechasDelBlanco, arrows)   ← @bal/shared
                Falla  →  'rejected' con el error tipado.

4. LWW          existing = scores.findOne({ participantId, targetIndex })
                if (existing && existing.clientUpdatedAt >= op.clientUpdatedAt)
                     →  'superseded'  (se descarta la op, se devuelve el valor vigente)
                Desempate si son iguales: gana el opId mayor (determinista).

5. APLICAR      withTransaction:
                  upsert scores  (con los totales RECALCULADOS por el servidor)
                  delta a los rollups de participants
                  recalcular normalizedPct
                  actualizar patrol.targetsCompleted
                  marcar syncOps.result

6. RESPONDER    { opId, status, score: { total, innerCount, xCount, tenCount, mCount } }
```

**El servidor nunca acepta `total` del cliente.** Ni siquiera lo lee. Lo deriva de los tokens.

### Response

```jsonc
{
  "results": [
    { "opId": "0192f3a1-...", "status": "applied",
      "score": { "total": 11, "innerCount": 0, "xCount": 0, "tenCount": 0, "mCount": 1 } },
    { "opId": "0192f3a2-...", "status": "duplicate" },
    { "opId": "0192f3a3-...", "status": "rejected",
      "error": { "code": "SIGNATURES_MISSING", "message": "Faltan 2 firmas" } }
  ],
  "patrol": { "status": "en_curso", "targetsCompleted": 8 },
  "serverTime": "2026-08-10T16:12:03.900Z"
}
```

El batch **nunca falla entero por una op mala**: siempre responde 200 con el resultado individual de cada una. Un `close` rechazado no debe hacer que se pierdan 40 puntajes válidos del mismo batch.

---

## 7. Conflictos

Una patrulla tiene **un solo escritor**: el líder. El único conflicto real posible es el mismo líder usando dos dispositivos (se le muere el celu y sigue en otro).

**Resolución: last-write-wins sobre `clientUpdatedAt`**, con desempate por `opId` mayor.

Es correcto para este dominio: si el mismo líder cargó el blanco 7 en dos dispositivos, el valor que quiere es el que cargó después. Un CRDT resolvería lo mismo con órdenes de magnitud más de complejidad.

Cada vez que una op es `superseded`, se registra en `auditLog` con `action: 'sync.conflict'`. Si aparecen conflictos con frecuencia, es señal de un problema operativo (dos personas anotando en paralelo) que hay que resolver hablando, no con código.

### Reconciliar tras cambiar de dispositivo

```
GET /api/wafl/state
  → devuelve el estado server-side completo de la patrulla

Cliente:
  1. Mergea contra IndexedDB por clientUpdatedAt (gana el más nuevo)
  2. Conserva las ops del outbox que aún no se enviaron
  3. Reconstruye la vista
```

---

## 8. Service worker

```ts
VitePWA({
  registerType: 'prompt',              // NUNCA autoUpdate
  scope: '/app/',
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,woff2}'],
    navigateFallback: '/app/index.html',
    runtimeCaching: [{
      urlPattern: /^\/api\/(?!wafl\/sync)/,
      handler: 'NetworkFirst',
      options: { networkTimeoutSeconds: 3, cacheName: 'api-cache' },
    }],
  },
})
```

Reglas:

| Regla | Motivo |
|---|---|
| `registerType: 'prompt'`, nunca `autoUpdate` | `autoUpdate` recarga la app sola. A mitad de recorrido es inaceptable. |
| `POST /api/wafl/sync` **excluido** del runtime caching | Cachear una escritura no tiene sentido y podría enmascarar fallos. |
| Actualizar el SW **no toca IndexedDB** | Los datos pendientes sobreviven a cualquier actualización. |
| Si hay ops pendientes, el aviso de actualización lo advierte | "Tenés 12 cambios sin sincronizar. Se conservan al actualizar." Se informa, no se bloquea. |
| La versión de la app se muestra en la UI | Diagnosticar en el campo sin acceso a devtools. |

### Aviso de instalación

Se captura `beforeinstallprompt` y se ofrece instalar al primer ingreso a WAFA o WAFL. En iOS, donde ese evento no existe, se muestran las instrucciones de "Compartir → Agregar a inicio".

---

## 9. Indicador de estado

Siempre visible en el encabezado de WAFL. Es lo que le da confianza al líder para seguir usando la app sin señal.

| Estado | Condición | Aspecto |
|---|---|---|
| `Sincronizado` | Outbox vacío y hubo conexión reciente | Verde, discreto |
| `N pendientes` | Outbox con ops, hay conexión | Ámbar, con contador |
| `Sin conexión · N pendientes` | `navigator.onLine === false` | Gris, con contador |
| `Error de sincronización` | Ops en estado `conflict` | Rojo, con detalle al tocar |

Al tocarlo se abre un panel con: última sincronización exitosa, cantidad de ops pendientes, errores si los hay, y un botón **Sincronizar ahora**.

**Nunca se muestra un spinner bloqueante mientras se sincroniza.** La sincronización es de fondo, por definición.

---

## 10. Matriz de escenarios de falla

| # | Escenario | Comportamiento esperado |
|---|---|---|
| 1 | Sin señal todo el recorrido | Se cargan los 14 blancos. Todo en IndexedDB, todo en el outbox. Al volver la señal, sincroniza solo. |
| 2 | Señal intermitente | El outbox se drena de a ratos. El indicador muestra el avance. Sin intervención del usuario. |
| 3 | Se cierra el navegador a mitad | Al reabrir, IndexedDB tiene todo. El outbox retoma donde iba. |
| 4 | Se apaga el celu por batería | Igual que 3. IndexedDB persiste en disco. |
| 5 | Se recarga la página | Igual que 3. |
| 6 | Sesión vencida durante el torneo | La sincronización se detiene, se pide reingresar. **Las ops se conservan** y se envían tras autenticar. |
| 7 | Líder cambia de dispositivo | Entra con la misma credencial, descarga el bundle, mergea por `clientUpdatedAt`. Se pierde solo lo que nunca se sincronizó del celu muerto. |
| 8 | Dos dispositivos en paralelo | LWW por blanco y arquero. Conflictos registrados en el audit log. |
| 9 | El mismo batch se envía dos veces | Deduplicado por `opId`. `status: 'duplicate'`. Cero duplicados en base. |
| 10 | El servidor está caído | Reintentos con backoff, indefinidamente. La app sigue plenamente usable. |
| 11 | Se llena el almacenamiento del dispositivo | Se detecta con `navigator.storage.estimate()`. Aviso al usuario. Se solicita `persist()` al entrar para evitar el desalojo. |
| 12 | Token de flecha inválido | Rechazado **en el cliente** antes de encolar. No llega al outbox. |
| 13 | El admin cambia el torneo mientras se anota | Solo puede editar blancos sin puntajes. Si un blanco cambió, la sincronización devuelve `rejected` con explicación y el bundle se refresca. |
| 14 | El reloj del celu está mal | Corregido con `clockSkewMs` al descargar el bundle y en cada sincronización exitosa. |
| 15 | Se cierra el circuito con ops pendientes | La UI lo impide: primero sincroniza, después encola el `close`. |
| 16 | Se actualiza la PWA con ops pendientes | El SW se actualiza, IndexedDB intacta, el outbox sigue drenando. El aviso lo advierte. |
| 17 | El líder olvida el PIN | El admin lo regenera desde WAFA. Las sesiones de esa patrulla se invalidan; el líder reingresa con el nuevo. Los datos locales se conservan. |

Los escenarios **1, 3, 6, 9, 12 y 15** son de cobertura obligatoria en la suite de tests. Ver [`TESTING.md`](TESTING.md).

---

## 11. Persistencia del almacenamiento

Al entrar a WAFL:

```ts
if (navigator.storage?.persist) {
  const persisted = await navigator.storage.persisted();
  if (!persisted) await navigator.storage.persist();
}
```

Sin esto, el navegador puede desalojar IndexedDB bajo presión de almacenamiento. Con `persist()` concedido, los datos solo se borran si el usuario lo hace explícitamente.

Si `persist()` es denegado, se muestra un aviso recomendando instalar la app (una PWA instalada suele obtener el permiso automáticamente).

---

## 12. Qué NO hacer

Antipatrones que rompen el principio de §1. Si aparece alguno en una revisión, se rechaza:

| Antipatrón | Por qué rompe todo |
|---|---|
| `await fetch(...)` en un handler de la UI de scoring | Pone la red en el camino crítico. Es exactamente el bug que este documento existe para prevenir. |
| Un spinner mientras se guarda un puntaje | Implica que el guardado espera algo. No espera nada. |
| `if (navigator.onLine)` en un componente | La UI no debe saber si hay red. Solo el `syncWorker` lo sabe. |
| Descartar ops del outbox ante un 401 | Se pierde trabajo del usuario por un problema de sesión. Jamás. |
| Borrar IndexedDB al actualizar el service worker | Se pierde el recorrido completo de la patrulla. |
| Confiar en el `total` que manda el cliente | Falsear puntajes se vuelve trivial. Ver [`SECURITY.md`](SECURITY.md). |
| `registerType: 'autoUpdate'` | Recarga la app a mitad de torneo. |
| Encolar el `close` con ops pendientes | El servidor rechaza por datos incompletos y confunde al usuario. |
