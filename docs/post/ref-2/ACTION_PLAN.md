# Plan de acción — Segundo gran refactor (`REF2-*`)

Implementación de [`docs/post/ref-2/refactor.md`](refactor.md). Mismas convenciones que [`docs/post/ref-1/ACTION_PLAN.md`](../ref-1/ACTION_PLAN.md).

**Convención de IDs:** `REF2-N` · **Prioridad:** `P0` bloqueante → `P1` necesario · **Estado:** `[ ]` `[~]` `[x]`

---

## Contexto

`ref-1` dejó el sistema **funcionando**: los tres bugs corregidos, «mejor de 2», pagos, patrullas con sus reglas, y las tres apps utilizables de punta a punta. Después, usándolo, salieron tres defectos más de la WAFL (firma pesada, outbox trabado, firma rechazada que figuraba como firmada), ya corregidos.

`ref-2` es distinto: **casi nada de esto es un bug.** Es la pasada de identidad y de flujo que convierte un sistema que anda en uno que se lee de un vistazo, con guantes y al sol. Tres bloques:

- **Identidad visual compartida** — logo, footers, color e ícono por categoría, modalidad y estado. Hoy cada pantalla resuelve esto sola, y no siempre igual.
- **Flujo de WAFA** — editar un torneo sin iniciar de verdad, ordenar dentro de la patrulla, eliminar una patrulla vacía, confirmar antes de arrancar, y poder volver atrás si arrancaste por error.
- **Landing** — explicar el ranking según el modo elegido, y mostrar la evolución del arquero.

El objetivo es llegar al **primer torneo real** con una interfaz que no haya que explicar.

---

## Hallazgos de la investigación

Diez cosas que el brief da por sentadas y no son así. Ninguna invalida un pedido; varias cambian cómo se cumple.

### 1. El repo de reutilización tiene **tres** fuentes de iconografía, no un set

`bv-easy-archery-battle` tiene exactamente:

| Archivo | Qué trae |
|---|---|
| `packages/web/src/components/Logo.tsx` | Diana en tres anillos. Colores **fijos**, hardcodeados |
| `packages/web/src/components/icons/modality.tsx` | 4 íconos de modalidad + `MODALITY_ICONS` |
| `packages/web/src/components/icons/bow.tsx` | 6 íconos de categoría + `BOW_ICONS` |

**No hay íconos de botones ni de otros componentes.** El pedido *«reutilizá también las que se usan en botones»* apunta a un set que no existe: ese repo tampoco tiene uno. Del lado de BAL hoy se usan **glifos de texto** — `↑ ↓ ✕ ⇄ ☀ ☾ 🔒` (`TournamentCreate.tsx:200`, `Patrols.tsx:271`, `Tournament.tsx:418`, `ui.tsx:231`).

**Consecuencia:** los tres archivos se portan; el resto del set **se dibuja**, con el mismo trazo (`viewBox 24`, `currentColor`, `strokeWidth 1.8`) para que se vea de una familia.

### 2. Las categorías no coinciden entre los dos repos

`BOW_ICONS` usa `raso`, `recurvo_olimpico`, `recurvo_tradicional`. BAL usa `razo`, `recurvo`, `tradicional` — y tiene una séptima, **`escuela`, que no tiene ícono allá**. El mapa se reescribe contra `CATEGORY_INFO` (`shared/src/constants.ts:161`) y `escuela` se dibuja.

### 3. El estado del torneo está escrito en tres lugares, con tres textos distintos

| Dónde | «completado» dice |
|---|---|
| `wafa/pages/Tournament.tsx:34` | «Completado, sin publicar» |
| `wafa/pages/Home.tsx:32` | otro texto |
| `landing/pages/Tournaments.tsx:288` | ni figura: sólo `en_proceso` y `publicado` |

Poner un badge de color en cada uno **sin unificar antes** es fabricar una cuarta versión.

### 4. `wallpaper.png` pesa **2,8 MB**

Está commiteado en `packages/shared/assets/`. Entró en el merge de `ref-1`. Tal cual no puede ir a la landing: es 23 veces el presupuesto de JS de esa app.

### 5. El gráfico de evolución necesita datos que el modelo **no guarda**

`StandingDoc` (`api/src/db/types.ts:243`) guarda `topTwoPcts` — los dos mejores— y `bestNormalizedPct`. **No hay serie por torneo.**

Pero `ParticipantDoc` sí tiene `normalizedPct` (`types.ts:185`) y **ya existe el índice `ix_archer`** (`db/indexes.ts:54`). La serie se deriva consultando, sin migración y sin tocar el publicado.

### 6. `UpdateTournamentSchema` no acepta participantes

`shared/src/schemas.ts:176` admite `name`, `date`, `description`, `payment`, `targets`. **No `participants`.** Agregar o quitar arqueros con el torneo `sin_iniciar` es backend nuevo, no una pantalla nueva.

### 7. La máquina de estados no tiene vuelta atrás desde `en_proceso`

`api/src/services/tournamentStateService.ts:19`:

```ts
sin_iniciar: ['en_proceso'],
en_proceso: ['completado'],
```

Volver a `sin_iniciar` es una **transición nueva**, con una guarda propia: sólo si no hay un solo puntaje cargado.

### 8. La recaudación por torneo ya existe; el total no

`paymentService.summary` devuelve `collected` (`paymentService.ts:50`). Lo que falta es **el acumulado de la temporada**.

### 9. `EvolutionChart.tsx` se porta tal cual

SVG puro, sin dependencias, tema-aware y accesible (`role="img"` con `aria-label` que enumera los puntos). Sólo hay que remapear `stroke-primary` → `--nock`.

### 10. El patrón de subir/bajar ya está escrito

`TournamentCreate.tsx:200-218` ya tiene los botones `↑ ↓ ✕` sobre una lista ordenable. Es el mismo gesto que pide el editor de patrullas.

---

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| **Regla 8** | **Se mantiene.** Rojo, azul y amarillo siguen siendo sólo estaca. Categorías y modalidades reciben una paleta que **evita** esos tres tonos. Los estados reusan los tokens que ya existen (`--ok`, `--warn`, `--danger`, `--nock`). Pago usa `--ok`/`--danger`, que ya son verde y rojo pero significan «bien/mal», no estaca. **El color nunca va solo**: ícono y texto lo acompañan siempre (`DESIGN_SYSTEM.md` §10) |
| **UI compartida** | **Paquete `@bal/ui` nuevo.** Logo, Footer, íconos, badges y chips. Se aprovecha para unificar lo que ya está duplicado entre `app` y `landing`: `cn`, `Screen`, `StakeChip`, `BotonTema`, `Encabezado` |
| **Imágenes** | **Script con Playwright**, que ya está en el repo para los E2E. Sin dependencias nuevas, y queda registrado cómo se generó cada asset |
| **Volver a `sin_iniciar`** | **Las patrullas y los PIN se conservan.** Si arrancaste por error, volvés, corregís y arrancás de nuevo: la planilla impresa sigue sirviendo |
| Entrega | **Siete tandas, un PR cada una** |

---

# Las siete tandas

### `[x] REF2-1` · Cimientos: `@bal/ui` y los catálogos · **P0**

Nada visual todavía. Es la base que las seis tandas siguientes consumen, y la que evita escribir tres veces el mismo color.

**Archivos:** `packages/ui/` (nuevo), `shared/src/constants.ts`, `shared/styles/tokens.css`, `app/src/components/ui.tsx`, `landing/src/components/ui.tsx`

- [x] Paquete `@bal/ui`: React, sin I/O, consumido por `app` y `landing`. Build igual que `@bal/shared`
- [x] **Mudar lo duplicado**: `cn`, `StakeChip`, `BotonTema`. Las dos apps re-exportan, así que los veinte sitios de importación no cambiaron
- [~] `Screen` y `Encabezado` **no se mudaron**: ver la nota de cierre
- [x] Portar `MODALITY_ICONS` y remapear `BOW_ICONS` contra `CATEGORY_INFO`; **dibujar `escuela`**
- [x] Dibujar el set de botones que reemplaza a `↑ ↓ ✕ ⇄ ☀ ☾ 🔒 ✎ ↺ 🗄 🗑`, con el mismo trazo
- [x] **Un solo catálogo de etiquetas de estado** en `@bal/shared`, con su token de color. Reemplaza las tres copias del hallazgo 3
- [x] Colores de categoría y modalidad, **fuera de los tonos de estaca**, verificados en claro y oscuro
- [x] `ChipCategoria`, `ChipModalidad` y `BadgeEstado`, listos para `REF2-4`

**DoD:** `pnpm build` con el paquete nuevo · ningún componente duplicado entre `app` y `landing` · las tres pantallas que hoy nombran un estado leen del mismo catálogo.
**Tests:** que `CATEGORY_INFO` y `SCORING` tengan ícono y color para **todas** sus claves —una categoría nueva sin ícono tiene que romper el typecheck, no aparecer en blanco—. Contraste AA de cada color contra su fondo, en los dos temas.
**Mutaciones:** sacar una entrada del mapa de íconos · bajar un color por debajo de AA.

> **Cerrada el 2026-08-13.** Tres desvíos, y ninguno es de conveniencia.
>
> **De los cinco componentes «duplicados», sólo tres lo estaban.** `cn` y `BotonTema` eran idénticos carácter por carácter; `StakeChip` difería nada más que en el tamaño —`h-6` en las tablas de la landing, `h-7` donde hay que tocarlo en la PWA—, así que esa diferencia quedó como prop en vez de elegir un tamaño y empeorar una pantalla. **`Screen` y `Encabezado` comparten el nombre y no son el mismo componente**: el de la PWA es una barra fija con vuelta atrás y ranura para el `SyncBadge`; el de la landing, una navegación pública con enlaces. Unificarlos daría un componente con dos modos, que es peor que dos componentes con un nombre repetido. Se dejaron donde están.
>
> **El brief pedía reutilizar los íconos de botones de `bv-easy-archery-battle`, y ese repo no tiene ninguno.** Sus únicos íconos son los de modalidad y los de categoría. Los once de acción se dibujaron acá con el mismo trazo.
>
> **`DESIGN_SYSTEM.md` §2.3 decía explícitamente que no había que hacer esto**: «la modalidad se distingue de forma, no de color; agregar cuatro colores más lo arruinaría». La advertencia era correcta, así que la sección se reescribió con los tres candados que la reemplazan —el color nunca solo, categoría y modalidad separadas por forma, y otro registro de saturación— en vez de borrarla y seguir.
>
> **El test de estacas rechazó tres de los once colores del primer intento.** El oliva de `razo` estaba a 22° del amarillo con saturación 1,0; un oliva **es** un amarillo oscuro. Lo mismo el marrón de `tradicional` y el óxido de `3d` contra el rojo. No se veían mal: se veían como estacas.
>
> 1019 tests en verde. Presupuestos: PWA 116,06 KB gz de 150, landing 97,32 KB de 120. **8 controles de mutación, murieron 8** — incluido uno sobre el `@source` de Tailwind, que sin él compila, importa y renderiza **sin una sola clase aplicada**.

---

### `[x] REF2-2` · La marca: logo, imágenes y footers · **P0**

**Archivos:** `scripts/imagenes.mjs` (nuevo), `shared/assets/`, `packages/ui/src/{Logo,Footer}.tsx`

- [x] `scripts/imagenes.mjs`: redimensiona con Playwright y deja registrado el origen y el tamaño de cada asset
- [x] **`wallpaper.png` de 2,8 MB** → `portada.webp`, 1120px, **130,8 KB**
- [x] **Logo del CBA** → `cba.webp`, 192px, **18,3 KB**. Salda la deuda de `REF-4`
- [x] `Logo` de la Liga con el verde de acento
- [x] Logo en el header de las tres apps
- [x] `Footer` en las tres apps
- [x] **El ícono de la PWA, que no existía** — ver la nota de cierre

**DoD:** ninguna imagen de más de 150 KB en `shared/assets` · el presupuesto de la landing sigue en verde · el logo se ve bien en claro y en oscuro.
**Tests:** que el footer nombre a la Liga y al CBA con texto, no sólo con imágenes · `alt` en las dos.

> El logo del CBA **es de un club, no del proyecto**: se usa tal cual, sin reinterpretarlo. El de la Liga es original.
>
> **Cerrada el 2026-08-13**, con un defecto encontrado de paso y un test propio que no servía.
>
> **El manifest declaraba `/app/icon.svg` y ese archivo no existía.** La PWA se anunciaba instalable con un ícono que daba 404 — en Android eso es un ícono en blanco o una instalación que no arranca. El test de `pwa-instalable` no lo veía porque comprobaba los **campos declarados** del manifest, no que el ícono se sirviera.
>
> **Y la primera corrección tampoco servía.** Agregué la comprobación del ícono, pasó en verde, y al borrar el archivo para controlarla **siguió pasando**: el servidor devuelve `index.html` para cualquier ruta desconocida —es lo que hace andar el ruteo del cliente— así que un ícono inexistente responde 200 con una página HTML. Ahora se verifica el `content-type` y que el cuerpo empiece con `<svg>`. Lo destapó la mutación, no la corrida en verde.
>
> **El logo nuevo saca una excepción a la regla 8.** El anterior usaba los tres colores de estaca como identidad (`REF-4`): era el único lugar de la interfaz donde un color de estaca significaba otra cosa. Con `REF2-1` agregando once colores, dejar esa excepción en la marca era pedir confusión.
>
> **Los originales salieron de `shared/assets/`.** Esa carpeta se empaqueta y se publica con `@bal/shared`; un PNG de 2,8 MB no tiene por qué viajar con la biblioteca. Ahora viven en `origen/` y el script genera las salidas.
>
> El script **no elige el tamaño por mí**: tiene un presupuesto por archivo y sale con error si no entra. Rechazó dos configuraciones antes de la que quedó, y la del CBA a 256px en PNG pesaba 55,7 KB contra un máximo de 30.
>
> 1025 tests, 8 de 8 E2E. **3 controles de mutación, murieron 3** — el del ícono en dos vueltas: la primera sobrevivió.

---

### `[ ] REF2-3` · Backend: edición, vuelta atrás e historial · **P0** · **TDD**

Todo lo que WAFA y la landing necesitan del servidor. **Antes** que las pantallas que lo consumen.

**Archivos:** `shared/src/schemas.ts`, `api/src/services/{tournamentEditService,tournamentStateService,paymentService}.ts`, `api/src/routes/{admin,publico}.ts`

- [ ] `UpdateTournamentSchema` acepta `participants` — hallazgo 6. **Sólo con el torneo `sin_iniciar`**
- [ ] Transición `en_proceso → sin_iniciar`, con guarda: **cero puntajes cargados**. Patrullas y PIN se conservan
- [ ] `POST /admin/tournaments/:id/unstart`
- [ ] Recaudación **de la temporada**, además de la del torneo — hallazgo 8
- [ ] Serie por torneo del arquero, derivada de `participants` con `ix_archer` — hallazgo 5. Sin migración

**Referencia:** [`SECURITY.md`](../../SECURITY.md) §2 — **el monto lo valida el servidor**. Todo cuerpo pasa por Zod `.strict()` antes de tocar un filtro de Mongo (regla 5).
**DoD:** quitar un arquero de un torneo `sin_iniciar` lo saca también de su patrulla · un torneo con un solo puntaje **no** puede volver atrás · la recaudación de la temporada coincide con la suma de sus torneos.
**Tests:** integración de las dos rutas nuevas contra `mongodb-memory-server` · la guarda del `unstart` con y sin puntajes.
**Mutaciones:** invertir la guarda de puntajes · permitir la edición con el torneo ya iniciado.
**Actualizar:** `FUNCTIONAL.md` §8 —la máquina de estados cambia— y `TECHNICAL.md` §3.

> `/security-review` obligatorio antes de mergear: toca autorización y entrada del usuario.

---

### `[ ] REF2-4` · La identidad aplicada · **P1**

Ya con los catálogos y el backend listos, la pasada visual sobre las tres apps.

**Archivos:** `wafa/pages/{Home,Tournament,Archers}.tsx`, `landing/pages/Tournaments.tsx`, `wafl/CircuitPage.tsx`

- [ ] **Badge de color por estado** en WAFA y en la landing, del catálogo de `REF2-1`
- [ ] **Chip de categoría** con su color y su ícono, donde hoy sólo hay texto
- [ ] **Chip de modalidad** con color e ícono
- [ ] **Distribución de modalidades** en el listado de torneos: un renglón nuevo con los porcentajes
- [ ] Los glifos de texto pasan a íconos

**DoD:** ningún color es el único portador de información · todo ícono tiene texto o `aria-label` · el mismo estado se ve igual en las tres apps.
**Tests:** que los porcentajes de modalidad **sumen 100** con cualquier reparto de blancos, incluidos los que no dividen exacto.
**Mutaciones:** redondear cada porcentaje por separado y ver que la suma se rompe.

---

### `[ ] REF2-5` · WAFA · flujo · **P1**

Lo que cambia lo que el admin **puede hacer**, no cómo se ve.

**Archivos:** `wafa/pages/{Patrols,Tournament,TournamentCreate,Payments}.tsx`, `wafa/patrullas.ts`

- [ ] **Ordenar dentro de la patrulla**: subir y bajar, con el patrón de `TournamentCreate.tsx:200` (hallazgo 10)
- [ ] **Eliminar una patrulla vacía** y **renumerar** las que siguen, sin huecos
- [ ] **No se guarda** con una patrulla vacía ni con una que rompa las reglas
- [ ] **Confirmación al iniciar el torneo**
- [ ] **Volver a `sin_iniciar`** desde la pantalla del torneo, con el endpoint de `REF2-3`
- [ ] **Edición completa** con el torneo `sin_iniciar`: arqueros y blancos incluidos
- [ ] **Pagos**: separación entre el botón y el estado; verde para pagó, rojo para debe

**DoD:** eliminar la patrulla 2 deja 1, 2, 3 sin huecos · guardar está bloqueado con una patrulla vacía y **dice cuál** · iniciar pide confirmación.
**Tests:** renumerado con la primera, una del medio y la última · el validador nombra la patrulla y el motivo.
**Mutaciones:** renumerar sin reordenar · dejar guardar con una patrulla vacía.

> **La pantalla de patrullas es delicada.** `REF-3` ya encontró ahí un algoritmo que daba peor que el óptimo en 30 de 960 composiciones. El barrido que quedó como test permanente tiene que seguir en verde.

---

### `[ ] REF2-6` · WAFA · presentación · **P1**

**Archivos:** `wafa/pages/{Ranking,Archers,TournamentCreate,Home}.tsx`

- [ ] **Sección «Recaudación»**: por torneo y total de la temporada
- [ ] **Compartir el ranking** por WhatsApp, mail y lo que ofrezca el dispositivo. Comparte **el modo que está elegido**
- [ ] **Paso «Revisión»** de crear torneo: distribución de modalidades en «Recorrido» y de categorías en «Participantes»
- [ ] **Arqueros**: el aviso de «ya participó de un torneo…» deja de estar siempre visible; se despliega al tocar

**DoD:** el total de recaudación coincide con la suma de los torneos · compartir «por puntos» no manda «mejor de 2» · el aviso arranca plegado y se abre con teclado.
**Tests:** el texto compartido incluye el modo elegido · el aviso es un `<details>` o equivalente accesible.

> **Compartir** se resuelve con `navigator.share` donde exista y con un texto copiable donde no. Nada de SDKs externos: la CSP prohíbe pedidos a otros hosts.

---

### `[ ] REF2-7` · Landing y WAFL · **P1**

**Archivos:** `landing/pages/{Home,Ranking,Archer}.tsx`, `packages/ui/src/EvolutionChart.tsx`, `wafl/{LoginPage,CircuitPage}.tsx`

**Landing**
- [ ] `wallpaper.png` —ya optimizado en `REF2-2`— reemplaza a `arqueria.svg` en la portada
- [ ] **La explicación sigue al modo elegido**: con «Por puntos», el reparto del podio; con «Mejor de 2», cómo se calcula el promedio, **con un ejemplo**. Hoy está detrás de un `<details>` que no depende del modo (`Ranking.tsx:173`)
- [ ] «Emes» pasa a **«M»** (`Archer.tsx:101`)
- [ ] **Gráfico de evolución** de «Mejor» contra cantidad de torneos, con `EvolutionChart` portado y la serie de `REF2-3`
- [ ] Cada categoría sin ranking, **dentro de su card**

**WAFL**
- [ ] Logo de la Liga y del CBA en el login
- [ ] Blancos **coloreados por modalidad, con ícono**

**DoD:** cambiar de modo cambia la explicación · un arquero con un solo torneo no rompe el gráfico · el E2E offline sigue verde.
**Tests:** la explicación de cada modo · el gráfico con 0, 1 y n torneos · presupuesto de la landing.
**Mutaciones:** mostrar siempre la misma explicación.

> **WAFL se toca al final y con el E2E andando.** Es la app que decide si el sistema sirve el día del torneo, y el color de los blancos entra en la pantalla que el líder mira caminando.

---

## Pendiente de las tandas anteriores

- ~~**PNG del CBA sin redimensionar**~~ → entra en `REF2-2`
- **`db:reconcile` al mergear `REF-2`**: las temporadas publicadas necesitan recalcular. Hoy no hay datos de producción; deja de ser gratis con el primer torneo real
- **PR #40 abierto**: firma pesada y outbox trabado. `ref-2` arranca cuando esté mergeado

---

## Verificación

Cada tanda, antes de su PR:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

```bash
pnpm test:e2e
```

```bash
pnpm build && pnpm budget
```

Y **a mano contra el MongoDB local**:

```bash
pnpm dev
```

Circuito completo: crear torneo → patrullas → iniciar → WAFL con PIN → **cargar con el wifi cortado** → reconectar → firmar → finalizar → publicar → verlo en la landing sin sesión.

**Además, propio de `ref-2`:** las tres apps abiertas **una al lado de la otra**, en claro y en oscuro. Es la única forma de ver que el mismo estado se ve igual en las tres — que es justamente lo que hoy no pasa.

Al terminar cada tanda: marcarla acá y anotar en [`BITACORA.md`](../../BITACORA.md) qué se decidió y por qué.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **`@bal/ui` engorda los bundles** | El presupuesto corre en cada tanda. Los íconos son SVG inline con `currentColor`, no una librería |
| **Quince colores nuevos rompen la legibilidad al sol** | Ninguno pisa un tono de estaca, todos se verifican contra AA en los dos temas, y **ninguno viaja solo**: siempre con ícono y texto |
| **`REF2-1` toca todo y no se ve nada** | Va primero y sola. Si algo se rompe, se rompe con las pantallas todavía sin cambiar |
| **Volver a `sin_iniciar` con puntajes cargados** | La guarda es del servidor, no del botón. Test de integración con y sin puntajes, y una mutación que la invierte |
| **Editar participantes de un torneo armado** | Quitar un arquero lo saca de su patrulla y puede dejarla inválida. El guardado exige que las patrullas sigan cumpliendo las reglas |
| **Tocar el editor de patrullas** | El barrido de 960 composiciones de `REF-3` es la red. Cualquier cambio se mide contra él |
