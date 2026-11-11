# Sistema de diseño — BV Bahía Archers League

---

## 1. Dirección

La app se usa **caminando por el monte, con guantes, al sol de la mañana**. Eso no es un detalle de accesibilidad: es la restricción que define el lenguaje visual entero.

La dirección sale de los objetos reales del deporte, no de una paleta de moda:

- **La cara de blanco de campo** es negra con centro amarillo. Es, sin coincidencia, la combinación de mayor contraste que existe en el equipamiento de arquería — porque tiene que leerse a 50 metros bajo el sol. Ese mismo par gobierna la interfaz.
- **Las estacas roja, azul y amarilla** son objetos físicos clavados en el piso que determinan dónde se para cada arquero. En esta app esos tres colores son **semántica reservada**: significan estaca y nada más.
- **El verde fluorescente del nock** es el color que los arqueros eligen para poder encontrar sus flechas en el pasto. Es el color más encontrable que existe en la cancha. Es el color de la acción primaria.
- **Los anillos concéntricos** del blanco son la estructura del deporte. Son el elemento de firma de la interfaz (§7).
- **La banda `monte`** (`ref-7`): la cara negra del blanco de campo como superficie de identidad. Es oscura en los dos temas y lleva encima el chartreuse pleno. Va en el hero de la landing y en el panel de la puerta `/app`, **nunca dentro de WAFA ni de WAFL**, donde manda el fondo claro que gana bajo el sol.

> **Agregado en `ref-7`.** Sobre la banda `monte` van **anillos concéntricos de fondo** (`AnillosDeFondo`, en `--monte-line`, el interior en `--monte-accent` al 50%). Son decoración, van `aria-hidden` y **no portan datos**: no rompen §6.5, que reserva el anillo con datos (`AnilloDeRecorrido`) a sus lugares. Nunca pasan por detrás del texto (en la puerta se miden con geometría a 360, 390, 768, 1024 y 1280 px).

Lo que se evita deliberadamente: fondo crema con serif de alto contraste, negro con un único acento ácido, y retículas tipo diario con filetes finos. Son defaults, no decisiones.

---

## 2. Color

### 2.1 Tokens base

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#FBFAF5` | `#16170F` | Fondo de página |
| `--surface` | `#FFFFFF` | `#1F211A` | Tarjetas, paneles |
| `--surface-2` | `#F1F0E8` | `#2A2D24` | Fondos anidados, filas alternas |
| `--ink` | `#16170F` | `#F4F3EC` | Texto principal |
| `--ink-muted` | `#5A5F4E` | `#A8AD99` | Texto secundario, etiquetas |
| `--line` | `#DEDDD2` | `#333629` | Bordes, divisores |
| `--nock` | `#8FA800` | `#c6f000` | **Acción primaria** |
| `--nock-ink` | `#0D0E05` | `#16170F` | Texto sobre `--nock`. **Oscuro en los dos temas** |
| `--danger` | `#B3200E` | `#F06449` | Errores, acciones destructivas |
| `--warn` | `#8A5A00` | `#E8A33D` | Pendiente de sincronizar, advertencias |
| `--ok` | `#2F6B2F` | `#7CC47C` | Sincronizado, completo |

**Tokens agregados en `REF7-2`** (ningún valor de arriba cambió):

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--line-strong` | `#7F8372` | `#7A7F6C` | Borde de **todo lo que se toca**: inputs, botón secundario, teclas, tarjeta de rol. `--line` daba 1.3:1 |
| `--nock-text` | `#556500` | `#C6F000` | El verde cuando tiene que **leerse**: enlaces, sección activa, segmentos del anillo, unidad activa |
| `--nock-soft` | `#EEF4CC` | `#2C3410` | Tinte de selección: pestaña activa, podio, banda «Sumate al padrón» |
| `--focus-ring` | `#556500` | `#C6F000` | Anillo de foco (§10) |
| `--danger-ink` | `#FFFFFF` | `#16170F` | Texto sobre `--danger`. Blanco sobre el rojo oscuro daba ≈3:1 |
| `--monte` | `#16170F` | `#0D0E05` | Banda de identidad (§1) |
| `--monte-2` | `#1F211A` | `#16170F` | Superficie elevada sobre `monte` |
| `--monte-line` | `#333629` | `#2A2D24` | Anillos de fondo |
| `--monte-ink` | `#F4F3EC` | `#F4F3EC` | Texto sobre `monte` |
| `--monte-muted` | `#A8AD99` | `#A8AD99` | Texto secundario sobre `monte` |
| `--monte-accent` | `#C6F000` | `#C6F000` | Palabra destacada, anillo interior, punto vivo |

El negro no es negro puro: `#16170F` tiene una caída olivácea. Es el negro de la cara de campo y la sombra del monte. El papel no es crema: `#FBFAF5` es claro y casi neutro, para exprimir la luminancia máxima de la pantalla bajo el sol.

`--nock` cambia de tono entre temas a propósito. El chartreuse fluorescente `#c6f000` es glorioso sobre fondo oscuro e ilegible sobre blanco; en tema claro se oscurece a `#8FA800`.

> **La tinta encima es oscura en los dos temas, y esto estuvo mal escrito hasta `REF5-5`.** Este párrafo afirmaba que `#8FA800` «llega a contraste AA», pero la tinta que tenía al lado era blanca y el par daba **2.70:1** — ni AA ni cerca. Afectaba a todo botón primario de las tres apps, en el tema claro, que es el default de WAFL. Con `#0D0E05` el par llega a **7.18:1**, que es el AAA que §2.4 exige en scoring.
>
> Se cambió la tinta y **no** el verde: `--nock` también dibuja el anillo de foco sobre el fondo claro, y aclararlo lo habría empeorado. Lo verifica `packages/ui/src/accion-primaria.test.ts`, que lee `tokens.css`.
>
> **Corregido en `REF7-2`:** el foco **ya estaba** por debajo: `#8FA800` sobre `#FBFAF5` da **2.59:1** y WCAG 2.4.11 pide 3:1. Desde `REF7-2` el foco usa `--focus-ring` (§10) y `--nock` queda sólo para la acción primaria.

### 2.2 Colores de estaca — reservados

```css
--stake-roja:     #D22B2B;
--stake-azul:     #1D5FD6;
--stake-amarilla: #F5C518;
```

**Regla absoluta: estos tres colores no se usan para nada más.** Ni para botones, ni para estados, ni para gráficos, ni para decorar. Si aparece rojo en la pantalla, es una estaca. Es lo que permite que el líder identifique la estaca de un vistazo, sin leer, con el sol de frente.

El color nunca va solo: el chip de estaca lleva **siempre** el nombre escrito. Un daltónico lee "Azul"; el resto ve el color. Ninguno de los dos depende del otro.

### 2.3 Colores de categoría y de modalidad

> **Esta sección se revirtió en `REF2-1`.** Antes decía que la modalidad se distinguía *«de forma, no de color»*, porque «el color está saturado de significado con las estacas; agregar cuatro colores más lo arruinaría». Con la app en la mano, encontrar la categoría de un arquero en una lista de veinte, o la modalidad de un blanco en un recorrido de catorce, sale demasiado lento leyendo texto.
>
> La advertencia era correcta y sigue en pie. Lo que cambió es que ahora hay **tres candados** en lugar de una prohibición.

Los valores viven en `@bal/ui/src/paleta.ts`, no en este documento: un color que se copia a mano a un `.md` se separa del que compila.

**Candado 1 · El color nunca va solo.** Cada chip lleva su ícono y su texto. El color acelera el reconocimiento de algo que **ya está escrito**; no lo reemplaza. Es §10 aplicado sin excepción, y hay un test por categoría y por modalidad que lo comprueba.

**Candado 2 · Categoría y modalidad se distinguen por forma.** La categoría es una **píldora**; la modalidad, un **rectángulo**. Por eso los dos ejes pueden compartir familia de color sin confundirse: nunca dicen lo mismo y nunca se ven iguales.

Esto no es un adorno, es una necesidad aritmética. Excluyendo rojo, azul y amarillo —reservados por §2.2— quedan **seis familias de tono** utilizables para **once** valores. Sin la distinción de forma, el reparto no cierra.

**Candado 3 · Otro registro visual.** Los tonos de estaca son saturados **a propósito**, para encontrarlos con el sol de frente. Los de categoría y modalidad son sordos, sobre fondo teñido y no en bloque. Pertenecen a otra capa de la interfaz y no compiten por esa atención.

| Familia | Categorías | Modalidades |
|---|---|---|
| Teal | Recurvo olímpico | Aire libre |
| Violeta | Compuesto libre | Sala |
| Magenta | Compuesto cazador | — |
| Verde | Razo, Longbow | Juego de campo |
| Tierra apagada | Tradicional | 3D |
| Neutro | Escuela | — |

`escuela` es la única **neutra**, y no por falta de tonos: es la única categoría que no es senior y la única que no puntúa para el ranking. Que no tenga color propio dice eso mismo sin una nota al pie.

**Dos tests sostienen todo esto**, y los dos fallan con valores que a ojo parecen razonables:

- Cada color llega a **AA contra el fondo de su tema**.
- Ningún color se confunde con una estaca: no puede estar a menos de 25° de tono **y** ser saturado a la vez. Un tierra apagado no se lee como «roja»; un rojo vivo sí.

> El segundo test rechazó tres de los once colores del primer intento. El oliva de `razo` estaba a 22° del amarillo de estaca con saturación 1,0 — un oliva **es** un amarillo oscuro—, y lo mismo el marrón de `tradicional` y el óxido de `3d` respecto del rojo. No se veían mal; se veían como estacas.

Los glifos de modalidad siguen siendo los mismos, y ahora también hay uno por categoría:

| Modalidad | Glifo | | Categoría | Glifo |
|---|---|---|---|---|
| Sala | Anillos concéntricos | | Compuesto libre | Mira de scope con un pin |
| Aire libre | Sol sobre el horizonte | | Compuesto cazador | Anillo de mira con tres pines |
| Juego de campo | Terreno con pinos | | Razo | Flecha con emplumado |
| 3D | Silueta de animal | | Recurvo olímpico | Arco con estabilizador |
| | | | Tradicional | Arco de palas recurvadas |
| | | | Longbow | Arco largo en D |
| | | | Escuela | Diana con la flecha en camino |

### 2.4 Contraste

Mínimo **AA (4.5:1)** en todo texto. **AAA (7:1)** en la pantalla de scoring y en los números de puntaje — es la que se lee bajo el sol.

Verificado en ambos temas para cada par de tokens. Ningún par de tokens del §2.1 puede combinarse fuera de la tabla sin volver a verificar.

Desde `REF7-2`, **`packages/ui/src/contraste.test.ts`** mide cada par que la interfaz usa junto, en los dos temas, leyendo `tokens.css`: texto 4.5:1 (7:1 en scoring), bordes, foco y marcas 3:1. Un par nuevo se agrega ahí antes de usarse. Conocido y fuera del test: `--danger` como **texto** sobre `--surface-2` en oscuro da 4.42:1 (hoy no hay texto de error sobre `surface-2`).

---

## 3. Tipografía

Tres roles, dos familias.

| Rol | Familia | Por qué |
|---|---|---|
| **Display** | **Archivo** al 125% de ancho (600, 700, 800) | Grotesca ancha y robusta. Lee como cartelería de cancha. Sus cifras son inconfundibles a distancia y con glare: el `6` y el `8` no se parecen, el `1` tiene base. |
| **Cuerpo** | **Archivo** (400, 500, 600) | Misma superfamilia, ancho normal. Cohesión sin monotonía. Excelente en tamaños chicos. |
| **Datos** | **Martian Mono** (400, 600) | Etiquetas técnicas: usuario de patrulla, PIN, número de blanco, contadores. Ancho fijo, lectura de "equipamiento marcado". |

Ambas son de Google Fonts, **autohospedadas** en `woff2` con `font-display: swap`. La CSP prohíbe pedidos a hosts externos (ver [`SECURITY.md`](SECURITY.md) §10) y además no queremos depender de la red para renderizar texto.

> **Corregido en `REF7-1`: hasta ahí las fuentes nunca cargaron.** No había un solo `@font-face` en el repo y todo se veía en la fuente del sistema. Y **«Archivo Expanded» no es una familia**: Archivo es una fuente variable con eje de ancho (`wdth`, 62–125), y lo expandido es ese eje al 125%. Ahora `@fontsource-variable/archivo` y `@fontsource-variable/martian-mono` se importan al principio de `packages/ui/styles/tokens.css`; las familias son `'Archivo Variable'` y `'Martian Mono Variable'`, y la utilidad **`font-display`** pone la familia y `font-stretch: 125%` (nunca `font-[var(--font-display)]`, que cambia la familia pero no el ancho). La PWA precachea sólo el subset `latin`, que cubre el castellano; lo verifica `scripts/presupuesto.mjs`.

### Escala

Base `16px`. Ratio 1.25 para cuerpo, saltos mayores para display.

| Token (utilidad) | Tamaño | Line-height | Uso |
|---|---|---|---|
| `--text-hero` (`text-hero`) | `64px` | 0.95, 800, tracking −0.02em | Titular del hero de la landing (40px en celular). **Nuevo en `ref-7`** |
| `--text-score` (`text-score`) | `56px` | 1.0 | Número del blanco y puntajes grandes |
| `--text-display` (`text-display`) | `32px` | 1.1 | Títulos de página (26px en las secciones de la portada en celular) |
| `--text-h2` (`text-h2`) | `24px` | 1.2, 700 | Encabezados de sección |
| `--text-h3` (`text-h3`) | `20px` | 1.3, 600 | Nombres de arquero, títulos de tarjeta |
| (base) | `16px` | 1.5 | Texto general. **Nunca menos de 16px en un input** (iOS hace zoom debajo de eso) |
| `--text-sm` (`text-sm`) | `14px` | 1.45 | Metadatos |
| `--text-mono` (`text-mono`) | `13px` | 1.4, `letter-spacing: 0.02em` | Etiquetas de datos |
| `--text-eyebrow` (`text-eyebrow`) | `12px` | 1.3, 600, `letter-spacing: 0.08em` | Rótulos de sección y de contexto, en mono y mayúsculas. **Nuevo en `ref-7`** |

> **Corregido en `REF7-2`.** El documento nombraba `--t-*`, pero en `tokens.css` sólo existían `--text-score` y `--text-display`, y se usaban como `text-[var(--text-display)]`: con un `var()` en un valor arbitrario Tailwind 4 asume que es un **color** y el tamaño no se aplicaba (los `h1` medían 16px). Ahora la escala completa está en `@theme` y se usa por utilidad. Un test en `ui/src/fuentes.test.ts` prohíbe `text-[var(--text-…)]` en los `.tsx`.

**`font-variant-numeric: tabular-nums` en todo número que pueda cambiar.** Un total que salta de ancho al pasar de 99 a 100 hace que la pantalla parezca temblar.

---

## 4. Espaciado, radios y elevación

Escala de 4px: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | `6px` | Chips, enlaces de navegación |
| `--radius-md` | `12px` | Botones, inputs, teclas, botones de ícono |
| `--radius-lg` | `20px` | Tarjetas, panel del teclado |
| `--radius-full` | `9999px` | Píldoras (estado, sincronización, contador) |

> **Corregido en `REF7-2`:** el documento los llamaba `--r-*` y `--r-full` no existía en `@theme`. Los nombres de arriba son los de `tokens.css`.

Elevación por **borde y fondo**, no por sombra. Las sombras se disuelven bajo el sol; un borde de 1px en `--line` se ve siempre. Hay **dos** sombras reales, las dos como token:

- `--shadow-dock` — el panel del teclado de scoring anclado abajo, para separarlo del contenido que scrollea (antes era un literal en `ScoreKeypad.tsx`).
- `--shadow-float` — **sólo** la tarjeta «En curso» que flota sobre la foto del hero de la landing, y sólo en escritorio. Agregada en `ref-7`.

---

## 5. Objetivos táctiles — la regla que manda

| Elemento | Mínimo |
|---|---|
| **Teclas del teclado de scoring** | **56 × 56 px** |
| Botones de acción primaria | 52 px de alto |
| Todo lo demás tocable | 44 × 44 px |
| Separación entre objetivos adyacentes | ≥ 8 px |

56px no es un número redondo elegido al azar: es lo que hace falta para acertar con guante de tiro, caminando, sin mirar de cerca. **Si un componente no llega, se rediseña el componente, no se baja el número.**

---

## 6. Componentes

### 6.1 `ScoreKeypad`
El componente más importante del sistema. Se adapta a la modalidad **del blanco**, no del torneo.

- **3D** (`11 10 8 5 M`) y **campo** (`6 5 4 3 2 1 M`): disposición en **arcos concéntricos** que espejan la cara de blanco real. El 11 y el 6 están al centro; los valores menores, hacia afuera. La memoria espacial de lo que el arquero acaba de mirar en el blanco se traslada a la pantalla.
- **Sala** y **aire libre** (12 tokens): grilla de 4 columnas. Doce zonas no caben en anillos legibles; acá gana la grilla.
- `M` siempre en la misma posición, siempre visualmente distinto del resto (desde `REF7-10`, con borde punteado sobre `--surface`).
- **Teclas de 64px de alto** (`REF7-10`, decisión 6 de `ref-7`): `TAMAÑO_TECLA_PX` sigue en 56 como **mínimo**. Cifra en display expandido de 26px; al tocarla se achica (`scale(.96)`) y se enciende en `--nock`. El panel (`--surface`, `--shadow-dock`, «Continuar» y «Falta cargar» adentro) lo arma `TargetPage`.
- Feedback háptico (`navigator.vibrate(10)`) en cada toque, si el dispositivo lo soporta.
- Sin estado de carga. Nunca. Ver [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §12.

> **Riesgo asumido y su salida.** La disposición en arcos es una apuesta: es más rápida si el mapeo espacial funciona, y más lenta si no. **Se valida con arqueros reales en una fecha de prueba antes de darla por buena.** Si no gana contra la grilla, se cambia a grilla en las cuatro modalidades. El componente se construye con las dos disposiciones detrás de una prop para que el cambio sea de una línea.

### 6.2 `StakeChip`
Color de estaca + nombre escrito, siempre juntos. Alto 28px, radio `--r-full`.

### 6.3 `UnitCard`
La unidad de tiro (par `A` o `B`): los dos arqueros, quién a la izquierda y quién a la derecha, la estaca, y cuál unidad tira primero. `A` lleva un indicador de orden.

> **Implementada en `REF7-10`** (`app/src/wafl/ArrowRow.tsx`), como una tarjeta por arquero: nombre a 20px; «UNIDAD A · TIRA 1º» en mono con la estaca compacta en la misma línea; el **total** en display de 36px con `aria-live`; casilleros de flecha de 48px de alto en mono (se angostan si no entran: seis flechas de aire libre a 360px) y el **próximo a cargar** marcado con 2px de `--nock-text`. La activa lleva borde de 2px en `--nock-text` con un pixel menos de relleno, para que no salte.

### 6.4 `SyncBadge`
Fijo en el encabezado de WAFL. Cuatro estados (`--ok` · `--warn` · `--ink-muted` · `--danger`), cada uno con **icono, color y texto**. Se toca para abrir el panel de detalle. Nunca bloquea.

> **Desde `REF7-4`** es una píldora de 44px con borde `--line` y un ícono por estado (tilde, sincronizar, sin señal, aviso). **Textos cortos desde `ref-7`** (consultado con el autor): «Al día», «N por enviar», «Sin señal · N guardados» y «No se pudo enviar · <motivo>». Los largos truncaban la patrulla y el torneo del encabezado del blanco a 390px. El motivo del error se conserva: si no entra, la píldora (tope de `min(14rem, 45vw)`) lo trunca a la vista y queda completo para el lector de pantalla y en el `title`.

### 6.5 `CircuitRing` — el elemento de firma
Anillo que representa el circuito completo: un segmento por blanco, el de inicio marcado arriba, los completados rellenos. **Es literalmente el mapa de la vuelta que la patrulla está caminando.**

Aparece en tres lugares, y en los tres codifica datos reales:
1. **WAFL Home** — avance del recorrido.
2. **WAFA seguimiento** — un anillo chico por patrulla, para ver de un vistazo quién va adelante.
3. **Estadísticas** — arco de medición del puntaje normalizado.

No aparece decorativamente en ningún otro lado. Es lo único memorable de la interfaz y se gasta esa carta una sola vez.

> **Implementado en `REF7-4`** como `AnilloDeRecorrido` (`@bal/ui`): un arco por blanco con 4° de hueco, completos en `--nock-text` y pendientes en `--line`, un triángulo en `--ink` arriba, `role="img"` con «N de M blancos cargados», y el relleno en 400 ms. **Gira para que el blanco de inicio quede arriba**; recibe cuántos blancos (contados desde el inicio) o cuáles. Ojo: `startTargetIndex` es el **número** del blanco (1-based) y el anillo cuenta **posiciones** en la lista.
>
> Dónde está hoy, siempre con datos reales: el recorrido de WAFL (120px, con «N/M BLANCOS»); la tarjeta «En curso» del hero de la landing (76px, el avance de todas las patrullas juntas) y el detalle público de un torneo en proceso (44px por patrulla). En el inicio de WAFA **no**: el listado de administración no trae el avance, y no se agregó un endpoint para esto. El arco de estadísticas no se implementó.

### 6.6 `SignaturePad`
Canvas a pantalla completa, orientación libre, trazo grueso. Botones **Borrar** y **Confirmar firma**. Muestra el puntaje que se está firmando arriba del canvas: nadie firma algo que no está viendo.

### 6.7 `TargetHeader`
Número de blanco grande, glifo de modalidad, cantidad de flechas. Es lo primero que se ve al llegar a un puesto.

> **Desde `REF7-10`:** el número a 56px en display (`aria-hidden`; el `h1` real dice «Blanco 1» para el lector de pantalla), y al lado el `ChipModalidad` y «2 flechas · Jabalí · 1 de 6». El encabezado de la app dice «Patrulla N» y el nombre del torneo.

### 6.9 Componentes de `ref-7`

Agregados o rediseñados en `ref-7` (especificación completa en [`post/ref-7/DISENO.md`](post/ref-7/DISENO.md) §4). Los de `@bal/ui` tienen nombre en castellano, como el resto del paquete:

| Componente | Dónde | Qué es |
|---|---|---|
| `botonClases` | `@bal/ui` | La piel de todo botón: `primario`, `secundario` (sobre `--surface` con borde `--line-strong`; el gris relleno se leía como deshabilitado), `fantasma`, `peligro` (con `--danger-ink`) y `sobreMonte`; tamaños `sm` (44), base (52) y `lg` (56). Deshabilitado **sin opacidad**: `--surface-2` con `--ink-muted`. Al tocar baja un pixel |
| `clasesDeBotonIcono` | `@bal/ui` | 44×44, radio `md`, siempre con `aria-label` |
| `BadgeEstado` | `@bal/ui` | **Rediseñado:** un punto de color y el texto en `--ink`, en una píldora con borde. «En curso» late (lo apaga `prefers-reduced-motion`). El color sigue saliendo de `ESTADO_DE_TORNEO` y va al punto: con el fondo relleno, «completado» daba 2.59:1 |
| `BarraDeModalidades` (`ModalityBar`) | `@bal/ui` | Barra apilada de 8px y leyenda con ícono, nombre y %. Reemplaza la fila de chips con porcentaje en las tarjetas de torneo |
| `RotuloDeSeccion` (`SectionHeader`) | `@bal/ui` | Eyebrow en mono, contador y filete; acción opcional. Es un encabezado (o un antetítulo con `nivel={false}`) |
| `TarjetaDeTorneo` (`TournamentCard`) | `@bal/ui` | Estado y fecha, nombre, tamaño, barra de modalidades y un pie que dice qué vas a encontrar. Se usa en la landing y en WAFA |
| `AnilloDeRecorrido` (`CircuitRing`) | `@bal/ui` | Ver §6.5 |
| `AnillosDeFondo` | `@bal/ui` | Los anillos decorativos de la banda `monte` (§1) |
| `TarjetaDeRol` (`RoleCard`) | `app/src/components` | Las dos entradas de la puerta `/app`: título, qué hace la app, ícono sobre `monte`; la de líder es la principal y avisa que funciona sin señal. Mínimo 96px |
| `Encabezado` de la landing (`SiteHeader`) | `landing/src/components/ui.tsx` | Una fila, sticky: marca, Inicio · Ranking · Torneos · Sumate con la activa marcada, tema e «Ingresar». Debajo de 760px la navegación se esconde |
| `Encabezado` de la PWA (`AppHeader`) | `app/src/components/ui.tsx` | 60px; a la izquierda, vuelta atrás (flecha y texto) **o** el logo; título en dos líneas (`contexto` en mono arriba) |

Los componentes que tienen enlaces reciben `enlace?: ComponenteDeEnlace` (`@bal/ui` no depende del router): cada app les pasa su `EnlaceInterno`.

---

## 6.8 Copy

El texto es material de diseño, no relleno.

- **Voz activa y literal.** El botón dice qué pasa: `Cerrar circuito`, no `Enviar`. Lo que dice el botón es lo que dice la confirmación: `Circuito cerrado`.
- **Vocabulario del deporte, no del sistema.** Blanco, patrulla, estaca, recorrido, flecha. Nunca "registro", "entidad", "sincronización de payload".
- **Los errores no piden disculpas y no son vagos.** Dicen qué pasó y qué hacer: `Faltan las firmas de Pérez y Gómez para cerrar el circuito.`
- **Los estados vacíos invitan a actuar.** `Todavía no cargaste ningún blanco. Empezá por el 10.`
- **Sin conexión no es un error.** `Sin señal · 12 guardados` — es información tranquilizadora, no una alarma.
- Español rioplatense, voseo, minúscula de oración.

---

## 7. Layout

**Todo pensado para el pulgar.** Las acciones primarias viven en el tercio inferior de la pantalla.

```
┌─────────────────────────┐
│ ← Blanco 10    ⬤ Sync   │  encabezado fijo, 56px
├─────────────────────────┤
│ 3D · 2 flechas · Jabalí │  contexto del blanco
├─────────────────────────┤
│                         │
│  Pérez      11  8   19  │  scrollea
│  Gómez       —  —    —  │
│  ─────────────────────  │
│  Díaz       10  5   15  │
│  Ruiz       11 11   22  │
│                         │
├─────────────────────────┤
│   ┌───┐ ┌───┐ ┌───┐     │  teclado anclado abajo
│   │11 │ │10 │ │ 8 │     │  56×56 mínimo
│   └───┘ └───┘ └───┘     │
│      ┌───┐ ┌───┐        │
│      │ 5 │ │ M │        │
│      └───┘ └───┘        │
├─────────────────────────┤
│      Continuar  →       │  52px
└─────────────────────────┘
```

- Ancho mínimo soportado: **360px**. Cero scroll horizontal, en ninguna pantalla.
- `env(safe-area-inset-*)` respetado — la barra de gestos de iOS no puede tapar el botón de continuar.
- **Sin modales durante el scoring.** Un modal que aparece mientras se anota es una interrupción en el peor momento posible.
- La landing usa un layout más ancho y respirado; es la única superficie que se ve también en escritorio.

> **Desde `ref-7`:**
> - **La landing es un documento** (`REF7-5`): el encabezado es sticky, el contenido scrollea con la página y **el pie va al final**, estático, con columnas (la liga, sus páginas y un solo acceso «Ingresar a la app»: puerta única, `FUNCTIONAL.md` §5.1). El contenedor es de 1200px. Antes el medio scrolleaba entre un encabezado y un pie fijos, y el pie se comía ~80px de alto útil.
> - **La PWA no tiene pie** (`REF7-4`, decisión 5): en WAFL el pie compacto quedaba entre la lista de arqueros y el teclado, justo donde no sobra alto; en WAFA repetía lo que ya dice el encabezado.
> - A 360×640, en la pantalla del blanco entran el encabezado del blanco, la primera unidad entera y el teclado de 12 teclas sin scroll (medido en `REF7-10`).
> - Los títulos parten una palabra que no entra (`overflow-wrap: anywhere` en `h1`–`h3`): un apellido largo a 32px expandido pasaba los 328px útiles de un celular de 360.

---

## 8. Movimiento

Contenido y con propósito. La app se usa con prisa; una animación de más es una espera de más.

| Interacción | Duración | Curva |
|---|---|---|
| Feedback de tecla | 80 ms | `ease-out` |
| Transición entre blancos | 180 ms | `cubic-bezier(0.2, 0, 0, 1)` |
| Cambio de estado del `SyncBadge` | 240 ms | `ease-in-out` |
| Relleno del `CircuitRing` al completar un blanco | 400 ms | `ease-out` |
| Latido del punto de «En curso» (`BadgeEstado`, `ref-7`) | 1.6 s, `infinite` | `ease-out` |

El relleno del anillo es la única animación con algo de gracia, y se la ganó: marca el momento en que el blanco quedó cargado. Es la recompensa del recorrido.

`@media (prefers-reduced-motion: reduce)` desactiva todo movimiento no esencial. Sin excepciones.

---

## 9. Temas

- Se respeta `prefers-color-scheme` por defecto, con conmutador manual persistido en `localStorage`.
- **Anti-FOUC**: un script **externo, clásico y bloqueante** en el `<head>` (`public/theme-init.js` de cada app) aplica el tema antes del primer pintado. Es externo porque la CSP es `script-src 'self'` —sin `'unsafe-inline'` y sin hashes que mantener a mano— y un script inline se bloquea; es bloqueante (sin `async`, `defer` ni `type="module"`) porque tiene que correr antes de pintar.
- `<meta name="theme-color">` se sincroniza con el tema para que la barra del navegador acompañe.
- **El tema claro es el default en WAFL**, porque es el que gana bajo el sol. El oscuro está para el pabellón y para la carga nocturna.

### Dónde vive cada parte

La decisión de **qué tema corresponde** está en `@bal/ui/src/tema.ts` —`resolverTema`, `TEMA_KEY`, `COLOR_DE_BARRA`— y probada ahí. La **aplicación** al documento es de cada app: `BotonTema` en `app/src/components/ui.tsx` y en `landing/src/components/ui.tsx`.

Son **cuatro lugares** que tienen que coincidir: los dos `theme-init.js` —que no pueden importar nada, porque corren antes de cualquier bundle— y los dos conmutadores. Hay un test en `@bal/ui` que **ejecuta los dos scripts** en un `vm`, con todas las combinaciones de valor guardado y preferencia del sistema, y compara el resultado con `resolverTema` y `COLOR_DE_BARRA`; además verifica que las dos copias sean idénticas y que los `index.html` no tengan ningún script inline. Buscar texto dentro del HTML no alcanzaba: una versión anterior pasaba ese test y decidía distinto que `resolverTema` (con un valor guardado corrupto, o con `localStorage` bloqueado, pintaba claro mientras el botón pintaba oscuro).

El E2E `tema-sin-parpadeo.spec.ts` prueba lo que ese test no puede ver: contra el stack de producción, con su CSP real, que el tema oscuro queda puesto **antes** de que React monte y que no hay una sola violación de la CSP.

Un valor guardado que no se reconoce **no cuenta como elección**: se sigue la preferencia del sistema. Forzar claro ignoraría a alguien que tiene el sistema en oscuro por una entrada corrupta que nunca eligió.

---

## 9.1 Fechas

Todas las fechas se escriben con `@bal/shared/src/fechas.ts`, nunca crudas.

| Función | Resultado |
|---|---|
| `formatearFecha` | `8 de agosto de 2026` |
| `formatearFechaCorta` | `08/08/2026` |
| `formatearRango` | `1 de marzo — 30 de noviembre de 2026` |

**Se formatea en UTC, a propósito.** La fecha de un torneo es un *día del calendario*, no un instante: se guarda como medianoche UTC y Argentina es UTC-3, así que formatear en la zona del navegador mostraría **el día anterior**. En la planilla impresa esa diferencia es un problema real.

Una fecha que no se puede interpretar se devuelve **tal cual**. Es un bug, pero romper la pantalla es peor que mostrar el dato crudo, que además deja verlo para reportarlo.

---

## 10. Accesibilidad

- Contraste AA mínimo, AAA en scoring.
- Foco visible global: `:focus-visible` con anillo de 3px en **`--focus-ring`**, con desplazamiento. Hasta `REF7-2` era `--nock`, que en el tema claro da 2.59:1 sobre el fondo (WCAG 2.4.11 pide 3:1); `--focus-ring` da 6.19:1 en claro y 13.6:1 en oscuro. Ninguna transición anima `outline-color`: el anillo arrancaba en el color del texto.
- Todos los inputs con `<label>` asociado. Grupos de radio y checkbox en `<fieldset>` con `<legend>`.
- El color **nunca** es el único portador de información: estaca, estado de sincronización y modalidad llevan siempre texto o forma.
- `aria-live="polite"` en el `SyncBadge` y en los totales que cambian.
- Navegable por teclado de punta a punta (importante para el admin, que usa notebook).
- `spellcheck="off"` y `autocomplete` correcto en los campos de nombre y PIN.
- Objetivos táctiles del §5, verificados en los tests de componente.

### Iconografía

**Ni el color ni el ícono son nunca el único portador de información.** En la práctica son dos reglas:

1. Un control que sólo muestra un símbolo lleva `aria-label` que dice **qué hace**, no cómo se ve: `Cambiar a tema oscuro`, `Subir el blanco 3`, `Mover a Pérez`.
2. Un símbolo decorativo lleva `aria-hidden="true"`, para que no se anuncie al lado del texto que ya lo dice.

Lo verifica un test que **recorre el código de las pantallas** y marca cualquier glifo que no esté acompañado de una de las dos cosas. Se revisa el código y no el DOM a propósito: montar las trece pantallas costaría más y dejaría afuera las que todavía no tienen test de render.

### Logo

El de la **Liga** es un SVG original en `@bal/ui/assets/liga.svg`: tres anillos con los colores de estaca y una flecha clavada, sin degradados ni filtros, para que se lea a 24px en el header y en blanco y negro en una planilla impresa. Va siempre **acompañando al nombre**, nunca reemplazándolo, y con `alt=""` porque el texto de al lado ya lo dice.

---

## 11. Verificación

Antes de dar por terminada cualquier tarea de frontend:

- [ ] Skill **`web-design-guidelines`** sobre el código de la UI, sin issues críticos.
- [ ] Skill **`audit-website`** contra el deploy.
- [ ] Contraste verificado en ambos temas.
- [ ] Objetivos táctiles medidos sobre estilos computados, no a ojo.
- [ ] Probado en un Android y un iPhone **reales**, a 360px, a pleno sol.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Navegación completa por teclado.
