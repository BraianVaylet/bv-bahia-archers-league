# Especificación de diseño — ref-7

La especificación completa del rediseño. Junto con [`referencia/`](referencia/index.html) alcanza para implementar sin acceso a ninguna conversación ni al artifact publicado.

- **Qué cambia y por qué:** [`INFORME.md`](INFORME.md).
- **En qué orden:** [`ACTION_PLAN.md`](ACTION_PLAN.md).
- **Cómo se ve:** [`referencia/capturas/`](referencia/capturas) (renders en Chrome a 1280 y 390 px) y las pantallas HTML en [`referencia/pantallas/`](referencia/pantallas). Se abren directo en el navegador; con `?oscuro` en la URL muestran el tema oscuro.

> **Cómo leer la referencia.** Los HTML de `referencia/` usan CSS plano con clases `bal-*` (`referencia/componentes.css`) porque se renderizan sin build. **No se copian tal cual al código**: el código usa Tailwind 4 con valores arbitrarios (`bg-[var(--nock)]`) y componentes de React en `@bal/ui`. La referencia es la **fuente de los valores** (tamaños, espacios, colores y estados). Cada sección de abajo dice a qué componente del código corresponde.

---

## 1. Dirección

No cambia nada de [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) §1: blanco de campo, verde nock, estacas reservadas y anillos concéntricos. Hay tres cambios de énfasis:

1. **La banda `monte`.** La cara negra del blanco de campo pasa a ser una superficie de identidad: el hero de la landing y el panel de la puerta `/app`. Es oscura en los dos temas y lleva encima el chartreuse pleno (`--monte-accent`). **Nunca va dentro de WAFA ni de WAFL**, donde manda el fondo claro, que gana bajo el sol.
2. **Los anillos como fondo.** Además del `CircuitRing`, la landing y la puerta llevan anillos concéntricos decorativos en `--monte-line` (uno en `--monte-accent` al 50%). No portan información (`aria-hidden`). Así no se rompe la regla de §6.5, que reserva el `CircuitRing` **con datos** a sus tres lugares.
3. **La tipografía expandida de verdad** (`D-1`). Archivo al 125% de ancho en titulares, cifras de puntaje y números de blanco.

Lo que se sigue evitando: degradados, sombras decorativas, emoji, tarjetas con borde de color a la izquierda.

---

## 2. Tokens

### 2.1 Existentes: no cambia ningún valor

`--bg`, `--surface`, `--surface-2`, `--ink`, `--ink-muted`, `--line`, `--nock`, `--nock-ink`, `--danger`, `--warn`, `--ok`, `--stake-*` y los colores de `paleta.ts` quedan **exactamente** como están.

### 2.2 Nuevos

Se agregan a `packages/ui/styles/tokens.css`, en `:root` y en `:root[data-theme='dark']`.

| Token | Claro | Oscuro | Uso | Hallazgo |
|---|---|---|---|---|
| `--line-strong` | `#7f8372` | `#7a7f6c` | Borde de **todo lo que se toca**: inputs, botón secundario, botón ícono, teclas, `RoleCard` | `A-2` |
| `--nock-text` | `#556500` | `#c6f000` | El verde cuando tiene que **leerse**: enlaces, nav activa, segmentos del `CircuitRing`, punto de "En curso", borde de la unidad activa | — |
| `--nock-soft` | `#eef4cc` | `#2c3410` | Tinte de selección: pestaña activa del ranking, posiciones 1–3, banda "Sumate al padrón" | — |
| `--focus-ring` | `#556500` | `#c6f000` | `:focus-visible` (reemplaza a `--nock`) | `A-1` |
| `--danger-ink` | `#ffffff` | `#16170f` | Texto sobre `--danger` | `A-3` |
| `--monte` | `#16170f` | `#0d0e05` | Banda de identidad (hero, panel de la puerta) | — |
| `--monte-2` | `#1f211a` | `#16170f` | Superficie elevada sobre `monte` (hover de botón sobre monte, `BadgeEstado` sobre monte) | — |
| `--monte-line` | `#333629` | `#2a2d24` | Anillos decorativos sobre monte | — |
| `--monte-ink` | `#f4f3ec` | `#f4f3ec` | Texto sobre monte | — |
| `--monte-muted` | `#a8ad99` | `#a8ad99` | Texto secundario y borde del botón secundario sobre monte | — |
| `--monte-accent` | `#c6f000` | `#c6f000` | Palabra destacada del titular, anillo interior, punto vivo sobre monte | — |
| `--shadow-dock` | `0 -2px 12px rgba(0,0,0,.08)` | `0 -2px 12px rgba(0,0,0,.4)` | Ya existe como literal en `ScoreKeypad.tsx`; pasa a token | — |
| `--shadow-float` | `0 12px 32px rgba(22,23,15,.18)` | `0 12px 32px rgba(0,0,0,.5)` | Solo la tarjeta "En curso" que flota sobre la foto del hero, en escritorio | — |

Espaciado (§4 ya define la escala; ahora pasa a tokens): `--space-1` 4px · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-6` 24 · `--space-8` 32 · `--space-12` 48 · `--space-16` 64. Con Tailwind alcanza la escala nativa (`gap-2` = 8px…): **no hace falta declararlos** salvo para CSS plano.

Radios: se agrega `--radius-full: 9999px` (§4 lo nombra como `--r-full`, pero no existe en `@theme`).

`referencia/tokens.json` tiene la lista completa con la nota de uso de cada token, y `referencia/tokens.css` la tiene compilada.

### 2.3 Contraste medido (WCAG 2)

| Par | Claro | Oscuro | Mínimo |
|---|---|---|---|
| `ink` / `bg`·`surface`·`surface-2` | ≥ 15:1 | ≥ 13:1 | 7 (scoring) |
| `ink-muted` / `bg`·`surface`·`surface-2` | 6.6 · 6.6 · 5.77 | ≥ 6.07 | 4.5 |
| `nock-ink` / `nock` | 7.18 | 13.6 | 7 |
| `nock-text` / `bg`·`surface`·`surface-2` | 6.19 · 6.47 · 5.66 | 13.6 · 12.3 · 10.6 | 4.5 |
| `nock-text` / `nock-soft` | 5.68 | 9.88 | 4.5 |
| `ink` / `nock-soft` | 15.85 | 11.76 | 4.5 |
| `focus-ring` / `bg` | 6.19 | 13.6 | 3 |
| `line-strong` / `bg`·`surface`·`surface-2` | 3.73 · 3.89 · 3.41 | 4.37 · 3.94 · 3.39 | 3 |
| `danger-ink` / `danger` | 6.71 | ≈ 6 | 4.5 |
| `monte-ink` / `monte` | 17.4 | 17.4 | 4.5 |
| `monte-muted` / `monte` | 7.82 | 8.41 | 4.5 |
| `monte-accent` / `monte` | 13.6 | 14.7 | 3 |
| **Antes:** `nock` / `bg` (foco) | **2.59** ✗ | 13.6 | 3 |
| **Antes:** `line` / `bg` (borde de control) | **1.3** ✗ | 1.4 ✗ | 3 |
| **Antes:** blanco / `danger` | 6.71 | **≈ 3** ✗ | 4.5 |
| **Antes:** `bg` / `nock` (badge completado) | **2.59** ✗ | 13.6 | 4.5 |

Los cuatro "Antes" son los hallazgos `A-1`, `A-2`, `A-3` y `A-4`. **Cada par nuevo se agrega como caso** en `packages/ui/src/accion-primaria.test.ts` o en un test nuevo `contraste.test.ts`, que lee `tokens.css` como ya hace el de acción primaria.

---

## 3. Tipografía

### 3.1 Carga (`D-1`)

```bash
pnpm --filter @bal/ui add @fontsource-variable/archivo @fontsource-variable/martian-mono
```

Las dos son `5.3.0` al 2026-11-08 y se verificaron con `npm pack`. `wdth.css` declara `font-family: 'Archivo Variable'` con `font-weight: 100 900` y `font-stretch: 62% 125%`, y `'Martian Mono Variable'` con `font-weight: 100 800`. Los `woff2` se sirven desde el mismo origen, así que la CSP (`font-src 'self'`) no se toca.

```css
/* packages/ui/styles/tokens.css: arriba de todo, antes de @theme */
@import '@fontsource-variable/archivo/wdth.css';
@import '@fontsource-variable/martian-mono/wdth.css';

@theme {
  --font-display: 'Archivo Variable', system-ui, sans-serif;
  --font-sans: 'Archivo Variable', system-ui, sans-serif;
  --font-mono: 'Martian Mono Variable', ui-monospace, monospace;
  /* … */
}

/* Lo "expandido" es un eje de la misma familia, no otra familia. */
@utility font-display {
  font-family: var(--font-display);
  font-stretch: 125%;
  font-variation-settings: 'wdth' 125;
}
```

- Hay que reemplazar cada `font-[var(--font-display)]` del código por la utilidad `font-display` (hoy: `app/src/App.tsx`, `wafl/WaflApp.tsx`, `wafl/ResultsPage.tsx`, `wafl/ScoreKeypad.tsx` y `landing/src/pages/Home.tsx`; `grep -rn "font-display" packages/*/src` da la lista completa).
- **Verificar** que `@import` de un paquete funciona dentro de `tokens.css` en los dos builds (landing y app). Si Tailwind 4 no resuelve el `@import` desde `@bal/ui`, se importa en `app/src/styles/index.css` y en `landing/src/styles/index.css`, antes de `@import '@bal/ui/tokens.css'`.
- **Peso del bundle:** son ~90 KB (Archivo, latin) y ~38 KB (Martian Mono, latin) en `woff2`. Con `unicode-range` el navegador baja solo los subsets que usa. El service worker de la PWA las precachea con el resto de los assets: hay que **verificar** que `globPatterns` de `vite-plugin-pwa` incluya `woff2`. Sin eso, el primer render offline vuelve a la fuente del sistema.

### 3.2 Escala

Se agrega a `@theme` lo que falta de §3 y dos estilos nuevos:

| Token | Tamaño / interlineado / peso | Familia | Uso |
|---|---|---|---|
| `--text-hero` | 64px / .95 / 800, tracking −0.02em | display | **Nuevo.** Titular del hero de la landing en escritorio; 40px en celular |
| `--text-score` | 56px / 1 / 700 | display | Total del blanco, número del blanco |
| `--text-display` | 32px / 1.1 / 700 | display | h1 de página y h2 de sección en la landing (26px en celular) |
| `--text-h2` | 24px / 1.2 / 700 | display | Encabezado de sección en la PWA |
| `--text-h3` | 20px / 1.3 / 600 | sans | Nombre de arquero, título de tarjeta |
| (base) | 16px / 1.5 / 400 | sans | Texto. Nunca menos de 16px en un input |
| `--text-sm` | 14px / 1.45 / 400 | sans | Metadatos |
| `--text-mono` | 13px / 1.4, tracking .02em | mono | PIN, usuario, fechas cortas, contadores |
| `--text-eyebrow` | 12px / 1.3 / 600, tracking .08em, MAYÚSCULAS | mono | **Nuevo.** Rótulos de sección y de contexto ("ADMINISTRACIÓN", "BLANCO 1 DE 6") |

---

## 4. Componentes compartidos

Para cada componente: **dónde vive en el código**, la clase de referencia y los valores exactos. "Ref" = la clase en `referencia/componentes.css`.

### 4.1 Botón · `botonClases` en `app/src/components/ui.tsx` (+ el equivalente de la landing) · ref `.bal-btn`

| Variante | Fondo | Texto | Borde | Hover |
|---|---|---|---|---|
| `primario` | `--nock` | `--nock-ink` | — | `inset 0 0 0 999px rgba(255,255,255,.12)` |
| `secundario` | `--surface` | `--ink` | 1px `--line-strong` | fondo `--surface-2` |
| `fantasma` (**nueva**) | transparente | `--ink` | — | fondo `--surface-2` |
| `peligro` | `--danger` | `--danger-ink` | — | — |
| `sobreMonte` (**nueva**, solo landing y puerta) | transparente | `--monte-ink` | 1px `--monte-muted` | fondo `--monte-2` |

- Alto 52px (base), 44px (`tamaño: 'sm'`, solo acciones de fila o de encabezado) y 56px (`tamaño: 'lg'`, solo la landing). Padding horizontal de 20px, 14px en `sm` y 28px en `lg`. Radio `--radius-md`. Texto de 16px a 600, 15px en `sm` y 17px en `lg`. `gap` de 8px entre ícono y texto.
- `:active` → `translateY(1px)` en 80 ms `ease-out`. **Sacar** `hover:opacity-90 active:opacity-80`.
- **Deshabilitado:** fondo `--surface-2`, texto `--ink-muted`, borde `--line`, `cursor: not-allowed`. **Sacar** `disabled:opacity-40` (`A-5`).

### 4.2 Botón ícono · `BotonTema`, `CerrarSesion`, `BotonIcono` · ref `.bal-iconbtn`

44×44, `--radius-md` (antes `-sm`), fondo `--surface`, borde `--line`, hover `--surface-2`. Lleva siempre `aria-label` con lo que hace.

### 4.3 Campo · `Field` en `app/src/components/ui.tsx` · ref `.bal-field` / `.bal-input`

- Label de 14px a 600. Input de 52px, padding de 16px, texto de 16px, fondo `--surface`, **borde `--line-strong`**, radio `--radius-md`.
- Error: borde `--danger` de 2px y mensaje de 14px en `--danger`, con `IconoAviso` de 16px y `role="alert"`.
- Ayuda: 14px en `--ink-muted`.

### 4.4 Tarjeta · `clasesDeTarjeta` · ref `.bal-card`

Sin cambios de valores. Se agrega una sola regla: si la tarjeta es un enlace, el hover pasa el borde a `--line-strong`.

### 4.5 `BadgeEstado` · `ui/src/Chips.tsx` + `shared/src/estados.ts` · ref `.bal-status`

Píldora de 28px de alto, padding de 0 12px 0 10px, borde 1px `--line`, fondo `--surface`, texto de 13px a 600 en `--ink`. A la izquierda, un punto de 8px con `--st`:

| Estado | `--st` | `label` (admin) | `publico` (landing) |
|---|---|---|---|
| `sin_iniciar` | `--ink-muted` | Sin iniciar | — (no se muestra) |
| `en_proceso` | `--nock-text` + pulso | En curso | **En curso** (antes "En curso ahora", decisión 4) |
| `completado` | `--warn` | **Esperando publicación** (antes "Completado, sin publicar", decisión 4) | — |
| `publicado` | `--ok` | Publicado | Resultados oficiales |

- Pulso: `@keyframes` que anima `box-shadow 0 0 0 0 → 0 0 0 7px transparent` en 1.6 s, `infinite`. Se apaga con `prefers-reduced-motion`, que ya cubre el bloque global de `tokens.css`.
- **El color de cada estado sigue viniendo de `ESTADO_DE_TORNEO[status].color`**, para no romper `paleta.test.ts` (`/^var\(--[a-z-]+\)$/`). Lo que cambia es dónde se aplica: al punto, no al fondo. `en_proceso.color` pasa de `var(--warn)` a `var(--nock-text)`, y `completado.color` de `var(--nock)` a `var(--warn)`.
- Variante sobre monte (tarjeta flotante del hero): fondo `--monte-2`, borde `--monte-line`, texto `--monte-ink`; en vivo, `--monte-accent`.

### 4.6 `ModalityBar` (nuevo) · `ui/src/BarraDeModalidades.tsx` · ref `.bal-modbar`

- **Props:** `modalidades: readonly { modality: Modality; pct: number }[]` (lo que ya devuelve `distribucionDeModalidades` en el listado público), ordenadas de mayor a menor.
- Barra: `display:flex; gap:2px; height:8px; border-radius:9999px; overflow:hidden`, un `span` por modalidad con `flex: pct` y `background` = el color de `COLOR_DE_MODALIDAD`, pasado igual que los chips (`--chip` / `--chip-oscuro` + `data-chip`). `role="img"` y `aria-label="Distribución de modalidades: Campo 33%, 3D 33%, …"`.
- Leyenda: `flex-wrap; gap: 4px 12px`, texto de 13px en `--ink-muted`. Cada ítem lleva el ícono de modalidad de 14px en su color, el nombre (`SCORING[m].label`) y el `%` en `<b>` `--ink` 600.
- Reemplaza la fila de `ChipModalidad pct` en `TournamentCard` (landing y WAFA). `ChipModalidad` sigue existiendo para un blanco suelto.

### 4.7 `SectionHeader` (nuevo) · `ui/src/RotuloDeSeccion.tsx` · ref `.bal-section-head`

- **Props:** `titulo`, `cantidad?: number`, `accion?: { texto; href }`.
- Fila con `gap:8px`, `padding-bottom:8px` y borde inferior `--line`. Eyebrow en mono de 12px en mayúsculas y `--ink-muted`. Contador en píldora mono de 12px a 600, mínimo 22×22, fondo `--surface-2`. La acción va a la derecha (`margin-left:auto`), en `--nock-text` 600 de 14px con `IconoFlecha` de 16px.
- Es un `<h2>` (o el nivel que corresponda) con el estilo de eyebrow: semántica de encabezado y look de rótulo.

### 4.8 `TournamentCard` (nuevo, extraído) · `ui/src/TarjetaDeTorneo.tsx` · ref `.bal-tcard`

- Contenedor: `clasesDeTarjeta` con padding de 20px y `flex-col gap-3`; como enlace, el hover lleva el borde a `--line-strong`.
- Arriba: `BadgeEstado publico` a la izquierda y la fecha a la derecha (`formatearFechaCorta`, mono de 13px, `--ink-muted`).
- Título de 20px a 600 y metadatos de 14px en `--ink-muted`: "6 blancos · 8 arqueros · 3 patrullas" (la tercera parte solo si el dato existe).
- `ModalityBar`.
- Pie con borde superior `--line` y `padding-top` de 12px: a la izquierda qué vas a encontrar ("Ver en vivo" si está en proceso, "Podios y estadísticas" si está publicado, "Armar patrullas" en WAFA si no arrancó) y a la derecha `IconoFlecha` en `--nock-text`.
- **Variante WAFA en proceso:** el pie se reemplaza por una fila de `CircuitRing` de 36px, uno por patrulla, con "P1 · 4/6" en 12px `--ink-muted`.

### 4.9 `CircuitRing` (nuevo; `C-5`, §6.5) · `ui/src/AnilloDeRecorrido.tsx` · ref `.bal-ring`

- **Props:** `total`, `completados`, `inicio` (índice del blanco de inicio, para rotar), `tamaño` (36 · 44 · 76 · 120), `conEtiqueta?`.
- SVG con un arco por blanco, con un hueco de 4° entre arcos. El trazo es de 10px (120), 8px (76) o 5–6px (36–44). Pendiente en `--line`, completo en `--nock-text`. Un triángulo de 10×6 en `--ink` arriba marca el inicio.
- Etiqueta central (solo en 120): "N/M" en display de 28px y "BLANCOS" en mono de 11px.
- `role="img"` y `aria-label="N de M blancos cargados"`.
- Relleno de un segmento al completar: `stroke` en transición de 400 ms `ease-out` (§8).
- Implementación de referencia de la geometría: función `ring()` en `referencia/generador/componentes.py`.
- **Se usa solo** en: la tarjeta "En curso" del hero de la landing (dato real del detalle público: `patrols[].targetsCompleted` y `startTargetIndex`, con el total de patrullas sumado), el inicio de WAFL (el recorrido) y WAFA (uno por patrulla). Cumple §6.5: siempre con datos reales.

### 4.10 `StakeChip`, `ChipCategoria`, `ChipModalidad`

No cambian. En las filas de scoring se usa la variante compacta (24px, texto de 12px).

### 4.11 `SyncBadge` · `app/src/wafl/SyncBadge.tsx` · ref `.bal-sync`

Píldora de 44px de alto mínimo, padding de 0 12px, borde `--line`, texto de 13px a 600 en el color del estado (`--ok` · `--warn` · `--ink-muted` · `--danger`) y un ícono de 16px. Textos: "Al día", "N por enviar", "Sin señal · N guardados" y "No se pudo enviar". Sigue la lógica actual; solo cambia la piel.

### 4.12 `AppHeader` · `Encabezado` en `app/src/components/ui.tsx` · ref `.bal-appbar`

- 60px, sticky, fondo `--bg` y borde inferior `--line`. Padding de 0 12px 0 16px.
- Izquierda: volver como **flecha + texto** (`IconoVolver` + "Blancos"/"Inicio", 600, mínimo 44×44) o el `Logo` de 28px.
- Título en dos líneas: contexto en mono de 11px en mayúsculas y `--ink-muted` ("ADMINISTRACIÓN", "PATRULLA 1", "BLANCO 1 DE 6"), y la pantalla en 16px 600 con `text-overflow: ellipsis`.
- Derecha: `SyncBadge` (WAFL) o `IndicadorDeConexion` (WAFA), `BotonTema` y cerrar sesión.
- La prop nueva `contexto?: string` es la primera línea.

### 4.13 `UnitCard` · `app/src/wafl/ArrowRow.tsx` / `TargetPage.tsx` · ref `.bal-unit`

- Grilla de `1fr auto`, padding de 12px 16px, fondo `--surface`, borde `--line`, `--radius-lg`.
- **Activa:** borde de 2px `--nock-text` (con el padding compensado en 1px para que no salte).
- Nombre de 20px a 600. Debajo, en mono de 13px y `--ink-muted`: "UNIDAD A · TIRA 1º" y el `StakeChip` compacto.
- Total a la derecha, en display de 36px con `aria-live="polite"`, y "TOTAL" en mono de 11px. Sin flechas cargadas va "—".
- Casilleros de flecha de 48×48 con `--radius-md` y token en mono 600 de 16px. Vacío: borde punteado `--line-strong`. Cargado: fondo `--surface-2`. **Siguiente:** borde de 2px `--nock-text`.

### 4.14 `ScoreKeypad` · `app/src/wafl/ScoreKeypad.tsx` · ref `.bal-keypad` / `.bal-key`

- Panel: `--surface`, borde superior `--line`, radio `--radius-lg` arriba, `box-shadow: var(--shadow-dock)`, padding de 12px 12px 16px.
- Grilla de 4 columnas con gap de 8px. Teclas de **64px de alto** (decisión 6; el mínimo sigue en `TAMAÑO_TECLA_PX = 56`) con `--radius-md`, borde `--line-strong`, fondo `--surface-2` y cifra en display expandido de 26px a 700.
- Zona central (`innerToken`: X / 11 / X6): fondo `--nock`, texto `--nock-ink`, sin borde. `M`: fondo `--surface`, borde **punteado**, texto `--ink-muted`, siempre en la misma posición.
- `:active` → `scale(.96)` y fondo `--nock` en 80 ms.
- "Continuar" (52px, a todo el ancho) va **dentro del panel**, 12px debajo de la grilla, y el texto "Falta cargar: …" de 14px centrado en `--ink-muted` debajo del botón.
- No cambia nada de la lógica: ni `vibrate`, ni `disposicion`, ni el bloqueo.

### 4.15 `RoleCard` (nuevo, solo `/app`) · ref `.bal-role`

- Un enlace (`<Link>`) con grilla de `56px 1fr 24px`, gap de 16px, mínimo 96px de alto, padding de 16px, `--radius-lg`, borde 1px `--line-strong`, fondo `--surface` y hover `--surface-2`.
- **Principal** (líder): borde de 2px `--nock-text`.
- Ícono: placa de 56×56 con `--radius-md`, fondo `--monte` y glifo de 28px en `--monte-accent` (líder: `IconoEditar`; admin: `IconoPanel`).
- Título de 18px a 700, descripción de 14px en `--ink-muted`. Tag (solo líder): "FUNCIONA SIN SEÑAL", mono de 11px a 600 en `--nock-text`.
- Chevron de 20px en `--ink-muted`.
- **Nombre accesible:** el título va primero en el DOM, así que `getByRole('link', { name: 'Soy líder de patrulla' })` sigue encontrándolo (Playwright busca por subcadena salvo con `exact`).

### 4.16 `SiteHeader` · `Encabezado` en `landing/src/components/ui.tsx` · ref `.bal-sitebar`

- Sticky. Fondo `color-mix(in srgb, var(--bg) 92%, transparent)` con `backdrop-filter: blur(8px)` y borde inferior `--line`.
- Contenido con máximo de 1200px, alto de 64px, padding de 0 16px y gap de 24px.
- Marca: `Logo` de 32px + "Liga Bahiense" en display de 15px a 700 + "de Arquería" en 12px `--ink-muted` (se esconde debajo de 760px).
- Nav: "Inicio", "Ranking", "Torneos", "Sumate". Links de 44px de alto con padding de 0 12px, 500 en `--ink-muted` y hover con `--ink` sobre `--surface-2`. La activa (`aria-current="page"`) va en `--ink` 600, con una barra inferior de 3px en `--nock-text` pegada al borde del header. **Debajo de 760px la nav se esconde**: quedan marca + tema + Ingresar, y las secciones se recorren con scroll y desde el pie.
- Derecha: `BotonTema` + "Ingresar" (botón secundario `sm`, `enlaceEntreApps('app', …)`).

### 4.17 `Footer` · `ui/src/Footer.tsx` · ref `.bal-footer`

- **Estático, al final del documento** (`L-2`). Fondo `--surface`, borde superior `--line`.
- Grilla de `2fr 1fr 1fr`, máximo de 1200px, padding de 48px 16px 32px y gap de 32px. Debajo de 720px pasa a `1fr 1fr` y el primer bloque ocupa las dos columnas.
  1. Escudos de 44px: el CBA **sobre placa blanca literal** (como hoy; ver el comentario de `Footer.tsx`) con `alt="Círculo Bahiense de Arquería"` + el `Logo` con `alt=""`. Debajo, la descripción de 14px en `--ink-muted`: "Liga Bahiense de Arquería. Un torneo por mes en Bahía Blanca: recorridos multitarget con sala, aire libre, campo y 3D."
  2. "LA LIGA" (eyebrow): Ranking · Torneos · Sumate al padrón.
  3. "ACCESO" (eyebrow): **un solo enlace, «Ingresar a la app»**, a `/app/`. *(Cambiado el 2026-11-09, en `REF7-4`: la versión anterior traía «Líderes de patrulla · Administración», un acceso por rol que contradice la puerta única de `FUNCTIONAL.md` §5.1. El autor eligió la puerta única; ver la bitácora.)*
- Línea legal con borde superior y texto de 13px en `--ink-muted`: "Círculo Bahiense de Arquería · Bahía Blanca" a la izquierda y "Temporada 2026" en mono a la derecha (el nombre de la temporada activa, de `/api/public/seasons`).
- La variante `compacto` desaparece (decisión 5: no hay pie en la PWA).

### 4.18 Íconos nuevos · `ui/src/iconos/` (`C-6`)

Mismo `Svg` base (24px, trazo 1.8, `round`, `currentColor`, `aria-hidden`). El contenido de cada uno:

```tsx
IconoChevron:     <path d="m9 6 6 6-6 6"/>
IconoFlecha:      <path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>
IconoVolver:      <path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>
IconoSincronizar: <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M4 4v4h4M20 20v-4h-4"/>
IconoSinSenal:    <path d="M3 3l18 18"/><path d="M8.5 6.3A6 6 0 0 1 17.7 10H18a4 4 0 0 1 2.3 7.3"/><path d="M16 19H7a5 5 0 0 1-2.2-9.5"/>
IconoPanel:       <rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>
IconoPodio:       <path d="M3 20h18"/><path d="M5 20v-6h4.5v6"/><path d="M9.5 20V8h5v12"/><path d="M14.5 20v-9H19v9"/>
IconoArqueros:    <circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>
IconoCalendario:  <rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>
IconoLugar:       <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>
IconoInstalar:    <path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>
```

Van en `ui/src/iconos/acciones.tsx` (o en un `navegacion.tsx` nuevo) y se exportan desde `ui/src/index.ts`. El test de iconografía (§10) ya exige `aria-label` o `aria-hidden` en cada uso.

---

## 5. Pantallas

### 5.1 Landing `/` · [`Landing.html`](referencia/pantallas/Landing.html) · [`LandingMovil.html`](referencia/pantallas/LandingMovil.html)

**Layout de documento** (`L-2`): en `landing/src/App.tsx`, el contenedor `flex flex-col h-dvh overflow-hidden` y el `<main data-scroll-principal …overflow-y-auto>` pasan a un flujo normal (`<SiteHeader/> <main> <Footer/>`). El header es sticky y el pie va al final. **Migrar** `useTituloDePagina` para que, si no encuentra `[data-scroll-principal]`, haga `window.scrollTo({ top: 0 })`, y actualizar `landing/src/navegacion.test.tsx`, que hoy mide `principal().scrollTop`. La PWA sigue usando su contenedor.

Contenedor de secciones: `max-w-[1200px] mx-auto px-4`. Las secciones, en orden:

**1. Hero** (`<section>` a sangre, fondo `--monte`, `overflow:hidden`, relativo)
- Fondo: SVG de anillos de 900×900 con `right:-260px; top:-200px`. Cinco círculos concéntricos (r 390/310/230/150/70 en un viewBox de 800) con trazo de 2px `--monte-line`, y el interior de 3px `--monte-accent` al 50%. `aria-hidden`. En celular mide 560×560 con `right:-260px; top:-140px`.
- Grilla de `1.05fr 1fr`, gap de 48px, padding de 64px 16px y `max-w-[1200px]`. En celular, una columna con gap de 32px y padding de 48px 16px 64px.
- Columna izquierda:
  - Eyebrow en `--monte-muted`: "TEMPORADA 2026 · BAHÍA BLANCA" (el nombre de la temporada activa).
  - `h1` en `font-display`, `--text-hero` (64px; 40px en celular), `--monte-ink`: «La liga de **arquería** de Bahía Blanca.», con "arquería" en `--monte-accent`, sin itálica, y `&nbsp;` entre "Bahía" y "Blanca".
  - Bajada de 18px / 1.55 (16px en celular) en `--monte-muted` y máximo de 480px: «Un torneo por mes, un recorrido por el monte. Seguí los resultados en vivo, los podios de cada fecha y el ranking de tu categoría.»
  - CTAs (`gap` de 12px, `margin-top` de 32px; en celular, en columna y a todo el ancho): "Ver el ranking →" (primario `lg`, a `/ranking`) y "Torneos" (`sobreMonte` `lg`, a `/torneos`).
- Columna derecha: la foto `portada.webp` (`alt=""`, `width`/`height` y **`height:auto`**, `aspect-ratio` de 4/3.2, 4/3 en celular, `--radius-lg`, `loading="eager"`). Encima, la **tarjeta "En curso"**: `position:absolute; left:-32px; bottom:-28px; width:320px` (en celular `left:12px; right:12px; bottom:-40px`), fondo `--surface`, borde `--line`, `--radius-lg`, `box-shadow: var(--shadow-float)`, padding de 16px y grilla de `auto 1fr` con gap de 16px. Adentro: un `CircuitRing` de 76 (sin etiqueta) con el avance **agregado** de todas las patrullas, `BadgeEstado` "En curso", el nombre del torneo en 16px y "N patrullas en el recorrido" en 13px. Toda la tarjeta enlaza a `/torneos/:id`.
  - **Sin torneo en curso:** la tarjeta muestra la **última fecha publicada** ("Resultados oficiales", nombre y "Ver podios").
  - **Sin torneos:** no hay tarjeta.
  - **Sin foto** (decisión 1): la columna derecha desaparece y el hero queda en una columna.

**2. Cómo se juega** (`padding-top:64px; padding-bottom:48px`. **No usar** el shorthand `padding`, que pisa el `px-4` del contenedor: pasó en la referencia)
- Eyebrow "CÓMO SE JUEGA" y una grilla de 3 columnas con gap de 24px (1 columna en celular). Cada ítem lleva borde superior de 2px `--ink`, `padding-top` de 16px, número en mono de 12px `--ink-muted`, `h3` de 20px y texto de 15px `--ink-muted`:
  - 01 · **Un recorrido multitarget** · «Cada fecha es una vuelta por el predio con blancos de sala, aire libre, campo y 3D.»
  - 02 · **En patrullas** · «Grupos de 2 a 4 arqueros. El líder anota los puntajes desde el celular, con o sin señal.»
  - 03 · **Ranking por categoría** · «Suman las mejores fechas de la temporada, normalizadas para comparar recorridos distintos.»

**3. Torneos** (`padding-block` de 48px)
- `SectionHeader` "FECHAS DE LA TEMPORADA" + cantidad + "Ver todas →" (`/torneos`). `h2` en `font-display` 32px (26px en celular): "Torneos".
- Grilla de 3 columnas con gap de 16px (1 en celular) y hasta 3 `TournamentCard`, del más reciente al más viejo, en proceso primero. Datos: `GET /api/public/tournaments` (`id`, `name`, `date`, `status`, `targetCount`, `participantCount`, `modalities`).
- Vacío: «Todavía no hay fechas publicadas esta temporada.» + enlace a "Sumate al padrón".

**4. Ranking** (`padding-block` de 48px)
- `SectionHeader` "RANKING DE LA LIGA" + "Ranking completo →". `h2`: "Quién va adelante".
- Grilla de `320px 1fr` con gap de 32px (en celular, una columna con las pestañas en una fila con scroll horizontal).
  - Izquierda: pestañas por categoría (`<nav aria-label="Categorías">`). Ítems de 48px con `--radius-md`: ícono de categoría en su color + nombre en `--ink` + cantidad en mono `--ink-muted` (la cantidad se esconde en celular). La activa va sobre `--nock-soft` a 600, con `aria-current="true"`.
  - Derecha: tabla del top 5 (ref `.bal-rank`) con las columnas "#", "Arquero" (enlace a `/arqueros/:id`), "Fechas" (mono, "3/3") y "Puntos" (mono 600, a la derecha, `normalizedPct` con coma decimal). Filas de 56px. Las posiciones 1–3 van en un círculo de 32px sobre `--nock-soft`, **sin oro/plata/bronce** (el amarillo y el naranja son estacas).
- Datos: `GET /api/public/seasons` → la activa → `GET /api/public/rankings?seasonId=…` (`categories[]`). Se respetan las pestañas de sexo de `FE-28` en la página `/ranking` completa; en la portada se muestra "General".

**5. Modalidades** (`padding-block` de 48px)
- `SectionHeader` "MODALIDADES". `h2`: "Cuatro escenarios, un recorrido".
- Grilla de 4 columnas con gap de 16px (2 en celular). Cada tarjeta (`--surface`, borde `--line`, `--radius-lg`, padding de 24px 16px) lleva una placa de 48px `--radius-md` sobre `--surface-2` con el glifo de 26px en su `COLOR_DE_MODALIDAD`, el `h3` de 18px, la descripción de 14px `--ink-muted` y los valores de flecha como fichas mono de 12px (24px de alto, borde `--line`) **leídos de `SCORING[m].scoringSet`**, no escritos a mano:
  - Sala 18 m · «Bajo techo, cara de 10 zonas.»
  - Aire libre · «Distancia larga según la estaca.»
  - Juego de campo · «Cara negra con centro amarillo.»
  - 3D · «Siluetas de animales en el monte.»
  - Si el set tiene más de 7 tokens, se muestran los 4 primeros, "…" y los 2 últimos.

**6. Sumate al padrón**
- Banda `--nock-soft` con `--radius-lg`, padding de 48px 32px y `margin` de 48px 0 64px, en una fila con `space-between` (en celular, en columna, con padding de 32px 24px y el botón a todo el ancho).
- `h2` en `font-display` 32px: "Sumate al padrón". Texto en `--ink`: «Dejá tus datos y el club revisa tu alta antes de habilitarla. Después ya podés competir en la próxima fecha.»
- Botón primario `lg`: "Sumarme al padrón →" a `/alta`.

**7. Footer** (§4.17).

### 5.2 Otras páginas de la landing

Mismo header, pie y contenedor. Cambios de piel, **no de contenido**:
- **Torneos** (`/torneos`): `h1` en `font-display` 32px + `SectionHeader` por estado + grilla de `TournamentCard` (2 columnas en tablet, 3 en escritorio).
- **Torneo** (`/torneos/:id`): `h1` + `BadgeEstado` + fecha. En proceso, un `CircuitRing` de 44 por patrulla. Las pestañas existentes (puntajes, patrullas, estadísticas) van con el mismo estilo que las de ranking (activa sobre `--nock-soft`).
- **Ranking** (`/ranking`): las pestañas de categoría y sexo con el mismo estilo, y la tabla `.bal-rank`.
- **Ficha de arquero** y **tarjeta de puntajes**: `h1` en `font-display`, chips y tablas `.bal-rank`, cifras en mono.
- **Alta** (`/alta`): `Field` nuevo (borde `--line-strong`), botón primario a todo el ancho en celular.

### 5.3 Puerta `/app` · [`Puerta.html`](referencia/pantallas/Puerta.html) · [`PuertaMovil.html`](referencia/pantallas/PuertaMovil.html)

`app/src/App.tsx` → `Elegir`. Sin `Encabezado` ni `Footer`.

- Grilla de `1fr 1fr` con `min-height:100dvh`. En celular, una columna sin altura mínima.
- **Panel izquierdo** (`<aside>`, fondo `--monte`, `--monte-ink`, padding de 48px, `flex-col justify-between`, `overflow:hidden`). En celular es una banda superior con padding de 24px 16px 32px y gap de 32px.
  - Anillos (el mismo SVG del hero), 760×760 con `right:-380px; top:-300px` (420×420 con `right:-200px; top:-200px` en celular). **No pueden pasar por detrás del texto**: en la primera versión cruzaban el titular.
  - Marca: `Logo` de 44px + "Liga Bahiense" en display 700 + "de Arquería" en 13px `--monte-muted`.
  - Promesa (abajo): `h2` en `font-display` 44px a 800 (30px en celular): «Anotá, sincronizá y **publicá**.», con "publicá" en `--monte-accent`. Debajo, en `--monte-muted` y con máximo de 420px: «La app del día del torneo. Guarda todo en el celular y envía cuando hay señal.»
- **Columna derecha** (`<main>`, centrada, padding de 48px 32px; en celular 24px 16px 32px, arriba). Caja con máximo de 440px y `flex-col gap-3`:
  - Eyebrow "INGRESAR". `h1` en `font-display` 32px (24px en celular): «¿Cómo entrás hoy?». Es el foco de `useTituloDePagina`.
  - `RoleCard` principal → `/wafl`: "Soy líder de patrulla" · "Anotá los puntajes del recorrido." · tag "FUNCIONA SIN SEÑAL".
  - `RoleCard` → `/wafa`: "Soy administrador" · "Torneos, patrullas, padrón y publicación."
  - `VolverALaLiga` como enlace `--nock-text`: "← Ver resultados y rankings".
  - `InstalarApp` como tarjeta con borde punteado `--line-strong` y `--radius-lg`, padding de 12px 16px. Lleva `IconoInstalar` de 24px en `--nock-text`, "**Instalá la app**" con «Abre directo acá y funciona sin señal.» en 13px `--ink-muted`, y el botón secundario `sm` "Instalar". **Se mantiene toda la lógica actual** (`beforeinstallprompt` y la explicación de iOS): solo cambia la piel. Si ya está instalada o no se puede instalar, no se muestra (como hoy).
  - Pie de la caja, en 12px `--ink-muted`: "Círculo Bahiense de Arquería" y la versión de la app en mono (de `registroDeVersion`, si está disponible; si no, se omite).

### 5.4 WAFA · Inicio · [`WafaInicio.html`](referencia/pantallas/WafaInicio.html)

`app/src/wafa/pages/Home.tsx`. Cambios simples:
1. `AppHeader` con `contexto="Administración"` y título "Inicio".
2. "Crear torneo" (primario, a todo el ancho, `IconoAgregar`).
3. Tres accesos en una grilla de 3 columnas con gap de 8px. Cada uno es una tarjeta-enlace de 88px de alto mínimo con padding de 12px, ícono de 20px en `--nock-text` arriba, nombre de 15px a 600 y el dato en mono de 11px `--ink-muted`:
   - Arqueros · `IconoArqueros` · "42 · 2 altas" (cantidad + altas pendientes de `FE-30`, si las hay).
   - Temporadas · `IconoCalendario` · nombre de la activa.
   - Ranking · `IconoPodio` · "8 categorías".
   Si un dato no está disponible sin una consulta nueva, va solo el nombre: **no se agrega ningún endpoint para esto**.
4. Las secciones por estado usan `SectionHeader` con su cantidad y el texto de `ESTADO_DE_TORNEO[s].plural`. Vacío: una tarjeta de borde punteado con un texto que dice qué va a aparecer. Para "Esperando publicación": «Cuando una patrulla cierre su circuito, el torneo aparece acá para publicar.» Para el resto, `ESTADO_DE_TORNEO[s].vacio`.
5. `TournamentCard` (variante WAFA). En proceso lleva un `CircuitRing` de 36 por patrulla. Los datos ya están en lo que trae la pantalla de torneo; si en el inicio no están, se muestra el pie normal.
6. Sin `Footer`.

El resto de WAFA solo hereda los componentes: botones, campos, `BadgeEstado`, `SectionHeader`, `AppHeader` y sin pie.

### 5.5 WAFL · Blanco · [`WaflBlanco.html`](referencia/pantallas/WaflBlanco.html)

`app/src/wafl/TargetPage.tsx`. **No se toca la lógica offline ni el orden de carga** (`FE-6`, regla 4).
1. `AppHeader`: "← Blancos", `contexto="Patrulla 1"`, título con el nombre del torneo y `SyncBadge` a la derecha.
2. Encabezado del blanco (padding de 16px 16px 8px, gap de 16px): número en `font-display` de 56px a 800 con `aria-label="Blanco 1"`, y al lado, en columna, el `ChipModalidad` + "2 flechas · Jabalí · 1 de 6" en 14px `--ink-muted`.
3. Lista de `UnitCard` (gap de 12px), en el orden actual.
4. Teclado (§4.14) en `position: sticky; bottom: 0`, con "Continuar" adentro.
5. **Sin `Footer`** (`F-1`).

**CircuitPage** (recorrido): `CircuitRing` de 120 arriba de la lista de blancos y la lista sin el botón "Cerrar sesión" al final (`F-4`; cerrar sesión queda en el encabezado). **ResultsPage**: sin pie; las firmas con el `h1` en `font-display`.

---

## 6. Copy nueva (literal)

| Dónde | Texto |
|---|---|
| Hero eyebrow | TEMPORADA {año} · BAHÍA BLANCA |
| Hero h1 | La liga de arquería de Bahía Blanca. |
| Hero bajada | Un torneo por mes, un recorrido por el monte. Seguí los resultados en vivo, los podios de cada fecha y el ranking de tu categoría. |
| Hero CTAs | Ver el ranking · Torneos |
| Tarjeta en curso | En curso · {torneo} · {n} patrullas en el recorrido |
| Cómo se juega | ver §5.1-2 |
| Torneos | FECHAS DE LA TEMPORADA · Torneos · Ver todas · Ver en vivo · Podios y estadísticas |
| Ranking | RANKING DE LA LIGA · Quién va adelante · Ranking completo |
| Modalidades | MODALIDADES · Cuatro escenarios, un recorrido |
| Sumate | Sumate al padrón · Dejá tus datos y el club revisa tu alta antes de habilitarla. Después ya podés competir en la próxima fecha. · Sumarme al padrón |
| Footer | LA LIGA · ACCESO · Ingresar a la app · Círculo Bahiense de Arquería · Bahía Blanca |
| Puerta | Anotá, sincronizá y publicá. · La app del día del torneo. Guarda todo en el celular y envía cuando hay señal. · INGRESAR · ¿Cómo entrás hoy? · Soy líder de patrulla · Anotá los puntajes del recorrido. · FUNCIONA SIN SEÑAL · Soy administrador · Torneos, patrullas, padrón y publicación. · Ver resultados y rankings · Instalá la app · Abre directo acá y funciona sin señal. · Instalar |
| WAFA | Administración · Esperando publicación · Cuando una patrulla cierre su circuito, el torneo aparece acá para publicar. |
| Estados | En curso · Esperando publicación (ver §4.5) |
| SyncBadge | Al día · {n} por enviar · Sin señal · {n} guardados · No se pudo enviar |

Todo en voseo y con mayúscula solo al principio de la oración, sin signos de exclamación (§6.8).

---

## 7. Movimiento

Sin cambios respecto de §8, más una línea: el **pulso de "En curso"** dura 1.6 s, es `ease-out` e `infinite`, y se apaga con `prefers-reduced-motion`.

---

## 8. Archivos de referencia

| Archivo | Qué es |
|---|---|
| `referencia/index.html` | Índice navegable de pantallas y componentes |
| `referencia/pantallas/*.html` | Las 6 pantallas propuestas. Usan los assets reales de `packages/ui/assets/` por ruta relativa |
| `referencia/componentes/*.html` | Los 20 componentes con sus estados |
| `referencia/componentes.css` | Las clases `bal-*` con los valores exactos de §4 |
| `referencia/tokens.json` | Todos los tokens con su nota de uso (formato del Design System) |
| `referencia/tokens.css` | Los tokens compilados para claro y oscuro + `@font-face` |
| `referencia/fonts/*.woff2` | Archivo y Martian Mono variables (latin), copiadas de `@fontsource-variable` 5.3.0, **solo para que la referencia renderice**. El código usa el paquete npm |
| `referencia/capturas/*.webp` | Renders a 1280/390 px en claro y oscuro |
| `referencia/generador/*.py` | El script que generó las previews (incluye la geometría del `CircuitRing` en `ring()`). Es solo referencia: no se ejecuta en CI |
