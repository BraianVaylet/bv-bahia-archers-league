La app se usa **caminando por el monte, con guantes, al sol, sin señal confiable**. Esa restricción define todo el lenguaje visual. Si una decisión estética choca con ella, gana la restricción.

El lenguaje sale de los objetos del deporte: **la cara del blanco de campo** (negra con centro amarillo, `monte` + `monte-accent`), **el verde fluorescente del nock** (`nock`, la acción primaria) y **los anillos concéntricos** (la firma: `CircuitRing` y el fondo del hero). Cubre tres superficies:

- **Landing** (`/`): pública, se lee en escritorio y en celular.
- **Puerta** (`/app`): elegir rol.
- **WAFA** (admin) y **WAFL** (líder de patrulla): PWA mobile-first, con WAFL offline.

## Contenido y voz

- Español rioplatense, voseo, mayúscula solo al principio de la oración: "Sumate al padrón", "¿Cómo entrás hoy?".
- Voz activa y literal: el botón dice qué pasa (`Cerrar circuito`), y la confirmación repite lo mismo (`Circuito cerrado`). Nunca "Enviar", "Aceptar" ni "Procesar".
- Vocabulario del deporte, nunca del sistema: **blanco, recorrido, patrulla, unidad de tiro, estaca, modalidad, publicar, temporada**. No traduzcas ni inventes sinónimos.
- Los errores no piden disculpas y dicen qué hacer: "Faltan las firmas de Pérez y Gómez para cerrar el circuito."
- Los estados vacíos invitan a actuar: "Todavía no cargaste ningún blanco. Empezá por el 10."
- Sin señal no es un error: "Sin señal · 12 guardados".
- Sin emoji. Sin signos de exclamación.

## Color

- Fondo `bg`, tarjetas `surface`, anidados `surface-2`. Texto `ink`, secundario `ink-muted`. Las dos combinaciones superan 5.7:1 en los dos temas.
- **Bordes:** `line` para divisores decorativos. **Todo lo que se toca** (inputs, botón secundario, teclas) lleva `line-strong`, que sí llega a 3:1.
- **Acción primaria:** fondo `nock` con texto `nock-ink`, oscuro en los dos temas. En claro `nock` no se lee como texto (2.59:1): cuando el verde tiene que leerse (enlaces, nav activa, anillo) usá `nock-text`. Para fondos de selección, `nock-soft`.
- **Foco:** `:focus-visible` con 3px sólidos de `focus-ring` y 2px de separación. En claro reemplaza a `nock`, que no llega a 3:1.
- **Banda de identidad:** `monte`, oscura en los dos temas, con `monte-ink` / `monte-muted` y el chartreuse `monte-accent`. Solo en el hero de la landing y el panel de la puerta. Nunca dentro de WAFA ni de WAFL.
- **Estados:** `ok` (sincronizado, oficial), `warn` (pendiente, esperando publicación), `danger` (error, destructivo; texto encima `danger-ink`). Siempre con ícono o texto.
- **Estacas: semántica reservada.** `stake-roja`, `stake-azul`, `stake-amarilla` y `stake-naranja` significan estaca y nada más: ni botones, ni estados, ni gráficos, ni medallas. Siempre junto al nombre escrito.
- **Categorías y modalidades:** `cat-*` en píldora y `mod-*` en rectángulo, con tono sordo sobre `surface-2` y siempre con ícono y texto. La forma separa los dos ejes, que comparten familias de tono.
- Tema claro por defecto (gana bajo el sol). El oscuro queda para el pabellón y la carga nocturna.

## Tipografía

- **Archivo** (variable, ejes `wght` y `wdth`), autohospedada en `fonts/`. La familia `display` es Archivo al **125% de ancho** (`font-variation-settings: "wdth" 125`): se lee como cartelería de cancha, y el 6 y el 8 no se confunden. Martian Mono para datos.
- `hero` 64/0.95 800, solo el titular de la landing (40px en celular). `display` 32/1.1 para h1. `h2` 24. `score` 56 para el total del blanco.
- `h3` 20/600 para nombres de arquero y títulos de tarjeta. `body` 16. `sm` 14 para metadatos. Nunca menos de 16px en un input.
- `mono` 13 para PIN, usuario de patrulla, fechas cortas y contadores. `eyebrow` 12 en mayúsculas con `letter-spacing: .08em` para rótulos de sección.
- `font-variant-numeric: tabular-nums` en todo número que cambia.

## Espaciado, radios, elevación

- Escala de 4px: `space-1` … `space-16`. Márgenes laterales: `space-4` en celular, contenedor de 1200px en la landing.
- `radius-sm` para chips de modalidad, `radius-md` para botones, inputs y teclas, `radius-lg` para tarjetas, `radius-full` para píldoras.
- La elevación se hace con borde y fondo: las sombras desaparecen bajo el sol. Hay dos excepciones: `shadow-dock` (el teclado de scoring) y `shadow-float` (la tarjeta flotante del hero, solo en escritorio).

## Objetivos táctiles

- `touch-keypad` 56px como mínimo por tecla de scoring (el teclado usa 64px). `touch-primary` 52px para botones primarios e inputs. `touch-min` 44px para todo lo demás, con 8px entre objetivos.
- Si un componente no llega, se rediseña el componente, no se baja el número.

## Layout

- Mobile-first, 360px como mínimo y cero scroll horizontal. Las acciones primarias van en el tercio inferior en WAFL.
- Sin modales durante el scoring.
- **El pie (`Footer`) es estático, al final del documento.** Nunca va fijo y nunca aparece en pantallas con teclado de scoring.
- La landing es la única superficie ancha. Usa bandas de sección con `space-12` y un hero sobre `monte`.

## Movimiento

- Tecla 80 ms `ease-out`, cambio de blanco 180 ms `cubic-bezier(.2,0,0,1)`, SyncBadge 240 ms, relleno del `CircuitRing` 400 ms `ease-out`, pulso de "En curso" 1.6 s.
- `prefers-reduced-motion` apaga todo, sin excepciones.

## Iconografía

- Glifos propios de `@bal/ui/src/iconos`: 24px, trazo 1.8, extremos redondeados, `currentColor`. Copiados en `assets/Iconos` (se exportan en tinta `#16170f`).
- Un control que solo muestra un ícono lleva `aria-label` con lo que hace. Un ícono decorativo lleva `aria-hidden`.
- **Adiciones** que todavía no existen en `@bal/ui` (dibujadas con el mismo trazo, en las previews): `chevron`, `flecha`, `volver`, `sincronizar`, `sin-senal`, `panel`, `podio`, `arqueros`, `calendario`, `lugar`, `instalar`. Hay que portarlas a `iconos/` antes de usarlas.

## Logo

- `assets/Logos/liga.svg`: tres anillos sobre placa `monte`, en colores fijos para los dos temas. Va siempre acompañando al nombre, con `alt=""`.
- `assets/Logos/cba.webp`: escudo del Círculo Bahiense de Arquería. Solo en el pie, con `alt` completo.

## Componentes con adiciones intencionales

`ModalityBar`, `SectionHeader` y `RoleCard` son nuevos. `BadgeEstado`, `SiteHeader` y el botón `secundario` se rediseñan. La sección **Rediseño** explica el porqué de cada cambio y el orden en que conviene aplicarlos.
