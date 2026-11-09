# Informe de diseño — Séptima ronda: rediseño visual

Revisión de la interfaz de las tres apps (landing, puerta `/app`, WAFA y WAFL) para hacerla más profesional, sin tocar ninguna de las reglas operativas del proyecto.

El plan que implementa estos hallazgos está en [`ACTION_PLAN.md`](ACTION_PLAN.md). La especificación visual completa (tokens, componentes y pantallas) está en [`DISENO.md`](DISENO.md), con archivos de referencia que se abren en el navegador en [`referencia/`](referencia/index.html).

> **Pedido, literal:** «Debes mejorar el diseño de esta aplicación para que sea más profesional. Debes: Crear un diseño completamente nuevo para la landingpage y para la página .../app. Estas deben tener un diseño moderno y profesional (Prioridad absoluta). Debes mejorar el diseño de las apps de Líder y Admin buscando cambios simples y de alto impacto. Mejorar la UI/UX general de todo el producto.»
>
> **Restricciones del pedido:** «tiene modo oscuro y claro (claro por defecto)». «Si vas a hacer algún cambio (que no deberías en esta instancia) crea una nueva branch desde main.» Y después: «Crea una rama con un plan de acción y toda la documentación necesaria para seguirlo desde otra sesión con Claude Code. No omitas nada.»

**Fecha:** 2026-11-08 · **Commit base:** `07e5754` (`main`, merge de la PR 80) · **Autor:** Claude Opus 5.5 · **Deploy revisado:** https://bv-bahia-archers-league-production.up.railway.app/

**Design System publicado** (privado del autor, como referencia navegable): https://claude.ai/artifact/GrcHNXJxhXrpJs3ghvPnta. **No hace falta para implementar**: todo lo que contiene está copiado en esta carpeta.

---

## 1. Resumen ejecutivo

La base es sólida: la dirección visual de [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) (blanco de campo, verde nock, estacas reservadas, objetivos táctiles) es buena y se mantiene entera. Lo que hace que el producto **no se vea profesional** es otra cosa:

| # | Hallazgo | Eje | Severidad |
|---|---|---|---|
| 1 | **Las fuentes nunca cargan.** No hay ningún `@font-face` en el repo. Todo se ve en Segoe UI o Roboto, y `'Archivo Expanded'` ni siquiera existe como familia | Identidad | **Alta** |
| 2 | **La landing no tiene contenido**: una foto, un título de 16px, un botón verde gigante y tres tarjetas de texto. Y el pie queda fijo, comiéndose el alto útil | UI/UX | **Alta** |
| 3 | **La puerta `/app` no explica nada**: dos botones ("Soy líder…", "Soy administrador") sin decir qué hace cada app | UI/UX | **Alta** |
| 4 | **En el tema claro, el anillo de foco da 2.59:1** (`--nock` sobre `--bg`), por debajo del 3:1 que exige WCAG | Accesibilidad | **Alta** |
| 5 | **En WAFL, el pie con los logos queda entre la lista de arqueros y el teclado de scoring**, justo donde no sobra alto | UI/UX | **Alta** |

Y una serie de detalles que, sumados, hacen que todo parezca un prototipo: el botón secundario gris que se lee como deshabilitado, los estados de torneo rellenos que pesan más que el título, la jerarquía tipográfica plana (casi todo en 16px semibold) y el `CircuitRing`, que está especificado en §6.5 pero nunca se implementó.

---

## 2. Qué se revisó y cómo

| Área | Alcance |
|---|---|
| Código | `packages/ui` (tokens, paleta, tema, Chips, StakeChip, Tarjeta, Footer, Logo, íconos), `packages/landing` (App, ui, Home, Ranking, Tournaments, Archer, ArcherRegister, Scorecard), `packages/app` (App, ui, WAFL: Login, Circuit, Target, ScoreKeypad, ArrowRow, Results; WAFA: Home, Login, Archers, Tournament), `shared/src/estados.ts` y `constants.ts` |
| Documentación | `CLAUDE.md`, `README.md`, `docs/DESIGN_SYSTEM.md` completo, la estructura de `ACTION_PLAN.md` y de `BITACORA.md`, y `post/ref-6` como formato |
| Capturas | Las 54 de `capturas/`, con foco en 01, 02, 04, 05, 12, 13, 14, 15, 21, 22, 24 y 26 |
| Contraste | Todos los pares de tokens nuevos y existentes que se tocan, medidos con la fórmula WCAG 2 en los dos temas (tabla en [`DISENO.md`](DISENO.md) §2.3) |
| Render | Las 6 pantallas propuestas, renderizadas en Chrome headless a 1280 y 390 px y en los dos temas ([`referencia/capturas/`](referencia/capturas)) |

---

## 3. Hallazgos

Cada hallazgo tiene un ID que el plan referencia.

### 3.1 Identidad y tipografía

**`D-1` · Las fuentes nunca cargan · Alta**
`packages/ui/styles/tokens.css` declara `--font-display: 'Archivo Expanded', 'Archivo', …`, `--font-sans: 'Archivo', …` y `--font-mono: 'Martian Mono', …`. Pero `grep -rn "font-face\|fontsource" packages` no devuelve nada fuera de `node_modules`. El navegador cae en `system-ui`: Segoe UI en Windows, Roboto en Android, SF en iOS. Se ve en todas las capturas.
Además, **"Archivo Expanded" no es una familia**: en Google Fonts, Archivo es una fuente variable con ejes `wght` (100–900) y `wdth` (62–125). Lo "expandido" es `font-stretch: 125%` / `font-variation-settings: 'wdth' 125` sobre la misma familia.
La CSP ya permite `font-src 'self'` (`api/src/middleware/security.ts:31`), así que alcanza con autohospedarlas.
**Impacto:** es el cambio de mayor impacto visual por línea de código. Alcanza a las tres apps.

**`D-2` · Jerarquía tipográfica plana · Media**
Casi todo es 16px semibold: el título de la landing, los títulos de tarjeta, los rótulos de sección y los botones. La escala de §3 (`display`, `h2`, `h3`, `sm`, `mono`) existe en el documento pero no en el código: solo hay `--text-score` y `--text-display`.

### 3.2 Landing

**`L-1` · Portada sin contenido · Alta**
`landing/src/pages/Home.tsx`: foto en una tarjeta, `h1` "Liga Bahiense de Arquería", una línea de texto, un botón `Ingresar` de 56px a todo el ancho y tres tarjetas que solo enlazan ("Ranking de la liga", "Torneos", "Sumarte al padrón"). Lo que el público viene a ver (el torneo en curso, los resultados, quién va primero) está a dos toques de distancia.

**`L-2` · El pie fijo come alto y tapa contenido · Media**
`landing/src/App.tsx` usa `flex flex-col h-dvh overflow-hidden` y un `<main data-scroll-principal>` que scrollea entre encabezado y pie. En la captura 21, el pie de ~80px corta la segunda fila de tarjetas. Una landing es un documento: el pie va al final.
**Ojo:** `useTituloDePagina` (`ui/src/navegacion.ts`) y `landing/src/navegacion.test.tsx` dependen de `data-scroll-principal` para volver arriba al navegar. Hay que migrarlos a `window.scrollTo`.

**`L-3` · Encabezado en dos filas sin estado activo · Media**
`Encabezado` (`landing/src/components/ui.tsx`): marca arriba, links de 14px abajo ("Ranking", "Torneos"), sin indicar en qué página estás. Ocupa ~108px.

**`L-4` · "Ingresar" ocupa el centro de la portada · Media**
La decisión de "una sola puerta" (comentario en `Home.tsx`) es correcta y **se mantiene**. Lo que cambia es dónde vive: un botón verde gigante en el medio de la portada le habla a quien menos lo necesita (el líder ya tiene la PWA instalada). Pasa al encabezado, siempre visible.

**`L-5` · Foto de portada genérica · Media**
`packages/ui/assets/portada.webp` tiene rótulos en inglés ("INDOOR", "OUTDOOR", "FIELD", "3D RANGE") y no es el predio del CBA: parece generada. Para el sitio de una liga real resta credibilidad. → Decisión 1.

### 3.3 Puerta `/app`

**`P-1` · No explica los roles · Alta**
`app/src/App.tsx` (`Elegir`): título + `Soy líder de patrulla` (primario) + `Soy administrador` (secundario gris) + `VolverALaLiga` + `InstalarApp`. Quien entra por primera vez no sabe qué hace cada app ni que la de líder funciona sin señal. El secundario gris parece deshabilitado (`C-1`).

### 3.4 Accesibilidad y contraste

**`A-1` · Anillo de foco en claro: 2.59:1 · Alta**
`:focus-visible { outline: 3px solid var(--nock) }`, con `--nock: #8fa800` sobre `--bg: #fbfaf5`, da 2.59:1, y WCAG 2.4.11 pide 3:1. El comentario de `tokens.css` dice que no se aclaró el verde para no empeorar el foco, pero el foco ya estaba por debajo.
→ Token nuevo `--focus-ring`: `#556500` en claro (6.19:1) y `#c6f000` en oscuro (13.6:1).

**`A-2` · Bordes de controles: 1.3:1 · Media**
Inputs (`Field`), botón secundario, botón ícono y teclas usan `border` = `--line` (`#deddd2` sobre `#fbfaf5` ≈ 1.3:1). WCAG 1.4.11 pide 3:1 para el borde que identifica un control.
→ Token nuevo `--line-strong`: `#7f8372` en claro (≥3.4:1 sobre bg/surface/surface-2) y `#7a7f6c` en oscuro (≥3.39:1).

**`A-3` · Botón de peligro en oscuro: ~3:1 · Media**
`peligro: 'bg-[var(--danger)] text-white'`. En oscuro `--danger` es `#f06449`, y el blanco encima da ~3:1.
→ Token nuevo `--danger-ink`: `#ffffff` en claro (6.71:1) y `#16170f` en oscuro.

**`A-4` · "Completado, sin publicar" en claro: 2.59:1 · Media**
`BadgeEstado` pinta el fondo con `ESTADO_DE_TORNEO[status].color` y el texto con `--bg`. Para `completado` el color es `var(--nock)`, y `#fbfaf5` sobre `#8fa800` da 2.59:1. Se ve en WAFA, que usa `label`.
→ Se resuelve con el rediseño de `BadgeEstado` (`C-2`).

**`A-5` · Deshabilitado con `opacity: .4` · Baja**
`disabled:opacity-40` baja el contraste del texto por debajo de AA sin decir por qué está deshabilitado (captura 15: "Continuar" lavado).
→ `surface-2` + `ink-muted` (≥5.7:1) y el motivo escrito al lado, como ya hace WAFL ("Falta cargar: …").

### 3.5 Componentes compartidos

**`C-1` · El botón secundario parece deshabilitado · Media**
`secundario: 'bg-[var(--surface-2)] text-[var(--ink)] border'`: un bloque gris relleno, con un borde invisible (`A-2`). En las capturas 01 y 04 ("Soy administrador", "Arqueros", "Temporadas") se lee como inactivo.
→ `surface` + borde `line-strong` + hover `surface-2`.

**`C-2` · El estado del torneo compite con el título · Media**
Píldora rellena ("En curso ahora" en marrón, "Resultados oficiales" en verde) que pesa más que el nombre del torneo (captura 22).
→ Punto de color + texto, en una píldora con borde `line` sobre `surface`. "En curso" con punto `nock-text` que late.

**`C-3` · Fila de chips de modalidad con % · Baja**
En las tarjetas de torneo, 2 a 4 chips con su % forman una fila de ruido difícil de comparar entre torneos (capturas 04 y 22).
→ `ModalityBar`: barra apilada de 8px + leyenda con ícono, nombre y %.

**`C-4` · Rótulos de sección sin contador ni separación · Baja**
"EN PROCESO", "SIN INICIAR", en gris y negrita (captura 04).
→ `SectionHeader`: eyebrow mono + contador + filete + acción opcional.

**`C-5` · `CircuitRing` especificado y no implementado · Media**
`DESIGN_SYSTEM.md` §6.5 lo define como "el elemento de firma" en tres lugares, pero `grep -rln "CircuitRing\|Anillo" packages/app/src packages/ui/src` no encuentra nada.

**`C-6` · Íconos faltantes · Baja**
Las pantallas nuevas necesitan `chevron`, `flecha`, `volver`, `sincronizar`, `sin-senal`, `panel`, `podio`, `arqueros`, `calendario`, `lugar` e `instalar`. Ninguno existe en `ui/src/iconos/`. Hoy se usan caracteres sueltos ("←").

### 3.6 Admin (WAFA)

**`W-1` · Inicio sin jerarquía · Media**
`wafa/pages/Home.tsx` (captura 04): cuatro botones de 52px ("Crear torneo", "Arqueros", "Temporadas", "Ranking de la liga"), los tres últimos del mismo gris. Ocupan media pantalla antes de mostrar un torneo.
→ Un primario y tres accesos compactos con ícono y dato.

**`W-2` · Pie en todas las pantallas de WAFA · Baja**
`Screen` renderiza `Footer` siempre (compacto con `conBarraFija`). En WAFA no aporta nada: el logo ya está en el encabezado.

**`W-3` · Seguimiento de patrullas sin vista de un vistazo · Media**
El torneo en curso muestra "2 blancos · 2 arqueros · 1 patrullas", pero no quién va adelante. Lo resuelve el `CircuitRing` chico por patrulla (`C-5`).

### 3.7 Líder (WAFL)

**`F-1` · El pie queda entre la lista y el teclado · Alta**
`Screen conBarraFija` (TargetPage, CircuitPage, ResultsPage) renderiza el `Footer compacto` dentro del área que scrollea, y queda **pegado arriba del teclado** (capturas 14 y 15). Son ~34px de logos justo donde el líder necesita ver el próximo arquero.
→ Sin pie en las pantallas con barra fija.

**`F-2` · El encabezado del blanco no se lee de un vistazo · Media**
"Blanco 1 · 3D · 2 flechas" en una línea de 16px, y "Jabalí" abajo. Es lo primero que hay que leer al llegar al puesto.
→ Número en display de 56px + `ChipModalidad` + "2 flechas · Jabalí · 1 de 6".

**`F-3` · La tarjeta de unidad no muestra el total · Media**
Arriba a la derecha hay un "—" largo sin contexto. Los casilleros de flecha son chicos (~36px) y no marcan cuál es la siguiente.
→ Total en display de 36px con `aria-live`, casilleros de 48px y la próxima con borde `nock-text`.

**`F-4` · "Cerrar sesión" al final de la lista de blancos · Baja**
Captura 14: un botón grande al final del recorrido, cuando ya hay un ícono de salir en el encabezado.

### 3.8 Lo que está bien y no hay que tocar

- La dirección visual de §1 y la paleta base de §2.1: **no cambia ningún valor existente**, solo se agregan tokens.
- Estacas reservadas, color nunca solo, forma píldora/rectángulo para categoría/modalidad (§2.2–§2.3) y los tests de `paleta.test.ts`.
- Objetivos táctiles (§5). El teclado sube de 56 a 64px de alto y sigue arriba del mínimo.
- Tema anti-FOUC con los cuatro lugares sincronizados (§9). No se toca `theme-init.js`.
- Sin spinner al guardar, sin modales en scoring, `aria-live` en totales y sync.
- La copy de §6.8. Los textos nuevos siguen esas reglas.

---

## 4. Propuesta en una línea por superficie

| Superficie | Propuesta | Preview |
|---|---|---|
| Landing | Encabezado de una fila + hero sobre `monte` con anillos + tarjeta del torneo en curso + Cómo se juega + Torneos + Ranking + Modalidades + Sumate + pie estático | [`Landing`](referencia/pantallas/Landing.html) · [`LandingMovil`](referencia/pantallas/LandingMovil.html) |
| Puerta `/app` | Panel `monte` con la promesa + "¿Cómo entrás hoy?" con dos `RoleCard` + volver al sitio + instalar | [`Puerta`](referencia/pantallas/Puerta.html) · [`PuertaMovil`](referencia/pantallas/PuertaMovil.html) |
| WAFA | Un primario, tres accesos, `SectionHeader`, `BadgeEstado` y `ModalityBar` nuevos, `CircuitRing` por patrulla, sin pie | [`WafaInicio`](referencia/pantallas/WafaInicio.html) |
| WAFL | Sin pie en scoring, encabezado del blanco grande, `UnitCard` con total, teclas de 64px, "Continuar" dentro del panel | [`WaflBlanco`](referencia/pantallas/WaflBlanco.html) |

---

## 5. Decisiones a confirmar antes de implementar

Se confirman con el autor **antes** de arrancar las tandas que dependen de cada una. Si nadie está para preguntar, se toma la opción marcada como *por defecto* y se anota en la bitácora.

> **Estado (2026-11-09):** el autor confirmó la opción *por defecto* de la **1, 2, 4 y 5**. La **3** y la **6** se tomaron por defecto sin consultar. Detalle en [`BITACORA.md`](../../BITACORA.md), entrada de `REF7-3`. No hace falta volver a preguntarlas.

1. **Foto de portada** (`L-5`) — ¿se reemplaza por una foto real del predio del CBA o se saca? *Por defecto:* se mantiene `portada.webp` hasta que haya una foto real, y el hero funciona sin foto (con solo los anillos) si el archivo no está. Afecta a `REF7-6`.
2. **"Ingresar" se muda al encabezado** (`L-4`) — el único acceso a la PWA desde la landing pasa del cuerpo al encabezado (y al pie). *Por defecto:* sí. Afecta a `REF7-5` y `REF7-6` y a `e2e/ingreso.spec.ts`, que busca el link por nombre (sigue llamándose "Ingresar").
3. **Recordar el último rol en `/app`** (`P-1`) — guardar en `localStorage` el último rol elegido y mostrarlo primero con "Seguís como …". *Por defecto:* no en esta ronda (queda como mejora P2).
4. **Texto público del estado** — `ESTADO_DE_TORNEO.en_proceso.publico` pasa de "En curso ahora" a "En curso", y `completado.label` a "Esperando publicación" en el badge. *Por defecto:* sí. Afecta a `shared/src/estados.ts`, `ui.test.tsx` y `landing.test.tsx`.
5. **Pie fuera de toda la PWA** (`W-2`, `F-1`) — ¿se saca de todas las pantallas de WAFA y WAFL, o solo de las que tienen barra fija? *Por defecto:* de todas. Los logos ya están en el encabezado y en la landing.
6. **Teclas de 64px** (`F-3`) — subir el alto de tecla de 56 a 64px. *Por defecto:* sí. `TAMAÑO_TECLA_PX` sigue siendo el **mínimo** (56) y el test de §5 sigue pasando.
