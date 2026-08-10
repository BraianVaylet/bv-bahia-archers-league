# Estrategia de testing — BV Bahía Archers League

TDD estricto en el dominio. Este documento define **qué se testea, con qué, y qué casos son obligatorios**. Un caso listado acá que no exista en la suite es un bug de proceso.

---

## 1. TDD — el ciclo

Para toda tarea de `@bal/shared` y todo servicio crítico del backend, **el test se escribe primero**:

```
1. ROJO     Escribir el test. Correrlo. Debe fallar por la razón correcta
            (la función no existe, o devuelve otra cosa) — no por un typo.
2. VERDE    Escribir el mínimo código que lo hace pasar.
3. REFACTOR Limpiar con la red de seguridad puesta.
```

Usar la skill **`tdd`** al arrancar cada una de esas tareas.

**Un test que nunca se vio fallar no prueba nada.** Si se escribe el código primero y el test pasa a la primera, hay que romper el código a propósito y confirmar que el test lo detecta.

---

## 2. La pirámide

```
              ╱╲          E2E — Playwright
             ╱  ╲         1 flujo completo, CON TRAMO OFFLINE
            ╱────╲
           ╱      ╲       Integración — Vitest + mongodb-memory-server
          ╱        ╲      API real contra Mongo real (replica set)
         ╱──────────╲
        ╱            ╲    Componentes — Vitest + RTL + fake-indexeddb
       ╱              ╲   Scoring, firma, cola offline
      ╱────────────────╲
     ╱                  ╲ Unitarios — Vitest
    ╱                    ╲@bal/shared: puro, rápido, exhaustivo
   ╱──────────────────────╲
```

| Capa | Herramienta | Cobertura objetivo | Velocidad |
|---|---|---|---|
| `@bal/shared` | Vitest | **~100% de ramas** | < 2 s toda la suite |
| `@bal/api` | Vitest + `mongodb-memory-server` (replica set) | Alta en servicios; **100% en autorización** | < 60 s |
| `@bal/app` | Vitest + RTL + `fake-indexeddb` | Alta en flujos críticos | < 30 s |
| E2E | Playwright | 1 flujo completo + escenarios offline | < 3 min |

---

## 3. `@bal/shared` — el dominio

La suite más importante y la más barata de correr. Sin I/O, sin mocks, sin setup.

### 3.1 `scoring.test.ts`

Por cada modalidad (`sala`, `aire_libre`, `campo`, `3d`):

- Valor canónico de cada token del set.
- `X` vale 10 y suma a `xCount` e `innerCount`.
- `X6` vale 6 y suma a `innerCount` (campo).
- `11` vale 11 y suma a `innerCount` (3D).
- `M` vale 0 y suma a `mCount`.
- `maxTargetScore` correcto para la cantidad de flechas default y para las personalizadas.
- Cantidad de flechas incorrecta → `ARROW_COUNT` con `expected` y `got`.
- **Token de otra modalidad → `INVALID_TOKEN`.** Casos obligatorios:
  - `"11"` en `sala` → rechazado
  - `"X"` en `3d` → rechazado
  - `"7"` en `campo` → rechazado (el máximo es 6)
  - `"9"` en `3d` → rechazado (el set es `11 10 8 5 M`)
- `sortArrowsDescending` ordena de mayor a menor y pone el inner primero a igual valor.
- El orden de las flechas de entrada **no altera** el total ni los contadores.

### 3.2 `patrolling.test.ts` — **el más crítico del proyecto**

Los ejemplos del reglamento del club son **normativos** y se testean literalmente.

**Válidos — `validatePatrols` no devuelve violaciones:**

| Caso | Composición |
|---|---|
| Dos pares homogéneos de la misma categoría | `A:[razo, razo]` · `B:[razo, razo]` |
| Dos pares homogéneos de categorías distintas | `A:[razo, razo]` · `B:[escuela, escuela]` |
| Compuesto + escuela | `A:[compuesto, compuesto]` · `B:[escuela, escuela]` |
| Unidad solitaria | `A:[compuesto, compuesto]` · `B:[cazador]` |
| Unidad solitaria de escuela | `A:[compuesto, compuesto]` · `B:[escuela]` |

**Inválidos — devuelve la violación esperada:**

| Caso | Composición | Regla |
|---|---|---|
| Pares mezclados | `A:[razo, tradicional]` · `B:[razo, cazador]` | `H2` |
| Pares mezclados | `A:[longbow, compuesto]` · `B:[razo, compuesto]` | `H2` |
| Patrulla 100% escuela | `A:[escuela, escuela]` · `B:[escuela, escuela]` | `H3` |
| Patrulla 100% escuela, 2 arqueros | `A:[escuela, escuela]` | `H3` |
| Patrulla 100% escuela, 3 arqueros | `A:[escuela, escuela]` · `B:[escuela]` | `H3` |
| Patrulla de 5 | 5 arqueros | `H1` |
| Patrulla de 1 | 1 arquero | `H1` |

**Del algoritmo `buildPatrols`:**

- **Determinismo**: el mismo input, en distinto orden de entrada, produce **exactamente** el mismo resultado. (Test con el array barajado.)
- Todas las patrullas generadas cumplen `H1..H4`.
- La estaca de cada arquero corresponde a su categoría según el `stakeMap`.
- Con 20 arqueros y 14 blancos, los blancos de inicio están repartidos y no se repiten innecesariamente.
- Cuando no alcanzan los seniors para acompañar a los escuela: `requiresManualReview === true`, warning `ESCUELA_SIN_SENIOR`, y **ninguna patrulla queda 100% escuela**.
- Caso extremo: **todos** los participantes son de escuela → no se genera ninguna patrulla válida; se devuelve el warning, no se rompe.
- Caso extremo: 2 participantes → una sola patrulla.
- Caso extremo: número impar en cada categoría → las unidades solitarias se combinan correctamente.
- `S1`: dados 6 razo y 2 compuesto, los razo quedan agrupados, no dispersos.

### 3.3 `ranking.test.ts`

- Orden por puntaje descendente.
- Desempate por inner, luego por cantidad de 10, luego por menos `M`.
- **Empate total → puesto compartido**: dos primeros, el siguiente es 3º (no 2º).
- Ranking por categoría filtra correctamente.
- Categoría con un solo participante → ese participante es 1º.

### 3.4 `league.test.ts`

- Reparto 5-4-3-2-1 por posición; del 6º en adelante, 0.
- **Puesto compartido**: dos primeros reciben 5 cada uno; el siguiente es 3º y recibe 3.
- `normalizedPct = total / maxPossibleScore × 100`, con redondeo consistente.
- El mejor `normalizedPct` de la temporada se conserva; un torneo peor no lo pisa.
- **Mínimo 2 torneos**: con 1 torneo el arquero no figura en el ranking; con 2, sí.
- Desempate de temporada: puntos → más primeros → más segundos → mejor `%`.
- La categoría `escuela` se rankea igual que las demás.

### 3.5 `stats.test.ts`

- Totales de `X`, `10`, `M` por participante y por torneo.
- Promedios por flecha y por blanco.
- Mejor y peor blanco.
- Desglose por modalidad: la suma de las modalidades es igual al total.
- Evolución blanco a blanco con el orden correcto.

---

## 4. `@bal/api` — integración

Contra MongoDB real (`mongodb-memory-server` en **modo replica set**, necesario para probar transacciones). Sin mockear la base: los bugs de esta capa viven en la interacción con Mongo.

### 4.1 Autenticación
- Login de admin correcto → cookie de sesión; en base hay `sha256(token)`, no el token.
- Login con password incorrecto → 401, sin revelar si el usuario existe.
- **Timing**: usuario inexistente tarda lo mismo que uno existente (comparación estadística sobre N intentos).
- 5 intentos fallidos → bloqueo; el 6º devuelve 429 aun con el password correcto.
- `mustChangePassword` bloquea toda otra ruta hasta cambiarlo.
- Login de patrulla con el torneo en `sin_iniciar` → rechazado.
- Login de patrulla con el torneo en `completado` → rechazado.
- Regenerar el PIN invalida las sesiones activas de esa patrulla.
- Logout invalida la sesión en base.

### 4.2 Autorización — **cobertura 100%**
- Sesión de patrulla en `/api/admin/*` → 403.
- Sin sesión en ruta protegida → 401.
- **La patrulla 3 envía una op de un participante de la patrulla 5 → `rejected` con `FORBIDDEN` + entrada en `auditLog`.**
- **Batch mixto** (ops propias + ajenas) → aplica solo las propias, rechaza las ajenas, y el batch responde 200.
- Recurso de otro torneo → 404 (no 403).

### 4.3 CSRF y validación
- Mutación sin `x-csrf-token` → 403.
- Mutación con token incorrecto → 403.
- Payload con propiedad extra → 400 por `.strict()`.
- `{ "username": { "$ne": null } }` → 400, **sin llegar a la base**.
- Clave con `$` o `.` en un objeto anidado → rechazada.
- `ObjectId` malformado → 400, sin excepción del driver.
- Body > 1 MB → 413.

### 4.4 Crear torneo
- Crea torneo + participantes + patrullas + credenciales en **una transacción**.
- `maxPossibleScore` correcto para un recorrido mixto. Caso obligatorio: 6×3D(2) + 6×campo(3) + 1×aire libre(6) + 1×sala(3) = **330**.
- Snapshot: cambiar la categoría del arquero después **no** altera el participante del torneo.
- Estacas asignadas según el `stakeMap`.
- PIN generado de 6 dígitos, hasheado con argon2id y cifrado con AES-GCM; descifrar devuelve el PIN original.
- **Si el armado de patrullas falla, no queda ningún documento huérfano** (rollback verificado).

### 4.5 Sync — el núcleo
- Op válida → `applied`, score persistido, rollups actualizados.
- **El servidor ignora el `total` del cliente**: enviar `total: 999` en el payload y verificar que se guarda el calculado.
- Token inválido para la modalidad del blanco → `rejected` con `INVALID_TOKEN`.
- Cantidad de flechas incorrecta → `ARROW_COUNT`.
- **Idempotencia**: enviar el mismo batch dos veces → la segunda vez todo es `duplicate`, cero duplicados en base.
- **LWW**: op con `clientUpdatedAt` anterior al valor vigente → `superseded`, el valor no cambia.
- **LWW con timestamps iguales** → desempate determinista por `opId` mayor.
- Batch de 200 ops → procesado completo, sin rate limit.
- **Un `close` rechazado en el batch no impide que se apliquen los scores del mismo batch.**
- Rollups: tras N ops, `participants.total` coincide con la suma de `scores`.
- `normalizedPct` recalculado correctamente.

### 4.6 Firmas y cierre
- Firma persistida con `scorecardHash`.
- Modificar un score después de firmar → cerrar devuelve `SIGNATURE_MISMATCH`.
- Cerrar sin todas las firmas → `SIGNATURES_MISSING`.
- Cerrar sin todos los blancos cargados → rechazado.
- Cerrar la última patrulla → el torneo pasa a `completado` automáticamente.
- Desbloqueo de firma por el admin → registra `unlockedBy`, `unlockReason` y `auditLog`.
- Firma que no es un PNG real → rechazada.

### 4.7 Estados y publicación
- Toda transición inválida → `INVALID_STATE_TRANSITION`. Matriz completa de estados origen × destino.
- Editar un blanco con puntajes cargados → `TARGET_LOCKED`.
- Editar un blanco sin puntajes en un torneo `en_proceso` → permitido, `maxPossibleScore` recalculado.
- Publicar → `standings` materializado con los puntos correctos.
- Publicar dos veces → la segunda es idempotente o rechazada; **nunca** duplica puntos.
- **Despublicar revierte exactamente**: `standings` vuelve al estado previo.
- Eliminar un arquero que participó → `ARCHER_IN_USE`.

### 4.8 Público
- Un torneo no publicado **no** expone puntajes.
- El ranking excluye a los arqueros con menos de 2 torneos.
- Headers de caché presentes.

---

## 5. `@bal/app` — componentes

Con `fake-indexeddb` para que IndexedDB funcione en el entorno de test.

### 5.1 `ScoreKeypad`
- Ofrece los tokens de la modalidad del blanco: 3D → `11 10 8 5 M`; sala → `X 10 … 1 M`.
- Al tocar un token, la flecha se agrega y el total se actualiza.
- Las flechas se muestran ordenadas de mayor a menor.
- Se puede corregir una flecha ya cargada.
- No deja cargar más flechas que las del blanco.
- Targets táctiles ≥ 56 px (verificado sobre los estilos computados).

### 5.2 Página de blanco
- Muestra modalidad, flechas, unidades, posiciones y estacas.
- **Continuar** deshabilitado hasta que todos los arqueros tienen puntaje; indica quién falta.
- Cada carga escribe en IndexedDB **y** encola una op, en la misma transacción.

### 5.3 Offline — **cobertura obligatoria**
- Escribir un score con `navigator.onLine === false` → persiste en IndexedDB y encola la op, sin error.
- Recargar el componente → los datos se leen de IndexedDB, idénticos.
- El outbox sobrevive a un remontaje completo.
- Al volver `online`, el `syncWorker` dispara el flush.
- Reintentos con backoff ante error de red.
- **Un 401 no descarta las ops**: quedan en el outbox.
- Token inválido → rechazado en el cliente, **no se encola**.
- **Cerrar el circuito con ops pendientes → bloqueado por la UI.**
- `SyncBadge` refleja cada estado: sincronizado, pendientes, sin conexión, error.

### 5.4 Firma
- El canvas captura el trazo y genera un PNG.
- El botón Finalizar se habilita solo con **todas** las firmas.
- Se puede rehacer una firma antes de cerrar.

### 5.5 WAFA
- Wizard de creación: los defaults de flechas cambian al elegir la modalidad de cada blanco.
- El máximo posible se actualiza en vivo al editar el recorrido.
- El validador de patrullas muestra las violaciones en la edición manual, **sin bloquear el guardado**.

---

## 6. E2E — Playwright

Un flujo completo contra el stack real. **El tramo offline no es opcional.**

```
tests/e2e/flujo-completo.spec.ts

 1. Admin entra con el password inicial → se le obliga a cambiarlo
 2. Crea una temporada
 3. Carga 20 arqueros de distintas categorías (incluyendo escuela)
 4. Crea un torneo de 14 blancos: 1-6 3D(2), 7-12 campo(3), 13 aire libre(6), 14 sala(3)
 5. Verifica que maxPossibleScore = 330
 6. Verifica que ninguna patrulla es 100% escuela
 7. Anota las credenciales de la patrulla 1
 8. Inicia el torneo
 9. En un contexto nuevo, el líder de la patrulla 1 entra con usuario y PIN
10. ▶ context.setOffline(true)
11. Carga los 14 blancos completos de sus arqueros, sin conexión
12. Verifica que el indicador muestra "Sin conexión" con el contador de pendientes
13. Recarga la página estando offline → los datos siguen ahí
14. ▶ context.setOffline(false)
15. Espera a que el indicador muestre "Sincronizado"
16. Verifica en la API que todos los scores llegaron y los totales coinciden
17. Firma cada arquero de la patrulla
18. Cierra el circuito
19. Repite 9-18 para las demás patrullas (versión acelerada)
20. El torneo pasa a "completado" solo
21. El admin verifica los podios y publica
22. En la landing, sin sesión, verifica el ranking y el detalle del torneo
23. Verifica que los puntos de liga se aplicaron correctamente
```

### Escenarios E2E adicionales

| Test | Verifica |
|---|---|
| `offline-recarga.spec.ts` | Cerrar y reabrir el navegador a mitad del recorrido no pierde nada |
| `dos-dispositivos.spec.ts` | LWW entre dos contextos con la misma credencial |
| `sesion-vencida.spec.ts` | Un 401 durante la sincronización conserva el outbox |
| `blanco-bloqueado.spec.ts` | El admin no puede editar un blanco ya tirado |
| `pwa-instalable.spec.ts` | Manifest válido, service worker registrado, `registerType: 'prompt'` |

---

## 7. Cómo correr

```bash
pnpm test
```

```bash
pnpm --filter @bal/shared test
```

```bash
pnpm --filter @bal/api test
```

```bash
pnpm --filter @bal/app test
```

```bash
pnpm test:e2e
```

```bash
pnpm --filter @bal/shared test -- --coverage
```

Modo watch durante el desarrollo: agregar `--watch` a cualquiera de los anteriores.

---

## 8. Umbrales y CI

| Paquete | Líneas | Ramas | Bloquea |
|---|---|---|---|
| `@bal/shared` | 95% | **95%** | Sí |
| `@bal/api` — `services/` | 85% | 80% | Sí |
| `@bal/api` — `middleware/auth` y autorización de sync | **100%** | **100%** | Sí |
| `@bal/app` — `offline/` | 90% | 85% | Sí |
| `@bal/app` — resto | 70% | 60% | No |

CI bloquea el merge ante: lint, typecheck, cualquier test rojo, umbral de cobertura no alcanzado, `pnpm audit` con crítico o alto, o presupuesto de bundle excedido.

---

## 9. Datos de prueba

`packages/api/tests/fixtures/` provee constructores reutilizables:

```ts
buildArcher({ category: 'razo' })
buildTournament({ targets: mixedCircuit(14) })   // 6×3D, 6×campo, 1×aire libre, 1×sala
buildPatrolWithMembers({ categories: ['razo','razo','escuela','escuela'] })
buildScoreOp({ participantId, targetIndex, arrows })
```

**Reglas de los fixtures:**
- Deterministas. Sin `Math.random`, sin `Date.now()` sin congelar.
- Cada test crea su propia base limpia. Sin estado compartido entre tests.
- Los datos representan casos reales de la liga, no valores arbitrarios: eso hace que los tests fallen de formas informativas.

---

## 10. Qué no se testea

Explícito, para que nadie pierda tiempo:

- Getters y setters triviales.
- Que el framework funcione (Hono enruta, React renderiza).
- Que el driver de MongoDB persista.
- Estilos que no afecten la funcionalidad — **excepto** los tamaños de target táctil, que son un requisito funcional.
- Configuración estática sin lógica.
