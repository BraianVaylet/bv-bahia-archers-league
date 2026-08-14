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

### `[x] REF2-3` · Backend: edición, vuelta atrás e historial · **P0** · **TDD**

Todo lo que WAFA y la landing necesitan del servidor. **Antes** que las pantallas que lo consumen.

**Archivos:** `shared/src/schemas.ts`, `api/src/services/{tournamentEditService,tournamentStateService,paymentService}.ts`, `api/src/routes/{admin,publico}.ts`

- [x] `UpdateTournamentSchema` acepta `archerIds`. **Sólo con el torneo `sin_iniciar`**, y rearma las patrullas
- [x] Transición `en_proceso → sin_iniciar`, con guarda de cero puntajes. Patrullas y PIN se conservan
- [x] `POST /admin/tournaments/:id/unstart`
- [x] `GET /admin/seasons/:id/collection` — recaudación de la temporada
- [x] Serie por torneo del arquero, derivada de `participants` con `ix_archer`. Sin migración
- [x] **La guarda de estado en `/wafl/sync`** — la encontró el `/security-review`

**Referencia:** [`SECURITY.md`](../../SECURITY.md) §2 — **el monto lo valida el servidor**. Todo cuerpo pasa por Zod `.strict()` antes de tocar un filtro de Mongo (regla 5).
**DoD:** quitar un arquero de un torneo `sin_iniciar` lo saca también de su patrulla · un torneo con un solo puntaje **no** puede volver atrás · la recaudación de la temporada coincide con la suma de sus torneos.
**Tests:** integración de las dos rutas nuevas contra `mongodb-memory-server` · la guarda del `unstart` con y sin puntajes.
**Mutaciones:** invertir la guarda de puntajes · permitir la edición con el torneo ya iniciado.
**Actualizar:** `FUNCTIONAL.md` §8 —la máquina de estados cambia— y `TECHNICAL.md` §3.

> `/security-review` obligatorio antes de mergear: toca autorización y entrada del usuario.
>
> **Cerrada el 2026-08-13, y el review encontró algo real.**
>
> `syncService.sync` nunca miró el estado del torneo: la autorización de `/wafl/sync` sale de la sesión de patrulla y nada más. Mientras el torneo sólo iba para adelante eso no importaba; **la transición nueva crea la combinación** de un torneo `sin_iniciar` con sesiones vivas, y un líder que entró antes seguía pudiendo anotar. El test lo confirmó antes de arreglarlo: la op volvió `applied`.
>
> Con un puntaje adentro, el rearmado borraba patrullas y participantes **pero no los puntajes**, dejando documentos que apuntan a gente que ya no existe. Ahora los tres se borran juntos, en una función del repositorio — porque además yo había puesto tres `deleteMany` sueltos en un servicio, rompiendo la regla 3 sin notarlo.
>
> **Dos tests pasaban por la razón equivocada**: Zod rechazaba `archerIds` por campo desconocido y el 400 coincidía con lo que yo esperaba. Recién al aceptar el campo pasaron a probar lo suyo.
>
> 1041 tests. **8 controles de mutación, murieron 8**, tres sobre las correcciones del review.

---

### `[x] REF2-4` · La identidad aplicada · **P1**

Ya con los catálogos y el backend listos, la pasada visual sobre las tres apps.

**Archivos:** `wafa/pages/{Home,Tournament,Archers}.tsx`, `landing/pages/Tournaments.tsx`, `wafl/CircuitPage.tsx`

- [x] **Badge de color por estado** en WAFA y en la landing, del catálogo de `REF2-1`
- [x] **Chip de categoría** en la ficha del torneo, el padrón y el editor de patrullas
- [x] **Chip de modalidad**, con el porcentaje adentro
- [x] **Distribución de modalidades** en los dos listados de torneos
- [x] `repartirPorcentajes` en `@bal/shared`, con TDD
- [~] Los glifos de texto pasan a íconos — ver la nota de cierre

**DoD:** ningún color es el único portador de información · todo ícono tiene texto o `aria-label` · el mismo estado se ve igual en las tres apps.
**Tests:** que los porcentajes de modalidad **sumen 100** con cualquier reparto de blancos, incluidos los que no dividen exacto.
**Mutaciones:** redondear cada porcentaje por separado y ver que la suma se rompe.

> **Cerrada el 2026-08-13.**
>
> **El reparto porcentual no era formateo.** Con catorce blancos, seis en 3D son el 42,857…%, y redondear cada parte por su cuenta da 99% o 101%. Se resolvió con el método del resto mayor —el mismo con el que se reparten bancas, y por la misma razón: el total tiene que cerrar—. El barrido sobre 30 totales × 7 repartos es el test que importa; los de ejemplo sólo documentan casos.
>
> **La distribución la calcula el servidor.** El listado no manda los blancos, y mandarlos para que el cliente los cuente sería enviar catorce objetos por torneo para mostrar cuatro números.
>
> **Los glifos de texto quedaron pendientes.** Los íconos de acción existen desde `REF2-1` pero `BotonIcono` recibe un `glifo: string`, así que cambiarlos toca la firma del componente y las cuatro pantallas que lo usan. Entra en `REF2-5`, que ya rehace esos botones para agregar subir y bajar: hacerlo dos veces sobre el mismo componente es pedir un conflicto.
>
> De paso, los títulos de grupo de la home salían de una copia local con palabras distintas a las de la ficha. Ahora los cuatro salen de `ESTADO_DE_TORNEO`.
>
> 1040 tests, 8 de 8 E2E. **4 controles de mutación, murieron 4.** Presupuestos: PWA 117,13 KB gz de 150, landing 98,34 KB de 120.

---

### `[~] REF2-5` · WAFA · flujo · **P1**

Lo que cambia lo que el admin **puede hacer**, no cómo se ve.

**Archivos:** `wafa/pages/{Patrols,Tournament,TournamentCreate,Payments}.tsx`, `wafa/patrullas.ts`

- [x] **Ordenar dentro de la patrulla**: subir y bajar, deshabilitados en los extremos
- [x] **Eliminar una patrulla vacía** y **renumerar** las que siguen, sin huecos
- [x] **No se guarda** con una patrulla vacía
- [x] **Confirmación al iniciar el torneo**, con dos toques sobre el mismo botón
- [x] **Volver a `sin_iniciar`** desde la pantalla, con el endpoint de `REF2-3`
- [x] **Pagos**: `gap-4` entre el estado y el botón, verde para pagó y rojo para debe
- [x] **Los glifos de texto pasaron a íconos** — la deuda que dejó `REF2-4`
- [ ] **Edición de arqueros** con el torneo `sin_iniciar` — pasa a `REF2-6`, ver la nota

**DoD:** eliminar la patrulla 2 deja 1, 2, 3 sin huecos · guardar está bloqueado con una patrulla vacía y **dice cuál** · iniciar pide confirmación.
**Tests:** renumerado con la primera, una del medio y la última · el validador nombra la patrulla y el motivo.
**Mutaciones:** renumerar sin reordenar · dejar guardar con una patrulla vacía.

> **La pantalla de patrullas es delicada.** `REF-3` ya encontró ahí un algoritmo que daba peor que el óptimo en 30 de 960 composiciones. El barrido que quedó como test permanente tiene que seguir en verde.
>
> **Entregada al 2026-08-13, menos un ítem.**
>
> **La edición de arqueros queda para `REF2-6`.** El backend está desde `REF2-3`; lo que falta es la pantalla, y el selector de participantes que hace falta ya existe **dentro del asistente de creación** (`TournamentCreate.tsx`, 675 líneas). Extraerlo es el trabajo, y `REF2-6` ya entra en ese archivo para agregar los porcentajes del paso «Revisión». Hacerlo acá significaría tocarlo dos veces.
>
> **Una patrulla vacía ya no se guarda.** Antes sí: `cuerpoDeDistribucion` la filtraba **en silencio** y el torneo terminaba con una patrulla menos y una numeración con huecos que nadie había pedido. Había un test que afirmaba esa conducta —«NO frena una patrulla sin nadie»— y se reescribió explicando por qué cambió. Renumerar no es presentación: el usuario del líder es `patrulla${número}`, y un hueco deja un usuario que no existe.
>
> **Una mutación sobreviviente destapó código duplicado, no un test faltante.** `moverEnPatrulla` tenía un chequeo de rango **y** el que `noUncheckedIndexedAccess` obliga a escribir: los dos hacían lo mismo. Se sacó el redundante, y ahí sí la mutación mata.
>
> 1077 tests, 8 de 8 E2E. **7 controles de mutación, murieron 7.**

---

### `[x] REF2-6` · WAFA · presentación · **P1**

**Archivos:** `wafa/pages/{Ranking,Archers,TournamentCreate,Home}.tsx`

- [x] **Sección «Recaudación»** en Temporadas: por torneo y total, desplegable
- [x] **Compartir el ranking** con `navigator.share`, o copiando donde no exista. Comparte **el modo elegido**
- [x] **Paso «Revisión»**: distribución de modalidades y de categorías, con porcentaje
- [x] **Arqueros**: el aviso se despliega al tocar
- [x] **La edición de arqueros del torneo** — la deuda de `REF2-5`

**DoD:** el total de recaudación coincide con la suma de los torneos · compartir «por puntos» no manda «mejor de 2» · el aviso arranca plegado y se abre con teclado.
**Tests:** el texto compartido incluye el modo elegido · el aviso es un `<details>` o equivalente accesible.

> **Compartir** se resuelve con `navigator.share` donde exista y con un texto copiable donde no. Nada de SDKs externos: la CSP prohíbe pedidos a otros hosts.
>
> **Cerrada el 2026-08-13**, con la deuda de `REF2-5` saldada.
>
> **El selector de arqueros salió del asistente**, que era exactamente el trabajo que faltaba: 200 líneas atrapadas dentro de un archivo de 675. Ahora lo usan la creación del torneo y la edición de participantes, y la pantalla de edición avisa que rearmar cambia los PIN.
>
> **Una mutación destapó un test débil, y era mío.** «Comparte el modo elegido» verificaba que apareciera «pts» y «%» — y pasaba con la pantalla mandando **siempre** los puntos de liga, porque la unidad la pone el texto compartido según el modo y cambiaba igual. Ahora se afirma el valor: `12 pts` contra `81.2 %`.
>
> El texto del ranking vive en `@bal/shared` y no en el componente: lo que se comparte tiene que ser lo publicado, no una lectura del DOM.
>
> 1088 tests, 8 de 8 E2E. **5 controles de mutación, murieron 5** —uno recién después de arreglar el test que dejaba pasar.

---

### `[x] REF2-7` · Landing y WAFL · **P1**

**Archivos:** `landing/pages/{Home,Ranking,Archer}.tsx`, `packages/ui/src/EvolutionChart.tsx`, `wafl/{LoginPage,CircuitPage}.tsx`

**Landing**
- [x] La portada usa `portada.webp`, optimizada en `REF2-2`
- [x] **La explicación sigue al modo elegido**, con un ejemplo con números en «Mejor de 2»
- [x] «Emes» pasa a **«M»**
- [x] **Gráfico de evolución** portado, midiendo **porcentaje** y no puntaje bruto
- [x] Cada categoría dentro de su tarjeta, no sólo las vacías

**WAFL**
- [x] Logo de la Liga y del CBA en el login
- [x] Blancos con su chip de modalidad, y **una cuarta copia de las etiquetas dada de baja**

**DoD:** cambiar de modo cambia la explicación · un arquero con un solo torneo no rompe el gráfico · el E2E offline sigue verde.
**Tests:** la explicación de cada modo · el gráfico con 0, 1 y n torneos · presupuesto de la landing.
**Mutaciones:** mostrar siempre la misma explicación.

> **WAFL se toca al final y con el E2E andando.** Es la app que decide si el sistema sirve el día del torneo, y el color de los blancos entra en la pantalla que el líder mira caminando.
>
> **Cerrada el 2026-08-13. Última tanda de `ref-2`.**
>
> **El gráfico mide porcentaje, no puntaje.** El brief pedía «Mejor vs cantidad de torneos», pero los puntajes brutos de dos fechas **no se comparan**: cada torneo tiene un máximo distinto. Es la misma razón por la que el ranking usa `normalizedPct`, y graficar puntajes habría dibujado una mejora donde sólo hubo un recorrido más largo.
>
> **La explicación del ranking va abierta, no plegada.** La primera vez que alguien ve esa pantalla necesita saber qué significan los números, no descubrir que hay una explicación escondida.
>
> **Dos hallazgos de tests viejos.** El mock de la landing servía `mode=score` —un modo que `REF-2` eliminó— y no tenía `best_two`: el test que conmuta de modo sólo verificaba que cambiara la URL, no lo que volvía. Y `CircuitPage` tenía **una cuarta copia** de las etiquetas de modalidad escritas a mano, después de las tres de estados que unificó `REF2-1`.
>
> **Y una mutación sobreviviente, otra vez sobre un test mío.** «La escala no se adapta a la serie» comparaba dos series entre sí — y con escala adaptativa también dan distinto. Ahora se mide contra una posición absoluta.
>
> 1094 tests, 8 de 8 E2E. **4 controles de mutación, murieron 4** —uno recién después de arreglar el test—.

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
