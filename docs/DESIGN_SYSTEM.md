# Sistema de diseño — BV Bahía Archers League

---

## 1. Dirección

La app se usa **caminando por el monte, con guantes, al sol de la mañana**. Eso no es un detalle de accesibilidad: es la restricción que define el lenguaje visual entero.

La dirección sale de los objetos reales del deporte, no de una paleta de moda:

- **La cara de blanco de campo** es negra con centro amarillo. Es, sin coincidencia, la combinación de mayor contraste que existe en el equipamiento de arquería — porque tiene que leerse a 50 metros bajo el sol. Ese mismo par gobierna la interfaz.
- **Las estacas roja, azul y amarilla** son objetos físicos clavados en el piso que determinan dónde se para cada arquero. En esta app esos tres colores son **semántica reservada**: significan estaca y nada más.
- **El verde fluorescente del nock** es el color que los arqueros eligen para poder encontrar sus flechas en el pasto. Es el color más encontrable que existe en la cancha. Es el color de la acción primaria.
- **Los anillos concéntricos** del blanco son la estructura del deporte. Son el elemento de firma de la interfaz (§7).

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
| `--nock` | `#8FA800` | `#C6F000` | **Acción primaria** |
| `--nock-ink` | `#FFFFFF` | `#16170F` | Texto sobre `--nock` |
| `--danger` | `#B3200E` | `#F06449` | Errores, acciones destructivas |
| `--warn` | `#8A5A00` | `#E8A33D` | Pendiente de sincronizar, advertencias |
| `--ok` | `#2F6B2F` | `#7CC47C` | Sincronizado, completo |

El negro no es negro puro: `#16170F` tiene una caída olivácea. Es el negro de la cara de campo y la sombra del monte. El papel no es crema: `#FBFAF5` es claro y casi neutro, para exprimir la luminancia máxima de la pantalla bajo el sol.

`--nock` cambia de tono entre temas a propósito. El chartreuse fluorescente `#C6F000` es glorioso sobre fondo oscuro e ilegible sobre blanco; en tema claro se oscurece a `#8FA800` para llegar a contraste AA.

### 2.2 Colores de estaca — reservados

```css
--stake-roja:     #D22B2B;
--stake-azul:     #1D5FD6;
--stake-amarilla: #F5C518;
```

**Regla absoluta: estos tres colores no se usan para nada más.** Ni para botones, ni para estados, ni para gráficos, ni para decorar. Si aparece rojo en la pantalla, es una estaca. Es lo que permite que el líder identifique la estaca de un vistazo, sin leer, con el sol de frente.

El color nunca va solo: el chip de estaca lleva **siempre** el nombre escrito. Un daltónico lee "Azul"; el resto ve el color. Ninguno de los dos depende del otro.

### 2.3 Colores de modalidad

Cada modalidad de blanco lleva un identificador visual propio, pero de **forma**, no de color: un glifo monocromo. El color está saturado de significado con las estacas; agregar cuatro colores más lo arruinaría.

| Modalidad | Glifo |
|---|---|
| Sala | Anillos concéntricos cerrados |
| Aire libre | Anillos con marca de distancia |
| Juego de campo | Cara de campo (centro sólido, anillo exterior) |
| 3D | Silueta de animal |

### 2.4 Contraste

Mínimo **AA (4.5:1)** en todo texto. **AAA (7:1)** en la pantalla de scoring y en los números de puntaje — es la que se lee bajo el sol.

Verificado en ambos temas para cada par de tokens. Ningún par de tokens del §2.1 puede combinarse fuera de la tabla sin volver a verificar.

---

## 3. Tipografía

Tres roles, dos familias.

| Rol | Familia | Por qué |
|---|---|---|
| **Display** | **Archivo Expanded** (600, 700) | Grotesca ancha y robusta. Lee como cartelería de cancha. Sus cifras son inconfundibles a distancia y con glare: el `6` y el `8` no se parecen, el `1` tiene base. |
| **Cuerpo** | **Archivo** (400, 500, 600) | Misma superfamilia, ancho normal. Cohesión sin monotonía. Excelente en tamaños chicos. |
| **Datos** | **Martian Mono** (400, 600) | Etiquetas técnicas: usuario de patrulla, PIN, número de blanco, contadores. Ancho fijo, lectura de "equipamiento marcado". |

Ambas son de Google Fonts, **autohospedadas** en `woff2` con `font-display: swap`. La CSP prohíbe pedidos a hosts externos (ver [`SECURITY.md`](SECURITY.md) §10) y además no queremos depender de la red para renderizar texto.

### Escala

Base `16px`. Ratio 1.25 para cuerpo, saltos mayores para display.

| Token | Tamaño | Line-height | Uso |
|---|---|---|---|
| `--t-score` | `56px` | 1.0 | Puntaje total en la pantalla de blanco |
| `--t-display` | `32px` | 1.1 | Títulos de página |
| `--t-h2` | `24px` | 1.2 | Encabezados de sección |
| `--t-h3` | `20px` | 1.3 | Nombres de arquero en la lista de scoring |
| `--t-body` | `16px` | 1.5 | Texto general. **Nunca menos de 16px en un input** (iOS hace zoom debajo de eso) |
| `--t-sm` | `14px` | 1.45 | Metadatos |
| `--t-mono` | `13px` | 1.4 | Etiquetas de datos, `letter-spacing: 0.02em` |

**`font-variant-numeric: tabular-nums` en todo número que pueda cambiar.** Un total que salta de ancho al pasar de 99 a 100 hace que la pantalla parezca temblar.

---

## 4. Espaciado, radios y elevación

Escala de 4px: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.

| Token | Valor | Uso |
|---|---|---|
| `--r-sm` | `6px` | Chips, badges |
| `--r-md` | `12px` | Botones, inputs |
| `--r-lg` | `20px` | Tarjetas |
| `--r-full` | `9999px` | Píldoras, teclas circulares |

Elevación por **borde y fondo**, no por sombra. Las sombras se disuelven bajo el sol; un borde de 1px en `--line` se ve siempre. Se reserva una sola sombra real para el teclado de scoring anclado abajo, para separarlo del contenido que scrollea.

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

- **3D** (`11 10 8 5 M`) y **campo** (`X6 6 5 4 3 2 1 M`): disposición en **arcos concéntricos** que espejan la cara de blanco real. El 11 y el X6 están al centro; los valores menores, hacia afuera. La memoria espacial de lo que el arquero acaba de mirar en el blanco se traslada a la pantalla.
- **Sala** y **aire libre** (12 tokens): grilla de 4 columnas. Doce zonas no caben en anillos legibles; acá gana la grilla.
- `M` siempre en la misma posición, siempre visualmente distinto del resto.
- Feedback háptico (`navigator.vibrate(10)`) en cada toque, si el dispositivo lo soporta.
- Sin estado de carga. Nunca. Ver [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §12.

> **Riesgo asumido y su salida.** La disposición en arcos es una apuesta: es más rápida si el mapeo espacial funciona, y más lenta si no. **Se valida con arqueros reales en una fecha de prueba antes de darla por buena.** Si no gana contra la grilla, se cambia a grilla en las cuatro modalidades. El componente se construye con las dos disposiciones detrás de una prop para que el cambio sea de una línea.

### 6.2 `StakeChip`
Color de estaca + nombre escrito, siempre juntos. Alto 28px, radio `--r-full`.

### 6.3 `UnitCard`
La unidad de tiro (par `A` o `B`): los dos arqueros, quién a la izquierda y quién a la derecha, la estaca, y cuál unidad tira primero. `A` lleva un indicador de orden.

### 6.4 `SyncBadge`
Fijo en el encabezado de WAFL. Cuatro estados (`--ok` · `--warn` · `--ink-muted` · `--danger`), cada uno con **icono, color y texto**. Se toca para abrir el panel de detalle. Nunca bloquea.

### 6.5 `CircuitRing` — el elemento de firma
Anillo que representa el circuito completo: un segmento por blanco, el de inicio marcado arriba, los completados rellenos. **Es literalmente el mapa de la vuelta que la patrulla está caminando.**

Aparece en tres lugares, y en los tres codifica datos reales:
1. **WAFL Home** — avance del recorrido.
2. **WAFA seguimiento** — un anillo chico por patrulla, para ver de un vistazo quién va adelante.
3. **Estadísticas** — arco de medición del puntaje normalizado.

No aparece decorativamente en ningún otro lado. Es lo único memorable de la interfaz y se gasta esa carta una sola vez.

### 6.6 `SignaturePad`
Canvas a pantalla completa, orientación libre, trazo grueso. Botones **Borrar** y **Confirmar firma**. Muestra el puntaje que se está firmando arriba del canvas: nadie firma algo que no está viendo.

### 6.7 `TargetHeader`
Número de blanco grande, glifo de modalidad, cantidad de flechas. Es lo primero que se ve al llegar a un puesto.

---

## 6.8 Copy

El texto es material de diseño, no relleno.

- **Voz activa y literal.** El botón dice qué pasa: `Cerrar circuito`, no `Enviar`. Lo que dice el botón es lo que dice la confirmación: `Circuito cerrado`.
- **Vocabulario del deporte, no del sistema.** Blanco, patrulla, estaca, recorrido, flecha. Nunca "registro", "entidad", "sincronización de payload".
- **Los errores no piden disculpas y no son vagos.** Dicen qué pasó y qué hacer: `Faltan las firmas de Pérez y Gómez para cerrar el circuito.`
- **Los estados vacíos invitan a actuar.** `Todavía no cargaste ningún blanco. Empezá por el 10.`
- **Sin conexión no es un error.** `Sin conexión · 12 cambios guardados en el celular` — es información tranquilizadora, no una alarma.
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

---

## 8. Movimiento

Contenido y con propósito. La app se usa con prisa; una animación de más es una espera de más.

| Interacción | Duración | Curva |
|---|---|---|
| Feedback de tecla | 80 ms | `ease-out` |
| Transición entre blancos | 180 ms | `cubic-bezier(0.2, 0, 0, 1)` |
| Cambio de estado del `SyncBadge` | 240 ms | `ease-in-out` |
| Relleno del `CircuitRing` al completar un blanco | 400 ms | `ease-out` |

El relleno del anillo es la única animación con algo de gracia, y se la ganó: marca el momento en que el blanco quedó cargado. Es la recompensa del recorrido.

`@media (prefers-reduced-motion: reduce)` desactiva todo movimiento no esencial. Sin excepciones.

---

## 9. Temas

- Se respeta `prefers-color-scheme` por defecto, con conmutador manual persistido en `localStorage`.
- **Anti-FOUC**: un script inline en `<head>` aplica el tema antes del primer pintado. Va con **hash en la CSP**, no con `'unsafe-inline'`.
- `<meta name="theme-color">` se sincroniza con el tema para que la barra del navegador acompañe.
- **El tema claro es el default en WAFL**, porque es el que gana bajo el sol. El oscuro está para el pabellón y para la carga nocturna.

---

## 10. Accesibilidad

- Contraste AA mínimo, AAA en scoring.
- Foco visible global: `:focus-visible` con anillo de 3px en `--nock`, con desplazamiento.
- Todos los inputs con `<label>` asociado. Grupos de radio y checkbox en `<fieldset>` con `<legend>`.
- El color **nunca** es el único portador de información: estaca, estado de sincronización y modalidad llevan siempre texto o forma.
- `aria-live="polite"` en el `SyncBadge` y en los totales que cambian.
- Navegable por teclado de punta a punta (importante para el admin, que usa notebook).
- `spellcheck="off"` y `autocomplete` correcto en los campos de nombre y PIN.
- Objetivos táctiles del §5, verificados en los tests de componente.

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
