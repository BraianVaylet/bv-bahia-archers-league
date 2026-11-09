R = {
'Button': '''Botón de acción; el primario existe una sola vez por pantalla y es lo que la pantalla viene a hacer.

**Fuente:** `botonClases` / `Button` en `packages/app/src/components/ui.tsx`.

- Variantes: `primario` (nock + nock-ink), `secundario`, `fantasma`, `peligro` (danger + danger-ink).
- Alto 52px (`touch-primary`); `bal-btn--sm` = 44px (`touch-min`), solo para acciones de fila o de encabezado. `bal-btn--lg` = 56px, solo landing.
- El texto dice qué pasa: `Cerrar circuito`, `Publicar`, `Crear torneo`. Nunca `Enviar` ni `Aceptar`.
- Ícono opcional a la izquierda (a la derecha solo la flecha de avance).

**Cambios respecto del código actual**
- `secundario` deja de ser un bloque gris relleno (`surface-2`, se leía como deshabilitado) y pasa a `surface` con borde `line-strong` (3:1).
- `peligro` usa `danger-ink`: en oscuro el blanco sobre `#f06449` no llega a AA.
- Deshabilitado: `surface-2` + `ink-muted`, sin `opacity:.4`. Siempre con el motivo escrito cerca ("Falta cargar: …").
- Feedback de tecla: `translateY(1px)` en 80 ms, no `opacity`.

**El consumidor provee:** etiqueta, variante, `ancho` si va a lo ancho, y el motivo cuando está deshabilitado.
''',
'IconButton': '''Botón de solo ícono, 44×44, para acciones de encabezado y de fila.

**Fuente:** `BotonTema`, `CerrarSesion`, `BotonIcono` (padrón).

- Siempre con `aria-label` que dice qué hace ("Cambiar a tema oscuro", "Subir el blanco 3"), nunca cómo se ve.
- Radio `radius-md` (antes `radius-sm`: se alinea con los botones de al lado).
- No lo uses para la acción principal de una pantalla: esa lleva texto.
''',
'Field': '''Campo de texto con etiqueta, ayuda y error asociados.

**Fuente:** `Field` en `packages/app/src/components/ui.tsx`.

- Input de 52px, 16px de texto (iOS no hace zoom), borde `line-strong`.
- Error: borde `danger` de 2px + mensaje con ícono y `role="alert"`, que dice qué pasó y qué hacer.
- `autocomplete` y `spellcheck="off"` correctos en usuario y PIN.

**Cambio:** el borde actual (`line`, 1.3:1) no llega al 3:1 que pide un control. Pasa a `line-strong`.
''',
'StakeChip': '''Estaca de tiro: color reservado + nombre escrito, siempre juntos.

**Fuente:** `StakeChip` en `@bal/ui`.

- Los cuatro `stake-*` no se usan para nada más en toda la interfaz.
- El nombre va siempre: un daltónico lee "Azul", el resto ve el color.
- Alto 28px (24px compacto en filas de scoring).
''',
'ChipCategoria': '''Categoría de arco: píldora con ícono, texto y su `cat-*`.

**Fuente:** `ChipCategoria` + `COLOR_DE_CATEGORIA` en `@bal/ui`.

- Forma píldora (`radius-full`): así no se confunde con la modalidad, que es rectángulo.
- Color sordo sobre `surface-2`; nunca va solo.
- `escuela` es neutra a propósito.
''',
'ChipModalidad': '''Modalidad de un blanco: rectángulo con ícono, texto, su `mod-*` y, opcional, el porcentaje.

**Fuente:** `ChipModalidad` + `COLOR_DE_MODALIDAD` en `@bal/ui`.

- La modalidad es del blanco, no del torneo.
- Para mostrar el reparto de un torneo entero, preferí **ModalityBar**: una fila de 4 chips con % se lee como ruido.
''',
'BadgeEstado': '''Estado de un torneo: punto de color + texto en una píldora con borde.

**Fuente:** `BadgeEstado` en `@bal/ui` (rediseñado).

| Estado | Punto | Texto público |
|---|---|---|
| Sin iniciar | `ink-muted` | Sin iniciar |
| En curso | `nock-text`, con pulso | En curso |
| Completo sin publicar | `warn` | Esperando publicación |
| Publicado | `ok` | Resultados oficiales |

**Cambio:** antes era una píldora rellena con texto `--bg` (marrón "En curso ahora", verde "Resultados oficiales"): pesaba más que el título de la tarjeta. Ahora el título gana y el estado acompaña. El pulso se apaga con `prefers-reduced-motion`.
''',
'ModalityBar': '''Reparto de modalidades de un torneo como barra apilada + leyenda con íconos y porcentajes.

**Adición intencional.** Reemplaza la fila de `ChipModalidad` con % en las tarjetas de torneo: la misma información en una línea que se compara de un vistazo entre torneos.

- Segmentos con `mod-*`, separados 2px, alto 8px, `radius-full`.
- La leyenda repite cada modalidad con ícono, nombre y % (el color nunca va solo). La barra lleva `role="img"` y `aria-label` con el reparto completo.
- **El consumidor provee:** pares `[modalidad, pct]` ordenados de mayor a menor (`@bal/shared` ya calcula los %).
''',
'CircuitRing': '''El recorrido completo como anillo: un segmento por blanco, el de inicio marcado arriba, los cargados en `nock-text`.

**Fuente:** `docs/DESIGN_SYSTEM.md` §6.5 (especificado, todavía no implementado en las pantallas).

- Tres lugares y solo tres: WAFL inicio (avance), WAFA seguimiento (uno chico por patrulla), estadísticas.
- `start` rota el anillo para que el blanco de inicio de esa patrulla quede arriba.
- Relleno de un segmento: 400 ms `ease-out`, la única animación con gracia.
- Lleva `role="img"` con "N de M blancos cargados".
''',
'RankingTable': '''Tabla del ranking de una categoría: posición, arquero, fechas jugadas y puntaje normalizado.

**Fuente:** `landing/src/pages/Ranking.tsx`.

- Filas de 56px; los tres primeros con la posición sobre `nock-soft` (sin oro/plata/bronce: el amarillo y el naranja son estacas).
- Puntaje en mono, alineado a la derecha, siempre `normalizedPct` (los totales brutos no se comparan entre torneos).
- El nombre enlaza a la ficha del arquero.
''',
'Tarjeta': '''Contenedor base: `surface`, borde `line`, `radius-lg`.

**Fuente:** `clasesDeTarjeta` en `@bal/ui`.

- `densidad`: normal (12px) · amplia (16px). `nivel`: base · anidada (`surface-2`).
- Elevación por borde y fondo, nunca sombra.
- Como enlace: el borde pasa a `line-strong` en hover.
''',
'SectionHeader': '''Rótulo de sección: eyebrow en mono, contador y acción opcional, sobre un filete.

**Adición intencional.** Reemplaza los rótulos actuales ("EN PROCESO" en gris y negrita), que no tenían contador ni separación.

- El contador dice cuántos hay antes de leer la lista; con 0, la sección muestra su estado vacío, que invita a actuar.
- Acción a la derecha solo si lleva a la lista completa ("Ver todas").
''',
'TournamentCard': '''Tarjeta de torneo para listas: estado, fecha, título, metadatos, reparto de modalidades y acción.

**Fuente:** listados de `landing/src/pages/Tournaments.tsx` y `app/src/wafa/pages/Home.tsx`.

- Jerarquía: título (20px/600) > estado > metadatos. La fecha va en mono, arriba a la derecha.
- `ModalityBar` en lugar de la fila de chips.
- El pie dice qué vas a encontrar ("Ver en vivo", "Podios y estadísticas", "Armar patrullas").
- En WAFA, para un torneo en curso, el pie cambia por un `CircuitRing` chico por patrulla.
''',
'RoleCard': '''Opción de rol en la puerta `/app`: ícono sobre `monte`, título, descripción y chevron; toda la tarjeta es el objetivo táctil.

**Adición intencional.** Reemplaza los dos botones ("Soy líder de patrulla" en verde, "Soy administrador" en gris) que no decían qué hace cada app.

- Mínimo 96px de alto.
- El líder va primero y con borde `nock-text`: es quien entra el día del torneo, con apuro.
- El tag "Funciona sin señal" es información, no marketing: solo WAFL lo tiene.
''',
'SiteHeader': '''Encabezado del sitio público: marca, navegación, tema e "Ingresar", en una fila de 64px.

**Fuente:** `Encabezado` en `landing/src/components/ui.tsx` (rediseñado).

- Hoy son dos filas (marca arriba, links chicos abajo). Pasa a una sola fila, sticky, con fondo `bg` al 92% + blur.
- La página activa se marca con texto `ink` 600 y una barra `nock-text` de 3px.
- "Ingresar" vive acá, siempre visible, en vez de un botón verde gigante en el medio de la portada.
- En celular la navegación se esconde y queda marca + tema + Ingresar; las secciones se recorren con scroll.
''',
'AppHeader': '''Encabezado de WAFA y WAFL: volver o logo, título en dos niveles, y estado/acciones a la derecha.

**Fuente:** `Encabezado` en `packages/app/src/components/ui.tsx`.

- 60px, sticky. Primera línea en mono con el contexto ("Administración", "Blanco 1 de 6"); segunda con la pantalla.
- Volver con flecha + texto, nunca solo "←".
- WAFL lleva su `SyncBadge`; WAFA el indicador de conexión.
''',
'Footer': '''Pie del sitio: escudos, descripción de la liga, columnas de enlaces y una línea legal.

**Fuente:** `Footer` en `@bal/ui` (rediseñado).

- **Estático, al final del documento.** Hoy la landing usa `h-dvh` + `overflow-hidden` y el pie queda fijo, comiéndose alto útil y tapando la segunda fila de tarjetas.
- Fondo `surface` con borde superior `line`. Escudo del CBA con `alt` completo y logo de la liga con `alt=""`.
- En la PWA no va: en WAFA sobra y en WAFL roba espacio al teclado.
''',
'SyncBadge': '''Estado de sincronización de WAFL: ícono + color + texto, tocable para ver el detalle.

**Fuente:** `app/src/wafl/SyncBadge.tsx`.

- `ok` Al día · `warn` N por enviar · `ink-muted` Sin señal · N guardados · `danger` No se pudo enviar.
- Sin señal no es un error: es información tranquilizadora.
- `aria-live="polite"`. Nunca bloquea.
''',
'UnitCard': '''Unidad de tiro en la pantalla de blanco: arquero, unidad y orden, estaca, flechas y total.

**Fuente:** `app/src/wafl/ArrowRow.tsx`, `TargetPage.tsx`.

- Activa: borde `nock-text` de 2px y la próxima flecha marcada.
- Total a la derecha en display 36px (`aria-live`). Hoy un guion largo sin contexto ocupaba ese lugar.
- Casilleros de flecha de 48px: con borde punteado `line-strong` si están vacíos, con fondo `surface-2` si están cargados.
''',
'ScoreKeypad': '''Teclado de scoring anclado abajo; se adapta a la modalidad del blanco.

**Fuente:** `app/src/wafl/ScoreKeypad.tsx`, `docs/DESIGN_SYSTEM.md` §6.1.

- Teclas de 64px de alto (mínimo `touch-keypad`, 56px), separadas 8px, cifras en display expandido.
- La zona central (X / 11 / X6) en `nock`; `M` con borde punteado, siempre en la misma posición.
- Panel `surface` con `shadow-dock`, la única sombra del sistema. "Continuar" va dentro del panel, con lo que falta escrito abajo.
- Sin estado de carga. Nunca.

**Cambio:** el pie con los logos hoy queda entre la lista y el teclado. En pantallas con teclado no va ningún pie.
''',
'Landing': '''La portada pública rediseñada (`/`), en escritorio.

Ver la sección **Rediseño** para el detalle. Estructura: SiteHeader → hero sobre `monte` con anillos, titular en display expandido, CTA "Ver el ranking" y tarjeta flotante del torneo en curso → Cómo se juega → Torneos → Ranking por categoría → Modalidades → Sumate al padrón → Footer.
''',
'LandingMovil': '''La misma portada a 390px: el mismo HTML, reacomodado con media queries.

Hero a una columna, titular de 40px, CTAs a lo ancho, tarjeta "En curso" debajo de la foto, ranking con pestañas horizontales.
''',
'Puerta': '''La puerta `/app` rediseñada: elegir rol, en escritorio.

Panel `monte` con la marca y la promesa ("Anotá, sincronizá y publicá") + columna con dos `RoleCard`, la vuelta al sitio público y la invitación a instalar la PWA.
''',
'PuertaMovil': '''La puerta `/app` a 390px: el panel `monte` queda como banda superior y los roles quedan al alcance del pulgar.
''',
'WafaInicio': '''Inicio de Administración con cambios simples y de alto impacto.

- Un solo primario ("Crear torneo") y tres accesos con ícono y dato (antes: cuatro botones del mismo peso).
- `SectionHeader` con contador y estados vacíos que explican qué va a aparecer.
- El torneo en curso muestra un `CircuitRing` por patrulla: quién va adelante, de un vistazo.
''',
'WaflBlanco': '''Pantalla de blanco del líder con cambios simples y de alto impacto.

- Número de blanco en display 56px + modalidad + flechas: lo primero que se ve al llegar al puesto.
- `UnitCard` con total visible y la próxima flecha marcada.
- Sin pie de logos entre la lista y el teclado; "Continuar" dentro del panel del teclado.
''',
}
