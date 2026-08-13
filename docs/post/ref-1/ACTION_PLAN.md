# Plan de acción — Primer gran refactor

Implementación de [`refactor.md`](refactor.md). Mismas convenciones que [`docs/ACTION_PLAN.md`](../../ACTION_PLAN.md): tareas autocontenidas, priorizadas, con DoD.

**Convención de IDs:** `REF-N`.
**Prioridad:** `P0` bloqueante → `P1` necesario.
**Estado:** `[ ]` pendiente · `[~]` en curso · `[x]` hecho.

---

## Contexto

El MVP está completo: dominio, backend, WAFA, WAFL, landing, E2E con tramo offline y CI en verde. Al usarlo **por primera vez de punta a punta contra un MongoDB real** aparecieron defectos de comportamiento y una lista de mejoras de producto.

Son ~50 ítems en cuatro áreas. Dos están reportados como bugs; la investigación encontró **un tercero** que nadie había notado y que hace perder datos en pantalla.

El objetivo es dejar el sistema listo para el **primer torneo real**: sin los bugs, con el ranking que la liga realmente usa, con el circuito de pagos, y con una interfaz que se entienda con guantes y al sol.

---

## Hallazgos de la investigación

Tres defectos con causa identificada. Los tres se corrigen en `REF-1`.

### 1. El avance de patrulla cuenta uno de menos

`packages/api/src/services/syncService.ts:306` — `actualizarAvanceDePatrulla` recibe la `session` de la transacción pero **sólo se la pasa a la escritura**:

```ts
const miembros = await tournamentRepo.listParticipantsOfPatrol(patrolId);  // sin session
const puntajes = await scoreRepo.listScoresOfPatrol(patrolId);             // sin session
// ...
await patrolRepo.setTargetsCompleted(patrolId, completos, session);        // con session
```

Las dos lecturas corren **fuera** de la transacción y no ven el puntaje que se acaba de escribir en ella. Por eso el último blanco nunca cuenta: **7 de 8**.

Ninguna de las dos funciones acepta `session` hoy (`tournamentRepo.ts:80`, `scoreRepo.ts:20`).

> Es el error que la cabecera de `tournamentRepo.ts` advierte explícitamente: *«sin pasarla, la escritura queda fuera de la transacción»*. Acá pasó con las lecturas.

### 2. Todos los blancos aparecen completos

`packages/app/src/wafl/CircuitPage.tsx:48`:

```ts
const total = bundle.participants.length;
return delBlanco.length >= total;   // con total === 0 es SIEMPRE verdadero
```

Con `participants` vacío la condición es **vacuamente verdadera** y todos los blancos figuran completos. Es la misma trampa que el `waitFor` de `FE-8`: una condición que se cumple por accidente.

**Hay que reproducirlo primero** para saber por qué llega vacío (bundle viejo en IndexedDB, o el bundle del servidor). El guard va igual: sin arqueros no hay blanco completo.

### 3. El editor de patrullas pierde el quinto arquero

`packages/app/src/wafa/patrullas.ts` — `unidadesDe` corta en cuatro:

```ts
const b = miembros.slice(2, MAX_PATROL_SIZE);   // descarta del 5º en adelante
```

Al mover un arquero a una patrulla que ya tiene 4, **el movimiento ocurre pero el arquero desaparece** de la vista y del cuerpo que se manda al servidor.

No es que la app no deje mover: **mueve y pierde**. La causa real es distinta de la que se supuso al reportarlo.

---

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Logo de la Liga | Se **diseña en SVG inline**, inspirado en el del CBA. El del CBA se usa desde el PNG de `packages/logos/`. Sin pedidos externos: la CSP los prohíbe |
| Ranking | **«Mejor de 2» reemplaza a «por mejor puntaje»**. Quedan dos modos: por puntos y mejor de 2 |
| Pago | **Monto único por torneo**. La recaudación es cantidad de pagos × monto |
| Entrega | **Siete tandas, un PR cada una**, para poder probar en local mientras avanza la siguiente |

---

# Las siete tandas

### `[x] REF-1` · Los tres bugs · **P0**

Lo que impide correr un torneo. Va solo y primero.

**Archivos:** `api/src/services/syncService.ts`, `api/src/repositories/{tournamentRepo,scoreRepo}.ts`, `app/src/wafl/CircuitPage.tsx`, `app/src/wafa/patrullas.ts`

- [x] Pasar la `session` a las dos lecturas del avance; agregar el parámetro en las dos funciones de repositorio
- [x] Guard de `total > 0` en `CircuitPage`, y reproducir por qué `participants` llega vacío
- [x] `unidadesDe` deja de recortar: el exceso **se muestra y bloquea el guardado**, no se descarta

**DoD:** el avance muestra 8 de 8 al completar el octavo blanco · un blanco sin cargar no figura completo · mover un 5º arquero lo deja visible y bloquea Guardar.
**Tests:** integración que carga el último blanco dentro de una transacción y verifica `targetsCompleted` (hoy falla) · componente con `participants: []` · `unidadesDe` con 5 miembros.
**Mutaciones:** quitar la `session` · quitar el guard · volver a recortar en 4.

> **Cerrada el 2026-08-12.** Salieron cinco correcciones, no tres. Las dos extra son la misma causa raíz:
>
> - **Una patrulla vacía cerraba el circuito sin un solo puntaje.** Con cero activos, `esperados` da cero y todas las comprobaciones de `aplicarCierre` pasan por vacuidad.
> - **El E2E pasaba con el bug del avance adentro**: verificaba el `targetsCompleted` del *participante*, nunca el de la *patrulla*. Con el bug reintroducido ahora da `Expected: 14 · Received: 13`.
>
> 745 tests en verde. 8 controles de mutación, murieron 7; el sobreviviente y su razón están en la [bitácora](../../BITACORA.md).

### `[x] REF-2` · Dominio: «mejor de 2» y pagos · **P0** · **TDD**

Toca `@bal/shared` y el modelo de datos. Antes que cualquier interfaz que los consuma.

**Archivos:** `shared/src/league.ts`, `shared/src/schemas.ts`, `api/src/db/types.ts`, `api/src/services/publishService.ts`, `api/src/routes/admin.ts`

- [x] `bestNormalizedPct` pasa a **promedio de los dos mejores porcentajes**. Reemplaza el modo `score`
- [x] `standings`: el campo cambia de significado. Recalcular al publicar y cubrir los ya publicados con `db:reconcile`
- [x] `TournamentDoc.payment: { required: boolean; amount: number }`
- [x] `ParticipantDoc.paid: boolean`
- [x] Schemas Zod, endpoint para marcar pagos, recaudación derivada

**Referencia:** [`DOMAIN_WA.md`](../../DOMAIN_WA.md) §9 · [`SECURITY.md`](../../SECURITY.md) §2 — **el monto lo valida el servidor, nunca se acepta del cliente**.
**DoD:** con dos torneos al 80 % y 90 %, el ranking muestra 85 % · con uno solo el arquero sigue sin clasificar · la recaudación coincide con pagos × monto.
**Actualizar:** `DOMAIN_WA.md` §9, `TECHNICAL.md` §2 y §3.

> **Cerrada el 2026-08-12.** Un desvío deliberado: `bestNormalizedPct` **no** cambió de significado. Se agregó `topTwoPcts` y el promedio se deriva; el mejor resultado suelto se sigue guardando porque es el récord personal que la landing muestra, aunque ya no ordene ningún ranking. Reinterpretar un campo en vez de agregar otro habría dejado un nombre que miente.
>
> Además: **la landing seguía pidiendo `mode=score`**, que la API ahora rechaza con 400. Sus tests pasaban porque mockean el endpoint. Corregida acá, no en `REF-7`: dejarla rota una tanda no era una opción.
>
> Se dio de baja el índice `ix_ranking_puntaje`. Nunca lo usó ninguna consulta —la landing ordena en memoria— y el campo que indexaba ya no ordena nada.

### `[x] REF-3` · Reglas y flujo de patrullas · **P0**

**Archivos:** `shared/src/patrolling.ts`, `app/src/wafa/patrullas.ts`, `app/src/wafa/pages/Patrols.tsx`

- [x] Nueva restricción: **como mucho una patrulla de 2**. Si quedan dos, se juntan. Con TDD, en `buildPatrols` y `validatePatrols`
- [x] Todas las patrullas arrancan en un **blanco distinto**
- [x] El guardado exige 2–4 en todas; el editor permite pasarse **transitoriamente**
- [x] **No se puede imprimir** hasta guardar
- [x] El aviso de guardado va **al final, arriba de los botones**
- [x] Botón de volver al inicio después de guardar

**DoD:** un torneo que generaría dos patrullas de 2 genera una de 4 · el validador nombra qué patrulla está mal y por qué · imprimir está deshabilitado con cambios sin guardar.

> **Cerrada el 2026-08-13.** La regla, tal como estaba escrita, **no siempre se puede cumplir**, y eso salió de medirlo, no de suponerlo.
>
> Una patrulla es a lo sumo dos unidades: `4 = u2+u2` · `3 = u2+u1` · `2 = u2` ó `u1+u1`. Con 1 recurvo y 3 compuestos —4 arqueros en tres unidades— los repartos son **2+2** o **3+1**, y el segundo viola `H1`. No hay fusión posible.
>
> Un barrido sobre 1213 composiciones que producían dos patrullas de 2 encontró **cero** fusionables. Pero el mismo barrido encontró algo mejor: **30 de 960 composiciones daban peor que el óptimo**. `mejorCompañero` elegía por categoría y estaca **ignorando el tamaño**, así que una unidad solitaria con cupo para llevarse un par se lo gastaba en otra solitaria y fabricaba una patrulla de 2. Con 1 recurvo y 5 compuestos salían una de 2 y una de 4 en vez de dos de 3.
>
> Corregido: **0 peores que el óptimo**, y los casos con dos patrullas de 2 bajaron de 1213 a 894. Los 894 restantes son inevitables, y el validador **no avisa sobre ellos**: marcar como violación algo que no se puede arreglar enseña a ignorar los avisos.
>
> El barrido quedó como test permanente. 770 en verde; 6 controles de mutación, murieron 6.

### `[x] REF-4` · Transversal de interfaz · **P1**

Lo que atraviesa las tres apps. **Antes** que el trabajo por pantalla, para no repetirlo.

**Archivos:** `shared/src/fechas.ts` (nuevo), `shared/assets/` (nuevo), `app/src/components/ui.tsx`, `landing/src/components/ui.tsx`

- **Conmutador de tema** en el header de las tres apps. La base ya existe: el script anti-FOUC de `index.html` lee `localStorage['bal_tema']` — falta el control que lo escribe
- **Formateo de fechas** en `@bal/shared` con `Intl.DateTimeFormat` y `es-AR`. **Hoy no hay formateo en ningún lado**: las fechas se muestran crudas
- Pasada de **iconografía y emojis**, respetando [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) §10: el color y el ícono **nunca** son el único portador de información
- **Logos**: SVG de la Liga y PNG del CBA, en `@bal/shared` para que las dos apps los usen

**DoD:** el tema se conmuta y persiste, sin parpadeo al recargar · ninguna fecha cruda en pantalla · todo ícono lleva texto o `aria-label`.

> **Cerrada el 2026-08-13.** Dos hallazgos y una baja.
>
> **El conmutador rompía la pantalla entera** en cualquier entorno sin `matchMedia`. No por falta de guarda: `temaInicial` llamaba a `matchMedia` dentro del `try` **y otra vez en el `catch`**, así que el camino de respaldo repetía la llamada que había fallado y el error salía sin atrapar. Como el conmutador vive en el header, no faltaba un botón: no se veía nada.
>
> **Las fechas se formatean en UTC.** Se guardan como medianoche UTC y Argentina es UTC-3: formatear en la zona del navegador mostraba **el día anterior**. Un torneo del 8 aparecía como 7.
>
> **El PNG del CBA no entró.** Es de 2000×2000 y 183 KB, y no hay herramienta de imágenes en el repo para achicarlo. Meter eso en una PWA que tiene que andar en un celular en el monte no es aceptable. El SVG de la Liga sí, que pesa 1,1 KB.
>
> De paso: los siete headers de WAFA estaban repetidos literalmente. Se extrajo `Encabezado`, que es lo que permitió agregar el conmutador una vez en lugar de siete.
>
> 862 en verde; 7 controles de mutación, murieron 7.

### `[x] REF-5` · WAFA · **P1**

**Archivos:** `app/src/wafa/pages/{Archers,Seasons,TournamentCreate,Home,Tournament,Payments}.tsx`

- [x] **Arqueros**: filtro por categoría, categoría resaltada, cantidad de torneos por arquero
- [x] **Arqueros**: botones a iconos
- [x] **Temporadas**: archivar y reabrir. Ruta nueva `POST /admin/seasons/:id/{archive,restore}`
- [x] **Crear torneo**: paso «Datos» con checkbox de pago y monto formateado
- [x] **Crear torneo**: paso «Participantes» con «agregar todos» y «quitar todos»
- [x] **Home**: tarjeta de torneo en tres renglones
- [x] **Detalle**: pantalla «Arqueros y pagos» con el listado, los pagos y la recaudación
- [x] **Detalle**: editar y eliminar el torneo mientras esté `sin_iniciar`

> **Completa al 2026-08-13**, en dos PRs. El primero llevó cinco de ocho. Lo que entró es lo que **desbloquea backend que ya existía y no se podía alcanzar**: los pagos de `REF-2` no tenían ninguna pantalla, y las temporadas tenían el campo `status` desde `BE-1` sin ruta que lo cambiara.
>
> Los tres restantes —presentación, sin backend esperando— entraron en un PR aparte. El «editar» quedó **inline sobre nombre y fecha**, no como pantalla propia: el recorrido tiene sus reglas —un blanco con puntajes está bloqueado— y se edita desde su pantalla, no de refilón. Borrar pide **dos toques sobre el mismo botón**, sin `confirm()` ni modal.
>
> Un hallazgo del backend: `participatedIds` devolvía un booleano disfrazado de lista. Se reemplazó por `tournamentCounts`, y `participated` pasó a derivarse del conteo — dos fuentes para el mismo hecho son dos que pueden decir cosas distintas.
>
> 891 en verde; 3 controles de mutación, murieron 2. El sobreviviente y su razón están en la [bitácora](../../BITACORA.md).

### `[x] REF-6` · WAFL · **P1**

**La app crítica.** Cada cambio se prueba con el E2E offline andando.

**Archivos:** `app/src/wafl/{LoginPage,TargetPage,ScoreKeypad,SignaturePad,ResultsPage,WaflApp}.tsx`, `api/src/routes/publico.ts`

- **Botonera de patrullas**: al elegir torneo aparecen los botones de cada patrulla y sólo se tipea el PIN. Necesita un endpoint público que liste los `username` del torneo
- **Puntajes editables** hasta que el arquero firme
- **Teclado**: botones al máximo espacio, menos padding, orden izquierda→derecha y arriba→abajo en las cuatro modalidades. Los **56px del §5 son piso, no techo**
- **Pad de firma** a pantalla completa
- «Cerrar circuito» → **«Finalizar torneo»**
- La pantalla de circuito cerrado lleva a la landing

**DoD:** el líder entra sin tipear el usuario · corrige un puntaje mal cargado antes de firmar · el E2E offline sigue verde.

> **Cerrada el 2026-08-13**, con dos huecos de test anotados en el código.
>
> **No hizo falta endpoint nuevo.** El público de torneo ya exponía el número de cada patrulla, y el usuario es `patrulla${number}`: se agregó el campo para que el cliente no repita la regla de nombrado, no porque antes fuera secreto. Hay un test que verifica que el PIN **nunca** salga por ahí.
>
> **Los arcos del teclado se dieron de baja como default.** `FE-6` los dejó como apuesta sin validar; la decisión ahora es el mismo orden de lectura en las cuatro modalidades. Quedan detrás de la prop.
>
> **Se encontró un agujero real:** se podía editar el puntaje de alguien que ya firmó, y el cierre después fallaba con `SIGNATURE_MISMATCH` — un error que sale al final del recorrido, lejos de su causa.
>
> 911 en verde. 3 controles de mutación: **murió 1**. Los dos que sobrevivieron destaparon tests que pasaban por llegar antes que la cola de escrituras; están anotados en el código como pendientes en vez de dejarlos verdes en falso.

### `[ ] REF-7` · Landing · **P1**

**Archivos:** `landing/src/pages/{Home,Tournaments,Ranking}.tsx`

- Presentación con imagen de tiro con arco, título, descripción y accesos a WAFA/WAFL arriba; ranking y torneos abajo
- **Torneos**: estado resaltado, valor de inscripción, por arquero puntaje/X/10/M/%/puntos sumados, patrullas en dos renglones, y **diagrama del recorrido** con cajas y líneas (modalidad y flechas por blanco)
- **Ranking**: podios con color y emoji, y explicación de cuántos puntos da cada puesto

---

## Verificación

Cada tanda, antes de su PR:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

```bash
pnpm test:e2e
```

Y **a mano contra el MongoDB local**, que es donde aparecieron los tres defectos:

```bash
pnpm dev
```

Circuito completo: crear torneo → patrullas → iniciar → WAFL con PIN → **cargar con el wifi cortado** → reconectar → firmar → finalizar → publicar → verlo en la landing sin sesión.

Al terminar cada tanda: marcarla acá y anotar en [`BITACORA.md`](../../BITACORA.md) qué se decidió y por qué.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| «Mejor de 2» cambia standings ya publicados | Recalcular con `db:reconcile`. Hoy no hay datos de producción, así que el costo es bajo — y sube apenas se corra el primer torneo real |
| El logo del CBA es de un club, no del proyecto | Se usa el PNG tal cual, sin reinterpretarlo. El de la Liga es original |
| Tocar el teclado de scoring | Es la pantalla que decide si la app sirve el día del torneo. Los tests de 56px y de doble toque quedan como red; todo cambio se prueba con el E2E |
| La botonera expone los `username` de patrulla | El usuario no es secreto —está en la planilla impresa— y el PIN sigue siendo el único factor. Se revisa en el `/security-review` de esa tanda |
