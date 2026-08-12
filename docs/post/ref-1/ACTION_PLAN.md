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

### `[ ] REF-1` · Los tres bugs · **P0**

Lo que impide correr un torneo. Va solo y primero.

**Archivos:** `api/src/services/syncService.ts`, `api/src/repositories/{tournamentRepo,scoreRepo}.ts`, `app/src/wafl/CircuitPage.tsx`, `app/src/wafa/patrullas.ts`

- Pasar la `session` a las dos lecturas del avance; agregar el parámetro en las dos funciones de repositorio
- Guard de `total > 0` en `CircuitPage`, y reproducir por qué `participants` llega vacío
- `unidadesDe` deja de recortar: el exceso **se muestra y bloquea el guardado**, no se descarta

**DoD:** el avance muestra 8 de 8 al completar el octavo blanco · un blanco sin cargar no figura completo · mover un 5º arquero lo deja visible y bloquea Guardar.
**Tests:** integración que carga el último blanco dentro de una transacción y verifica `targetsCompleted` (hoy falla) · componente con `participants: []` · `unidadesDe` con 5 miembros.
**Mutaciones:** quitar la `session` · quitar el guard · volver a recortar en 4.

### `[ ] REF-2` · Dominio: «mejor de 2» y pagos · **P0** · **TDD**

Toca `@bal/shared` y el modelo de datos. Antes que cualquier interfaz que los consuma.

**Archivos:** `shared/src/league.ts`, `shared/src/schemas.ts`, `api/src/db/types.ts`, `api/src/services/publishService.ts`, `api/src/routes/admin.ts`

- `bestNormalizedPct` pasa a **promedio de los dos mejores porcentajes**. Reemplaza el modo `score`
- `standings`: el campo cambia de significado. Recalcular al publicar y cubrir los ya publicados con `db:reconcile`
- `TournamentDoc.payment: { required: boolean; amount: number }`
- `ParticipantDoc.paid: boolean`
- Schemas Zod, endpoint para marcar pagos, recaudación derivada

**Referencia:** [`DOMAIN_WA.md`](../../DOMAIN_WA.md) §9 · [`SECURITY.md`](../../SECURITY.md) §2 — **el monto lo valida el servidor, nunca se acepta del cliente**.
**DoD:** con dos torneos al 80 % y 90 %, el ranking muestra 85 % · con uno solo el arquero sigue sin clasificar · la recaudación coincide con pagos × monto.
**Actualizar:** `DOMAIN_WA.md` §9, `TECHNICAL.md` §2 y §3.

### `[ ] REF-3` · Reglas y flujo de patrullas · **P0**

**Archivos:** `shared/src/patrolling.ts`, `app/src/wafa/patrullas.ts`, `app/src/wafa/pages/Patrols.tsx`

- Nueva restricción: **como mucho una patrulla de 2**. Si quedan dos, se juntan. Con TDD, en `buildPatrols` y `validatePatrols`
- Todas las patrullas arrancan en un **blanco distinto**
- El guardado exige 2–4 en todas; el editor permite pasarse **transitoriamente**
- **No se puede imprimir** hasta guardar
- El aviso de guardado va **al final, arriba de los botones**
- Botón de volver al inicio después de guardar

**DoD:** un torneo que generaría dos patrullas de 2 genera una de 4 · el validador nombra qué patrulla está mal y por qué · imprimir está deshabilitado con cambios sin guardar.

### `[ ] REF-4` · Transversal de interfaz · **P1**

Lo que atraviesa las tres apps. **Antes** que el trabajo por pantalla, para no repetirlo.

**Archivos:** `shared/src/fechas.ts` (nuevo), `shared/assets/` (nuevo), `app/src/components/ui.tsx`, `landing/src/components/ui.tsx`

- **Conmutador de tema** en el header de las tres apps. La base ya existe: el script anti-FOUC de `index.html` lee `localStorage['bal_tema']` — falta el control que lo escribe
- **Formateo de fechas** en `@bal/shared` con `Intl.DateTimeFormat` y `es-AR`. **Hoy no hay formateo en ningún lado**: las fechas se muestran crudas
- Pasada de **iconografía y emojis**, respetando [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) §10: el color y el ícono **nunca** son el único portador de información
- **Logos**: SVG de la Liga y PNG del CBA, en `@bal/shared` para que las dos apps los usen

**DoD:** el tema se conmuta y persiste, sin parpadeo al recargar · ninguna fecha cruda en pantalla · todo ícono lleva texto o `aria-label`.

### `[ ] REF-5` · WAFA · **P1**

**Archivos:** `app/src/wafa/pages/{Archers,Seasons,TournamentCreate,Home,Tournament}.tsx`

- **Arqueros**: filtro por categoría, categoría resaltada, botones a iconos, cantidad de torneos por arquero
- **Temporadas**: editar y archivar. El modelo ya tiene `status: 'activa' | 'cerrada'`; faltan ruta y UI
- **Crear torneo**: paso «Datos» con checkbox de pago y monto formateado; paso «Participantes» con «agregar todos»
- **Home**: tarjeta de torneo en tres renglones — nombre · fecha · blancos, arqueros y patrullas
- **Detalle**: botón «Arqueros» con el listado y los pagos, recaudación, y editar/eliminar mientras esté `sin_iniciar`

### `[ ] REF-6` · WAFL · **P1**

**La app crítica.** Cada cambio se prueba con el E2E offline andando.

**Archivos:** `app/src/wafl/{LoginPage,TargetPage,ScoreKeypad,SignaturePad,ResultsPage,WaflApp}.tsx`, `api/src/routes/publico.ts`

- **Botonera de patrullas**: al elegir torneo aparecen los botones de cada patrulla y sólo se tipea el PIN. Necesita un endpoint público que liste los `username` del torneo
- **Puntajes editables** hasta que el arquero firme
- **Teclado**: botones al máximo espacio, menos padding, orden izquierda→derecha y arriba→abajo en las cuatro modalidades. Los **56px del §5 son piso, no techo**
- **Pad de firma** a pantalla completa
- «Cerrar circuito» → **«Finalizar torneo»**
- La pantalla de circuito cerrado lleva a la landing

**DoD:** el líder entra sin tipear el usuario · corrige un puntaje mal cargado antes de firmar · el E2E offline sigue verde.

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
