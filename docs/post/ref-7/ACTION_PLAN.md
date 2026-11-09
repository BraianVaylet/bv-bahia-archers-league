# Plan de acción — Séptima ronda: rediseño visual

Implementación de [`INFORME.md`](INFORME.md) según la especificación de [`DISENO.md`](DISENO.md). Mismas convenciones que [`ref-6`](../ref-6/ACTION_PLAN.md).

**Convención de IDs:** `REF7-N` · **Prioridad:** `P0` lo que el pedido marca como «prioridad absoluta» (landing y `/app`) y lo que lo sostiene → `P1` necesario → `P2` mejora · **Estado:** `[ ]` `[~]` `[x]` · **Esfuerzo:** `S` ≤ ½ día · `M` 1-2 días · `L` 3+ días

Cada tanda referencia los hallazgos del informe por ID (`D-1`, `L-1`, …) y las secciones de `DISENO.md` (§N).

---

## Cómo retomar esto en otra sesión de Claude Code

1. `git fetch origin && git checkout design/ref-7-rediseno`. **Todo el trabajo va en esta rama.** No se mergea a `main` sin revisión.
2. Leer, en orden: [`CLAUDE.md`](../../../CLAUDE.md) → este archivo → [`INFORME.md`](INFORME.md) §5 (decisiones) → [`DISENO.md`](DISENO.md).
3. Abrir [`referencia/index.html`](referencia/index.html) en el navegador. Ese es el objetivo visual.
4. Buscar la primera tanda `[ ]` cuyas dependencias estén `[x]` y hacerla. **Una tanda por commit o PR.**
5. Al terminar cada tanda: marcarla `[x]` acá, anotar en [`docs/BITACORA.md`](../../BITACORA.md) (entradas nuevas **arriba**, plantilla al final de ese archivo) y correr `pnpm lint && pnpm typecheck && pnpm test`.
6. Skills: `frontend-design` al arrancar una pantalla nueva (`REF7-6`, `REF7-8`), `vercel-react-best-practices` al escribir componentes y `web-design-guidelines` al terminar cada pantalla. `tdd` solo si una tanda toca `@bal/shared` (`REF7-4` toca `estados.ts`: es un catálogo, no lógica, pero el test se actualiza primero y se lo ve fallar).

> **Nada de esto toca las reglas 1 a 7 de `CLAUDE.md`.** Es piel: tokens, componentes y layout. Si una tanda parece pedir un cambio en el sync, el outbox, la sesión o la API, se frena y se pregunta.

---

## Contexto

El proyecto pasa lint, tipos y los tests de la PR 80. Lo que se ve no está a la altura de lo que hay debajo: las fuentes no cargan (`D-1`), la landing y la puerta no tienen contenido ni jerarquía (`L-1`, `P-1`) y hay cuatro pares de contraste por debajo de WCAG (`A-1` a `A-4`).

El orden sale del pedido: **landing y `/app` primero**. Pero las dos dependen de las fuentes, los tokens y los componentes compartidos, así que esas tres tandas van antes, y son chicas.

Las seis decisiones de [`INFORME.md`](INFORME.md) §5 se confirman antes de arrancar las tandas que las usan (lo indica cada tanda). Si no hay a quién preguntar, se toma la opción *por defecto* y se anota en la bitácora.

---

## Resumen

| Tanda | Qué | Hallazgos | Depende de | Prioridad | Esfuerzo |
|---|---|---|---|---|---|
| `REF7-1` | Fuentes autohospedadas | `D-1` | — | **P0** | S |
| `REF7-2` | Tokens nuevos y contraste | `A-1` `A-2` `A-3` `D-2` | — | **P0** | S |
| `REF7-3` | Íconos nuevos | `C-6` | — | **P0** | S |
| `REF7-4` | Componentes compartidos | `C-1` `C-2` `C-3` `C-4` `C-5` `A-4` `A-5` | 2, 3 | **P0** | M |
| `REF7-5` | Landing: layout de documento, encabezado y pie | `L-2` `L-3` `L-4` | 4 | **P0** | M |
| `REF7-6` | Landing: portada nueva | `L-1` `L-5` | 5 | **P0** | L |
| `REF7-7` | Puerta `/app` nueva | `P-1` | 4 | **P0** | M |
| `REF7-8` | Landing: el resto de las páginas | `D-2` | 5 | P1 | M |
| `REF7-9` | WAFA: cambios simples | `W-1` `W-2` `W-3` | 4 | P1 | M |
| `REF7-10` | WAFL: cambios simples | `F-1` `F-2` `F-3` `F-4` | 4 | P1 | M |
| `REF7-11` | Documentación | — | 1–10 | P1 | S |
| `REF7-12` | Verificación final | — | 1–11 | P1 | S |
| `REF7-13` | Recordar el último rol en `/app` | `P-1` | 7 | P2 | S |

```
REF7-1 ─┐
REF7-2 ─┼─→ REF7-4 ─┬─→ REF7-5 ─┬─→ REF7-6
REF7-3 ─┘           │           └─→ REF7-8
                    ├─→ REF7-7 ──→ REF7-13
                    ├─→ REF7-9
                    └─→ REF7-10
                              todas ─→ REF7-11 ─→ REF7-12
```

---

# P0 — Base compartida

### `[x] REF7-1` · Fuentes autohospedadas · **P0** · S

**Hallazgo:** `D-1`. **Spec:** `DISENO.md` §3.1.
**Archivos:** `packages/ui/package.json`, `packages/ui/styles/tokens.css`, `packages/app/vite.config.ts` (`globPatterns` del PWA), los usos de `font-[var(--font-display)]` (`grep -rn "font-display" packages/*/src`).

- [x] `pnpm --filter @bal/ui add @fontsource-variable/archivo @fontsource-variable/martian-mono`
- [x] `@import '@fontsource-variable/archivo/wdth.css'` y `…/martian-mono/wdth.css` al principio de `tokens.css` (o en los dos `styles/index.css` si Tailwind no resuelve el import desde `@bal/ui`) — *lo resuelve: quedó en `tokens.css`*
- [x] `--font-display` y `--font-sans` a `'Archivo Variable'`; `--font-mono` a `'Martian Mono Variable'`
- [x] `@utility font-display` con `font-stretch: 125%` y `font-variation-settings: 'wdth' 125`, y reemplazar cada `font-[var(--font-display)]` por `font-display`
- [x] El precache de la PWA incluye `**/*.woff2` — *acotado al subset `latin` (ver la bitácora del 2026-11-09); lo verifica `scripts/presupuesto.mjs`*
- [x] Test en `@bal/ui`: `tokens.css` importa las dos fuentes y ninguna familia declarada es `'Archivo Expanded'` — `ui/src/fuentes.test.ts`

**DoD:** en el deploy, DevTools → Rendered Fonts muestra "Archivo Variable" en el cuerpo y en los títulos · `pnpm build` de app y landing sin warnings de fuentes · la CSP no cambia y el E2E `tema-sin-parpadeo` sigue sin violaciones · con la PWA instalada y en modo avión, los títulos siguen en Archivo.
**Riesgo:** el peso. Son ~128 KB de woff2 (latin), y con `unicode-range` no se baja nada que no se use. Se verifica contra los presupuestos de `TECHNICAL.md`.

### `[x] REF7-2` · Tokens nuevos y contraste · **P0** · S

**Hallazgos:** `A-1`, `A-2`, `A-3`, `D-2`. **Spec:** `DISENO.md` §2.2, §2.3 y §3.2.
**Archivos:** `packages/ui/styles/tokens.css`, `packages/ui/src/accion-primaria.test.ts` (o uno nuevo, `contraste.test.ts`).

- [x] Agregar en claro y oscuro: `--line-strong`, `--nock-text`, `--nock-soft`, `--focus-ring`, `--danger-ink`, `--monte`, `--monte-2`, `--monte-line`, `--monte-ink`, `--monte-muted`, `--monte-accent`, `--shadow-dock` y `--shadow-float` (valores en §2.2)
- [x] Agregar a `@theme`: `--radius-full`, `--text-hero`, `--text-h2`, `--text-h3`, `--text-sm`, `--text-mono`, `--text-eyebrow` (§3.2)
- [x] **Hallazgo de `REF7-1`:** `text-[var(--text-display)]` y `text-[var(--text-score)]` no aplican el tamaño (Tailwind 4 toma un `var()` arbitrario como color: los `h1` miden 16px). Reemplazarlos por `text-display` / `text-score`, y un test que prohíba `text-[var(--text-` en los `.tsx` (como el de `fuentes.test.ts`)
- [x] `:focus-visible { outline: 3px solid var(--focus-ring) }` (antes `--nock`)
- [x] Comentario en `tokens.css` que explique por qué el foco dejó de ser `--nock` (2.59:1)
- [x] **Primero el test, y se lo ve fallar:** cada par de la tabla §2.3 en los dos temas, leyendo `tokens.css`. Mínimo 4.5 para texto y 3 para bordes, foco y marcas

**DoD:** test de contraste verde con todos los pares de §2.3 · `paleta.test.ts` sigue verde · ningún valor existente cambió (verificar con `git diff` que solo hay líneas agregadas, salvo el `:focus-visible`).

### `[x] REF7-3` · Íconos nuevos · **P0** · S

**Hallazgo:** `C-6`. **Spec:** `DISENO.md` §4.18.
**Archivos:** `packages/ui/src/iconos/acciones.tsx` (o uno nuevo, `navegacion.tsx`), `packages/ui/src/index.ts`.

- [x] `IconoChevron`, `IconoFlecha`, `IconoVolver`, `IconoSincronizar`, `IconoSinSenal`, `IconoPanel`, `IconoPodio`, `IconoArqueros`, `IconoCalendario`, `IconoLugar` e `IconoInstalar`, con el `Svg` base
- [x] Exportados desde `@bal/ui`

**DoD:** el test de iconografía de §10 sigue verde · se ven a 16, 20 y 24px.

### `[ ] REF7-4` · Componentes compartidos · **P0** · M

**Hallazgos:** `C-1`, `C-2`, `C-3`, `C-4`, `C-5`, `A-4`, `A-5`. **Decisiones:** 4 (textos de estado). **Spec:** `DISENO.md` §4.1 a §4.9, §4.11, §4.12 y §4.17.
**Archivos:** `packages/app/src/components/ui.tsx`, `packages/landing/src/components/ui.tsx`, `packages/ui/src/{Chips,Footer,Tarjeta}.tsx`, nuevos `packages/ui/src/{BarraDeModalidades,RotuloDeSeccion,TarjetaDeTorneo,AnilloDeRecorrido}.tsx`, `packages/shared/src/estados.ts`, `packages/app/src/wafl/SyncBadge.tsx`, y los tests de cada uno.

- [ ] **Botón** (§4.1): `secundario` sobre `surface` con borde `line-strong`. Variantes nuevas `fantasma` y `sobreMonte` y tamaños `sm`/`lg`. `peligro` con `danger-ink`. Deshabilitado sin `opacity`. `:active` con `translateY(1px)`
- [ ] **Botón ícono** (§4.2): radio `md`
- [ ] **Campo** (§4.3): borde `line-strong`, error de 2px con ícono
- [ ] **`BadgeEstado`** (§4.5): punto + texto + pulso. `estados.ts`: `en_proceso.color → var(--nock-text)`, `completado.color → var(--warn)`, `en_proceso.publico → 'En curso'`, `completado.label → 'Esperando publicación'` (decisión 4). **Primero actualizar** `ui/src/ui.test.tsx`, `landing/src/landing.test.tsx` y cualquier test que busque "En curso ahora" o "Completado, sin publicar" (`grep -rn`), y verlos fallar
- [ ] **`ModalityBar`** (§4.6), con test: suma de `flex` = 100, `aria-label` completo, un ícono y un texto por modalidad
- [ ] **`SectionHeader`** (§4.7), con test: es un encabezado y muestra la cantidad
- [ ] **`TournamentCard`** (§4.8), extraída de los listados de landing y WAFA
- [ ] **`CircuitRing`** (§4.9), con test: N segmentos, `completados` con la clase de completo, rotación por `inicio` y `aria-label`
- [ ] **`SyncBadge`** (§4.11): solo la piel
- [ ] **`AppHeader`** (§4.12): prop `contexto` y volver con ícono + texto
- [ ] **`Footer`** (§4.17): versión estática con columnas; se saca `compacto`

**DoD:** todos los componentes nuevos con test · `pnpm test` verde · los snapshots o textos de E2E que cambian, actualizados **en este mismo commit** (`e2e/` · `grep -rn "En curso ahora\|Completado, sin publicar"`).

---

# P0 — Landing y `/app` (prioridad absoluta del pedido)

### `[ ] REF7-5` · Landing: layout de documento, encabezado y pie · **P0** · M

**Hallazgos:** `L-2`, `L-3`, `L-4`. **Decisiones:** 2. **Spec:** `DISENO.md` §4.16, §4.17 y §5.1 (primer párrafo).
**Archivos:** `packages/landing/src/App.tsx`, `packages/landing/src/components/ui.tsx` (`Encabezado`, `Screen`), `packages/ui/src/navegacion.ts` (`useTituloDePagina`), `packages/landing/src/navegacion.test.tsx`, `e2e/ingreso.spec.ts`.

- [ ] Sacar `h-dvh overflow-hidden` y `data-scroll-principal` de la landing: flujo de documento con header sticky y pie al final
- [ ] `useTituloDePagina`: si no hay `[data-scroll-principal]`, `window.scrollTo({ top: 0 })`. La PWA no cambia. **Primero el test** de la landing con el scroll del documento, y verlo fallar
- [ ] `SiteHeader` (§4.16): una fila, nav con `aria-current`, "Ingresar" (secundario `sm`) siempre visible, nav oculta debajo de 760px
- [ ] `Screen` de la landing a `max-w-[1200px]`
- [ ] `Footer` nuevo

**DoD:** en 360, 390, 768 y 1280 px, el pie aparece solo al final del scroll y nunca tapa contenido · al navegar se entra arriba · la página activa se ve marcada · `e2e/ingreso.spec.ts` verde (el link sigue llamándose "Ingresar").

### `[ ] REF7-6` · Landing: portada nueva · **P0** · L

**Hallazgos:** `L-1`, `L-5`. **Decisiones:** 1 (foto). **Spec:** `DISENO.md` §5.1 completo y §6. **Objetivo visual:** `referencia/pantallas/Landing.html` y `LandingMovil.html`; `referencia/capturas/Landing-*.webp`.
**Archivos:** `packages/landing/src/pages/Home.tsx` (reescritura), componentes de sección nuevos en `packages/landing/src/components/` si conviene partirla, `packages/landing/src/landing.test.tsx`.

- [ ] **Hero** sobre `--monte`, con anillos, titular `--text-hero`, bajada, dos CTAs y la foto con `height:auto`
- [ ] **Tarjeta flotante** "En curso" con `CircuitRing` agregado (`GET /api/public/tournaments` → el primero `en_proceso` → `GET /api/public/tournaments/:id` → `patrols[].targetsCompleted`). Si no hay: la última publicada. Si no hay ninguna: sin tarjeta
- [ ] **Cómo se juega**: tres ítems con la copy de §5.1-2
- [ ] **Torneos**: `SectionHeader` + hasta 3 `TournamentCard` + estado vacío
- [ ] **Ranking**: pestañas por categoría + top 5 (`/seasons` → `/rankings?seasonId=`). Posiciones 1–3 sobre `--nock-soft`, sin oro/plata/bronce
- [ ] **Modalidades**: cuatro tarjetas con los valores de `SCORING[m].scoringSet`, no escritos a mano
- [ ] **Sumate al padrón**: banda `--nock-soft` con CTA a `/alta`
- [ ] Estados de carga y error con los `Cargando`/`Fallo` que ya existen, **por sección**: si el ranking falla, el resto de la portada se ve igual
- [ ] Sin foto (decisión 1): el hero en una columna sigue viéndose bien

**DoD:** a 1280 y 390 px, en claro y oscuro, coincide con `referencia/capturas/` · `landing.test.tsx` cubre: con torneo en curso, sin torneo en curso, sin torneos, ranking vacío y error de una sección · `web-design-guidelines` sin issues críticos · el bundle de la landing sigue dentro del presupuesto (120 KB gz, `TECHNICAL.md`).
**Cuidado:** la portada hace hasta 4 pedidos. Que salgan **en paralelo**, y que ninguno bloquee el render del hero.

### `[ ] REF7-7` · Puerta `/app` nueva · **P0** · M

**Hallazgo:** `P-1`. **Spec:** `DISENO.md` §4.15 y §5.3. **Objetivo visual:** `referencia/pantallas/Puerta.html` y `PuertaMovil.html`.
**Archivos:** `packages/app/src/App.tsx` (`Elegir`), `packages/app/src/components/InstalarApp.tsx`, `packages/app/src/components/VolverALaLiga.tsx`, `RoleCard` nuevo en `packages/app/src/components/` (no es compartido), `packages/app/src/navegacion.test.tsx`, `e2e/ingreso.spec.ts`.

- [ ] Panel `monte` con marca, anillos (que **no** pasen por detrás del texto) y promesa
- [ ] "¿Cómo entrás hoy?" como `h1` con foco
- [ ] Dos `RoleCard` (líder principal con el tag "FUNCIONA SIN SEÑAL")
- [ ] `VolverALaLiga` como enlace `--nock-text` con `IconoVolver`
- [ ] `InstalarApp` con la piel nueva, **sin tocar su lógica** (`beforeinstallprompt` e iOS)
- [ ] Pie de la caja con "Círculo Bahiense de Arquería" y la versión si está disponible

**DoD:** a 1280 y 390 px, en claro y oscuro, coincide con la referencia · `e2e/ingreso.spec.ts` verde (`getByRole('link', { name: 'Soy líder de patrulla' })` busca por subcadena) · cada `RoleCard` mide ≥ 96px de alto · se navega por teclado con el foco visible.

---

# P1 — El resto del producto

### `[ ] REF7-8` · Landing: el resto de las páginas · P1 · M

**Hallazgo:** `D-2`. **Spec:** `DISENO.md` §5.2.
**Archivos:** `packages/landing/src/pages/{Tournaments,Ranking,Archer,ArcherRegister,Scorecard}.tsx`.

- [ ] `h1` en `font-display` 32px en cada página
- [ ] Torneos: `SectionHeader` por estado + grilla de `TournamentCard`
- [ ] Torneo en proceso: `CircuitRing` de 44 por patrulla
- [ ] Pestañas (torneo, ranking por categoría y sexo) con la activa sobre `--nock-soft`
- [ ] Tablas con el estilo `.bal-rank` (filas de 56px, cifras en mono, sin oro/plata/bronce)
- [ ] Alta con el `Field` nuevo

**DoD:** sin cambios de contenido ni de datos · los tests existentes de cada página verdes.

### `[ ] REF7-9` · WAFA: cambios simples · P1 · M

**Hallazgos:** `W-1`, `W-2`, `W-3`. **Decisiones:** 5 (pie). **Spec:** `DISENO.md` §5.4. **Objetivo visual:** `referencia/pantallas/WafaInicio.html`.
**Archivos:** `packages/app/src/wafa/pages/Home.tsx`, `packages/app/src/components/ui.tsx` (`Screen` sin `Footer`), las páginas de WAFA que usan `Encabezado` (para el `contexto`).

- [ ] Un primario ("Crear torneo") y tres accesos con ícono y dato. **Sin endpoints nuevos**: si un dato no está, va solo el nombre
- [ ] `SectionHeader` con cantidad y estados vacíos que dicen qué va a aparecer
- [ ] `TournamentCard` con `ModalityBar` y, en proceso, un `CircuitRing` por patrulla
- [ ] `AppHeader` con `contexto="Administración"`
- [ ] `Screen` deja de renderizar `Footer` (decisión 5)

**DoD:** tests de WAFA verdes · el inicio muestra el primer torneo sin scroll a 390×844.

### `[ ] REF7-10` · WAFL: cambios simples · P1 · M

**Hallazgos:** `F-1`, `F-2`, `F-3`, `F-4`. **Decisiones:** 5 (pie) y 6 (teclas de 64px). **Spec:** `DISENO.md` §4.13, §4.14 y §5.5. **Objetivo visual:** `referencia/pantallas/WaflBlanco.html`.
**Archivos:** `packages/app/src/wafl/{TargetPage,CircuitPage,ResultsPage,ScoreKeypad,ArrowRow,SyncBadge}.tsx`, `packages/app/src/components/ui.tsx`.

> **Tarea sensible.** Toca la pantalla de `FE-6`. **Solo piel y layout.** No cambia nada del outbox, IndexedDB, `onToken`, el orden de carga, `vibrate` ni el bloqueo. Si algo de eso parece necesario, se frena y se pregunta.

- [ ] Sin `Footer` en Target, Circuit y Results (`F-1`)
- [ ] Encabezado del blanco: número de 56px + `ChipModalidad` + "N flechas · nombre · i de N" (`F-2`)
- [ ] `UnitCard`: total de 36px con `aria-live`, casilleros de 48px y la siguiente marcada (`F-3`)
- [ ] `ScoreKeypad`: teclas de 64px de alto (el mínimo `TAMAÑO_TECLA_PX` sigue en 56), cifras en display, "Continuar" dentro del panel, `--shadow-dock` como token
- [ ] `CircuitPage`: `CircuitRing` de 120 arriba y sin "Cerrar sesión" al final (`F-4`)

**DoD:** el E2E offline (`TEST-1`) y `flujo-completo.spec.ts` verdes en Chromium y en los perfiles de celular de `REF6-9` · los tests de objetivos táctiles miden ≥ 56px en las teclas y ≥ 44px en el resto · a 360×640 se ven el encabezado del blanco, la primera unidad completa y el teclado entero sin scroll.

### `[ ] REF7-11` · Documentación · P1 · S

**Archivos:** `docs/DESIGN_SYSTEM.md`, `docs/BITACORA.md`, `docs/post/ref-7/ACTION_PLAN.md`.

- [ ] `DESIGN_SYSTEM.md` §1 (la banda `monte` y los anillos de fondo), §2.1 (tokens nuevos), §3 (la carga real de las fuentes y la escala completa), §4 (`--radius-full` y `--shadow-float`), §6 (los componentes nuevos: `ModalityBar`, `SectionHeader`, `TournamentCard`, `RoleCard`, `SiteHeader`; `BadgeEstado` rediseñado; `CircuitRing` implementado), §7 (pie estático, sin pie en la PWA) y §10 (foco con `--focus-ring`). Cada sección cambiada con la nota de qué se revirtió y por qué, como se hizo en `REF5-5` y `REF2-1`
- [ ] Entrada en `BITACORA.md` por cada tanda, más una que cierre la serie

**DoD:** ningún valor de `DESIGN_SYSTEM.md` contradice a `tokens.css`.

### `[ ] REF7-12` · Verificación final · P1 · S

Checklist de `DESIGN_SYSTEM.md` §11, sobre el deploy de la rama:

- [ ] `web-design-guidelines` sobre landing, puerta, WAFA y WAFL, sin issues críticos
- [ ] `audit-website` contra el deploy
- [ ] Contraste verificado en los dos temas (el test de `REF7-2` + una mirada con el sol de frente)
- [ ] Objetivos táctiles medidos sobre estilos computados
- [ ] 360 px sin scroll horizontal en todas las pantallas
- [ ] `prefers-reduced-motion`: el pulso y las transiciones apagados
- [ ] Navegación completa por teclado en landing, puerta y WAFA
- [ ] Capturas nuevas en `capturas/` con los mismos nombres que las de 2026-11, para comparar
- [ ] Probado en un Android y un iPhone reales

**DoD:** checklist completo · PR de `design/ref-7-rediseno` a `main` con antes/después en la descripción.

---

# P2 — Mejora

### `[ ] REF7-13` · Recordar el último rol en `/app` · P2 · S

**Hallazgo:** `P-1` (extensión). **Decisión:** 3 (por defecto, fuera de esta ronda).
**Archivos:** `packages/app/src/App.tsx`.

- [ ] Guardar en `localStorage` el último rol elegido (con `try/catch`: puede estar bloqueado)
- [ ] Mostrar primero la `RoleCard` de ese rol con el tag "SEGUÍS COMO …"

**DoD:** test con `localStorage` disponible, bloqueado y con un valor corrupto (que se ignora).

---

## Definición de terminado — aplica a toda tarea

- [ ] Los ítems y el DoD de la tanda cumplidos.
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` verdes; `pnpm test:e2e` si la tanda toca una pantalla con E2E.
- [ ] Claro **y** oscuro revisados a 390 y a 1280 px contra `referencia/`.
- [ ] Sin valores de color, radio o espacio escritos a mano: todo sale de un token.
- [ ] Sin cambios en las reglas 1 a 7 de `CLAUDE.md`.
- [ ] Tanda marcada `[x]` acá **y** anotada en [`BITACORA.md`](../../BITACORA.md).
