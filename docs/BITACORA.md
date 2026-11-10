# Bitácora — BV Bahía Archers League

Registro de avance. **Se actualiza al terminar cada tarea de [`ACTION_PLAN.md`](ACTION_PLAN.md).**

Qué anotar en cada entrada:
- Qué se hizo, en una o dos líneas.
- **Decisiones tomadas** que no estaban en la documentación, y por qué.
- **Desvíos** respecto de lo planificado, y su justificación.
- **Deuda técnica** que se deja abierta, con el ID de la tarea que la resolvería.

Qué **no** anotar: el detalle de la implementación (para eso está el código), ni el listado de archivos tocados (para eso está el commit).

Formato: entradas nuevas **arriba**.

---

## 2026-11-10 · `FE-39` — El alta rápida del wizard pide sexo y DNI

**Autor:** Claude Opus 5.5 · **Estado:** completado, sin commitear (en la rama `copy/hero-predio`, junto a cambios de otra sesión que no son de esta tarea).

El «Arquero nuevo» del paso de participantes (crear torneo y editar participantes de un `sin_iniciar`) era una copia del formulario anterior a `FE-29`: mandaba nombre, apellido y categoría, y el arquero nacía sin sexo ni DNI. Ahora usa `FormularioDeArquero`, el mismo del padrón.

**Decisiones:**
- **Una función para el cuerpo del alta** (`aCuerpoDeArquero`, en `wafa/padron/tipos.ts`): el padrón y el wizard la usan, así no pueden volver a divergir. Sexo y DNI en blanco viajan como `null`: siguen opcionales (decisión 6 de la Fase 8).
- `FormularioDeArquero` recibe `nivelDeTitulo` (`h2` en el padrón, `h3` dentro del paso del wizard) y `textoDeGuardar` («Crear y sumar» en el wizard, porque guardar también lo suma a los elegidos).
- **`useId()` para el `select` de categoría y el `name` de los radios de sexo.** El formulario usaba `id="categoria"` y `name="sexo"` fijos; la copia del wizard había esquivado el choque con `id="categoria-nueva"`. Con el formulario en dos lugares, el id por instancia es lo que garantiza que cada etiqueta apunte a su control.
- El error del servidor (DNI repetido) lo muestra el formulario, que queda abierto con lo tipeado; los elegidos no se tocan hasta que el alta sale bien.

**Tests:** 3 casos nuevos en `wizard-ui.test.tsx`, vistos fallar antes del fix (no existían los campos, el body no traía `sex`/`dni`): el alta manda sexo y DNI, sin ellos igual crea con `null`, y un DNI repetido muestra el mensaje sin perder elegidos. En ese último, el `alert` del error se busca por texto: con un solo elegido, el aviso de composición también es `role="alert"` y `findByRole` encontraba ese primero. `pnpm -r typecheck` y los 649 tests de `@bal/app` verdes; Biome limpio en `packages/app`. Probado en el navegador contra un backend simulado (sin tocar la base local): DNI tipeado con letras y puntos llega filtrado, el 409 se muestra en el formulario, y al corregir el DNI el arquero se crea y queda elegido.

**Fuera de alcance, encontrado al correr el lint completo:** `npx biome check packages scripts e2e` falla en `landing/.../portada/{Hero,Secciones}.tsx` (formato; son cambios sin commitear de otra sesión) y en `api/tests/docs.test.ts:69` (`useTemplate`, ya commiteado en `REF6-15`). Ninguno es de esta tarea.

---

## 2026-11-10 · Fase 9 — Plan de edición por estado, archivo, pre-inscripción y próximas fechas

**Autor:** Claude Opus 5.5 · **Estado:** plan escrito, sin código. Pendiente de que el autor confirme las decisiones.

Pedido del autor: editar torneos según su estado (incluida la corrección de puntajes contra la planilla de papel antes de publicar), eliminar los sin iniciar, archivar los publicados, link de pre-inscripción con botón en la landing, link al repositorio en el pie y «Próximas fechas» en la landing. Quedó como Fase 9 de `ACTION_PLAN.md`: `SH-11`, `BE-24`..`BE-28`, `FE-32`..`FE-39`, `TEST-4`. **Planillas impresas: fuera de alcance** — el autor decidió (2026-11-10) usar las planillas oficiales de FATARCO; la app no las genera.

**Fix agregado (`FE-39`):** el alta rápida de arquero en el wizard (`AltaRapida`, en `SelectorDeArqueros.tsx`) es una copia anterior a `FE-29` y no pide ni DNI ni sexo. Se reemplaza por `FormularioDeArquero` del padrón, con el armado del cuerpo extraído a una sola función.

**Relevado antes de planificar:** eliminar un `sin_iniciar` ya está hecho de punta a punta; el `PATCH` del torneo ya acepta en el backend más de lo que la UI expone (descripción, pago, blancos); `completado` hoy no acepta ninguna edición, y no existe ningún camino para que el admin escriba un puntaje.

**Decisiones abiertas** (tabla en `ACTION_PLAN.md`, Fase 9): las 7 se escribieron como propuestas. Las que cambian documentación de diseño cuando se confirmen: la columna «Quién escribe» y «Visible en landing» de `FUNCTIONAL.md` §8 (corrección en `completado`, `sin_iniciar` visible en próximas fechas, flag de archivo), y una entrada nueva en `SECURITY.md` por el `href` que carga el admin.

---

## 2026-11-09 · `REF7-7` — Puerta `/app` nueva

**Autor:** Claude Opus 5.5 · **Estado:** completado, en la rama `design/ref-7-rediseno`.

La puerta de `DISENO.md` §5.3 (`P-1`): a la izquierda (arriba en el celular) la banda `monte` con la marca, los anillos de fondo y la promesa «Anotá, sincronizá y publicá.»; a la derecha «¿Cómo entrás hoy?» (`h1`) con dos `TarjetaDeRol` que dicen qué hace cada app —la de líder es la principal, con «Funciona sin señal»—, la salida a la landing en verde con su flecha, «Instalá la app» como tarjeta de borde punteado y el pie con el club.

**Decisiones:**
- `TarjetaDeRol` (el `RoleCard` de §4.15) vive en `app/src/components/`: sólo la usa la puerta. El título va primero en el DOM, así el nombre accesible empieza por «Soy líder de patrulla» y el E2E de `ingreso` lo sigue encontrando.
- **Los anillos no pasan por detrás del texto**, medido con geometría (cada círculo contra la caja de cada texto del panel) a 360, 390, 768, 1024 y 1280. Los valores de la spec (760px a la derecha y arriba) cruzaban la marca con el panel angosto: se usan sólo desde 1280; entre 760 y 1280 van de 400px, y en el celular de 280px (con los 420px de la spec el anillo exterior cruzaba la promesa).
- `InstalarApp` sólo cambió la piel y la copia («Instalá la app · Abre directo acá y funciona sin señal.» y el botón «Instalar»); `beforeinstallprompt`, la explicación de iOS y el diálogo no se tocaron. Los tests que buscaban «Instalar la app» buscan «Instalar».
- `VolverALaLiga` es un enlace en `--nock-text` con `IconoVolver` también en los dos logins (centrado ahí; al principio de la línea en la puerta).
- **La versión no se muestra en el pie**: no hay ninguna expuesta en el código (§5.3 dice «si está disponible»).
- `transition-colors` animaba también el color del anillo de foco: al llegar con Tab, el anillo arrancaba en el color del texto y tardaba 120ms en volverse verde. La tarjeta de rol y la tarjeta-enlace (`clasesDeTarjeta`) transicionan sólo fondo y borde.

**Desvíos:** ninguno respecto del alcance.
**Tests:** 8 casos nuevos en `components/puerta.test.tsx` (h1, qué hace cada rol con el título primero, la principal con «Funciona sin señal», 96px de alto, la promesa en el panel, la salida verde con flecha, el pie y la tarjeta de instalar), vistos fallar.

---

## 2026-11-09 · `REF7-6` — Landing: portada nueva

**Autor:** Claude Opus 5.5 · **Estado:** completado, en la rama `design/ref-7-rediseno`.

La portada de `DISENO.md` §5.1 (`L-1`): hero sobre `--monte` con anillos de fondo, titular de 64/40px, bajada y dos accesos; la foto con la tarjeta del torneo que importa ahora (en curso con su `AnilloDeRecorrido` agregado; si no, la última publicada; sin torneos, ninguna); «Cómo se juega»; hasta tres `TarjetaDeTorneo`; el top 5 del ranking por categoría; las cuatro modalidades con sus valores de flecha leídos de `SCORING`; y la banda «Sumate al padrón». Partida en `components/portada/` (`Hero`, `Secciones`, `RankingDeLaPortada`) y `lib/portada.ts` (decisiones puras, con test).

**Decisiones:**
- **Las temporadas se piden una vez.** El pie y la portada las necesitan y `useRecurso` no deduplica: `App` las comparte con `ProveedorDeTemporadas`; una pantalla montada sola (los tests) las pide por su cuenta.
- **Pedidos:** torneos y temporadas salen juntos; el detalle del torneo en curso y el ranking esperan sólo al que necesitan y salen en paralelo. El hero no espera a nadie. Cada sección tiene su carga y su error (un test lo fija con el ranking caído).
- Las pestañas de categoría del ranking son **botones con `aria-pressed`** dentro de un `<fieldset>`, no una `<nav>` con `aria-current` como dice §5.1-4: cambian la tabla de al lado, no navegan.
- La columna «Fechas» muestra las fechas jugadas («3»). La spec dice «3/3», pero el denominador no está definido y el endpoint no lo trae: no se inventó.
- Sin oro, plata ni bronce en el podio (regla 8): círculo `--nock-soft`.
- La tarjeta publicada no lleva anillo (§6.5: el anillo, sólo con el avance real). Sin foto (decisión 1), la tarjeta va debajo de los accesos, sin flotar. La sombra flotante, sólo en escritorio.
- El año del antetítulo sale del texto de `startsAt` (`slice(0, 4)`), no de `Date`: en UTC−3 el 1 de enero es 31 de diciembre. Sin temporada activa, el antetítulo dice sólo «Bahía Blanca».
- `RotuloDeSeccion` acepta `nivel={false}`: arriba de un título grande es un antetítulo, no otro `h2`. `AnillosDeFondo` vive en `@bal/ui` (la puerta lo usa en `REF7-7`). El pie de `TarjetaDeTorneo` va en `--ink-muted`, como la referencia.
- Copy nueva que la spec no traía: «Todavía no hay resultados publicados esta temporada.» (ranking vacío).
- No se volvió a correr `frontend-design`: la dirección visual ya la fijaron `DISENO.md` y `referencia/`.

**Desvíos:** ninguno respecto del alcance.

**Hallazgo:** el E2E encontró que la portada **no montaba** contra la API real: el detalle público viene envuelto en `{ tournament }` y se leía directo. El test de componente pasaba porque su mock tenía la misma forma equivocada; se corrigió el mock primero (se lo vio fallar) y después el código. Además, `useCarga` conserva los datos de la ruta anterior cuando la ruta cambia: si el torneo destacado cambiara en caliente se vería un instante el avance del anterior. No pasa hoy (se elige una vez por carga); queda anotado.

**Deuda:** la foto sigue siendo `portada.webp` (decisión 1). El JS inicial de la landing pasó de 109 a 115 KB gz (presupuesto 120).
**Tests:** `landing/src/lib/portada.test.ts` (10) y 12 casos nuevos en `landing.test.tsx` (hero, tarjeta en curso / publicada / sin torneos, top 3 de torneos, top 5 del ranking sin medallas, ranking vacío, una sección caída, fichas de modalidad desde `SCORING`, alta, pedidos en paralelo y sin foto), todos vistos fallar. `componentes.test.tsx` suma `AnillosDeFondo` y el rótulo como antetítulo.

---

## 2026-11-09 · `REF7-5` — Landing: layout de documento, encabezado y pie

**Autor:** Claude Opus 5.5 · **Estado:** completado, en la rama `design/ref-7-rediseno`.

La landing pasó a ser un documento: sin `h-dvh overflow-hidden` ni `data-scroll-principal`, con el encabezado sticky y el pie al final (`L-2`). Encabezado nuevo de una fila (`L-3`): marca, «Inicio · Ranking · Torneos · Sumate» con la sección activa marcada (`aria-current` + barra `--nock-text`), tema e «Ingresar» siempre visible (`L-4`, decisión 2). La portada perdió su botón «Ingresar». El pie nombra la temporada activa. `Screen` de la landing a 1200px.

**Decisiones:**
- `useAlCambiarDeRuta` lleva **la ventana** arriba si no encuentra `[data-scroll-principal]`. La PWA, que sigue teniendo su contenedor, no cambia (un test lo fija).
- La temporada del pie es **la primera activa** de `/api/public/seasons` (`lib/temporada.ts`, con test); si no hay ninguna, el pie no la nombra. `REF7-6` la reusa para el hero.
- `html { scroll-padding-top: 4.5rem }` en la landing: con el encabezado sticky, el elemento enfocado con Tab podía quedar debajo (WCAG 2.4.11).
- Debajo de 760px el espacio entre marca y acciones baja de 24 a 12px: a 360px «Liga Bahiense» se truncaba. **Debajo de 360px el nombre queda `sr-only`** (el enlace sigue llamándose «Liga Bahiense»): a 320px marca, tema e «Ingresar» no entran juntos y la página scrolleaba de costado (lo encontró `flujo-completo.spec.ts`). Se sacó el `truncate`: si el nombre no entra, baja de renglón en vez de recortarse.
- **Los títulos parten una palabra que no entra** (`:where(h1, h2, h3) { overflow-wrap: anywhere }` en `tokens.css`). Al pasar a documento salió a la luz un desborde que el `main` con `overflow-y-auto` tapaba (recortaba también en horizontal): en la tarjeta de puntajes, un apellido largo en el `h1` de 32px expandido pasaba los 328px útiles de un celular de 360. Lo encontró `tarjeta-de-puntajes.spec.ts`. Vale también para la PWA (nombres de arquero y de torneo largos).
- El encabezado sigue llamándose `Encabezado` en el código (es el `SiteHeader` de `DISENO.md`), y `A_LA_APP` vive en `components/ui.tsx`, compartido por el encabezado y el pie.

**Desvíos:** el plan pedía «Footer nuevo» acá; ya había llegado en `REF7-4` (dentro del `main` como puente). En esta tanda pasó al final del documento y recibió la temporada.

**Deuda:** los demás textos de la portada (hero, tarjetas de acceso) siguen siendo los de antes: los reemplaza `REF7-6`.
**Tests:** `ui/src/fuentes.test.ts` suma uno (los títulos parten palabras), visto fallar. `landing/src/navegacion.test.tsx` (7 casos nuevos, vistos fallar: scroll de la ventana, sin contenedor de scroll, pie después del `main`, sección activa, las cuatro secciones, «Ingresar» en el encabezado de todas las páginas, la portada sin «Ingresar» propio); `ui/src/navegacion.test.tsx` (2: la ventana sin contenedor, y la PWA intacta con contenedor); `landing/src/lib/temporada.test.ts` (3). Los dos de `HomePage` que exigían el «Ingresar» en el cuerpo ahora exigen lo contrario.

---

## 2026-11-09 · `REF7-4` — Componentes compartidos

**Autor:** Claude Opus 5.5 · **Estado:** completado, en la rama `design/ref-7-rediseno`.

La piel nueva de botón, botón ícono, campo y tarjeta-enlace; `BadgeEstado` rediseñado (punto + texto, «En curso» late); cuatro componentes nuevos en `@bal/ui` —`BarraDeModalidades`, `RotuloDeSeccion`, `TarjetaDeTorneo` y `AnilloDeRecorrido`, que son el `ModalityBar`, `SectionHeader`, `TournamentCard` y `CircuitRing` de `DISENO.md`—; `SyncBadge` con ícono por estado; el encabezado de la PWA con `contexto` y vuelta atrás con ícono y texto; y el pie estático de la landing.

**Decisiones:**
- **`botonClases` se mudó a `@bal/ui`** (`boton.ts`), con `clasesDeBotonIcono`. La landing y la puerta necesitan las mismas variantes que WAFA (más `sobreMonte` y `lg`); la PWA lo reexporta y sus pantallas no cambian de import. Variantes nuevas `fantasma` y `sobreMonte`, tamaños `sm`/`lg`, deshabilitado sin opacidad (también con `aria-disabled` en enlaces) y `active:translate-y-px`.
- **Nombres en castellano**, como el resto de `@bal/ui` (`BadgeEstado`, `ChipModalidad`, `GraficoDeTorta`): cada archivo dice en su comentario a qué nombre de `DISENO.md` corresponde.
- **`@bal/ui` sigue sin depender del router.** Los componentes con enlaces reciben `enlace?: ComponenteDeEnlace` (`enlace.tsx`); por defecto, un `<a>`. Cada app tiene su `EnlaceInterno` (el `<Link>` con esa forma).
- **Decisión 4, completa:** además de `label` y `publico`, `completado.plural` pasó a «Esperando publicación» y su `vacio` al texto de §5.4. Los colores van al punto: `en_proceso` → `--nock-text`, `completado` → `--warn`. El `label` de `en_proceso` para el admin sigue siendo «En proceso»: la tabla de §4.5 dice «En curso», pero la decisión 4 no lo incluía.
- El pulso es `animate-pulso` (`@keyframes` dentro de `@theme`), en el color del estado (`--st`); lo apaga el bloque de `prefers-reduced-motion` que ya existía.
- El error del campo es un borde de 2px hecho con el borde de 1px más un anillo interior de 1px: con `border-2` el campo saltaba un pixel.
- `AnilloDeRecorrido` acepta, además de cuántos blancos (contados desde `inicio`), **cuáles** (sus índices): en WAFL los blancos no siempre se cargan en orden. Gira para que el blanco de inicio quede arriba, bajo el triángulo.
- La leyenda de la barra de modalidades va `aria-hidden`: la barra ya se describe entera en su `aria-label`.
- Los enlaces del pie miden 44px y no los 36 de la referencia: regla 9 de `CLAUDE.md`.
- **El pie tiene un solo acceso, «Ingresar a la app», y no uno por rol** (consultado con el autor). `DISENO.md` §4.17 traía «Líderes de patrulla · Administración», que choca con la puerta única de `FUNCTIONAL.md` §5.1 y con la guarda de `e2e/ingreso.spec.ts` (el E2E falló por eso). Se corrigió la spec. La guarda dejó de contar **un** enlace a `/app` —con la decisión 2 van a ser dos, encabezado y pie— y ahora exige lo que importaba: que todos digan «Ingresar» y ninguno nombre un rol. El primer test busca «Ingresar» con `exact`.

**Desvíos:**
- **`Screen` de la PWA dejó de renderizar el pie en esta tanda**, y no en `REF7-9`/`REF7-10`: el pie perdió su variante compacta, y la alternativa era poner el pie grande arriba del teclado de scoring. Es la decisión 5 (sin pie en toda la PWA), ya confirmada. Se quitó la prop `conBarraFija`, que sólo elegía el pie compacto.
- **El pie de la landing pasó adentro del `<main>` que scrollea**, como puente: con columnas, fijo abajo se comería media pantalla. `REF7-5` saca el alto fijo y lo deja al final del documento.
- `TarjetaDeTorneo` ya reemplazó a las tarjetas del listado de la landing (`/torneos`) y del inicio de WAFA (en WAFA, «Armar patrullas» en los que no arrancaron). Los rótulos y la grilla de esas pantallas quedan para `REF7-8` y `REF7-9`.
- El texto de volver perdió la flecha tipográfica («← Blancos» → `IconoVolver` + «Blancos»). Se actualizaron los dos tests que buscaban «← Inicio».

**Deuda:**
- **Los textos de `SyncBadge` no son los de `DISENO.md` §6** («Al día», «N por enviar»…): el plan pedía «solo la piel» y se respetó `syncLabel`, que además muestra el motivo de un error. Pero los textos actuales son largos para un encabezado de 360px con título. Decidirlo en `REF7-10`.
- Los `<select>` y `<textarea>` sueltos de WAFA (fuera de `Field`) siguen con borde `--line` (`A-2` a medias) → `REF7-8`/`REF7-9`.
- La landing todavía no usa `botonClases`: sus botones se rehacen en `REF7-5` y `REF7-6`.
- El pie recibe `temporada`, pero nadie se la pasa todavía: la landing la pide en `REF7-5`.

**Tests:** `ui/src/boton.test.tsx` (17: variantes, tamaños, deshabilitado sin opacidad, botón ícono, tarjeta-enlace y `BadgeEstado` nuevo) y `ui/src/componentes.test.tsx` (29: barra, rótulo, anillo y tarjeta), los dos vistos fallar antes. Los del pie en `marca.test.tsx` se reescribieron (columnas, enlaces de 44px, acceso a la PWA, temporada) y se vieron fallar; el de `wafa.test.tsx` ahora exige que la PWA no tenga pie. `ui.test.tsx` busca «Esperando publicación».

---

## 2026-11-09 · `REF7-3` — Íconos nuevos

**Autor:** Claude Opus 5.5 · **Estado:** completado, en la rama `design/ref-7-rediseno`.

Los 11 íconos de `DISENO.md` §4.18 (`IconoChevron`, `IconoFlecha`, `IconoVolver`, `IconoSincronizar`, `IconoSinSenal`, `IconoPanel`, `IconoPodio`, `IconoArqueros`, `IconoCalendario`, `IconoLugar`, `IconoInstalar`) en `ui/src/iconos/navegacion.tsx`, con el `Svg` base, exportados desde `@bal/ui`. Todavía no los usa ninguna pantalla: llegan con `REF7-4` en adelante. Revisados a ojo a 16, 20 y 24px y al lado de texto de 16px.

**Decisiones:** archivo nuevo `navegacion.tsx` y no `acciones.tsx`: son de navegación y de estado, no acciones sobre un dato.

**Decisiones de `INFORME.md` §5, confirmadas con el autor (2026-11-09):** 1 — se mantiene `portada.webp` hasta tener una foto real del predio, y el hero funciona sin foto · 2 — «Ingresar» se muda al encabezado y al pie · 4 — «En curso» y «Esperando publicación» · 5 — sin pie en toda la PWA. **Las otras dos se toman por defecto, sin consultar:** 3 — recordar el último rol queda fuera de esta ronda (`REF7-13`, P2) · 6 — teclas de 64px de alto, con `TAMAÑO_TECLA_PX` = 56 como mínimo.

**Tests:** `ui/src/iconos.test.tsx` (26 casos, visto fallar los 26 antes): cada ícono sale del barril de `@bal/ui`, usa el trazo común (grilla de 24, 1.8, `currentColor`, sin relleno), es decorativo por defecto, dibuja algo y respeta `size` a 16, 20 y 24; suelto, acepta `role="img"` y `aria-label`.

---

## 2026-11-09 · `REF7-2` — Tokens nuevos y contraste

**Autor:** Claude Opus 5.5 · **Estado:** completado, en la rama `design/ref-7-rediseno`.

Los 13 tokens de `DISENO.md` §2.2 en los dos temas, la escala tipográfica completa en `@theme` (`text-hero`, `text-h2`, `text-h3`, `text-sm`, `text-mono`, `text-eyebrow`, con interlineado, peso y tracking) y `--radius-full`. El foco pasa de `--nock` a `--focus-ring` (`A-1`: 2.59:1 → 6.19:1 en claro). Ningún valor existente cambió: en `tokens.css` sólo se quitaron las dos líneas del `:focus-visible`.

**Decisiones:**
- **Los `h1` vuelven a medir 32px.** Los 21 `text-[var(--text-display)]` / `text-[var(--text-score)]` pasaron a `text-display` / `text-score` (hallazgo de `REF7-1`: Tailwind 4 tomaba el valor arbitrario como color). Es un cambio visible en todas las pantallas con título: es el tamaño que `DESIGN_SYSTEM.md` §3 siempre pidió, no uno nuevo.
- Los tokens nuevos de la escala llevan el peso (`--text-h2--font-weight: 700`…); un `font-*` explícito al lado gana. A `--text-score` y `--text-display` **no** se les agregó peso, para no cambiar valores existentes: los usos ya llevan `font-bold`.
- `--text-sm` pisa el `text-sm` de Tailwind: el interlineado pasa de 1.43 a 1.45 en todos los metadatos. Es el valor de §3.2.
- El test de contraste cubre, además de la tabla de §2.3, los puntos de `BadgeEstado` (marca, 3:1) y el texto de estado de `SyncBadge` y de los errores (4.5:1) sobre `bg` y `surface`, que `REF7-4` va a usar.

**Deuda:** `--danger` como **texto** sobre `--surface-2` en oscuro da **4.42:1** (pide 4.5). Hoy no hay texto de error sobre `surface-2`, así que no entró al test; si aparece uno, hay que oscurecer o usar `--surface`.
**Tests:** `ui/src/contraste.test.ts` (87 casos, visto fallar 43 antes): todos los pares de §2.3 en los dos temas leyendo `tokens.css`, el foco con `--focus-ring` y las dos sombras en los dos temas. `fuentes.test.ts` suma un caso que prohíbe `text-[var(--text-…)]` en los `.tsx` (visto fallar con los 21 usos). `paleta.test.ts` y `accion-primaria.test.ts` siguen verdes.

---

## 2026-11-09 · `REF7-1` — Fuentes autohospedadas

**Autor:** Claude Opus 5.5 · **Estado:** completado, en la rama `design/ref-7-rediseno`.

Archivo y Martian Mono variables (`@fontsource-variable` 5.3.0, dependencias de `@bal/ui`) se importan al principio de `tokens.css`; las tres familias apuntan a `'Archivo Variable'` y `'Martian Mono Variable'`, y la utilidad `font-display` agrega `font-stretch: 125%`. Los 31 usos de `font-[var(--font-display)]` pasaron a `font-display`. Verificado en el navegador: el `h1` de `/app` sale en Archivo al 125% de ancho y sólo se descarga el subset `latin`.

**Decisiones:**
- El `@import` del paquete funciona desde `tokens.css` en los dos builds (Tailwind 4 resuelve y rebasa las URL): no hizo falta importarlo en cada `styles/index.css`.
- **El precache de la PWA lleva sólo el subset `latin`**, no `**/*.woff2`. Los paquetes traen también cirílico, vietnamita y latin-ext: con el patrón genérico el precache subía de ~600 a 888 KiB, ~200 KB que cada celular bajaría al instalar y que ninguna pantalla en castellano pide (`unicode-range`). `latin` cubre ñ, tildes, ¿, ¡ y la puntuación. Queda en 725 KiB. Con señal, un nombre con un carácter de latin-ext baja ese subset igual; sin señal, ese carácter sale en la fuente del sistema.
- `scripts/presupuesto.mjs` (que ya corre en el CI) verifica sobre `sw.js` que se precacheen las dos fuentes latin y ninguna otra. Se lo vio fallar contra el build con el patrón genérico.

**Desvíos:** el ítem del plan decía «el precache incluye `**/*.woff2`»; se acotó a `latin` por lo de arriba. El DoD («en modo avión los títulos siguen en Archivo») se cumple igual.

**Hallazgo para `REF7-2`:** `text-[var(--text-display)]` (21 usos) **no aplica el tamaño**: con `var()` en un valor arbitrario, Tailwind 4 asume que es un **color**. Los `h1` de toda la app miden 16px, no 32 (medido en `/app`). Es la causa real de buena parte de `D-2`. Se arregla al agregar la escala a `@theme` usando `text-display` / `text-score` en lugar del valor arbitrario.

**Deuda:** `pnpm lint` falla en local si hay worktrees de otras sesiones en `.claude/worktrees/` (cada uno trae su `biome.json`). En el CI no pasa: `.claude/` no se versiona.
**Tests:** `ui/src/fuentes.test.ts` (12 casos, visto fallar 11 antes): los dos `@import` antes de cualquier regla, ninguna familia `'Archivo Expanded'`, los tres tokens con las familias cargadas, la utilidad con el eje de ancho, los paquetes como dependencias, el nombre de familia igual al del `@font-face` de cada paquete, y ningún `.tsx` con la clase vieja.

---

## 2026-11-08 · `ref-7` — Informe y plan del rediseño visual

**Autor:** Claude Opus 5.5 · **Estado:** solo documentación, en la rama `design/ref-7-rediseno`. Ningún cambio de código.

### Qué se hizo

Revisión visual de las tres apps, a pedido del autor: «mejorar el diseño para que sea más profesional; diseño completamente nuevo para la landing y `/app` (prioridad absoluta); cambios simples y de alto impacto en Líder y Admin; mejorar la UI/UX general». Quedó en [`post/ref-7/`](post/ref-7/README.md):

- [`INFORME.md`](post/ref-7/INFORME.md): 26 hallazgos con ID y las 6 decisiones a confirmar.
- [`ACTION_PLAN.md`](post/ref-7/ACTION_PLAN.md): 13 tandas `REF7-N`.
- [`DISENO.md`](post/ref-7/DISENO.md): la especificación con valores exactos.
- [`referencia/`](post/ref-7/referencia/index.html): las pantallas y los componentes propuestos en HTML, con capturas.

### Hallazgos que conviene saber aunque no se implemente nada

- **Las fuentes nunca cargaron.** No hay `@font-face` en el repo y `'Archivo Expanded'` no existe como familia (el ancho es un eje de Archivo variable). Todo se ve en la fuente del sistema. → `REF7-1`.
- **El foco en el tema claro da 2.59:1** (`--nock` sobre `--bg`), por debajo del 3:1. El comentario de `tokens.css` asumía que el foco estaba bien. → `REF7-2`.
- **El borde de los controles da 1.3:1**, el **botón de peligro en oscuro** ~3:1 y el **badge "Completado, sin publicar" en claro** 2.59:1. → `REF7-2` y `REF7-4`.
- **En WAFL, el pie con los logos queda entre la lista y el teclado de scoring.** → `REF7-10`.

### Decisiones

Ninguna tomada todavía: las 6 de `INFORME.md` §5 se confirman antes de cada tanda. Los valores existentes de `DESIGN_SYSTEM.md` §2.1 **no cambian**: solo se agregan tokens. `DESIGN_SYSTEM.md` se actualiza en `REF7-11`, cuando lo implementado lo justifique.
## 2026-11-09 · El padrón viejo vuelve a verse, se edita en el lugar y entra al ranking por sexo (BE-23)

**Autor:** Claude Opus 5.5 · **Estado:** completado.

### Qué pasaba

El pedido fue «agregar editar arqueros». Editar ya existía (`PATCH /admin/archers/:id`, el lápiz de cada fila), pero no servía para el caso que lo motivó:

- **Los arqueros anteriores a `BE-19` no aparecían en ningún lado de WAFA.** `BE-19` agregó `registrationStatus`, `sex` y `dni` sin migrar los documentos existentes, y la lista filtraba `registrationStatus: 'aprobado'`, una igualdad que no matchea una clave ausente. Quedaban afuera del padrón, de la búsqueda y del wizard de torneo: no se podían editar porque no se podían encontrar. Los tests no lo veían porque todos los fixtures se crean por la API actual, que ya escribe las tres claves.
- **Aunque se encontraran, el sexo cargado no movía el ranking.** El ranking por sexo lee `standings.sex`, que es un snapshot del torneo (`participants.sex`). Completar el padrón no tocaba ninguno de los dos, y `db:reconcile` recalcula desde `participants`.
- **En el celular el lápiz parecía no hacer nada.** El formulario de edición se abría arriba de todo, encima del buscador; con el arquero abajo en la lista, quedaba fuera de pantalla.

### Decisiones

- **Consulta tolerante en vez de migración.** «Aprobado» se consulta como `registrationStatus: { $ne: 'pendiente' }` y `toView` lee las tres claves con `??`. Una migración resuelve los documentos de hoy pero no protege la consulta del próximo campo que se agregue sin migrar; ésta funciona sin correr nada en producción. Un arquero viejo lo cargó el admin, que es exactamente lo que vale como aprobado (`archerRepo.create`).
- **`sex` se propaga hacia atrás; nombre y categoría no.** Cambio a la decisión 2 de `ARCHITECTURE.md` §5, anotado ahí como excepción: el sexo es la pool en la que se rankea, no algo que pasó ese día. La edición escribe el valor nuevo en `participants` y `standings` del arquero dentro de una transacción. Una corrección de sexo mal cargado lo mueve de vista, no lo deja en las dos.
- **Editar se abre en el lugar de la fila**, con el foco en el primer campo (que la trae a la vista); arriba queda sólo el alta. El aviso dice qué falta («sexo», «DNI» o los dos) y un filtro «Sólo con datos incompletos», del cliente como el de categoría, deja a quienes hay que completar.

### Verificado

Tests nuevos vistos fallar por la razón correcta antes de cada cambio: lista vacía para el arquero viejo; ranking por sexo sin él después de cargarle el sexo. En el navegador, contra una base descartable con doce arqueros insertados con la forma de antes de `BE-19`: aparecen todos con «Falta completar sexo y DNI», el formulario se abre en el lugar del último de la lista a 375 px, guarda, y el filtro deja sólo a los incompletos. `pnpm -r typecheck`, `pnpm -r test` (1897 tests), Biome y `verificar-capas` verdes.

### Deuda

- El mensaje de lista vacía con un filtro de categoría sin resultados sigue diciendo «El padrón está vacío»; es anterior a este cambio.

---

## 2026-11-04 · Tercer CI de la PR 80: una carrera del test al cerrar el circuito

**Autor:** Claude Sonnet 5.5 · **Estado:** sigue la serie de correcciones de la PR 80; no es una tanda nueva.

### Qué pasó

Con el arreglo del CSRF, el iPhone 14 pasó, pero el CI falló en **otro** test y en **otro** navegador: `alta-publica.spec.ts` en Chromium, que había pasado en los dos CI anteriores. Falló en «Finalizar torneo» → «Torneo finalizado», con la pantalla mostrando «Falta sincronizar 1 cambio. Buscá señal y probá de nuevo».

### Causa

No es el servidor (el log no tiene ni un rechazo) ni el cambio del CSRF. `requestClose()` **encola el cierre sólo si el outbox está vacío** (`OFFLINE_SYNC.md` §5.5, a propósito: cerrar con puntajes pendientes confundiría al líder). Firmar sincroniza en segundo plano, y el test tocaba «Finalizar torneo» apenas la UI mostraba la última firma, **antes de que la op de esa firma llegara al servidor**. Con la CI rápida casi siempre ganaba la carrera; esta vez no. La app hizo lo que tiene que hacer: avisó, y un líder con señal toca de nuevo.

La reproduje: con el sync de la patrulla demorado 3 s (`page.route`), el test falla en el mismo punto y con **el mismo mensaje**, antes del arreglo.

Había una segunda carrera igual, un paso más adelante: «Torneo finalizado» aparece al **encolar** el cierre, no al sincronizarlo, y el test cerraba el contexto del navegador enseguida. Con el sync normal gana casi siempre; con el sync lento perdía y el torneo no llegaba a `completado`.

### Qué cambió

- `e2e/ayudas.ts`: `esperarOutboxVacio(page)`, que espera a que el outbox de IndexedDB esté en 0. Es la condición exacta que lee `requestClose`; no se mira el indicador del encabezado, que es otra cosa.
- `alta-publica.spec.ts`: lo usa antes de «Finalizar torneo» y otra vez antes de cerrar el contexto.
- `flujo-completo.spec.ts`: antes de «Finalizar torneo» (tenía la misma carrera; no había fallado).

Sólo tests; ningún cambio en la app.

### Verificación

Con el sync demorado 3 s (300 veces más lento que el normal): falla antes, pasa después. Suite completa de los tres proyectos: **60/60** (`chromium` 42, `Pixel 7` 9, `iPhone 14` 9). Biome sin errores.

### Lo que no puedo afirmar

- **Que no haya otra carrera parecida.** Esta apareció porque el CI es más lento que mi máquina. Hay specs que clickean tras una acción que sincroniza en segundo plano; revisé los dos que cierran el circuito, no todos.
- **El CI real todavía no corrió con esto.**

### Una observación sobre el producto (no la toqué)

Un líder con señal que firma al último arquero y toca «Finalizar torneo» enseguida ve «Falta sincronizar 1 cambio. Buscá señal y probá de nuevo», aunque tenga señal y la op esté a milisegundos de llegar. Es el diseño documentado, pero el mensaje manda a buscar antena cuando lo que falta es esperar un instante. Una opción sería que `requestClose` intente vaciar el outbox antes de rendirse. Cambia §5.5 de `OFFLINE_SYNC.md`, así que es decisión tuya.

---

## 2026-11-04 · Segundo CI de la PR 80: queda 1 test, y era un bug del cliente (CSRF)

**Autor:** Claude Sonnet 5.5 · **Estado:** continúa la corrección de la entrada de abajo; no es una tanda nueva.

### Qué pasó

Con el arreglo de WebKit, el CI de la PR 80 pasó de 8 fallos a **1 de 60**: `el alta pública se completa entera por teclado`, otra vez en iPhone 14, otra vez «La solicitud no pudo validarse». En mi máquina (WebKit en Windows) pasa, así que no pude reproducirlo.

### Causa

La traza del CI, que bajé del artifact, lo muestra sin ambigüedad: `GET /api/auth/csrf` → 200 con la cookie en `Set-Cookie` y el token en el cuerpo; después `POST /api/public/archers` salió **con la cookie y sin el header `x-csrf-token`** → 403. El cliente (`asegurarCsrf`) hacía el `fetch` y releía `document.cookie` de inmediato; en WebKit/Linux la cookie recién recibida todavía no era visible ahí, aunque el navegador ya la tenía y la mandó. Ignoraba el token que la propia respuesta trae.

**No es sólo un problema del E2E.** Es el primer POST de un visitante que llega a `/alta` sin ninguna petición previa a la API: justo lo que hace un arquero nuevo con un link. Si Safari en iPhone se comporta como WebKit/Linux acá, vería «Recargá la página» en su primer intento (y andaría al recargar, porque la cookie ya estaría). No lo pude verificar en un iPhone.

### Qué cambió

- `@bal/cliente`: si la cookie no se ve tras pedir el token, usa el `csrfToken` del cuerpo. La cookie sigue mandando si está; el cuerpo de una respuesta que no salió bien, o que no es JSON (un portal cautivo con un 200 de HTML), se ignora y la mutación sale igual sin header, como antes.
- `SECURITY.md` §CSRF lo dice.

### Cómo se hizo

Test primero: el caso «usa el token que vino en el cuerpo» falló con el header en `null` (la razón correcta) antes del arreglo. 7 tests nuevos en el cliente (cliente 57 → 64). **6 mutaciones, todas detectadas:** sin el respaldo del cuerpo, el cuerpo por encima de la cookie, confiar en una respuesta con error, relanzar el error de un cuerpo que no es JSON, aceptar un token que no es texto, y pedir el token a otra ruta. Una condición mía (`token !== ''`) la saqué antes de mutar: era redundante, porque `enviar` ya descarta un token vacío.

### Lo que no pude comprobar

- **El arreglo no se puede reproducir acá**: el test unitario simula el comportamiento, y el E2E de iPhone 14 en Linux sólo lo confirma el CI.
- **iPhone real**: no se sabe si Safari de iOS tiene el mismo retraso.

### Lo que apareció de paso (no lo arreglé)

- **`GET /api/auth/csrf` manda dos `Set-Cookie` con dos tokens distintos** en la misma respuesta: el middleware pone la cookie en toda lectura y el handler vuelve a llamar a `ensureCsrfCookie`, que como la cookie del pedido no existe genera otro. El navegador se queda con el último, que es el que va en el cuerpo, así que es consistente y no rompe nada. Pero es desprolijo; se arregla haciendo que el handler lea el token que dejó el middleware.

---

## 2026-11-04 · El E2E de iPhone 14 (WebKit) falla en el primer CI (PR 80)

**Autor:** Claude Sonnet 5.5 · **Estado:** corrección de [`REF6-9`](post/ref-6/ACTION_PLAN.md); no es una tanda nueva.

### Qué pasó

Al abrir la PR 80, cuatro checks pasaron y **`E2E con tramo offline` falló: 8 tests, todos del proyecto `iPhone 14`**. Chromium y Pixel 7 pasaban. `REF6-9` había entregado ese proyecto sin correrlo (WebKit no estaba instalado), y esa limitación quedó anotada como pendiente; el CI confirmó que el pendiente escondía un fallo real. Lo bajé (60 MB) y lo reproduje local.

### Causas (las dos son del E2E, no de la app)

- **7 tests: la cookie de CSRF no llegaba.** El servidor E2E corre con `NODE_ENV=production`, o sea cookies `Secure`, sobre `http://localhost`. Chromium las guarda; WebKit no. Todo POST respondía «La solicitud no pudo validarse», y el login del líder y del admin y el alta pública fallaban. Arreglo: `COOKIE_SECURE=false` en `e2e/servidor.ts`.
- **1 test (`offline-recarga`): «WebKit encountered an internal error».** WebKit de Playwright rompe cualquier navegación con el contexto en `setOffline(true)`, aunque el service worker tenga el shell. Arreglo: en WebKit sólo se abortan las llamadas a la API.

### Decisiones y costos

- **Desactivar `COOKIE_SECURE` en el E2E deja de ejercitar la cookie `Secure` en todos los navegadores**, incluido Chromium. `env.test.ts` fija que producción la active por defecto, pero **ningún test mira el header `Set-Cookie` de una respuesta**. Si te importa cubrirlo, es un test del API que lea `Set-Cookie` con `NODE_ENV=production`. No lo agregué.
- **En Safari, `offline-recarga` ya no prueba que el shell abra sin red.** Sigue probando lo importante del escenario (lo cargado vive en IndexedDB, sobrevive a cerrar la pestaña y se sincroniza), pero esa parte sólo la verifica un iPhone real (`FE-21`). Está escrito en el test, en `TESTING.md` y en el plan.
- **Probé la alternativa mínima primero:** sólo `COOKIE_SECURE` arregló 7 de 8; el octavo era un problema distinto, no una consecuencia del primero.

### Verificación

Corrida completa local de los tres proyectos: **60/60** (`chromium` 42, `Pixel 7` 9, `iPhone 14` 9). Biome sobre los archivos tocados sin errores. **El CI real todavía no confirmó el arreglo.**

### Lo que apareció de paso

- **`e2e/` no se tipa en el CI**: `pnpm typecheck` sólo recorre `packages/*`. Corriendo `tsc -p e2e/tsconfig.json` a mano salen 3 errores `TS2488` en `objetivos-tactiles.spec.ts` (`NodeListOf` sin iterador: a ese `tsconfig` le falta `DOM.Iterable` en `lib`). No son de este cambio. No los arreglé.

---

## 2026-11-03 · El CI deja de estar en rojo: la pantalla de elegir rol ya no baja Zod

**Autor:** Claude Sonnet 5.5 · **Estado:** cierra lo que `REF6-11`, `REF6-12` y `REF6-15` dejaban abierto sobre el tope de bundle de «elegir rol». No es una tanda nueva del plan.

### Qué cambió

- **`@bal/shared` declara `sideEffects`** en su `package.json`: sólo `configuracionZod.js` y `navegador.js` tienen efectos reales al importarse. Sin la declaración, el empaquetador debía asumir que cualquier módulo del barril podía tenerlos y dejaba `schemas.ts` —y con él Zod— en el chunk compartido, aunque la pantalla de elegir rol no use ningún schema. Midiendo el sourcemap, ese chunk llevaba 362 KB sin minificar de Zod.
- **La pantalla de elegir rol baja de 105.53 a 82.81 KB gz.** WAFL (118.98) y WAFA (128.87) casi no se mueven: ésas sí usan los schemas.
- **El tope de esa pantalla baja de 105 a 90 KB** (`presupuesto.mjs` y `TECHNICAL.md` §5, que `verificar-docs` mantiene iguales). Con 105 había 22 KB de margen y un `import` que arrastrara el barril volvía a colar Zod sin que nadie se enterara.

### Decisiones

- **Arreglar la causa y no subir el tope.** `REF6-11` ofrecía recortar o subir; subirlo era firmar que la pantalla de entrada baje una librería de validación que no usa.
- **La lista de `sideEffects` es a mano y hay que mantenerla.** Si alguien agrega a `@bal/shared` un módulo con un efecto real al importarse, tiene que sumarlo ahí o el empaquetador se lo va a quitar. Quedó escrito en `TECHNICAL.md` §5.
- **`configuracionZod.ts` tiene que seguir siendo un módulo con efectos.** Aplica `z.config({ jitless: true })` cuando hay `document`, porque la CSP no permite `eval`. Está en la lista a propósito, y se confirmó que `jitless` sigue presente en los dos chunks que llevan Zod (`CerrarSesion` e `index`) y en la landing.

### Verificación

Presupuestos todos en verde (elegir rol 82.81/90, WAFL 118.98/125, WAFA 128.87/135, landing 109.24/120). E2E Chromium de escritorio **42/42**, con el test de la CSP de las tres pantallas y los flujos de WAFA y WAFL, que usan Zod. Tipos, Biome estricto sobre `packages`, `scripts` y `e2e`, `verificar-docs`, `verificar-capas` y `verificar-workspace` sin errores.

### Lo que no pude comprobar

- **El `pnpm lint` de la raíz falla en esta máquina, y no por el código**: Biome encuentra `.claude/worktrees/*/biome.json` (copias de trabajo del entorno, sin trackear) y se queja de configuraciones raíz anidadas. En el CI esa carpeta no existe. No lo toqué.
- **La suite E2E corrió sin `e2e/capturas.spec.ts`**, que no está en el repositorio (es una herramienta mía de capturas) y suma el test 43 de las corridas anteriores.
- **Un primer intento de E2E falló** con `EPERM` de Windows al vaciar `packages/landing/dist/assets`, no con un error del código: la landing construye sola y la segunda corrida pasó entera. Si el CI de Linux lo mostrara, sería otra cosa.
- **El CI real sigue sin haber corrido** con esto.

---

## 2026-11-03 · Los docs dicen la verdad (REF6-15)

**Autor:** Claude Sonnet 5.5 · **Estado:** [`REF6-15`](post/ref-6/ACTION_PLAN.md) hecha. **Con esto la serie `REF6` queda completa.**

### Qué cambió

Las once filas de `INFORME.md` §3.5 `B-2` quedaron cerradas, cada una como **implementado** o como **doc corregido** (la tabla está en el plan). Ocho ya habían quedado cerradas en las tandas anteriores; tres se cerraron acá:

- **Sync por sesión (implementado).** `SECURITY.md` prometía 300/min por sesión y el código contaba por IP. No era un detalle del doc: el wifi del club es **una sola IP para todas las patrullas**, y diez patrullas volviendo del monte y vaciando su outbox a la vez se cortaban entre sí con 429. El cliente reintenta los 429 y no pierde nada, pero el doc dice que `sync` «nunca debe ser rechazado». Ahora el cupo es de la sesión.
- **`/api/admin/*` sin límite (doc corregido).** El doc decía 60/min por sesión y el código nunca lo tuvo. No lo agregué: ver abajo.
- **`TESTING.md` §9 (doc corregido).** Describía una carpeta `tests/fixtures/` con constructores que nunca existió. Ahora describe `tests/helpers.ts`.

Además se corrigió lo que la auditoría encontró fuera de la tabla (ver abajo).

### Decisiones

- **El cupo de `sync` es de la sesión, y hay un tope por IP 20 veces más alto.** Contar sólo por cookie abre un agujero: quien no tiene sesión puede mandar una cookie distinta en cada request y no gastar nunca el mismo cupo, con una lectura a la base por request (cada una es un 401, pero el 401 sale de buscar la sesión). El tope por IP (6000/min) no mira la cookie y sólo se alcanza con una inundación. La clave guarda el **hash** del token, no el token.
- **No agregué un límite en `/api/admin/*`.** Es una sola persona, autenticada, con CSRF. Un tope no protege de una sesión robada —quien la tiene hace lo que el admin puede hacer, a ritmo humano— y sí puede cortar a un administrador legítimo cargando un torneo grande. Si alguna vez hace falta, la clave sería la sesión, como en `sync`. **Es una decisión de diseño que tomé yo y que podés revertir**: si preferís que el doc se cumpla, es agregar un `rateLimit` con `clavePorSesion`.
- **La guarda cubre dos cosas y nada más.** Versiones de `TECHNICAL.md` §1 y topes de bundle de §5. Un test que pretendiera leer el doc entero se rompería con cada frase reescrita y alguien lo desactivaría.

### Lo que apareció auditando

- **«Presupuestos — se verifican en CI» era falso para seis de diez filas.** Sólo los cuatro topes de bundle se verifican en el CI. «Navegar entre blancos», «primera carga en 3G», LCP y el p95 de rankings **no se miden en ningún lado**. Ahora la tabla lo dice fila por fila.
- **Hoy el CI está en rojo por un tope de bundle**: la pantalla de elegir rol baja 105.5 KB contra un tope de 105. Ya estaba así desde `REF6-11` y no lo causó esta tanda. El doc lo dice. Hay que recortar la entrada o subir el tope; sigue siendo decisión tuya.
- **Cuatro versiones viejas en `TECHNICAL.md` §1**, más `README.md` (React 18, Vite 6) y `CONFIG.md` (`node:20`). La guarda detecta exactamente ese tipo de error.

### Errores míos en el camino

- **El heredoc del shell me metió caracteres de control** (`\b` se volvió backspace) en tres regex del test de la guarda; Biome lo marcó como error y lo corregí con patrones sin escapes. Es la tercera vez que me pasa en esta serie.
- **Mi primera versión de los casos de prueba de la guarda era una cadena de `replace` encadenados**, ilegible y fácil de equivocar. La rescribí con la fila rota completa en cada caso.

### Verificación

Tipos y Biome estricto sin errores; `verificar-docs` y `verificar-capas` en verde sobre el repo real. **12 mutaciones, todas detectadas.** E2E: Chromium de escritorio 43/43 (3.5 min). Tests de `@bal/api`: 531.

### Estado de la serie `REF6`

Las quince tandas están hechas. Lo que sigue abierto, todo de decisión o de red:

- ~~**El tope de bundle de «elegir rol»** (105.5 contra 105): el CI está en rojo.~~ **Resuelto** en la entrada de arriba: baja a 82.8 KB y el tope pasa a 90.
- **`aikido:scan` (`BE-14`)**: los motores SAST e IaC de la instalación local no funcionan. `/security-review` tampoco se corrió desde `REF6-2`, y esta serie tocó la sincronización, la validación de entrada y el límite de tasa.
- **Drenado en Railway** (`deploy.drainingSeconds` > 10 s) para que el apagado ordenado de `REF6-13` sirva.
- **Pantalla encendida y «registrar una flecha» en un celular real**: nunca se probaron en uno.
- **El workflow de mutación nunca corrió en el CI**, ni se confirmó que el CI acepte los SHA fijados ni que construya la imagen con el digest.
- **La landing** sin tipos de punta a punta.

---

## 2026-11-03 · Mutación sistemática (REF6-14 / T-7)

**Autor:** Claude Sonnet 5.5 · **Estado:** `T-7` de [`REF6-14`](post/ref-6/ACTION_PLAN.md) hecho. Con esto la tanda queda completa, salvo el `aikido:scan`.

### Qué cambió

- **Stryker** (`@stryker-mutator/core` y `vitest-runner`, 10.1.1) como dependencia de desarrollo de la raíz, con una configuración por paquete y un script `mutacion`.
- **`.github/workflows/mutacion.yml`**: de noche (05:00 UTC, las 2 en Argentina) y a demanda. **No corre en cada PR ni bloquea merges**: tarda minutos en el dominio y bastante más en la sincronización, que levanta un MongoDB en memoria por worker.
- **Dos objetivos**, los que el plan nombraba: el dominio (`@bal/shared`) y `syncService`, la sincronización idempotente que es una de las cuatro tareas que definen el proyecto.

### Los números de partida

| Objetivo | Puntaje | Piso (`break`) | Mutantes | Tiempo |
|---|---|---|---|---|
| `@bal/shared` | **76.6 %** | 70 | 1124 | 1.5 min |
| `syncService` | **76.82 %** | 70 | 384 | 26.5 min |

En el dominio lo que importa está alto: `ranking` 96 %, `league` 95 %, `stats` 94 %, `scoring` 93 %, `distribucion` 89 %, `patrolling` 85 %. Lo bajo es `schemas.ts` (18 %), y ahí no es ruido.

### Decisiones

- **El piso (`break`) queda unos puntos debajo del puntaje real**, para que el job falle ante una regresión y no por ruido. Se sube a mano cuando el puntaje suba. Un piso en el valor exacto fallaría por un mutante que cambia de lado. El de `syncService` (70) se fijó sobre la corrida de **76.82 %**; después se agregaron los 9 tests y **no se volvió a medir la corrida entera** (26 min), así que el puntaje real hoy es mayor.
- **Se excluyen `constants.ts` y `domain.ts`, y nada más.** Son catálogos de datos y etiquetas: de 99 mutantes, 89 sobrevivieron (45 de texto, 17 de objetos, 12 de booleanos y 10 de arreglos de datos). No excluí `schemas.ts` aunque tenga el puntaje más bajo, porque ahí 76 de los 169 sobrevivientes (45 %) son mutantes de método y de regex: quitar un `.trim()` o relajar un patrón no lo detecta ningún test de `shared`. Los cubren los tests de integración del API, que esta corrida no ejecuta. Es un hueco real del dominio medido por sí solo, no un falso positivo.
- **`syncService` corre sólo los 5 archivos de tests que lo ejercitan**, con `concurrency: 2` y un `timeoutMS` de 2 minutos. Correr los 28 de la suite multiplicaría el tiempo sin probar más a `syncService`.

### Lo que la primera corrida ya encontró

La corrida de `syncService` dejó 79 mutantes vivos y 10 sin cobertura. 34 son textos de mensajes de error. De los otros 55, estos son los que importan, y **el código estaba bien: lo que faltaba era un test que se enterara si dejaba de estarlo**:

- **Quién puede firmar a quién** (línea 561): nada comprobaba que una patrulla no pueda firmar a un arquero de otra, ni que un arquero inexistente se rechace en vez de romper. Quitar la comprobación pasaba todos los tests. Es una regla de seguridad.
- **Quién gana cuando dos celulares cargan la misma celda** (líneas 399-401): el desempate por `opId` a igualdad de hora, y la comparación `>` contra `>=`, no tenían test. Cambiar quién gana no rompía nada.
- **Reprocesar una op que ya se había aplicado** (el caso de `B-4`: el proceso muere después del commit y antes de confirmar la marca): que quede `superseded` y no cambie el puntaje no lo verificaba nadie.
- Se escribió `tests/sync-reglas.test.ts` (9 tests) y se repitió la prueba **sólo sobre esas líneas**: 13 de 13 mutantes muertos en el desempate, 12 de 13 en la autorización (el vivo era el de `B-4`, que cubre el tercer punto).

Siguen vivos, sin tests, y quedan como lista de trabajo (el reporte HTML dice cuáles):

- **Un `close` y un puntaje en el mismo lote** (línea 142): el `close` del lote tiene que contar para las ops que vienen después. No se prueba.
- **La firma PNG** (línea 606): los límites del tamaño mínimo.
- **La cuenta de lo esperado al cerrar** (línea 634): `activos.length * blancos`; un `/` en su lugar no rompe nada.
- **El torneo que desaparece a mitad de sesión** (línea 95, sin cobertura) y **la marca que se suelta entre el insert y la lectura** (línea 224).
- **`reclamar` devuelve `"mia"` y nadie lo compara**: `procesarOp` sólo mira `"duplicada"` y `"en-proceso"`, así que cualquier otro valor cuenta como «es mía». El mutante que lo cambia por `""` es equivalente al código real. No es un bug, pero el tipo `Reclamo` promete más de lo que el código verifica.

### Cosas a saber

- **Nunca corrió en el CI.** Lo probé en local; el primer disparo real es el de la primera noche (o con «Run workflow»). La sincronización tardó 26 min 30 s en local con 2 workers; si el runner es más lento puede tardar el doble. El `timeout-minutes` es 120 para el job de sincronización y 30 para el del dominio.
- **Dependencias nuevas, 116 paquetes** (Stryker trae mucho). `pnpm audit` no muestra nada alto o crítico, que es lo que bloquea el CI, pero sí 4 moderadas de `qs` que vienen de `typed-rest-client`, dependencia interna de Stryker. Es una herramienta de desarrollo que sólo corre de noche sobre nuestro propio código; el `qs` vulnerable es para `qs.stringify` con entrada controlada por un atacante, que ahí no existe. Quedan anotadas, no resueltas. (Además hay una de `minimatch` que viene de `vite-plugin-pwa` y no tiene que ver con esto.)
- **`reports/` y `.stryker-tmp/`** quedan ignorados en un `.gitignore` por paquete, no en el de la raíz.

### Errores míos en el camino

- **`pnpm mutacion -- --mutate …` falla** («too many arguments»): pnpm 9 pasa el `--` literal a Stryker. Se llama sin él.
- **Casi excluyo `schemas.ts`** por tener el 18 %. Miré de qué eran los sobrevivientes antes y no lo hice: son de método y de regex, no de texto.

### Verificación

Lint estricto sin errores; el workflow parsea y tiene sus 9 actions fijadas; `pnpm audit` sin altos. Las dos corridas completas se hicieron en local. Tests nuevos: `@bal/api` +9 (`sync-reglas`), los que cubren lo que la primera corrida encontró vivo.

### Deuda / lo que sigue

- **Subir `schemas.ts`**: los tests de validación del dominio de verdad están en el API. Mover o duplicar alguno en `shared` subiría el puntaje del dominio y haría la prueba autocontenida.
- **`aikido:scan`** (`BE-14`): sigue sin poder completarse por los motores rotos de la instalación local.

---

## 2026-11-02 · Lo visual sale de @bal/shared (REF6-14 / C-9)

**Autor:** Claude Sonnet 5.5 · **Estado:** `C-9` de [`REF6-14`](post/ref-6/ACTION_PLAN.md) hecho. Sólo queda `T-7` de la tanda.

### Qué cambió

- **`paleta.ts`, `tema.ts`, `despliegue.ts`, `tokens.css` y las cuatro imágenes pasaron de `@bal/shared` a `@bal/ui`**, con sus tests (87 de los 499 de `shared` se mudaron con ellos). `@bal/shared` es otra vez sólo el dominio, y un test lo fija: no puede volver a tener un módulo de presentación, exportarlo, ni exponer `tokens.css` o `assets/`.
- **Quién importa qué cambia poco.** Los consumidores de la paleta, el tema y `enlaceEntreApps` ya dependían de `@bal/ui`. El backend no usaba nada de esto, y la imagen de producción tampoco copiaba `assets/` ni `styles/` de `shared`.

### Por qué fue más fácil de lo que había anotado

En la tanda anterior dejé `C-9` sin hacer porque `@bal/ui` compila con `tsc` y **no copia los `.webp` a `dist`**: el `Footer` iba a perder su imagen en el build. El problema era real, pero no hacía falta resolverlo: si `assets/` y `styles/` van en la **raíz del paquete**, hermanos de `src/` y de `dist/`, el `import cba from '../assets/cba.webp'` es válido desde `src/Footer.tsx` y desde `dist/Footer.js`, a la misma profundidad. Es la misma disposición que ya tenía `shared`. Se comprobó en el build real: las imágenes salen con los **mismos nombres con hash** (`cba-BuVrM48w.webp`, `portada-BR2ho9sO.webp`), o sea, bytes idénticos, y los bundles pesan lo mismo (±0.02 KB).

### Decisiones

- **Los tests que leen archivos del disco corren en Node** (`// @vitest-environment node`), como corrían en `shared`. `ui` usa jsdom, y bajo jsdom `import.meta.url` no es una URL `file:`. Se tocó la configuración de `vitest` de `ui` para que corra también los `.test.ts`.
- **Una guarda de empaquetado** (`ui/src/empaquetado.test.ts`): cada entrada de `exports` y `files` existe en disco, y cada `@bal/ui/assets/…` o `@bal/ui/tokens.css` que importan la PWA y la landing apunta a algo real. Un import mal escrito de esos no falla al compilar TypeScript: falla en el build de Vite, o deja una imagen rota que sólo se ve sin señal.
- **`@bal/ui` ya figura en el árbol de paquetes** de `ARCHITECTURE.md` y del `README`, de donde faltaba (lo había creado `REF2-1` y nadie lo había anotado).

### Errores míos en el camino

- **Una ruta escrita a mano en un test que no busqué.** `marca.test.tsx` leía `packages/shared/assets/liga.svg` con la ruta armada con `join`; no figuraba en mi búsqueda de referencias (que buscaba el texto `shared/assets`) y apareció al correr los tests. Lo corregí. Es la razón por la que la guarda de empaquetado mira el árbol y no sólo el texto.

### Verificación

Tipos, Biome estricto y estructura sin errores. Tests: `@bal/cliente` 57, `@bal/shared` **419** (−87 mudados, +7 de pureza), `@bal/api` 492, `@bal/ui` **174** (+87 mudados, +10 de empaquetado), `@bal/app` 631, `@bal/landing` 64. **8 mutaciones, todas detectadas.** Build completo, imágenes con el mismo hash, pesos sin cambios. E2E: Chromium de escritorio 43/43 (3.3 min).

### Deuda / lo que sigue

- `T-7`: Stryker nocturno, que necesita instalar paquetes y un job nuevo en el CI.

---

## 2026-11-02 · Cadena de suministro del CI (REF6-14 / S-10, completo)

**Autor:** Claude Sonnet 5.5 · **Estado:** `S-10` de [`REF6-14`](post/ref-6/ACTION_PLAN.md), con tu autorización del paquete completo. Falta el `aikido:scan`.

### Qué cambió

- **Las actions del CI van por SHA de commit**, no por tag: `actions/checkout`, `actions/setup-node`, `actions/cache`, `actions/upload-artifact` y `pnpm/action-setup`, 17 referencias en total. Un tag es móvil: quien controle el repo de la action puede mover `v4` a otro código y el siguiente CI lo ejecuta. Cada SHA se resolvió con `git ls-remote` y lleva la versión en un comentario (`# v4.4.0`).
- **La imagen base va por digest.** `node:22-bookworm-slim` es un tag móvil: una build de mañana podía traer otra imagen sin que nada del repo cambiara. El digest es el del **índice** multi-arquitectura, para que construya igual en amd64 y arm64. Se verificó contra el registro (responde 200 y lista las plataformas).
- **`.github/dependabot.yml`**: actions, docker y pnpm, semanal. Es lo que hace que fijar no sea congelar: los SHA y el digest nuevos llegan como PR que pasan por el mismo CI.
- **`permissions: contents: read`** (ya estaba de antes en este mismo `REF6-14`).

### Cosas a saber

- **El tag anotado de `pnpm/action-setup`.** Su tag `v4` es un objeto de tag, no un commit: el SHA que devuelve `git ls-remote` a secas es el del **objeto de tag**, no el de un commit, y para fijar hace falta el commit. Se tomó el commit al que apunta (`^{}`), que es el que corresponde a la versión 4.3.0. Los otros cuatro son tags livianos y apuntan directo al commit.
- **No pude construir la imagen acá** (no hay Docker). Lo hace el job `imagen` del CI en el primer PR; si el digest estuviera mal, falla ahí, antes de llegar a producción. Sí verifiqué que el digest existe y es el índice correcto.
- **Dependabot recién actúa cuando el archivo llega a la rama por defecto**, no en esta rama. El primer lote de PR va a aparecer después de mergear.
- **Las versiones fijadas son las que `v4` señalaba hoy**: `checkout` 4.4.0, `setup-node` 4.4.0, `cache` 4.3.0, `upload-artifact` 4.6.2, `action-setup` 4.3.0. Es el mismo código que el CI ya corría; no se subió ninguna versión.

### Lo que falta

- **`aikido:scan`** (pendiente de `BE-14`) **no se pudo completar.** Con la sesión ya iniciada, el escaneo corrió sobre 48 archivos (el backend y la infraestructura de la serie `REF6`) y devolvió `issues: []`, pero **dos de sus motores fallaron**:
  - **SAST (Opengrep):** `unknown JSON field taint_intrafile` al cargar las reglas locales. Es una incompatibilidad entre las reglas y la versión del binario, determinista: se repitió con un solo archivo.
  - **IaC (Checkov):** `spawn …\aikido-mcp\checkov\checkov.exe ENOENT`: el binario no está instalado.
  - Lo que sí corrió: el escaneo de **dependencias** (`pnpm-lock.yaml` y los `package.json`), sin hallazgos. El de secretos no informó error, pero tampoco puedo afirmar que haya corrido.
  - **Un `issues: []` con dos motores caídos no es un escaneo limpio.** No se cuenta como tal. No instalé nada para arreglarlo: bajar y ejecutar binarios es decisión del dueño de la máquina. Hay que reinstalar o actualizar el plugin de Aikido, o correr el escaneo desde su panel o su integración con el repositorio.
- `C-9` y `T-7` siguen sin hacerse.

---

## 2026-11-02 · Calidad continua (REF6-14, parcial)

**Autor:** Claude Sonnet 5.5 · **Estado:** [`REF6-14`](post/ref-6/ACTION_PLAN.md) hecha a medias: `C-8` y `P-7` completos y verificados, parte segura de `S-10`; `C-9`, `T-7` y el resto de `S-10` sin hacer a propósito.

### Qué cambió

- **Biome en cero warnings, y el lint falla si vuelve uno** (`C-8`). Quince warnings: los mecánicos se arreglaron a mano (cinco `?.` equivalentes, incluidos dos en `middleware/auth.ts`, que exige 100 % de cobertura; la cobertura se mantuvo), y **tres funciones de complejidad cognitiva > 20 se partieron** sin cambiar comportamiento. En `presupuesto.mjs` se comparó la salida antes y después: idéntica byte a byte, con el mismo código de salida.
- **Anotar una flecha repinta una fila, no todas** (`P-7`). Además de `memo`, hizo falta que los callbacks fueran estables y que el conjunto de firmados conservara su identidad cuando no cambia: un `Set` nuevo en cada lectura cambiaba la identidad de `borrarUltima` y, con ella, la de los callbacks de **todas** las filas. `memo` solo no hacía nada. La lectura de los puntajes pasa a `by-target`.
- **`permissions: contents: read` en el CI** (`S-10`), la parte que se puede verificar sin red y no tiene efectos secundarios.

### Decisiones

- **`ArrowRow` compara las flechas por contenido.** IndexedDB devuelve objetos nuevos en cada lectura aunque el puntaje no haya cambiado: una comparación por referencia (la de `memo` por defecto) repintaría todas las filas igual. Los callbacks sí se comparan por referencia, y quien usa la fila tiene que darlos estables.
- **El test de tiempo tiene un tope holgado (150 ms) a propósito.** Es jsdom con IndexedDB falso, no un celular: sirve para ver el orden de magnitud y para que un cambio que lo multiplique (releer todo, repintar todo) se note. Un test de tiempos que falla por una máquina lenta enseña a ignorarlo. El presupuesto real de 50 ms se mide en el teléfono, que no tuve.
- **`C-9` no se hizo.** Mover código es fácil; lo que cambia el riesgo es que `@bal/ui` compila con `tsc` y no copia `.webp` a `dist`, así que el `Footer` perdería su imagen en el build. Es un cambio de empaquetado sin beneficio para quien usa la app, en una tanda que ya tocaba el camino de scoring. Mejor aparte y con el E2E de entrega de assets como red.
- **`S-10` a medias, a propósito.** Fijar actions por SHA y la imagen por digest sin un actualizador (Dependabot o Renovate) congela los parches de seguridad; activar Dependabot empieza a abrir PR en el repositorio; y un SHA o digest equivocado rompe el CI. Es una decisión tuya, no algo para resolver en silencio.

### Errores míos en el camino

- **Una constante de más.** Agregué `SIN_FLECHAS` para que las filas sin puntaje recibieran siempre el mismo arreglo; una mutación mostró que no cambiaba nada porque el comparador ya mira el contenido. Saqué el código en vez de dejarlo.
- **Un hueco real en mis tests**, que encontró otra mutación: nada comprobaba que un cambio de *quién* firmó, con el mismo tamaño del conjunto, llegara a la pantalla. Si mi optimización del `Set` se equivocara ahí, se vería firmado a quien no firmó, y editable quien sí. Escribí el test.
- **El shell se comió una barra invertida otra vez** al escribir `\n` en un script con heredoc: el script de `presupuesto.mjs` quedó con saltos de línea reales dentro de un string. Lo vi porque `node` falló al parsear, lo repararon dos ediciones, y comparé la salida contra la original para estar seguro.

### Verificación

Tipos y Biome estricto (`--error-on-warnings`) sin errores. Tests: `@bal/cliente` 57, `@bal/shared` 499, `@bal/api` 492, `@bal/ui` 77, `@bal/app` **631** (+15), `@bal/landing` 64. **14 mutaciones, todas detectadas.** E2E: Chromium de escritorio 43/43 (3.6 min).

### Deuda / lo que sigue

- **`C-9`**: mover lo visual de `@bal/shared` a `@bal/ui`, resolviendo antes cómo se empaquetan los assets.
- **`S-10`**: actions por SHA, imagen por digest, Dependabot o Renovate y `aikido:scan`, juntos y con tu OK.
- **`T-7`**: Stryker nocturno, que necesita instalar paquetes y un job nuevo.
- **Medir «registrar una flecha» en un celular real.** Hoy sólo hay la cifra de jsdom.
- Las cifras «medido 99 / 111 / 119» de `TECHNICAL.md` §5 están desactualizadas (hoy 105.5 / 118.8 / 128.8): es de `REF6-15`.
- `pnpm lint` de la raíz **falla localmente** si existen worktrees en `.claude/worktrees/` (cada uno trae su `biome.json` y Biome lo toma por una raíz anidada). En el CI no pasa porque `.claude/` no se versiona. Se corre sobre las carpetas del proyecto.

---

## 2026-11-02 · Limpieza del backend (REF6-13)

**Autor:** Claude Sonnet 5.5 · **Estado:** [`REF6-13`](post/ref-6/ACTION_PLAN.md) hecha, con un punto de despliegue pendiente y un ítem descartado a propósito (hallazgos `B-3`, `B-4`, `B-5`, `C-5`, `C-6`, `P-6`).

### Qué cambió

- **Una op de sync que quedó a medias ya no se pierde** (`B-4`). La marca de dedup nacía `applied` *antes* de aplicar: si el proceso moría entre la marca y el commit, el reintento recibía `duplicate` y el puntaje desaparecía. Ahora nace `processing`, con la hora, y una op que sigue así pasados 30 s se reprocesa. Es una de las cuatro tareas que definen el proyecto (`BE-10`), así que se probó más de lo habitual: 15 tests y 10 mutaciones sobre este camino.
- **El apagado espera a los requests en vuelo** (`B-3`) antes de cerrar Mongo, con un plazo de 10 s.
- **Un log que se puede consultar** (`B-5`): una línea JSON por evento, que respeta `LOG_LEVEL` (que se validaba y no filtraba nada). Cada lote de sync dice cuántas ops trae, cuánto tarda y cuántas rechaza.
- **`esClaveDuplicada`** (`C-5`) en vez de buscar «E11000» en el texto del mensaje.
- **Config muerta afuera** (`C-6`): `WEB_DIST_*`, `VITE_APP_NAME`, `validateBody`.
- **El listado público de torneos filtra en la consulta** (`P-6`).

### Decisiones

- **Una op en proceso reciente no se contesta, no se responde `duplicate`.** El cliente ya trata una op ausente de la respuesta como «reintentar más tarde» (el arreglo de `REF6-5`), así que omitirla es seguro; `duplicate` la sacaría del outbox del celular antes de saber si llegó a aplicarse, que es exactamente el bug que se quiere cerrar. Se aprovecha un contrato que ya existía en vez de inventar un estado nuevo.
- **La confirmación de los scores es por lote; la de firmas y cierre, dentro de la transacción.** Confirmar op por op suma un viaje a la base por cada score, y `REF6-5` existe para sacarlos (el tope fijo del lote pasa de 8 a 9: un `updateMany`). Un score se puede volver a aplicar sin consecuencias, así que una marca que quedó `processing` es inocua. Una firma o un cierre **no**: al reaplicarse rechazarían por «ya firmado» y el líder vería un conflicto que no existe, en el peor momento. Esas se confirman con su transacción.
- **Retomar es atómico y sólo de la misma patrulla.** Renueva la hora en el mismo comando que la busca, así que dos reintentos simultáneos no la toman los dos, y el `opId` de otra patrulla no se puede retomar.
- **El logger no usa `LOG_LEVEL` al importar sino al escribir**, y nunca lanza: un log que tira una excepción tira abajo la request que quería contar.
- **Sin LRU de rankings.** `TECHNICAL.md` §5 lo pedía; lo descarté. El único escritor de `standings` corre dentro de una transacción, así que invalidar antes del commit deja que un lector recachee datos viejos; hacerlo bien exige invalidar después del commit en tres sitios de `publishService`, y olvidar uno es un ranking desactualizado tras publicar. A cambio de ahorrar una lectura indexada de unos cientos de documentos, con `ETag` ya puesto. Se reabre si se mide. Quedó escrito en `TECHNICAL.md`.

### Lo que encontré

- **El listado público de torneos estaba roto de una forma silenciosa:** el `limit(200)` iba antes del filtro por estado, así que con 200 torneos recientes sin publicar, los públicos no aparecían. Hoy no pasa porque hay pocos torneos; el test lo reproduce.
- **Railway da 0 segundos de drenado por defecto** entre `SIGTERM` y `SIGKILL`. Sin configurarlo, el apagado ordenado no tiene tiempo de hacer nada. La clave es `deploy.drainingSeconds` en `railway.json` (o la variable `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`).

### Lo que dejé sin hacer, a propósito

- **No toqué `railway.json`.** Es configuración de despliegue; un valor con el tipo equivocado puede romper el próximo deploy, y la documentación de Railway muestra el número como string. Hay que decidirlo y probarlo en un deploy.

### Errores míos en el camino

- **Una cita a una sección que no existe.** En `CONFIG.md` escribí «Ver `TECHNICAL.md` §10» para el logger; no hay tal sección. Lo vi al buscar dónde estaba documentado y lo saqué.
- **Una ancla ambigua en mi propia especificación de mutaciones** (`result: 'processing'` aparece en dos funciones) y **dos mutaciones/tests que no distinguían nada**: un lote de prueba donde las aplicadas y las rechazadas eran una cada una (cruzarlas no se notaba), y una hora que se renueva al retomar sin test que la mirara. Las tres las encontró la mutación; las cerré.
- **Un bloque de test roto por comillas del shell** al agregarlo con `node -e`: perdió la línea del PNG. Lo vi al leer el archivo y lo reparé con el editor.

### Verificación

Tipos y Biome sin errores nuevos. Tests: `@bal/cliente` 57, `@bal/shared` 499, `@bal/api` **492** (+47), `@bal/ui` 77, `@bal/app` 616, `@bal/landing` 64. **31 mutaciones, todas detectadas.** E2E: Chromium de escritorio 43/43 (3.6 min).

### Deuda / lo que sigue

- **Configurar el drenado en Railway** (`deploy.drainingSeconds` > 10 s). Sin eso, `B-3` está escrito pero no hace nada.
- Sigue pendiente lo de `REF6-12` (pantalla encendida en un celular real; seis pantallas de WAFA sin `h1`) y el presupuesto de bundle de «pantalla de elegir rol».
- Sigue sin correrse `/security-review` ni `aikido:scan` formales desde `REF6-2`. Esta tanda toca la sincronización idempotente y el apagado: conviene antes de mergear.

---

## 2026-11-02 · Navegación accesible y pantalla encendida (REF6-12)

**Autor:** Claude Sonnet 5.5 · **Estado:** [`REF6-12`](post/ref-6/ACTION_PLAN.md) hecha, salvo la prueba de la pantalla encendida en un celular real (hallazgos `U-5` y `U-7`).

### Qué cambió

- **Cada pantalla pone su título** (`useTituloDePagina`): «Ranking · Liga Bahiense de Arquería». Antes todas se llamaban igual en la pestaña, en el historial y para un lector de pantalla (WCAG 2.4.2).
- **Al cambiar de ruta, la pantalla nueva se ve desde arriba y el foco va a su título** (`useAlCambiarDeRuta`). El bug real estaba en la landing: el `main` que scrollea es **uno solo para todas las rutas**, así que del ranking a la ficha de un arquero se entraba a la mitad. En la PWA cada pantalla monta su propio `Screen` y ya arrancaba arriba; el hook cubre el caso de la misma ruta con otro parámetro.
- **La pantalla no se apaga en un blanco** (`useWakeLock`): se pide al entrar a `TargetPage`, se suelta al salir y se vuelve a pedir al volver a ser visible la página, que es cuando el navegador lo suelta solo.

### Decisiones

- **El hook recibe el `pathname`, no usa el router.** `@bal/ui` no depende de `react-router-dom`; cada app lee su `location` en un componente de tres líneas. Solo cuenta el `pathname`: cambiar `?temporada=` no es otra pantalla.
- **El foco va al `h1`, y si no hay, al título del `Encabezado`.** Seis pantallas de WAFA no tienen `h1` (el título del encabezado es un `span`), así que sin el segundo camino no se movía nada. Se marca con atributos (`data-scroll-principal`, `data-titulo-de-pagina`) en vez de pasar refs: es una preocupación transversal y los dos contenedores viven en archivos distintos.
- **Si el título todavía no existe, se espera.** Una pantalla que carga datos o un chunk perezoso no tiene `h1` cuando cambia la ruta. Se observa el DOM hasta 3 s y se enfoca cuando aparece, **salvo que el usuario ya se haya puesto a escribir**: robarle el foco a quien está en un campo es peor que no moverlo. Tampoco se mueve el foco al abrir el sitio.
- **Un título enfocado por código no lleva anillo** (`tabindex="-1"`, solo los que se enfocan por código). No es un control.
- **WAFL solo recibe títulos.** Navega por estado, no por rutas, y mover el foco en medio de una carga no se justifica.
- **Pantalla encendida solo en `TargetPage`**, y un test lo fija: si alguien la quiere en otro lado, el test lo obliga a decidirlo a la vista. Cuesta batería y el recorrido dura horas.
- **Un test lee el código para exigir el título** (como `iconografia.test.tsx`), en vez de montar las ~25 pantallas: el olvido es fácil de cometer y casi imposible de ver a ojo.

### Lo que no pude verificar

**La pantalla encendida en un celular real.** La decisión 4 decía «probado en un celular real antes de fijarlo». Los tests usan una API simulada: prueban cuándo se pide, se suelta y se reintenta, no que el sistema operativo respete el candado ni cuánta batería gasta. Queda abierto.

### Errores míos en el camino

- **Una mutación equivalente.** Para ver si el Wake Lock reintenta tras un rechazo puse `pidiendo = true` justo antes de un `finally` que lo repone: no cambiaba nada y «sobrevivió». No era un hueco del test sino una mutación mal pensada; la reemplacé por una que no limpia `pidiendo` tras el rechazo, que sí se detecta.
- **Una barra invertida perdida** al escribir un test con un heredoc de shell (`split('\\')`); lo vio `tsc` y lo reescribí con `path.sep`.
- **Mi primer test estructural exigía el sufijo `Page`**, y `RecuperarPassword` es una pantalla sin él. Lo corregí para exigir al menos una llamada por archivo.

### Verificación

Tipos y Biome sin errores. Tests: `@bal/cliente` 57, `@bal/shared` 499, `@bal/api` 445, `@bal/ui` **77** (+16), `@bal/app` **616** (+40), `@bal/landing` **64** (+11). **23 mutaciones, todas detectadas.** E2E: Chromium de escritorio 43/43 (3.4 min).

### Deuda / lo que sigue

- **Probar la pantalla encendida en un celular y medir la batería.**
- **Seis pantallas de WAFA sin `h1`** (`Archers`, `Home`, `Payments`, `Ranking`, `Seasons`, `TournamentCreate`). Arreglarlo sin duplicar el `h1` de las que ya lo tienen es una decisión de diseño.
- **Presupuesto de bundle de «pantalla de elegir rol»: 105.53 KB contra 105.** Ya estaba sobre el tope antes (ver `REF6-11`); esta tanda suma ~0.45 KB por los hooks de `@bal/ui`. Hay que recortar o subir el tope.

---

## 2026-11-02 · Tipos de punta a punta en WAFA (REF6-11, cierre)

**Autor:** Claude Sonnet 5.5 · **Estado:** última entrega de [`REF6-11`](post/ref-6/ACTION_PLAN.md) (hallazgo `C-3`). Con esta, la tanda queda cerrada para WAFA.

### Qué cambió

- **WAFA pide por el cliente RPC de Hono** (`hc<…>`) tipado con las rutas del backend. Renombrar un campo en una ruta rompe el `typecheck` de la pantalla que lo lee, en vez de fallar en el celular de alguien. Probado con mutaciones, no sólo afirmado.
- **Los cuerpos y las consultas también quedaron tipados**, no sólo las respuestas: `bodyValidado` / `consultaValidada` son `parseJsonBody` / `parseQuery` movidos a un middleware. Hono sólo infiere un tipo de entrada si el schema aparece en la ruta.
- **El CSRF y el `ApiError` no se duplicaron**: `hc` recibe el `fetch` de `@bal/cliente`, que adjunta el token en cada mutación y convierte un rechazo en `ApiError`. Un `200` que no es JSON (el portal cautivo) sigue saliendo como `SyntaxError`, no como `ApiError`.

### Decisiones

- **Tipos importados por alias, no por dependencia ni por `dist`.** `@bal/api/tipos` apunta al fuente (`tsconfig.base.json`). Declarar `@bal/api` como dependencia lo habría vuelto una «librería compilada» para `verificar-workspace` (su `main` es `dist/`), y apuntar a `dist` exigiría construir el backend antes de cada typecheck del frontend. El costo: el typecheck de la app compila también el código del backend que los tipos alcanzan (~6 s en total).
- **Hono RPC y no DTOs a mano.** Las rutas ya estaban encadenadas, así que el tipo sale gratis y no hay una segunda copia del contrato que mantener. Con DTOs compartidos un campo renombrado en el servidor y no en el DTO volvería a compilar bien.
- **El cliente RPC vive en `lib/rpc.ts` y no en `apiClient.ts`.** WAFL importa `apiClient`, y el chunk de WAFL es el que se usa sin señal: no baja `hono/client`. Se comprobó en el build.
- **`import { type X }` no es `import type`.** Con `verbatimModuleSyntax` el primero deja un `import {} from …` que el bundler resuelve y carga. La guarda de `verificar-capas` exige la forma completa.
- **La landing quedó afuera.** El título de la tanda es WAFA y el costo es distinto: hay que cambiar la firma de `useRecurso` (de una ruta a una función). Queda como trabajo aparte.

### Lo que la migración encontró

Pasar las llamadas a tipos reales destapó tres desfases entre lo que el frontend declaraba y lo que el servidor manda. Los tests de UI no podían verlos: simulan la red con lo que cada test quiere que conteste.

- **`/results` nunca mandó `participantId`**, y el tipo del frontend lo exigía. El desempate de presentación de `rankParticipants` compara ese campo, así que con dos arqueros iguales en todo el orden dependía de cómo llegaran. El fixture del test de `podios` también lo traía: **el fixture mentía igual que el tipo**. Se escribió primero el test que lo muestra (rojo: `["p9","p1"]`) y se arregló en `podios`.
- **`category: string` en cuatro vistas del servidor** (arqueros, miembros de patrulla, pagos, ranking), cuando la base la guarda como `BowCategory`. Se corrigió en el servidor, sólo en tipos.
- **`pin?: string`** contra el `pin?: string | undefined` que infiere Hono con `exactOptionalPropertyTypes`.

### Errores míos en el camino

- **Casi llevo `hono/client` a WAFL.** Lo primero que escribí puso el cliente RPC dentro de `apiClient.ts`, que WAFL también importa. Lo vi al pensar en el bundle, antes de medirlo, y lo separé en `rpc.ts`.
- **Me salté dos `api.del`.** El patrón que usé para migrar sólo buscaba `post` y `patch`; los vio el typecheck (`Cannot find name 'api'`) al sacar el import. Después busqué por `api.` a secas.

### Verificación

Tipos y Biome sin errores en las carpetas del proyecto (el `pnpm lint` de la raíz falla por los worktrees de `.claude/`, que traen su propio `biome.json`). Tests: `@bal/cliente` **57** (+18), `@bal/shared` 499, `@bal/api` **445** (+27), `@bal/ui` 61, `@bal/app` **576** (+16), `@bal/landing` 53. **15 mutaciones, todas detectadas.** E2E: Chromium de escritorio 43/43 (3.4 min).

### Deuda / lo que sigue

- **Presupuesto de bundle de «pantalla de elegir rol»: 105.08 KB contra 105.** El CI lo corre. Ya estaba en 105.09 antes de esta entrega, medido sobre el `dist` del commit anterior. No es de esta tanda, pero está rojo.
- **Landing sin tipos de punta a punta** (cambiar la firma de `useRecurso`; ~2 KB sobre 108.7 de 120).
- **`useCarga` tiene complejidad cognitiva 23** (tope 20, es un warning). Viene de la entrega 1.
- Sigue sin correrse `/security-review` ni `aikido:scan` formales desde `REF6-2`. Esta entrega toca la validación de entrada de 15 rutas, que es justo lo que un revisor de seguridad querría ver: conviene correrlos antes de mergear.

---

## 2026-11-01 · WAFA: páginas chicas (REF6-11, las páginas)

**Autor:** Claude Sonnet 5.5 · **Estado:** segunda entrega de [`REF6-11`](post/ref-6/ACTION_PLAN.md) (hallazgo `C-1`, y el resto de `C-2`). **Falta** la que da los tipos de punta a punta (`C-3`).

### Qué cambió

- **Siete páginas de WAFA pasaron de 250 a ~100-175 líneas**: `Archers` 668 → 146, `Tournament` 624 → 144, `TournamentCreate` 527 → 144, `Patrols` 486 → 106, `Ranking` 311 → 141, `Publish` 260 → 159 y `Seasons` 256 → 111. Cada una es sólo la composición; los datos salen de un hook por pantalla y cada pieza tiene nombre y archivo.
- **Todas las cargas de WAFA usan `useCarga`**, incluidas las tres que no estaban en la lista (`Home`, `Payments`, `SelectorDeArqueros`). Antes cada pantalla reimplementaba `useState` + `useEffect` + `try/catch`, sin cancelación.
- **`useCarga` ganó `conservarDatos`.** Lo pidió `Archers`: sus filtros (búsqueda, «ver archivados») recargan **el mismo recurso con otra consulta** y hoy conservan la lista mientras llega la nueva. `useCarga` descartaba los datos al cambiar de claves —correcto para pasar del torneo A al B, que no puede mostrar ni un instante lo de A—, y con eso el padrón habría parpadeado con cada tecla.

### Cómo se hizo sin romper nada

El plan decía «una página por PR, con los tests de UI como red». Se partió **una página por vez, con los 256 tests de UI de WAFA corriendo después de cada una**, y las partes se **cortaron del archivo original por marcadores en vez de retiparlas**: el JSX que ya funcionaba se movió, no se reescribió. **No se modificó ni un test existente.**

### Decisiones

- **El error de la última acción, aparte del de la carga**, en cada página (`errorDeAccion ?? carga.error`). Con un solo slot, un refresco o una recarga que sale bien borraba el motivo por el que el servidor había rechazado lo que el admin acababa de hacer (el mismo caso de `REF6-7`).
- **Cada componente es dueño de su estado y de su pedido**, y avisa a la página con `onCambio` (que recarga y se **espera**: el botón sigue deshabilitado hasta que llegan los datos) y `onError`. La página no sabe cómo se hace «iniciar» ni «eliminar».
- **Carpetas por pantalla (`detalle/`, `padron/`…) y no un `components/` único**: ya existía `wafa/torneo.ts` (el dominio del seguimiento) y una carpeta `wafa/torneo/` al lado se confundía con él.
- **Se conservó un comportamiento discutible a propósito**: si falla la carga de temporadas en el wizard o en el ranking, se ve «no hay temporadas», como antes. Es engañoso (la carga falló, no están vacías), pero cambiarlo es otra decisión.

### Errores míos en el camino

- **Pisé un archivo antes de leerlo.** Escribí la página nueva de `Ranking` antes de correr el generador que cortaba piezas del original, y el generador leyó la versión ya reescrita. Estaba commiteada: se recuperó de `HEAD` y los generadores siguientes leen de `HEAD`, no del disco.
- **Cinco mutaciones sobrevivieron, y las cinco eran huecos que ya existían antes del refactor.** Nada comprobaba que la pantalla del torneo se actualizara después de «iniciar», que un pago rechazado mostrara su motivo, que marcar un pago se viera reflejado, ni cómo se comporta el selector del wizard cuando la búsqueda falla. La refactorización no los creó; la mutación los encontró. Los tests de UI «de red» sólo eran una red donde los agujeros ya estaban.
- **Un test de iconografía recorre cada `.tsx` de `app/src`** y cuenta uno por archivo: los 26 componentes nuevos sumaron 26 tests a la corrida (527 → 553) sin que yo escribiera ninguno. Todos pasan, pero el número de tests sube con la cantidad de archivos y no con el comportamiento cubierto.

### Verificación

`@bal/app` **560** (527 de antes de las páginas, 26 de la iconografía y 7 nuevos), `@bal/cliente` **39**, `@bal/api` 418, `@bal/shared` 499, `@bal/ui` 61, `@bal/landing` 53. Tipos y Biome sin errores; ni un warning en `app/src`. **16 mutaciones, todas detectadas**, cinco tras escribir el test que faltaba. E2E: Chromium de escritorio 43/43.

### Deuda / lo que sigue

- **Entrega 2 — tipos de punta a punta (`C-3`).** Sigue siendo lo único que falta de `REF6-11`. Ahora es más fácil: cada pantalla tiene un hook con **un solo lugar** donde se piden sus datos, así que migrar a `AppType`/RPC es tocar `useTorneo`, `usePadron`… y no cien sitios de llamada.
- **WAFL (`wafl/*`) sigue con sus cargas a mano**: no estaba en el alcance (la lista era de WAFA), y su capa de datos es IndexedDB, no HTTP.

---

## 2026-11-01 · Un cliente HTTP y un hook de carga (REF6-11, entrega 1 de 3)

**Autor:** Claude Sonnet 5.5 · **Estado:** primera entrega de [`REF6-11`](post/ref-6/ACTION_PLAN.md) (hallazgos `C-2` y `C-4` de [`INFORME.md`](post/ref-6/INFORME.md)). **Faltan** los tipos de punta a punta (`C-3`) y partir las páginas (`C-1`).

### Por qué en partes

`REF6-11` es la única tanda de tamaño L, y su propio riesgo dice «refactor amplio sin cambio funcional — una página por PR, con los tests de UI como red». Hacerla de una vez dejaba un cambio imposible de revisar y de revertir. Esta entrega es la que **no toca ninguna página**: crea las piezas que las demás necesitan y deja los tests de UI donde estaban.

### Qué cambió

- **Un paquete nuevo, `@bal/cliente`**, con el cliente HTTP y el hook de carga. Había dos clientes (`app/src/lib/apiClient.ts`, `landing/src/lib/api.ts`) que duplicaban el CSRF y tenían dos `ApiError` con formas distintas. Ahora los dos son delgados —dicen dónde cuelga la API y qué mensaje dar por defecto— y **ningún sitio de llamada cambió**: `app` 527 tests y `landing` 53, sin tocar uno.
- **`useCarga`** reemplaza el `useState` + `useEffect` + `try/catch` + `setError` que cada página reimplementaba, y que la landing tenía por su cuenta como `useRecurso`. Decisión 3 del informe: **hook propio**, no react-query.
- **Se sacó `@tanstack/react-query`** de las dependencias de `@bal/app`: nunca se importó. De paso, `ARCHITECTURE.md` y `TECHNICAL.md` decían que se usaba.

### Decisiones

- **Un paquete nuevo y no `@bal/ui` ni `@bal/shared`.** `@bal/ui` dice «sin I/O» en su descripción, y `@bal/shared` es el dominio puro: poner un cliente HTTP en cualquiera de los dos ensucia lo que cada uno promete. El costo es tocar los cuatro lugares donde hay que acordarse de un paquete nuevo (scripts de la raíz, `dev`, el Dockerfile y el CI); `scripts/verificar-workspace.mjs`, que existe por ese olvido, confirma que quedaron cubiertos.
- **`useCarga` conserva lo que se ve al recargar y lo descarta al cambiar de recurso.** Son dos cosas distintas: después de «iniciar torneo», la pantalla no puede parpadear a «cargando»; pero al pasar del torneo A al B no puede mostrar ni un instante los datos de A.
- **La recarga silenciosa generaliza lo que `REF6-7` había escrito a mano en `Tournament.tsx`**: no pasa por «cargando», un fallo no muestra nada, un éxito no borra el error de la última acción, y si ya hay una carga en vuelo no manda otra.
- **Una respuesta que no es JSON sigue saliendo como `SyntaxError`, y está escrito en un test.** Lo descubrí al unificar: si el cliente la convirtiera en un `ApiError(200, …)` —lo más prolijo—, `esReintentable` del outbox diría que no, porque no es 5xx ni 4xx transitorio, y la op se descartaría. El wifi del club tiene un portal cautivo que contesta `200` con una página HTML: sería un puntaje perdido por un portal.

### Errores míos en el camino

- **Un error de lint que el CI habría marcado**: `useEffect(..., claves)` no es un array literal, y mi comentario de supresión estaba en la línea equivocada (la del `useEffect`, no la de la lista). Biome lo contó como un error, no un aviso.
- **Una mutación sobrevivió**: que `recargar` cambie de identidad cuando llegan datos nuevos. Mi test sólo comparaba la identidad entre dos renders sin datos nuevos. Importa: es lo que se pasa de dependencia al refresco de 30 s, que se reiniciaría con cada dato. Ahora el test pasa por una recarga con datos distintos.

### Verificación

`@bal/cliente` **36** tests nuevos (rojos antes: el módulo no existía), `@bal/app` **527** y `@bal/landing` **53** sin tocar, `@bal/api` 418, `@bal/shared` 499, `@bal/ui` 61. Tipos del workspace limpios; `verificar-workspace` reconoce el paquete. **22 mutaciones, todas detectadas**. E2E: Chromium de escritorio 43/43.

### Deuda / lo que sigue

- **Entrega 2 — tipos de punta a punta (`C-3`).** `AppType` + cliente RPC de Hono, o DTOs compartidos. Hace falta decidir cómo se integra con el CSRF y el `ApiError` de `@bal/cliente`.
- **Entrega 3 — las páginas (`C-1`).** Siete pasan de 250 líneas: `Archers` 668, `Tournament` 624, `TournamentCreate` 527, `Patrols` 486, `Ranking` 311, `Publish` 260 y `Seasons` 256. Cada una adopta `useCarga` al partirse.
- **`@bal/cliente` no tiene umbral de cobertura** (como `landing` y `ui`): se mide, no se exige.

---

## 2026-10-31 · La regla 3 sin excepciones (REF6-10)

**Autor:** Claude Sonnet 5.5 · **Estado:** hecho. Décima tanda de [`post/ref-6`](post/ref-6/ACTION_PLAN.md) (hallazgo `B-1` de [`INFORME.md`](post/ref-6/INFORME.md)).

### Qué cambió

- **Un chequeo de CI para las capas** (`scripts/verificar-capas.mjs`, paso «Capas del backend»): falla si algo fuera de `repositories/` y `db/` importa `db/client`, o si una ruta importa un repositorio. La regla 3 de `CLAUDE.md` estaba escrita desde el principio y se rompía sin que nadie lo viera: una ruta pública llevaba semanas haciendo `seasons().find(…)`.
- **Las rutas hablan con servicios.** `rankingService` (ranking y ficha del arquero), `tournamentQueryService` (las lecturas de torneo de la landing y de WAFA) y `seasonService.listar`. La ruta valida, llama y serializa.
- **Las consultas que vivían en servicios pasaron al repositorio** (`tournamentRepo.updateIfStatus`), y **las transacciones abren su sesión por `db/sesion`**, que no expone colecciones.
- **El healthcheck** consultaba la base desde la ruta: ahora `saludService` → `saludRepo`.

### Lo que el hallazgo no decía

`B-1` hablaba de una ruta con una consulta. Al escribir el chequeo —que es lo que impide que vuelva— aparecieron **13 infracciones**, no una: la de `publico.ts`, `admin.ts` y `publico.ts` importando repositorios, el healthcheck, y **siete servicios** que importaban el cliente de Mongo. De esos, cinco sólo lo hacían para abrir una sesión de transacción; dos —`tournamentStateService` y `tournamentEditService`— **consultaban la base directamente**, con la misma violación que la ruta.

### Decisiones

- **`db/sesion.ts` en vez de una excepción para los servicios.** Prohibirle a un servicio importar `db/client` obligaba a decidir qué hacer con las transacciones. Dejarlas como excepción abría justo el hueco que el chequeo quería cerrar: el mismo import da acceso a todas las colecciones. `iniciarSesion()` expone una sola cosa —abrir una sesión—: la transacción se agrupa en el servicio y cada consulta sigue pasando por un repositorio.
- **Las rutas tampoco importan repositorios**, aunque el plan sólo pedía lo de `db/client`. Con la regla a medias, la ruta que arma su respuesta con repositorios habría seguido ahí, que es lo que `B-1` señalaba en su segunda viñeta. Eran 8 imports más.
- **`index.ts` queda permitido**: es la raíz de composición, conecta y desconecta la base. Es la única excepción y está escrita en el script.
- **Se mira lo que se importa, no cada llamada.** Es barato, no se confunde con un alias y alcanza para que la regla no se pueda romper sin que alguien lo vea. Lo que no ve: un repositorio que reciba una colección por parámetro. No existe hoy.

### Errores míos en el camino

- **El script de edición se cortó a la mitad** (esperaba un `}` al final de `admin.ts` que no estaba) y dejó `publico.ts` reescrito y `admin.ts` sin tocar. Se rehízo sólo la parte que faltaba; el golden, que se comparó después de las dos, es lo que dice que quedó bien.
- **El primer escenario del golden no probaba el ranking**: con un solo torneo publicado, nadie llegaba a `bestN` y todas las vistas salían vacías (`ranked: 0`). Un golden sobre respuestas vacías no compara nada. Se agregó un segundo torneo publicado y un torneo en proceso, y se verificó que el ranking, la ficha y los resultados tuvieran datos antes de congelarlos.
- **Rutas con `\` en Windows**: el chequeo imprimía `routes\publico.ts` y el test esperaba `/`. Normalizado.

### Verificación

`@bal/api` **418** (+13 de `capas.test.ts`), cobertura de `services/` 96,4 % de líneas y 83,8 % de ramas (umbral 85/80: el margen de ramas bajó de 85,5 a 83,8 porque el código movido de las rutas a los servicios cuenta ahora acá). Tipos y Biome sin errores. **30 respuestas congeladas antes y después: idénticas, 33 218 bytes.** 11 mutaciones del chequeo, todas detectadas. E2E: 43/43 en Chromium de escritorio.

**No se hizo** `/security-review` ni `aikido:scan`.

### Deuda / lo que sigue

- **`tarjetaService`, `archerService` y otros todavía arman respuestas con vistas propias**, cada uno a su manera; no se unificó el estilo de las vistas. No es de esta tanda.
- **`tournamentQueryService` importa `blancosBloqueados` de `tournamentEditService`**: una lectura que vive en un servicio de escritura. Es el único acoplamiento entre los dos y conviene separarlo cuando se toque la edición.

---

## 2026-10-31 · Un servidor que no devuelve el resultado de una op (hallazgo de REF6-9)

**Autor:** Claude Sonnet 5.5 · **Estado:** hecho. Surgió al escribir los tests de `offline/` de [`REF6-9`](post/ref-6/ACTION_PLAN.md) y no estaba en el informe. Toca `syncWorker.ts` (`FE-2`, una de las cuatro tareas que definen el proyecto).

### Qué pasaba

`aplicarResultados` saltaba (`continue`) una op sin resultado en la respuesta sin sacarla del outbox, sin contar un intento y sin marcar nada. El `for (;;)` de `flush` volvía a leer el outbox, encontraba la misma op y la mandaba de nuevo, **sin pausa ni backoff**. Reproducido con un servidor de mentira que contesta `200` con `results: []`: **300 pedidos en 46 ms**, con la op todavía en el outbox.

Con el servidor de hoy no pasa: `syncService.sync` devuelve un resultado por op en todos sus caminos. El caso realista es un **desfase de versiones**: la PWA se actualiza con `prompt` (regla 7), así que hay celulares con el cliente viejo durante días, y un cambio futuro en la forma de `results` —o un proxy que altere la respuesta— los metería en el bucle. Lo único que lo frenaba era el 429 del rate limit (300 por minuto y por IP), y el wifi del club es una sola IP: un celular así dejaba sin cuota a las demás patrullas, y volvía a empezar con cada ventana. **No perdía datos**: la op nunca se descartaba.

### Qué cambió

- `aplicarResultados` devuelve `{ hayConflicto, sinResultado }`. Las ops sin resultado se tratan como un **intento fallido**, igual que un corte de red: se anota el intento con el motivo «El servidor no devolvió el resultado de este cambio.» (es lo que lee `requestClose` para explicarle al líder por qué falta sincronizar), se programa el reintento con backoff y **`flush` sale**.
- En el camino de aislamiento de un lote rechazado, la op sin resultado también cuenta un intento.
- **La op nunca se descarta.** El puntaje es del líder, y que el servidor no lo haya contestado no lo vuelve basura. Es la misma regla que el 401 y los errores de red.

### Decisiones

- **Se arregló el comportamiento y no el síntoma.** Una guarda genérica («si el lote es idéntico al anterior, cortar») habría frenado este bucle y dejado pasar el siguiente: acá se nombra la causa —una op sin resultado— y se la trata como lo que es.
- **Sin estado `error` en la pantalla.** Se comporta como un corte de red: el indicador sigue en «pendiente» y el motivo queda en la op. El líder no tiene nada que hacer; marcarle un error que no puede resolver sería ruido.

### Errores míos en el camino

- **Un test mío era flaky y yo no lo sabía.** «Con un lote parcial» asumía que la primera op del lote era la de P1, pero el orden del outbox sale del uuid v7, que **empata a ras de milisegundo** y desempata al azar. Pasó dos veces por suerte y falló en la tercera corrida, con el E2E andando en paralelo. Ahora el servidor de prueba contesta por arquero y no por posición; 8 corridas seguidas verdes y las 9 mutaciones otra vez detectadas.
- **Lo encontré por accidente.** Una respuesta de prueba que omitía una op colgó mi test hasta el timeout de 5 s. Si hubiera escrito la respuesta completa, el hueco seguiría ahí.

### Verificación

`@bal/app` **527** (+5 nuevos, rojos antes del arreglo por la razón correcta: «expected 6 to be 1», el bucle corriendo hasta el tope del test). `offline/` sube a **90,2 %** de ramas (umbral 85, y los umbrales pasan). 9 mutaciones, todas detectadas: volver al `continue` · anotar el intento pero seguir la vuelta · cortar sin programar el reintento · cortar sin anotar el intento · descartar la op · no registrar las ops sin resultado · el aislamiento sin anotar · sin motivo a la vista · lote parcial que deja a todas sin resultado.

### Deuda / lo que sigue

- **No hay un tope de reintentos ni un aviso al líder** si una op queda sin resultado durante mucho tiempo. Con backoff (hasta 60 s) es barato, pero un cliente viejo contra un servidor nuevo seguiría reintentando para siempre: lo que debería pasar entonces es avisar que hay que actualizar la app. Es una decisión de producto, no de este arreglo.

---

## 2026-10-31 · Cobertura que bloquea y E2E en celular (REF6-9)

**Autor:** Claude Sonnet 5.5 · **Estado:** hecho, **con una parte sin verificar** (el proyecto de WebKit no se corrió) y **un hallazgo nuevo** que no es de esta tanda (abajo). Novena tanda de [`post/ref-6`](post/ref-6/ACTION_PLAN.md) (hallazgos `T-1`, `T-2` y `T-6` de [`INFORME.md`](post/ref-6/INFORME.md)).

### Qué cambió

- **Los umbrales de cobertura se aplican.** Estaban en `TESTING.md` §8 como «bloquea: sí», y el CI corría `vitest run` sin `--coverage`: ni uno se evaluaba. Ahora están en el `vitest.config.ts` de `api` y `app`, por carpeta, y el CI corre `pnpm test:coverage` en todos los paquetes.
- **`offline/` sube de 75,5 a 89,2 % de ramas** (exigido: 85) y **`middleware/auth` de 88 a 100 %** (exigido: 100). Es la capa donde viven `U-3` y `P-2`, y era la que más cobertura de ramas debía tener.
- **Proyectos móviles de Playwright:** `Pixel 7` (Chromium) y `iPhone 14` (WebKit) corren `offline-recarga`, `objetivos-tactiles` y un `flujo-corto` nuevo. El resto sigue sólo en escritorio.
- **Fuera `--passWithNoTests`** de `app` y `landing`.

### Decisiones

- **Umbrales por carpeta y no sobre el total.** Un 95 % global deja pasar un servicio entero sin probar si el resto está muy cubierto.
- **«Autorización de sync» no tiene umbral propio.** `TESTING.md` §8 pedía 100 % ahí; vive dentro de `syncService.ts`, que comparte archivo con el resto de la sincronización, y vitest aplica umbrales por archivo o carpeta, no por función. Queda bajo el de `services/` (85/80, medido 97/85,5). Queda escrito en el documento.
- **El resto de `app` no bloquea**, como dice el documento (70/60, «No»): se mide, no se exige.
- **Los márgenes son chicos a propósito de cómo se midió**: `offline/` 89,2 contra 85 y `services/` 85,5 contra 80. No les agregué relleno para ensancharlos: un test que existe para subir un número es peor que el hueco.
- **Las specs que corren en tres navegadores eligen el torneo por id.** Cada navegador crea el suyo en la misma base, y el selector por nombre (`getByRole('option', { name: /Recarga/ })`) encontraba varios y Playwright se negaba a elegir.
- **`landing` ganó `@vitest/coverage-v8`** (ya estaba en los otros cuatro paquetes) para poder correr `test:coverage` en todos. Sin umbral: sólo se mide.

### Errores míos en el camino

- **Agregar la dependencia rompió los enlaces del workspace.** `pnpm add --offline` cambió las variantes de `vitest` en el store y `packages/api/node_modules/vitest` quedó apuntando a una carpeta que ya no existía: `Cannot find module ...vitest.mjs`. Lo arregló un `pnpm install --offline`. La diferencia en `pnpm-lock.yaml` es de tres líneas.
- **Un test mío cuelga el worker, y eso es un hallazgo (abajo).** Escribí una respuesta del servidor que omitía una op del lote; el test no terminó nunca. No era mi test el roto.
- **Otra vez un token inválido en 3D** (`'9'` en un blanco 3D): el puntaje no se guardó y el test fallaba mirando otra cosa. Es la tercera vez que me pasa en esta serie.
- **El heredoc del shell se comió una barra** (`/\.ts/` quedó `/.ts/`) y los argumentos que empiezan con `/` se reescriben como rutas de Windows. Sin consecuencias en el repo; los scripts van a un archivo.

### Verificación

`pnpm test:coverage` en todo el workspace, exit 0: `shared` 499, `api` 405 (+5), `ui` 61, `app` 522 (+17), `landing` 53. **Los umbrales bloquean de verdad:** con los tests nuevos de `offline/` sacados, la corrida queda con todos los tests en verde y sale con 1 por `branches (75.53%) … threshold (85%)`; sin `auth-middleware.test.ts`, por `branches (88.23%) … threshold (100%)`. E2E: `chromium` + `Pixel 7` **52/52** (43 + 9). Lint sin errores.

**No se pudo verificar:** el proyecto `iPhone 14`. WebKit no está instalado en esta máquina y bajarlo es la descarga de un binario que no hice sin tu autorización; `playwright test --list` lo muestra con sus 9 tests. Tampoco se corrió el CI real (GitHub Actions): se probó el comando que corre, no el workflow. **No se hizo** `/security-review` ni `aikido:scan`.

### Deuda / lo que sigue

- ~~**`flush()` puede quedar en un bucle sin fin si el servidor omite una op en `results`.**~~ **Resuelto** (entrada de arriba). Se dejó el texto original: `aplicarResultados` hace `continue` sobre una op sin resultado y no la saca del outbox; el `for (;;)` de `flush` vuelve a leer el mismo lote y a mandarlo, sin pausa. Un servidor que cumple el contrato siempre devuelve un resultado por op, así que hoy no pasa; pero un proxy que corte la respuesta, o una versión vieja del servidor, convertirían al celular en un cliente que hace POST sin parar. Hace falta una guarda (contar la op como intento fallido y salir) y un test. **No lo toqué:** no es de esta tanda y es la capa más delicada del proyecto.
- **Correr WebKit** (`pnpm exec playwright install webkit`, y luego `playwright test --project="iPhone 14"`). Puede fallar por diferencias reales: `objetivos-tactiles` incluye un test de foco por teclado, y Safari no tabula a los botones por defecto.
- **`e2e/tsconfig.json` no pasa `tsc`** (`NodeListOf` sin iterador, en tres archivos que no toqué) y no está en `pnpm typecheck`: los errores no los ve nadie.
- `outbox.ts` tiene una rama que el propio código llama «inalcanzable» (`computoParcial` tras un `!r.ok`): código muerto que cuenta como rama sin cubrir.

---

## 2026-10-31 · Entrega de assets y PWA (REF6-8)

**Autor:** Claude Sonnet 5.5 · **Estado:** hecho, **con dos puntos del plan sin verificar** (si el borde de Railway ya comprime; Lighthouse «installable»). Octava tanda de [`post/ref-6`](post/ref-6/ACTION_PLAN.md) (hallazgos `P-3`, `P-4`, `P-5`, `U-4` y `S-8` de [`INFORME.md`](post/ref-6/INFORME.md)).

### Qué cambió

- **Compresión.** `scripts/precomprimir.mjs`, al final de `pnpm build`, deja un `.br` y un `.gz` junto a cada archivo de texto del `dist`; el servidor entrega el que el cliente acepta (`serveStatic({ precompressed: true })`). El JS de la PWA pasa de 439 KB a **109 KB** en brotli. El JSON de la API se comprime con gzip si pasa de 1 KB (`middleware/compresion.ts`).
- **Caché.** Lo que está bajo `/assets/` lleva hash y va `immutable` por un año; todo lo demás (`index.html`, `sw.js`, el manifest, los íconos) va `no-cache`. `Vary: Accept-Encoding` siempre. Los dos `index.html` se leen una vez al montar.
- **Code splitting.** `WafaApp` y `WaflApp` se cargan con `React.lazy`. El líder ya no baja el panel del admin: **WAFL pasa de 126 a 111 KB gz**, WAFA a 119, y la pantalla de elegir rol a 99.
- **Presupuestos sobre lo que una pantalla descarga.** `presupuesto.mjs` arma el grafo de chunks del `index.html` y, para WAFL y WAFA, de su app, y **falla si una baja código de la otra**. Antes sumaba todo el JS del `dist`, que con las dos apps en un solo chunk coincidía con la carga inicial y con el splitting dejó de hacerlo.
- **PWA.** El precaché incluye `webp` y `png` (el logo del CBA se veía roto sin señal). El manifest declara PNG 192 y 512 más un maskable aparte, con zona segura (nuevo `icon-maskable-512.png`, generado por `scripts/imagenes.mjs`); `apple-touch-icon` enlazado; `theme_color` igual al de la página. **Se borró `runtimeCaching`.**

### Decisiones

- **La landing no se partió.** Se probó con el formulario de alta, la ficha del arquero y la tarjeta de puntajes: esas tres pantallas pesan ~4 KB gz entre las tres, lo pesado es una librería compartida (`api-*.js`, 42 KB gz) que necesita toda pantalla, y la carga inicial no bajó (102,2 KB contra 101,9 del chunk único). Un `React.lazy` que no baja el inicial sólo agrega una espera: se revirtió. El plan decía «rutas pesadas de la landing»; no hay ninguna.
- **El presupuesto de WAFL se apretó de 150 a 125 KB.** Con 150 un `import` estático que trajera WAFA de vuelta (126 KB) habría pasado; los 125 más el chequeo de «no baja la otra app» lo detectan los dos.
- **`Vary` también en la respuesta sin comprimir.** `serveStatic` sólo lo agrega cuando elige un precomprimido; una caché intermedia que guardó el original podría servírselo a quien aceptaba brotli.
- **`manifest.theme_color` claro (`#fbfaf5`)**, el de la página. Un manifest no se adapta al tema; se eligió el claro, que es el default.
- **`hono/compress` no alcanza solo**: su umbral de 1 KB sólo se mira si la respuesta trae `Content-Length`, y `c.json()` no lo trae, así que comprimía hasta `{ "ok": true }`. El middleware declara el largo antes.

### Errores míos en el camino

- **El code splitting rompió una garantía de `REF6-3`, y sólo la vio el E2E.** `REF6-3` apagó el JIT de Zod con un `import '@bal/shared/navegador'` puesto primero en cada `main.tsx`, y dejó escrito que tenía que evaluarse antes de `schemas.ts`. Era cierto con un solo chunk. Con `React.lazy`, el chunk de los schemas es una dependencia estática de la entrada y se evalúa **antes** que su cuerpo, donde estaba el import de efecto: volvió el `eval` en la CSP, en las cuatro rutas (`tema-sin-parpadeo`). Los tests unitarios no lo ven: no hay empaquetador. Arreglo de raíz: `schemas.ts` importa `configuracionZod.ts`, que apaga el JIT si hay un DOM. «Un módulo depende de otro» sí es un orden garantizado; «el empaquetador evalúa esto primero», no. Dos tests nuevos (con DOM, sin importar `navegador`; sin DOM, el JIT sigue encendido) y mutaciones en ambos sentidos.
- **Un test existente asumía que todos los íconos eran SVG** (`pwa-instalable`: «devolvió el HTML del SPA» si el cuerpo no empezaba con `<svg`). Con PNG fallaba por un motivo que no era el que decía. Ahora comprueba la firma de 8 bytes de un PNG.
- **`page.getAttribute` sobre un elemento que no existe espera 5 minutos** (el timeout del test). La primera corrida en rojo de la spec nueva tardó 5,6 min por eso; se pasó a `toHaveCount(1)`.
- **La primera mutación del import estático no compilaba** (`WafaApp` quedaba sin usar y `tsc` cortaba el build): el presupuesto seguía en verde por no haber cambiado nada. Se rehízo con un `void WafaApp` y ahí sí falló, por la razón correcta. Es la misma trampa de `REF6-2` y `REF6-4`.
- **Un presupuesto inventado antes de medir**: puse 24 KB al ícono maskable y salió de 25,6. Se subió a 40, como el de 512 común.
- **Una afirmación mía en la documentación que era falsa.** Escribí que partir la landing ganaba «≈4 KB»; al medirlo, no ganaba nada. Corregida antes de commitear.

### Verificación

`@bal/api` **400** (+19, casi todos de `estaticos.test.ts`), `@bal/shared` **499** (+2), `@bal/app` 505, `@bal/landing` 53, `@bal/ui` 61. Tipos del workspace limpios; Biome sin errores (las advertencias nuevas son de `scripts/`, que antes no entraba en el alcance: `noConsole` en los CLI y la complejidad de `main()` en `presupuesto.mjs`). E2E **42/42** (10 nuevos, en `entrega-de-assets.spec.ts`: sin código de la otra app, caché, brotli, íconos, apple-touch, `theme_color`, imágenes sin conexión, y que el `sw.js` no tenga reglas para la API). **Mutaciones, todas detectadas**: 11 del servidor y de Zod, la del import estático (por el presupuesto) y las de la PWA (E2E).

**No se hizo** `/security-review` formal ni `aikido:scan` sobre los cambios de `REF6-2` en adelante.

### Deuda / lo que sigue

- **No se verificó si el borde de Railway ya comprime** (el plan pedía hacerlo primero): no hay deploy contra el cual medirlo. El servidor comprime de todos modos; si el borde también lo hiciera, recibe contenido ya codificado y lo deja pasar. Al primer deploy: `curl -sI -H 'Accept-Encoding: br' https://…/app/assets/<index>.js` y mirar `content-encoding`.
- **Lighthouse «installable» no se corrió.** Se cubre lo que Lighthouse mira (manifest con PNG 192/512, maskable, `start_url` y `display`, service worker registrado, íconos que existen), pero no la auditoría misma.
- **`/api/*` ahora puede venir comprimido con gzip**: con BREACH en mente, ninguna respuesta refleja datos del request junto a un secreto en el mismo cuerpo (`/api/auth/csrf` devuelve el token sin eco), así que no hay con qué montarlo. Queda anotado por si esa respuesta cambia.

---

## 2026-10-30 · PIN y audit log (REF6-7)

**Autor:** Claude Sonnet 5.5 · **Estado:** hecho, con un punto abierto que no es del DoD (los ingresos fallidos del admin no se registran, a propósito). Séptima tanda de [`post/ref-6`](post/ref-6/ACTION_PLAN.md) (hallazgos `S-7`, `S-9`, `C-7` y `U-6` de [`INFORME.md`](post/ref-6/INFORME.md)).

### Qué cambió

- **Los PIN no viajan por defecto.** `GET /tournaments/:id/patrols` devuelve el avance sin PIN y sin escribir `patrol.pin.reveal`; con `?pins=1` los trae y lo registra. Es lo único que se acepta: otro valor o un parámetro desconocido es un `400`. La pantalla del torneo usaba esa lista para mostrar el avance, así que cada vistazo descifraba todos los PIN y llenaba el log.
- **Se audita lo que faltaba:** `admin.login`, `tournament.start/unstart/delete`, `payment.set`, `archer.create/update/archive/restore/delete` y `season.create/update/close/reopen`. Cada entrada con actor e IP, y un `meta` que dice qué pasó sin copiar nombres ni DNI. Las rutas de temporadas llamaban al repositorio directo: ahora pasan por un `seasonService`.
- **El cierre es `patrol.close`**, con la IP de quien cerró (la IP se pasa ahora de la ruta del sync hasta el cierre). Antes era `patrol.manual_edit` con `closed:true`, el mismo nombre que usan las redistribuciones del admin.
- **El seguimiento se refresca cada 30 s** mientras la pestaña está visible y el torneo está en curso (`useRefrescoPeriodico`). Con la pestaña oculta se pausa; al volver refresca una vez, de inmediato.
- **En las rutas del admin, la IP del audit log sale de un solo lugar** (`ipDelCliente`, con `null` si no se sabe). Las tres entradas que ya existían usaban `clientIp`, que devuelve el texto `'desconocida'`: en el log podían figurar las dos cosas para el mismo caso.

### Decisiones

- **Parámetro y no endpoint propio** (`?pins=1`). El plan dejaba las dos opciones. El parámetro cambia una línea en cada pantalla y deja una sola ruta que autorizar; y como es estricto, no hay un «sí» ambiguo.
- **El `PUT` sigue devolviendo PIN.** Guardar una redistribución se hace desde la pantalla de credenciales, que los muestra. Sacarlos obligaba a esa pantalla a pedirlos de nuevo.
- **Los ingresos fallidos no se registran.** Un `401` por request llenaría el log con el ruido de cualquier bot, que es justo lo que se quería evitar con los PIN. Ya tienen su freno (`REF6-6`). El plan decía «login de admin» a secas: queda escrito en `SECURITY.md` §9 bis.
- **El refresco silencioso no toca los errores.** Si falla no muestra nada, y si anda bien no borra el error de la última acción: el motivo por el que el servidor rechazó «volver a sin iniciar» tiene que poder leerse.
- **`?pins=1&pins=2` se acepta como `pins=1`** (Hono toma el primer valor). No lo rechacé: pide lo mismo que el admin ya pidió.

### Errores míos en el camino

- **Tres mutaciones sobrevivieron y apuntaban a huecos reales.** Archivar↔restaurar y cerrar↔reabrir al revés: mi test comprobaba que existiera una entrada de cada acción, no que cada endpoint dejara la suya; un test que sólo mira el conjunto no ve un intercambio. Y el refresco que borraba el error de la última acción: no había test.
- **Los tests de `patrol.close` los escribí después de implementar**, y pasaron a la primera: no los vi fallar. La mutación (volver al nombre viejo, o sin IP) es lo que demuestra que sí detectan.
- **Una mentira mía de la tanda anterior.** En `REF6-6` anoté que el duplicado del alta «entra naturalmente en `REF6-7`, que audita y expone el log». `REF6-7` audita, no muestra nada: esa pantalla no está en el plan. Corregido en el plan y en la bitácora de `REF6-6`.
- **Un regex sin su barra** (`/^d{6}$/`) que perdió el `\` al pasar por el shell: un test pasó a esperar «d» seguido de seis veces nada. Lo vio el propio test al fallar con un PIN real.

### Verificación

`@bal/api` **381** (+19), `@bal/app` **505** (+17: 10 del hook, 7 de la pantalla), `@bal/shared` 497, `@bal/ui` 61, `@bal/landing` 53. Tipos del workspace limpios; Biome sin errores (las advertencias que quedan son anteriores, incluida la complejidad de `Tournament.tsx`, que ya era 24 en HEAD). **24 mutaciones, todas detectadas** (tres tras escribir el test que faltaba). E2E **32/32** contra el stack reconstruido, con los cuatro specs que leen PIN pidiéndolos con `?pins=1`.

**No se hizo** `/security-review` formal ni `aikido:scan` sobre estos cambios.

### Deuda / lo que sigue

- **Ninguna pantalla muestra el audit log.** Está en la base y se consulta ahí. Falta una pantalla de auditoría en WAFA, y no tiene tarea en el plan; es lo que haría visible el duplicado del alta (`REF6-6`).
- **Sin retención ni índice por acción.** El log sólo crece. Con la lista de acciones ahora más larga, conviene decidir cuánto se guarda.

---

## 2026-10-30 · Entradas públicas endurecidas (REF6-6)

**Autor:** Claude Sonnet 5.5 · **Estado:** hecho, con dos puntos abiertos que no son del DoD (el duplicado no se ve en WAFA; la cola de pendientes no tiene tope). Sexta tanda de [`post/ref-6`](post/ref-6/ACTION_PLAN.md) (hallazgos `S-4`, `S-5` y `S-6` de [`INFORME.md`](post/ref-6/INFORME.md)).

### Qué cambió

- **El body se mide en bytes reales** (`middleware/limiteDeBody.ts`, `bodyLimit` de Hono): 64 KB en cualquier ruta salvo `POST /api/wafl/sync`, que admite 1 MB. `parseJsonBody` sólo miraba el `Content-Length` declarado; con `Transfer-Encoding: chunked` no hay header y el body entero se leía a memoria antes de decidir nada. El error conserva la forma `{ error: { code, message } }` del resto de la API.
- **El alta pública ya no es un oráculo de DNI.** Un DNI nuevo y uno ya anotado en esa categoría reciben la misma respuesta (`200`, mismo cuerpo, un `_id` inventado en el duplicado); el duplicado no crea nada y deja `archer.register_duplicate` en el audit log. `POST /api/admin/archers` conserva el `409`: el admin tiene sesión.
- **El alta tiene cupo propio** (`RATE_LIMIT_REGISTER`, 20 por hora e IP) **y un campo trampa** (`sitioWeb`, fuera de pantalla). Si llega lleno se responde como si hubiera funcionado y no se guarda nada.
- **El bloqueo de las cuentas es por (cuenta, IP)** con backoff progresivo (`lib/bloqueoDeIngreso.ts`): admin 15 → 30 → 60 min, patrulla 5 → 10 → 20 min, cinco intentos por par. Por debajo queda el contador por cuenta de la base, ahora con umbral **30** entre todas las IPs.
- **El intento se reserva al entrar.** Antes se leía el contador, se verificaba y se anotaba el fallo: una ráfaga de 30 requests pasaba entera. Ahora pasan cinco. Se aplica también a cuentas que no existen.
- **Recuperar el password y regenerar el PIN sueltan el bloqueo** de todas las IPs de esa cuenta.

### Decisiones

- **Se revirtieron dos decisiones de `BE-20`**, a propósito y con la razón a la vista. (1) «DNI duplicado → 409 sin filtrar el nombre»: el `409` ya confirmaba que el DNI estaba en el padrón, que es justo lo que se quería ocultar; ocultar el nombre no alcanzaba. (2) «Sin límite propio: el freno real es la cola de aprobación»: la cola es un freno *humano*, y cada alta basura es una fila que el admin tiene que descartar. Quedó anotado en `SECURITY.md` §15 y se marcó en `docs/ACTION_PLAN.md` (`BE-20`).
- **El tope por cuenta en la base es 30**, ni 5 ni «sin tope». A cinco, volvía a ser el problema original (cinco requests dejan afuera al dueño); sin tope, un PIN de seis dígitos se puede probar desde muchas IPs, cinco por cada una. Con 30 el dueño tiene margen y el atacante tiene techo.
- **El costo de reservar al entrar está documentado**: un mismo par (cuenta, IP) no admite más de cinco intentos *en vuelo* a la vez, aunque la clave sea buena. Seis logins simultáneos al mismo usuario desde la misma IP no los manda una persona, y argon2 hace corta la ventana. Un test que mandaba diez ingresos buenos a la vez desde la misma IP se reescribió como dos tandas de cinco.
- **El techo de la patrulla es 20 min, no 30** como decía `SECURITY.md` §3.2: un líder trabado en el monte es un torneo parado. Se corrigió el documento y no el código.
- **El bloqueo por par vive en memoria**, como el rate limit: se pierde al reiniciar y no se comparte entre instancias. Alcanza para un solo contenedor (`ARCHITECTURE.md` §3); la capa de la base sobrevive a un reinicio.
- **La clave de una patrulla usa el id canónico del torneo** y no el texto del request: el esquema acepta hexadecimal en mayúsculas, y el mismo torneo escrito distinto habría dado un cupo nuevo.
- **`clearDb` de los tests también limpia los bloqueos.** Todos los tests entran como `admin` desde la misma IP (`desconocida`); sin esto el par quedaba bloqueado para el test siguiente (trece tests de `auth.test.ts` en rojo en la primera corrida completa).

### Errores míos en el camino

- **El campo trampa rompió el E2E de objetivos táctiles** y los tests unitarios no podían verlo: jsdom no hace layout. El `input` estaba recortado por su contenedor pero conservaba su caja de 181×24 px, y `e2e/objetivos-tactiles.spec.ts` mide todo lo tocable de la landing. Se arregló quitándole la caja al propio input (`h-0 w-0 border-0 p-0`), que además es lo correcto: no hay nada que tocar.
- **Una mutación sobrevivió y apuntaba a un hueco real.** Subir el tope de la base de las patrullas a 1000 no rompía nada: el test de «muchas IPs, cinco cada una» sólo existía para el admin. Se escribió el de la patrulla, que es justamente la cuenta con 10⁶ combinaciones.
- **La ráfaga de ingresos buenos** (ver arriba) la detectó un test de `REF6-2` que asumía que diez ingresos simultáneos caben siempre. Era una consecuencia del diseño y no un error del diseño, pero la suposición del test estaba implícita.
- **Un script de edición con comillas anidadas falló en el shell** (`unexpected EOF`) y hubo que pasarlo a un archivo. Sin consecuencias en el repo.

### Verificación

`@bal/api` **362** (+34: `limite-de-body`, `bloqueoDeIngreso` unitario con 10, `bloqueo-de-cuentas` con 12, y los de alta pública), `@bal/landing` **53** (+3 del campo trampa), `@bal/shared` 497, `@bal/ui` 61, `@bal/app` 488. Tipos del workspace limpios. Biome: cero errores; los avisos que quedan son anteriores y están en archivos que esta tanda no tocó salvo `syncService.ts` (los dos `useOptionalChain` de siempre). **22 mutaciones, todas detectadas** (13 del bloqueo, 3 del límite de body, 6 del alta pública), una de ellas tras escribir el test que faltaba. E2E **32/32** contra el stack construido (la primera corrida dio 31/32: el campo trampa, ver arriba).

**No se hizo** `/security-review` formal ni `aikido:scan` sobre estos cambios (ni sobre los de `REF6-2` en adelante): el plan los pide para `REF6-6`.

### Deuda / lo que sigue

- **El duplicado no se ve en WAFA.** La decisión 2 decía «el admin ve el duplicado en la cola»; hoy sólo está en el audit log, que ninguna pantalla muestra. `REF6-7` audita pero no muestra el log, así que esto no tiene tarea: falta una pantalla de auditoría en WAFA.
- **La cola de altas pendientes no tiene tope.** El cupo por IP frena el volumen, no a quien tiene muchas IPs.
- **El bloqueo depende de que `ipDelCliente` sea cierta** (`INF-4`, verificar `X-Real-IP` en el primer deploy). Si el borde no pisara el header, cada IP inventada traería cinco intentos nuevos; el tope de 30 por cuenta en la base es lo que acota ese daño.
- Si algún día hay más de una instancia, el bloqueo por par pasa a la base.

---

## 2026-10-30 · Sincronización que viaja menos a la base (REF6-5)

**Autor:** Claude Sonnet 5.5 · **Estado:** hecho, **con un punto del DoD sin cumplir** (el presupuesto de 400 ms). Quinta tanda de [`post/ref-6`](post/ref-6/ACTION_PLAN.md) (hallazgos `P-1` y `T-5`, parcial, de [`INFORME.md`](post/ref-6/INFORME.md)).

### Primero se midió: la estimación del informe era correcta

El informe decía «~9-10 viajes a Mongo por op» leyendo el código, y daba 1 s / 15 s / 60 s por lote de 50 como estimación. Para no optimizar a ciegas, `connect` ganó una opción `monitorCommands` (opt-in, sólo para medir) y un test cuenta los comandos que el driver manda. **204 comandos para 20 ops: 10 por op**, y el desglose coincide con el código (`find×84 update×60 insert×20 findAndModify×20 commitTransaction×20`). Con un proxy que inyecta latencia, el código de entonces daba 17,6 s a 30 ms y 67,6 s a 120 ms para 50 ops: las estimaciones quedaron dentro de ~15 %.

### Qué cambió

- **El avance de la patrulla se cuenta una vez por lote**, en su propia transacción corta, no dentro de la de cada score. Eran 3 comandos por op (dos listas y una escritura). La transacción propia conserva lo que importaba de estar adentro: dos lotes de la misma patrulla escriben el mismo documento, el segundo recibe un `WriteConflict` y se reintenta releyendo.
- **Los rollups son una escritura, no dos.** `normalizedPct` salía de releer el documento después del `$inc`; ahora sale del total que la op ya leyó en su transacción más el delta. Seguro por la misma razón: la segunda transacción que toque al mismo arquero se reintenta entera.
- **`/api/health` dice `dbMs`**: lo que tarda su `ping` a la base. Es la forma de comprobar una región equivocada sin entrar a ningún panel.
- **Medido: 204 → 128 comandos en 20 ops (−37 %) y 554 → 309 en 50 ops (−44 %)**; 17,6 s → 9,9 s a 30 ms y 67,6 s → 37,8 s a 120 ms. Por score, 10 → 6.

### Decisiones

- **Los `duplicate` también disparan el recálculo.** El avance dejó de ser parte de la transacción de cada op: si el proceso muere entre los commits y el recálculo, queda desactualizado. El reenvío del lote —que el cliente hace solo— vuelve con todo `duplicate`, y es lo que lo repara. Un lote donde todo se rechaza no paga el recálculo; una op mala no lo impide si las buenas lo piden. Tres de las mutaciones salen de acá.
- **Dos medidas distintas para dos cosas.** En CI, el **conteo de comandos** (determinista: cuenta lo que el tiempo multiplica por la latencia). A demanda, `pnpm --filter @bal/api bench:sync` con tiempos (depende de la máquina; un umbral de reloj en un test sería inestable).
- **No se tocó la idempotencia** (dedup en bloque con `insertMany`) ni se unieron las transacciones de un lote. Es lo que haría falta para bajar de 6 por op y es una decisión de diseño: ver abajo.

### El presupuesto de 400 ms no se cumple, y esto hay que decirlo

`TECHNICAL.md` §5 fija «lote de 20 ops p95 < 400 ms». **Medido: 487 ms** a 2 ms de RTT (peor de 3). Con 6 comandos por op y ~2 ms de procesamiento por comando en esta máquina, 20 ops cuestan ~230 ms aun sin latencia, y cada ms de RTT suma 128. Cumplirlo pide ~5 comandos por op. El número se escribió antes de medir; hay dos salidas honestas —tocar la idempotencia o recalibrar el presupuesto— y ninguna es un ajuste. Lo dejé escrito como «no se cumple todavía» en `TECHNICAL.md` en vez de moverlo.

### Una interacción con `REF6-4` que hay que decidir

El plazo de 20 s que agregué en la tanda anterior **choca con la latencia**: un lote de 50 ops son ~309 viajes en serie, y a partir de ~60 ms de RTT supera los 20 s (a 120 ms tarda 38 s). El cliente corta, reintenta, y el servidor sigue procesando el pedido cortado; el reintento vuelve `duplicate`, así que no se pierde ni se duplica nada, pero el outbox se vacía a los tropezones. Con Railway y Atlas en la misma región no pasa. Por eso `CONFIG.md` §7 lo exige y da la forma de verificarlo. Si se quiere blindar, la salida es bajar el lote del cliente de 50 a 20 (128 comandos × (RTT + 2 ms) < 20 s hasta ~150 ms de RTT): **no lo cambié**, es una decisión del dueño.

### Errores míos en el camino

- **El benchmark midió mal tres veces antes de medir bien.** Primero sospeché de Nagle (el proxy sin `TCP_NODELAY`): puse `setNoDelay` y no cambió nada. La pista era que el sobrecosto *bajaba* al subir la latencia (37, 49 y 130 ms por comando a 2, 30 y 120 ms de RTT): en **Windows los temporizadores de Node tienen granularidad de ~15,6 ms**, y un `setTimeout(…, 1)` dispara a ~15. Se reemplazó por una cola con bombeo por `setImmediate`. A 2 ms de RTT el mismo lote pasó de 3,9 s a 0,5 s. Las primeras cifras eran artefactos del proxy.
- **Un test de viajes con un escenario que no se puede repetir** (`adminListo()` dos veces: la segunda, la contraseña inicial ya no sirve) y un umbral mal contado (cada pedido HTTP hace además un `find` de la sesión, así que el mínimo de lecturas era 5 y no 4).
- **Una guarda que era código muerto, otra vez** (`miembros.length > 0` en el recálculo): reacomodar patrullas sólo se puede con el torneo `sin_iniciar`, donde no hay puntajes, así que una patrulla vacía con puntajes no existe. Se sacó y el invariante quedó escrito en el comentario.
- **Una mutación sobrevivió y apuntaba a un hueco real de cobertura.** Calcular `normalizedPct` sin el total previo no rompía ningún test: el único que lo verificaba aplicaba **una** op sobre un arquero sin puntajes, donde `totalPrevio + delta` y `delta` valen lo mismo. Se escribió un test que acumula entre blancos y baja al corregir.
- **Una cifra extrapolada que estuve a punto de presentar como medida** (2 ms a 50 ops en `CONFIG.md`): quedó marcada como calculada, con la cuenta a la vista.

### Verificación

`@bal/api` **328** (+7: 5 de viajes y avance, 1 de `normalizedPct`, 1 del healthcheck). Tipos del workspace limpios; Biome sobre los archivos tocados, sólo los dos `useOptionalChain` de `syncService.ts` que ya estaban. Mutaciones, todas detectadas: no recalcular al final · recalcular sólo si todas las ops se aplicaron · recalcular siempre · no contar los duplicados · recalcular dentro de cada op · `normalizedPct` sin el total previo (esta última, recién después del test nuevo). **Suites completas, verdes:** `pnpm test` en los cinco paquetes (shared 497, api 328, ui 61, app 488, landing 50) y E2E entero, **32 de 32** (3,1 min) contra el stack real.

### Deuda / lo que sigue

- Decidir qué hacer con el presupuesto de 400 ms (tocar la idempotencia o recalibrar) y con el tamaño del lote del cliente (50 → 20).
- Re-medir contra el despliegue real (`bench:sync` no puede apuntar a Atlas: escribe) y comprobar `dbMs`.
- `bench/` no entra en `tsc` (`rootDir: src`) ni en CI; lo corre `tsx`. Si se rompe por un cambio de API, nadie se entera hasta que alguien lo corra.

---

## 2026-10-29 · El celular muestra lo que tiene el servidor (REF6-4)

**Autor:** Claude Sonnet 5.5 · **Estado:** completado. Cuarta tanda de [`post/ref-6`](post/ref-6/ACTION_PLAN.md) (hallazgos `U-2`, `U-3` y `P-2` de [`INFORME.md`](post/ref-6/INFORME.md)).

### El problema: la pantalla que el arquero mira para firmar podía no ser la del servidor

- **`U-2` · X, 10 y M en cero.** `sembrarPuntajes` guardaba los puntajes que ya estaban en el servidor —el caso del líder que cambia de celular— con `innerCount`, `xCount`, `tenCount` y `mCount` en 0. La pantalla de resultados suma esos campos: mostraba menos X y menos 10 que los reales.
- **`U-3` · el celular que perdía el last-write-wins se quedaba con su número.** Dos celulares con la misma credencial cargan el mismo blanco, gana el `clientUpdatedAt` más reciente, y al que pierde se le respondía `superseded`. El cliente sacaba la op del outbox y nada más: el puntaje local seguía en `pending` con las flechas que perdieron, y `sembrarPuntajes` **nunca pisa lo que no está `synced`**. Quedaba mostrando —y haciendo firmar— un número que no era el que el servidor guardó. `OFFLINE_SYNC.md` §5.3 ya decía «superseded → … refrescar desde el servidor; syncState = 'synced'»: otra promesa del documento que el código no cumplía.
- **`P-2` · un POST colgado trababa todo.** Sin plazo, un `fetch` sin respuesta dejaba `corriendo = true` y **ningún otro disparador podía vaciar el outbox**: `online`, el intervalo y el foco llaman a `flush()` y salen de inmediato.

### Qué cambió

- **Siembra:** los conteos salen de `validateTargetScore` con la modalidad del blanco que ya trae el bundle, la misma función que usa el servidor. El `total` sigue siendo el del servidor (regla 1). Un blanco que no está en el recorrido no rompe la entrada.
- **Servidor:** `superseded` y `duplicate` de un score ahora traen `score.arrows` —lo que el servidor tiene **hoy** en esa celda—. Antes `superseded` devolvía sólo totales: el celular sabía cuánto sumaba lo que ganó, no cuáles eran las flechas.
- **Cliente:** `alinearConServidor` reemplaza flechas y totales por los del servidor, sin `error`, en `synced`. **No pisa una edición más nueva que todavía está en camino**: si hay otra op de score para la misma celda en el outbox, el líder volvió a tocar el blanco mientras el lote viajaba.
- **Plazo de 20 s** en el POST de sync, token CSRF incluido. El corte es un error sin respuesta, así que `esReintentable` lo trata como cualquier error de red: la op se conserva.

### Decisiones y desvíos

- **`duplicate` no se marca `synced` a secas**, como decía el plan. Un `duplicate` es lo que recibe quien reenvía una op cuya respuesta se perdió, y no dice qué pasó con ella: pudo haberse aplicado, haber perdido o haberse rechazado. Marcarlo `synced` escondería un rechazo —y desde `REF6-1` hay rechazos nuevos, `PATROL_CLOSED` y `SIGNATURE_LOCKED`, que perfectamente pueden perderse en una respuesta—. Se le devuelve la verdad actual de la celda y el cliente se alinea con ella.
- **Eso abre una puerta que hay que cerrar.** El duplicado se detecta por `opId` *antes* de autorizar nada. Si devolviera el puntaje de cualquier `participantId` que traiga el cuerpo, un líder podría leer los puntajes de otra patrulla reenviando uno de sus propios `opId` con el `participantId` ajeno. `respuestaDeDuplicada` comprueba que el arquero sea de la patrulla; hay un test, una mutación que lo prueba (quitar la comprobación lo hace fallar) y un ítem nuevo en el checklist de `SECURITY.md` §13.
- **`setTimeout` propio y no `AbortSignal.timeout`.** Este último no se puede controlar con relojes falsos y el plazo es justo lo que hay que probar. Se usa `Promise.race` contra el pedido para que cubra también el `fetch` del token CSRF, que no lleva señal.
- **El mensaje de «no se pudo cerrar» decía «El servidor respondió: …» ante cualquier error guardado.** Con el plazo eso queda «El servidor respondió: El servidor no respondió a tiempo», y ya era falso para un `Failed to fetch`. Ahora dice «El último intento falló: …». Es un cambio de texto fuera del alcance estricto, pero lo introducía mi propio mensaje.
- **Dos funciones salieron de `aplicarResultados`** (`celdaDe` y `reflejarResultado`): con mi bloque nuevo pasó el límite de complejidad cognitiva. Es un movimiento sin cambio de comportamiento, cubierto por los tests de `flush`.

### Errores míos en el camino, para que no se repitan

- **Un test con tokens inválidos que no probaba nada.** Usé `'9'` en un blanco 3D; `writeScore` devolvió `INVALID_TOKEN` y la «edición más nueva» que quería provocar nunca ocurrió. Lo vi porque el segundo lote no salió; ahora el test **afirma** que la edición entró.
- **Un test de plazo que no discriminaba.** La mutación «plazo de 5 s en vez de 20» sobrevivió. «`flush` todavía no volvió» depende de una carrera entre relojes falsos e IndexedDB real, no del plazo. Se rehízo observando la **señal de cancelación** (`aborted`), que se activa de forma sincrónica en el timer, y esperando a que el pedido salga antes de correr el reloj. Ahora los plazos de 5 s, 60 s y sin plazo se detectan.
- **Dos mutaciones que no compilaban.** Dejé una función sin uso, `noUnusedLocals` rompió el build, el E2E «falló» y no probaba nada. Es la segunda vez en dos tandas (ya pasó en `REF6-2`). La regla para mutar: que **compile** (`Date.now() < 0 &&`), y comprobar que el E2E falla por la aserción y no por `ELIFECYCLE`.
- **Dos guardas que eran código muerto**, igual que en `REF6-2`: `op.type === 'score'` en `alinearConServidor` (una firma no tiene `targetIndex`, `celdaDe` ya la descarta). Se sacó.
- **Supuestos sobre la interfaz** al armar el E2E: la tecla de fallo no se llama «Puntaje M» sino «Miss, flecha sin puntaje», y «Resultados finales» sigue **deshabilitado hasta que está todo el recorrido**, así que cada celular tiene que cargar los dos blancos.

### Verificación

`@bal/api` **321** (3 nuevos), `@bal/app` **488** (+12: 3 de siembra, 5 de alineación, 3 de plazo y 1 de mensaje), `@bal/shared` 497, `@bal/ui` 61, `@bal/landing` 50. E2E completo contra el stack real: **32 de 32**. Tipos del workspace limpios. Biome sobre los archivos tocados, sin warnings nuevos (quedan los dos `useOptionalChain` de `syncService.ts` que ya estaban).

**E2E nuevo** en `dos-dispositivos.spec.ts`, por la interfaz y sin timestamps a mano: el que va a perder carga primero y sin señal, el que gana carga después y sincroniza; se comprueba que las pantallas de resultados *difieren* antes de reconectar, y *coinciden* después. Contra el bug, con la alineación apagada, el celular que perdió muestra **39** de total contra **48**, con 1 contra 2 en inner y 10 contra 19.

Mutaciones, todas detectadas salvo la equivalente: conteos en cero · modalidad equivocada en la siembra · no alinear · alinear pisando una edición en camino · error viejo pegado · `applied` sin fijar totales · sin plazo, 5 s y 60 s · plazo tratado como rechazo definitivo · servidor sin flechas · servidor filtrando puntajes ajenos · servidor sin detalle en el duplicado.

### Deuda / lo que sigue

- **Un `rejected` deja el valor del celular en `conflict` y no lo alinea.** Es a propósito: el líder tiene que ver que algo salió mal, no que el número cambie solo. Pero el `error` de cada puntaje no se dibuja en ninguna pantalla; sólo llega al indicador del encabezado. Con `PATROL_CLOSED` y `SIGNATURE_LOCKED` esto pasa a ser más probable.
- **El E2E de dos dispositivos cubre un caso, no el espacio.** No hay uno para el `duplicate` por respuesta perdida; está cubierto en los unitarios (cliente y servidor) pero no de punta a punta.
- El indicador de sincronización sigue sin distinguir «sin señal» de «el servidor rechazó» más allá del texto.

---

## 2026-10-29 · El tema oscuro llega antes de pintar, y la consola sin violaciones de CSP (REF6-3)

**Autor:** Claude Sonnet 5.5 · **Estado:** completado. Tercera tanda de [`post/ref-6`](post/ref-6/ACTION_PLAN.md) (hallazgo `U-1` de [`INFORME.md`](post/ref-6/INFORME.md)).

### El problema, y por qué nada lo mostraba

El script anti-FOUC estaba **inline** en los dos `index.html`, y la CSP de producción es `script-src 'self'` sin `'unsafe-inline'` ni hashes. El comentario de `security.ts` decía «el hash lo inyecta el build del frontend»; ese paso nunca existió. El navegador bloqueaba el script en cada carga: quien usa el tema oscuro veía la pantalla en claro y el salto a oscuro cuando React montaba, que es el parpadeo que el script existe para evitar. Nada fallaba y ningún test miraba la CSP ni el orden de pintado. Además había un tercer `theme-init.js` suelto, con otra clave (`bal-theme`) y otra lógica, que nadie cargaba.

### Qué cambió

- **El script pasó a un archivo externo, clásico y bloqueante** (`public/theme-init.js` de cada app), referenciado desde el `<head>`. La CSP no se tocó: sigue en `script-src 'self'`, sin hashes que mantener a mano. Se verificó el build: Vite lo emite con el `base` (`/app/theme-init.js`) y la PWA lo precachea, así que sin señal el tema también llega.
- **Había una segunda violación que el plan no preveía: `script-src → eval`.** Zod 4 compila cada schema de objeto con `new Function` y, para saber si puede, lo *prueba* con `new Function('')` dentro de un `try`. La CSP lo bloquea, el `try` lo atrapa y todo sigue andando, pero el navegador lo reporta en cada carga. Se encontró porque el E2E nuevo exige cero violaciones y no sólo tema correcto. Solución: `@bal/shared/navegador` (`z.config({ jitless: true })`), importado **primero** en el `main.tsx` de cada frontend. El probe se evalúa al *construir* los schemas, no al parsear, así que el orden de import es lo que lo hace funcionar. **Sólo en el navegador**: el backend corre sin CSP y valida hasta 200 ops por lote con JIT.

### Un hallazgo dentro del hallazgo: las copias no decidían lo mismo que `resolverTema`

El test de coherencia que existía leía los `index.html` y buscaba texto (la clave, el color, `setAttribute`). Pasaba, y las copias inline **decidían distinto**: con un valor guardado corrupto y el sistema en oscuro pintaban claro (`guardado === null` en vez de «no reconocido»), y con `localStorage` bloqueado se quedaban en claro mientras `BotonTema` seguía al sistema. En los dos casos, un parpadeo en el lugar donde el script existe para evitarlo. Ahora el test **ejecuta** los dos scripts en un `vm` con `localStorage` y `matchMedia` de mentira y compara con `resolverTema` y `COLOR_DE_BARRA` en las diez combinaciones de valor guardado × sistema, más el caso sin almacenamiento. Las dos copias tienen que ser idénticas (también lo verifica).

### Decisiones y desvíos

- **No hay una sola fuente del script, hay dos copias idénticas.** Un script clásico no se bundlea, y cada `public/` se sirve bajo su propio origen. Una fuente única habría pedido un plugin de Vite que emita el archivo; dos copias con un test que las compara cuesta menos y falla fuerte si se separan.
- **`DOMContentLoaded` no sirve para medir «antes de pintar».** El plan lo proponía, pero el módulo de React corre *antes* de ese evento y ya habría escrito el tema. El E2E usa un `MutationObserver` instalado antes de cualquier script de la página, que anota qué pasó primero: que se escriba `data-theme` o que `#root` reciba su primer hijo.
- **`scriptHashes` queda en `createApp` y en `securityHeaders`**, pero ya no lo usa nadie. Se corrigió el comentario que prometía un paso de build inexistente; no se borró la opción porque es el mecanismo correcto si algún día hace falta un script inline, y sacarla toca tests que no son de esta tanda.

### Verificación

`@bal/shared`: 36 tests en `tema.test.ts` (antes 13, ocho de ellos sólo leían texto del HTML) y 1 nuevo en `navegador.test.ts`. Tipos del workspace limpios. Biome sobre los diez archivos tocados, sin warnings ni errores. E2E nuevo `tema-sin-parpadeo.spec.ts`: 8 de 8 (4 páginas × 2) contra el stack de producción; antes de arreglar fallaban los 8, con `script-src-elem → inline` y `script-src → eval`. **Suites completas, verdes:** `pnpm test` en los cinco paquetes (shared 497, api 318, ui 61, app 476, landing 50) y E2E entero, **31 de 31** (3,1 min) contra el stack real.

Mutaciones, todas detectadas: clave `bal-theme` · copias distintas · un valor corrupto deja de seguir al sistema · las dos lecturas en un solo `try` · script inline de vuelta · `defer` · script después del bundle · y el import de Zod movido después de `./App`, que sólo el E2E puede ver (fallan las 4 páginas con `script-src → eval`). Esta última es la que importa: un reordenamiento automático de imports la reproduce sin que nadie lo note.

### Deuda / lo que sigue

- **El script es render-blocking.** Es lo que se busca, pero en la landing —que no tiene service worker— es un pedido más antes de pintar. Pesa 2 KB y `P-4` (política de caché de estáticos) lo vuelve cacheable; hasta entonces cada visita lo revalida.
- No se probó en un iPhone ni en un Android reales (sigue pendiente en `FE-21`).
- `docs/ARCHITECTURE.md` §9 todavía lista «`public/theme-init.js` — portar tal cual» como si viniera del repo de origen. Es el mapa histórico de qué se portó y no se tocó.

---

## 2026-10-29 · Un cupo de login que no deja afuera a la patrulla 11 (REF6-2)

**Autor:** Claude Sonnet 5.5 · **Estado:** completado, con un punto que sólo se puede verificar desplegado. Segunda tanda de [`post/ref-6`](post/ref-6/ACTION_PLAN.md) (hallazgos `S-2`, `S-3` y `T-3` de [`INFORME.md`](post/ref-6/INFORME.md)).

### El problema, y por qué ningún test lo veía

El límite de login (10 cada 15 min por IP) se aplicaba a **todo** `/api/auth/*` y contaba cada request. `/me` y `/csrf` los pide la app en cada carga, y los ingresos correctos gastaban el mismo cupo que un ataque: desde el wifi del club —una sola IP— la patrulla 11 recibía «Demasiados intentos» por culpa de las diez anteriores. Nadie lo vio porque `e2e/servidor.ts` subía `RATE_LIMIT_LOGIN` a 100: **el E2E nunca corría con la configuración que corre el día del torneo.**

### Qué cambió

- **Sólo cuentan los intentos fallidos (`401`)**, y sólo en `POST /admin/login`, `/patrol/login` (cupo compartido) y `/admin/recover` (cupo aparte). `/me`, `/csrf`, `/logout` y el cambio de password salen del cupo. Un `429` del bloqueo de cuenta, un `403` de CSRF o un `409` de torneo no iniciado no cuentan: no son credenciales equivocadas.
- **`RATE_LIMIT_LOGIN` pasa de 10 a 60** (intentos *fallidos*; lo que frena la fuerza bruta contra una cuenta es su bloqueo propio). **`RATE_LIMIT_RECOVER` = 5**, nuevo: la recuperación del password es la única ruta sin sesión que cambia una credencial y no tiene bloqueo por cuenta, así que este cupo es lo único que frena adivinar el código. Antes compartía el cupo del login.
- **La IP sale de `TRUSTED_IP_HEADER`**, no del primer valor de `X-Forwarded-For`: los proxies *agregan* al final, y el primero lo escribe quien hace el request. Por defecto `x-real-ip` en producción —el header que Railway documenta como la IP del cliente—, ninguno en desarrollo. Un solo `lib/ip.ts` alimenta el cupo, las sesiones y el audit log; antes cada uno la leía a su manera.
- **El `Map` de contadores tiene tope** (10 000, desaloja el más viejo): con una IP inventada por request crecía sin límite.
- `e2e/servidor.ts` **ya no relaja el login**, y hay un spec nuevo (`ingreso-masivo.spec.ts`): quince patrullas entran desde la misma IP con el límite real.

### Una falla de mi propio diseño, encontrada antes de cerrar

La primera versión **miraba el contador al entrar y anotaba el fallo al salir**. Una ráfaga de requests simultáneos mira el contador antes de que el primero termine, y pasan todos: el test de ráfaga lo mostró con números, **30 de 30 intentos llegaron a verificar el código de recuperación contra un cupo de 5**. El límite viejo no tenía el problema porque reservaba el lugar al entrar. Ahora cada intento **suma uno apenas llega y lo resta si la respuesta no fue `401`**. El costo, aceptado: los intentos en vuelo cuentan unos milisegundos, así que hacen falta tantos ingresos simultáneos como el cupo (60) para cortar a uno legítimo.

### Decisiones y desvíos

- **`TRUSTED_PROXY_HOPS` → `TRUSTED_IP_HEADER`.** El plan decía contar saltos del proxy, «antes, verificar en Railway qué header y en qué posición llega la IP real». La documentación de Railway (*Specs & Limits → Request Headers*) da `X-Real-IP` y no menciona `X-Forwarded-For`: contar saltos habría sido adivinar una posición que no está documentada. Si el header no llega, se cae al comportamiento de antes en lugar de agrupar a todo el club bajo una IP: un cupo compartido sería peor que uno esquivable.
- **Dos tests de `app.test.ts` cambiaron de premisa.** Probaban el middleware genérico contra `/api/auth/csrf`, que dejó de estar limitada a propósito. El middleware pasó a `rateLimit.test.ts` (contra una app mínima) y `app.test.ts` conserva sólo que cada grupo de rutas tenga su límite enchufado (`/api/public/*`). No se perdió cobertura: se movió a donde prueba lo que dice.
- **Una guarda que escribí era código muerto.** La mutación «devolver el lugar sin mirar si la ventana se reabrió» sobrevivió; resultó un mutante *equivalente*: se resta sobre la referencia reservada, no sobre una búsqueda por clave, así que restarle a una ventana vieja no toca a la nueva. Se sacó la guarda en vez de dejarla; el test queda como especificación.
- **La primera verificación del E2E no probaba nada.** La corrida con el comportamiento viejo «falló», pero por el *build* (`noUnusedLocals` rechazó mi mutación), no por el test; no probaba nada. Se rehízo con una mutación que compila, y falla donde tiene que fallar: `patrulla 10 — Expected: 200, Received: 429`.

### Verificación

`@bal/api`: **318 tests** verdes (15 archivos; 17 nuevos entre `intentos-fallidos`, `rateLimit`, `env` y `app`). `tsc --noEmit` limpio. Biome sobre los once archivos tocados, sin warnings ni errores. **E2E completo contra el stack real: 23 de 23 en verde** (3,1 min), incluido `ingreso-masivo.spec.ts`, ya sin la relajación del login. No se corrieron `shared`, `ui`, `app` ni `landing`: esta tanda no toca esos paquetes.

**No se corrió** `/security-review` formal ni `aikido:scan` sobre esta tanda, que el plan pide. Sí hubo una revisión mía del diseño, y fue la que encontró la ráfaga de arriba; pero la escribió quien lo diseñó, y no reemplaza una mirada independiente.

Mutaciones, todas detectadas salvo la equivalente: no registrar fallos · contar cualquier error · contar los exitosos · cupo global en vez de por IP · sin default de producción · ignorar el header de confianza · sin tope · desalojar el contador recién abierto · sin el límite público enchufado · nunca devolver el lugar · devolver también el de los fallos · no reservar.

### Deuda / lo que sigue

- **Sin verificar: que el borde de Railway pise un `X-Real-IP` mandado por el cliente.** La documentación dice que identifica la IP del cliente; no dice que sobrescriba uno falsificado. Hay que comprobarlo en el primer deploy (`INF-4`) con el procedimiento de `SECURITY.md` §3.3. Si no lo pisa, el cupo por IP vuelve a ser esquivable.
- **El bloqueo por cuenta (5 fallos) tiene la misma ráfaga:** evalúa antes de verificar y anota después, así que una ráfaga contra una cuenta pasa de cinco. Es anterior a esta tanda; el cupo por IP ahora lo acota a 60 por ventana desde una IP, pero no desde varias. Anotado en `REF6-6`.
- `SECURITY.md` §3.3 sigue diciendo «300 / min **por sesión**» para el sync y «60 / min por sesión» para `/api/admin/*`: el primero es por IP y el segundo no existe. Es el `B-2` del informe; entra en `REF6-15`.

---

## 2026-10-29 · Nada se escribe después de cerrar ni sobre lo firmado (REF6-1)

**Autor:** Claude Sonnet 5.5 · **Estado:** completado. Primera tanda de [`post/ref-6`](post/ref-6/ACTION_PLAN.md), que sale de la auditoría de [`INFORME.md`](post/ref-6/INFORME.md) (hallazgo `S-1`).

### El hueco, comprobado antes de arreglarlo

`SIGNATURE_MISMATCH` se evaluaba **una sola vez**, en el cierre de la patrulla. Después, `/sync` seguía aceptando puntajes y firmas de una patrulla `cerrada` y puntajes de un arquero ya firmado, y `publish` no volvía a mirar el hash. Los tests nuevos se vieron fallar por esa razón exacta: el servidor devolvía `applied` sobre una patrulla cerrada, y `publish` devolvió **200** sobre un torneo con un puntaje alterado. Es decir: se podía publicar un resultado que nadie firmó.

### Qué cambió

- **`PATROL_CLOSED`** (409, por op): score o firma con la patrulla cerrada. El estado se lee **una vez por lote** —no una por op, que cuesta un viaje a la base— y un `close` del mismo lote cuenta para las ops que vienen detrás.
- **`SIGNATURE_LOCKED`** (409, por op): score sobre un arquero que ya firmó. La firma que el admin desbloqueó (sin trazo) también cuenta como firmada.
- **`publish` verifica el hash** de cada firmado y se niega con `SIGNATURE_MISMATCH` diciendo **de quién**; el torneo queda `completado`. `SECURITY.md` §7 ya decía «al publicar, se verifica de nuevo» y el código no lo hacía: la promesa del documento ahora es verdad.
- Los dos códigos se rechazan **después** de autorizar: un intento sobre un participante ajeno sigue siendo `FORBIDDEN` y sigue quedando en el audit log. Y `PATROL_CLOSED` va antes que `SIGNATURE_LOCKED`: tras el cierre todos están firmados, y el motivo útil es el cierre.

### Decisiones y desvíos

- **Un test existente cambió de premisa.** `cambiar un puntaje después de firmar frena el cierre` mandaba un score sobre un firmado por `/sync` y esperaba que el *cierre* lo frenara. Ahora esa op la corta `SIGNATURE_LOCKED` antes, así que el test dejó de probar el cierre. Se reescribió para alterar el dato **por fuera de `/sync`** (como lo haría una corrección a mano o un bug): `SIGNATURE_MISMATCH` queda como defensa en profundidad y sigue probado. No se ocultó un rojo: cambió el camino por el que el dato puede llegar.
- **`deltaDeRollup` extraído** de `aplicarScore`. La función estaba justo en el límite de complejidad cognitiva (20) y la guarda nueva la pasaba a 21. En vez de sumar un warning, el cálculo del delta —que repetía `?? 0` cinco veces— salió a una función chica. Es un movimiento puro; lo cubre el test `recalcula el rollup por delta, sin sumar dos veces`, que falla si el delta ignora lo previo (mutación probada).
- **No se tocó el cliente.** El rechazo llega al líder por el indicador de sincronización del encabezado («Problema al sincronizar: …» con el mensaje del servidor). El plan decía «en el blanco»: verificado, el `error` de cada puntaje no se dibuja en esa pantalla; el camino que existe es el del encabezado.
- **`loginPatrol` no rechaza una patrulla cerrada**, a propósito: el líder que cambia de celular tiene que poder entrar a ver que el torneo terminó. El control está en la escritura, no en la entrada.

### Verificación

`seguridad.test.ts`: de 8 a 13 tests (5 nuevos, 1 reescrito). `@bal/api`: **301 tests** verdes. `tsc --noEmit` limpio. Biome sobre los cuatro archivos tocados: los mismos 2 warnings que ya existían en `syncService.ts` (`useOptionalChain`), **ninguno nuevo**.

Mutaciones, todas detectadas: sacar el chequeo de patrulla cerrada en score · idem en firma · no seguir el `close` dentro del lote · sacar `SIGNATURE_LOCKED` · `publish` sin verificar el hash · y, sobre el código ya refactorizado, las dos de `motivoDeBloqueo` y la del delta.

**No se corrió:** el E2E (Playwright) ni el resto de los paquetes (`shared`, `app`, `landing`): esta tanda solo toca `@bal/api`. Tampoco `/security-review` ni `aikido:scan`, que el plan pide para esta tanda.

### Deuda / lo que sigue

- **No existe ningún camino para corregir un puntaje firmado por error.** La UI ya lo impedía y ahora el servidor también. `unlockSignature` solo sirve para quien **no** firmó y rechaza a quien ya firmó. El `INFORME.md` decía lo contrario («la corrección pasa por el desbloqueo del admin») y está corregido. Si hace falta —y el día del torneo seguro que alguien firma mal—, es una función nueva: reabrir la firma de un participante con motivo, auditada. **Decisión del dueño del proyecto**, no se hizo.
- **`pnpm lint` desde la raíz falla ahora** con «Found a nested root configuration»: hay dos worktrees de otras sesiones en `.claude/worktrees/` (`detalle-flechas-solo`, `fix-auditoria-dependencias`) con su propio `biome.json`. No son de esta tanda y no se tocaron; conviene borrarlos o excluirlos en `biome.json`. Mientras tanto Biome se corrió sobre los archivos tocados.
- La ruta pública nueva de la tarjeta de puntajes (`FE-31`) muestra cada flecha; entra en el alcance de `/security-review` de `REF6-6`.

---

## 2026-10-29 · Tarjeta de puntajes de un arquero: cada flecha de cada blanco (FE-31)

**Autor:** Claude Sonnet 5.5 · **Estado:** completado.

### Pedido directo del usuario, fuera del plan

En la landing, el torneo publicado mostraba el total de cada arquero pero no cómo se llegó a él: los puntajes por flecha estaban en `scores.arrows` y no se veían en ningún lado. Ahora cada arquero del podio es un enlace a `/torneos/:id/participantes/:participantId`, que muestra cada flecha de cada blanco. Rama `feat/detalle-flechas-arquero`, desde `main`.

### Decisiones

- **La cuenta vive en `@bal/shared`** (`armarTarjetaDePuntajes`), no en el servicio: regla 2. Recibe el recorrido y los puntajes y **no recibe ningún total guardado**, así que no tiene cómo confiar en uno (regla 1). El valor de cada flecha sale del set de la modalidad **del blanco**, no de la del puntaje guardado. TDD: cada test se vio fallar antes de escribir el código; los de borde que cubrían código ya escrito (orden de filas, blanco ajeno, mutación) se verificaron rompiendo la implementación a propósito.
- **«Sin puntaje» no es cero.** Un blanco sin documento de puntaje devuelve `arrows: null`; uno tirado todo a `M` devuelve sus flechas y vale cero. La pantalla los distingue.
- **Un token inválido en la base lanza `INVALID_TOKEN`** en vez de mostrarse como cero. Se valida al escribir, así que no debería pasar; si pasa, que se note.
- **El `id` que se agregó a `results` es el de la participación**, no el del arquero del padrón: es la clave real de `scores` y no obliga a exponer `archerId`. Es opcional en el tipo de la landing (una respuesta vieja en caché no lo trae) y sin id el nombre se muestra sin enlace.
- **Seguridad (ruta pública nueva).** 404 **sin distinguir** torneo sin publicar / inexistente / participante ajeno / ausente / id malformado: no se puede sondear qué existe. Un torneo sin publicar no expone ningún puntaje, igual que su detalle. Respuesta por **lista blanca**, campo por campo: la firma (`pngDataUrl`), `paid`, DNI, `archerId` y `patrolId` no salen. Cada guarda y la lista blanca tienen un test que falla si se las saca (verificado por mutación).
- `Dato` (la caja etiqueta/valor de la ficha de arquero) pasó de `Archer.tsx` a `components/ui.tsx` para reusarla. Sin cambios de comportamiento.

### Verificación

`pnpm -r test` (shared 473, api 296, ui 61, app 476, landing 50), `pnpm typecheck` y `biome` sobre los archivos tocados, verdes. E2E nuevo contra el stack real en Chromium (`tarjeta-de-puntajes.spec.ts`: puntaje cargado por API, publicado, y navegación de punta a punta; incluye 360 px sin desborde). Revisado a ojo en escritorio y a 360 px: en el celular el resumen ocupaba cuatro renglones y empujaba las flechas fuera de pantalla; se compactó a dos.

### Deuda / lo que sigue

- No se corrió la suite E2E completa (sólo el spec nuevo): la tarea no toca WAFL/WAFA, pero conviene correrla en CI.
- `/security-review` sobre el diff: sin hallazgos HIGH/MEDIUM (ids validados con `toObjectId`, guardas de estado/torneo/ausente, respuesta por lista blanca, sin `dangerouslySetInnerHTML`). `aikido:scan` **no se pudo correr**: el MCP de Aikido exige que el usuario inicie sesión (`aikido_login`); queda pendiente antes de mergear.
- La ficha histórica del arquero (`/arqueros/:id`) no enlaza a estas tarjetas; sería el paso natural para ver sus flechas de torneos pasados.

---

## 2026-10-27 · DNI único por categoría, no por arquero (padrón)

**Autor:** Claude Sonnet 5 · **Estado:** completado.

### Pedido directo del usuario, fuera del plan

El índice único de `dni` en `archers` era global desde `BE-19`: un DNI sólo podía estar cargado una vez en todo el padrón. El usuario pidió explícitamente lo contrario para el caso real de la liga — un arquero puede anotarse en más de una categoría (p. ej. `recurvo` y `compuesto`), cada anotación es un `ArcherDoc` separado con el mismo DNI — así que lo que hay que impedir es el duplicado **dentro de la misma categoría**, no el DNI repetido en sí.

### El cambio: índice compuesto, no una regla nueva en `@bal/shared`

`uk_dni` (`{dni}` único, parcial sobre `dni: {$type: 'string'}`) pasó a `uk_dni_category` (`{dni, category}`, misma condición parcial). Sigue sin ser una regla de dominio pura: la deduplicación depende de qué hay en la base, así que sigue viviendo en el índice de Mongo + el catch de `E11000` en `archerRepo.create`/`update`, mismo patrón que el resto de los índices únicos del proyecto — no hizo falta tocar `@bal/shared` ni `ArcherInputSchema`/`ArcherSelfRegisterSchema`.

TDD: el test que hoy fallaba por la razón correcta (`el mismo DNI puede anotarse en más de una categoría`, esperando 201 y recibiendo 409 contra el índice global viejo) se escribió primero, se lo vio rojo, y el cambio de índice lo puso verde. Los tests existentes de "DNI repetido en la misma categoría → 409" (admin y alta pública) siguen verdes sin tocarlos: siguen cubriendo exactamente lo que tienen que cubrir.

### Mensaje de error actualizado, oráculo de DNI un poco más angosto, no más ancho

`ARCHER_DNI_DUPLICATE` pasó de "Ya existe un arquero con ese DNI" a "... en esa categoría". El hallazgo `S-6` ya documentado (`docs/post/ref-6/INFORME.md`, `docs/SECURITY.md` §15) sobre el alta pública como oráculo de DNI sigue intacto como riesgo conocido — este cambio no lo introduce, lo angosta: antes un solo intento confirmaba "ese DNI existe en la liga", ahora sólo confirma "existe en la categoría que mandaste". Anotado en `SECURITY.md` §15 para que quede explícito, no evaluado como hallazgo nuevo en el `/security-review` de esta tarea (sin resultados HIGH/MEDIUM).

### Deuda / lo que sigue

- Ninguna para esta tarea. `S-6` (hacer que alta nueva y DNI repetido respondan igual) sigue siendo trabajo de `docs/post/ref-6/ACTION_PLAN.md`, no de ésta.

---

## 2026-10-26 · Backups: restauración verificada de punta a punta (INF-6)

**Autor:** Claude Sonnet 5 · **Estado:** completado.

### El procedimiento ya estaba escrito; nadie lo había corrido nunca

`CONFIG.md` §9 documentaba `mongodump`/`mongorestore` desde antes, pero el DoD pedía **restauración verificada**, no sólo documentada. Las herramientas no estaban instaladas. Consultado con el usuario —mismo patrón que `squirrel` en `FE-21`—: pidió instalarlas (binario oficial, SHA-256 verificado contra el que publica `downloads.mongodb.org/tools/db/release.json`) y correr la verificación real, no simularla.

### La verificación: un `mongod` efímero, datos reales, los comandos tal cual están en el doc

Un script standalone (fuera del repo salvo un paso intermedio en `packages/api/`, necesario para que Node encontrara el driver `mongodb` — pnpm no lo hoistea a la raíz) levantó un `mongod` con `mongodb-memory-server` —el mismo paquete que ya usa `e2e/servidor.ts`, nada nuevo que mantener—, insertó una temporada y un arquero, corrió `mongodump` con el comando exacto del doc, **borró la base entera** (`dropDatabase`, confirmado en 0 documentos antes de seguir — sin esto el test podría pasar sin haber restaurado nada), corrió `mongorestore --drop`, y los dos documentos volvieron: mismo `_id`, mismos campos.

### Un error real, encontrado a mano, que no estaba en el procedimiento documentado

El primer intento falló con *"provide only one MongoDB connection string"* — un mensaje que no menciona la causa real. Resultó ser `mongodump`/`mongorestore` 100.19.1 en Windows rechazando `--uri` con el valor en un argv separado (`--uri "mongodb://…"`) en vez de unido con `=` (`--uri=mongodb://…`). Los comandos que ya estaban en `CONFIG.md` §9 usaban `=` desde el principio, así que el procedimiento documentado nunca tuvo el bug — pero alguien "prolijizando" el comando a mano, un día de verdad con la base caída, podría reintroducirlo. Se agregó la nota en el doc explicando por qué el `=` importa, no sólo que importa.

### Deuda / lo que sigue

- Ninguna para esta tarea. Queda la recomendación operativa ya existente: `mongodump` después de publicar cada torneo, archivo guardado fuera de Atlas y de Railway.

---

## 2026-10-26 · Auditoría de UI y accesibilidad (FE-21)

**Autor:** Claude Sonnet 5 · **Estado:** parcial — todo lo que no depende de un celular real está hecho.

### `<button>` dentro de `<a>`: HTML inválido en tres pantallas

`web-design-guidelines` (corrido contra el código, no contra el DOM renderizado) encontró el mismo patrón repetido ocho veces: `<Link><Button>texto</Button></Link>`. Es inválido —interactivo dentro de interactivo— y el navegador lo repara reordenando el DOM de formas que rompen el foco y el objetivo táctil, sin que nada en pantalla avise. Se separó `botonClases()` de `Button` en `components/ui.tsx`: las clases, sin el elemento, para que un `<Link>` que navega se **vea** como botón sin **ser** un botón anidado. Encontrado en `App.tsx` (el selector de rol, la primera pantalla de la PWA), `Home.tsx` y `Tournament.tsx`.

El cambio de rol (`button` → `link`, que es el correcto: navegan, no accionan) rompió `e2e/ingreso.spec.ts`, que consultaba el selector de rol por `role: 'button'`. Se corrigió la consulta al rol correcto en vez de revertir el fix.

### Dos bugs reales de objetivo táctil, encontrados por el propio test que los advierte

El test de 44px existía sólo para WAFA. Al agregarlo a la landing (`/`, `/alta`, `/ranking`, `/torneos`) encontró dos: el link del logo en el header (`min-h-[44px]` estaba en el `<div>` padre, no en el `<Link>` —el `<a>` real medía 26px—) y los links de arquero en `/ranking` (sin `min-h` propio). Es exactamente lo que el comentario original del archivo advertía: *"un `min-h-[44px]` escrito en el código no prueba que el elemento mida 44 en la pantalla"*. Los dos corregidos.

### Contraste sólo se medía en un tema

El test de AAA del teclado de scoring corría en lo que el navegador trae por default —claro—, nunca en oscuro. `page.emulateMedia({ colorScheme })` antes de `goto`, en un `for` sobre los dos temas: el script anti-FOUC de `index.html` lee la preferencia de forma síncrona, así que queda puesto antes de que React monte nada.

### Eliminar un arquero no pedía confirmación

Era la única acción irreversible de `Archers.tsx` sin el patrón de dos toques que ya usa el resto de la app (borrar un torneo, rechazar un alta pendiente). Nadie lo había notado porque ningún test lo clickeaba de verdad —los dos tests existentes sólo comprobaban que el botón estuviera habilitado o deshabilitado—. Agregado el segundo toque, con test que sí lo clickea.

### `squirrel` (audit-website): instalado con permiso, auditado el build real, no el dev server

No estaba instalado y no hay deploy en vivo (`INF-4` sigue pendiente). Consultado con el usuario: pidió instalarlo (binario verificado contra el SHA-256 publicado) y auditar un build de producción local en vez de saltear el punto. El primer intento corrió contra el dev server de Vite y mezcló ruido real con artefactos del dev server (CSP ausente, JS sin minificar) que no existen en producción — se reconfirmó contra `e2e/servidor.ts`, el mismo stack que usa `TEST-1`, y esos dos desaparecieron.

Encontrados y corregidos: favicon sin enlazar (el asset ya existía, faltaba el `<link>`), título y descripción cortos, sin `robots.txt` en ninguna de las dos apps. Decisión consciente de **no** tocar: canonical y OG tags (la landing es una SPA con un único `index.html` para todas las rutas; un canonical fijo sería correcto sólo para `/`, incorrecto para el resto — necesita gestión de `<head>` por ruta, que es más que esta tarea), sitemap.xml (rutas dinámicas, sin sentido antes de un dominio real), y los hallazgos de E-E-A-T (Acerca de, Contacto, Política de privacidad, autoría) — señales de SEO de contenido/marketing que no describen lo que es este sitio.

El "No H1 encontrado" / "0 links internos" / "contenido insuficiente" que `squirrel` marca como error **es real pero no es un bug de esta tarea**: el crawler no ejecuta JavaScript, así que ve el HTML crudo antes de que React pinte nada. Es inherente a ser una SPA sin SSR — se confirmó que persiste igual contra el dev server y contra el stack de producción, mientras que los artefactos de CSP y minificación sí desaparecieron entre uno y otro.

### Lo que queda, y por qué no lo puedo cerrar yo

**Probar en un Android y un iPhone reales.** No hay forma de hacerlo desde una sesión de terminal. Queda marcada `[~]`, igual que `BE-14`/`INF-4`: todo lo demás del DoD está hecho y verificado, esto depende de que alguien del equipo lo haga con el celular en la mano.

### Deuda / lo que sigue

- Prueba en dispositivos reales (el único punto que falta de `FE-21`).
- Gestión de `<head>` por ruta (título, canonical, OG) si la landing alguna vez necesita compartirse bien en redes — hoy nadie lo pidió.
- `INF-4` (deploy real) antes de que un sitemap tenga sentido.

---

## 2026-10-26 · E2E de la Fase 8: alta pública de punta a punta (TEST-3)

**Autor:** Claude Sonnet 5 · **Estado:** completado. Cierra toda la Fase 8 (`SH-8`..`TEST-3`).

### `flujo-completo.spec.ts` llevaba dos días roto y nadie lo sabía

El paso 23 de `TEST-1` pedía `?mode=position` y leía `leaguePoints` del ranking — el sistema que `SH-9` retiró. `pnpm -r test` nunca lo iba a atrapar: `e2e/` no es parte de los workspaces que ese comando corre. El E2E es la única red que cubre ese campo, y nadie había vuelto a correrlo completo desde `SH-9` porque toma varios minutos y ninguna de las tareas de la Fase 8 lo pedía explícitamente hasta ésta. Reescrito para pedir `/public/rankings` sin `mode` y verificar `tournamentsPlayed`/`bestNormalizedPct` en `notYetEligible` — el equivalente correcto: "el resultado se aplicó, aunque con un solo torneo nadie llegue todavía a `bestN`".

### El radio de sexo rompía en Chromium de verdad, no en jsdom

`.check()` sobre el input de sexo (`sr-only`, la etiqueta visible es el control real) choca con la etiqueta que lo envuelve: Playwright reintenta el click 300 segundos contra un elemento que otro elemento tapa, hasta el timeout. Los tests de componente de `FE-27`/`FE-29` (`fireEvent.click` sobre jsdom) nunca lo iban a encontrar — jsdom no hace hit-testing real, dispara el evento directo sin importar qué hay encima. Encontrado recién acá, con Chromium de verdad. Se cambió a clickear la etiqueta por su texto, que es además lo que hace quien usa el mouse.

### Decisión: el caso del rechazo se verifica por API, no abriendo el wizard

El DoD dice "no aparece **en el wizard**". Abrirlo de verdad exige llenar los pasos 1 y 2 (temporada, recorrido) antes de llegar al paso 3 donde vive `SelectorDeArqueros` — mucho armado para confirmar una ausencia. Se verificó contra `GET /admin/archers` (sin filtro) y `?status=pendiente`: es exactamente la consulta que `SelectorDeArqueros` hace al abrir ese paso, así que comprobar la respuesta es comprobar lo que el wizard mostraría. Documentado como decisión consciente, no un atajo sin pensar.

### De paso: un segundo `entrarComoAdmin`

Al escribir el nuevo spec iba a quedar una segunda copia de `entrarComoAdmin` —la misma duplicación que `ayudas.ts` ya había resuelto una vez para los helpers de `TEST-2`—. Se sacó de `flujo-completo.spec.ts` y se exportó desde `ayudas.ts` en vez de copiarla de nuevo.

### Deuda / lo que sigue

- **Ninguna.** Con esto, la Fase 8 completa (`SH-8` a `TEST-3`) está cerrada: alta pública, categoría `principiantes`, mejor-de-N configurable y ranking por sexo, de punta a punta, contra el stack real.
- Vale la pena correr el E2E completo con más frecuencia que "cuando una tarea lo pide explícitamente" — es la única red que habría atrapado el bug de `leaguePoints` antes de dos días.

---

## 2026-10-26 · Ranking con pestañas General/Femenino/Masculino (FE-28)

**Autor:** Claude Sonnet 5 · **Estado:** completado. Cierra la Fase 8 entera (`SH-8`..`FE-30`); queda sólo `TEST-3` (E2E).

### Una tira de pestañas, no ocho

El plan decía "pestañas por encima de las tarjetas de categoría" — una sola elección de vista que aplica a las ocho categorías, no un selector repetido en cada una. Un estado `vista` en la pantalla, `c[vista]` en vez de `c.general` en cada lugar que antes leía la vista general a secas. El componente de pestañas está duplicado entre landing y WAFA, misma razón que el resto del JSX de cada paquete en este proyecto: no comparten bundle.

### "Ninguna pantalla dice «puntos»" tenía un sobrante real

`grep` encontró cinco archivos con la palabra "puntos". Cuatro eran legítimos —puntaje de arco (`Archer.tsx`, `Tournaments.tsx`), puntos de un gráfico (prop `puntos` de `GraficoDeEvolucion`), o sobre el torneo individual (`torneo.ts`: "no suman puntos" se refiere a si el arquero tiró, no al sistema de liga)—. El quinto no: `Publish.tsx` decía "los puntos que sumó cada arquero se recalculan" al despublicar, lenguaje del sistema por posición que `SH-9` había retirado hace dos días sin tocar esta frase. Corregido a "el promedio de cada arquero se recalcula".

### `Compartir` ignoraba la pestaña elegida

No estaba en el plan, pero sin esto las pestañas de WAFA no servían: `compartir()` armaba el texto siempre con `c.general`, así que tocar "Compartir" parado en la pestaña Femenino mandaba por WhatsApp el ranking General igual. Se encontró probando el flujo completo en el navegador, no leyendo el código. Corregido para que comparta `c[vista]`, con el nombre de la vista sumado al de la temporada en el encabezado del texto —`textoDeRanking` en `@bal/shared` es dominio puro de puntajes y no sabe de sexo, así que la etiqueta se arma en el componente, no se le agregó un parámetro nuevo a la función pura.

### Deuda / lo que sigue

- `TEST-3`: E2E de punta a punta de toda la Fase 8. Es lo único que queda.

---

## 2026-10-26 · WAFA: cola de aprobación de altas pendientes (FE-30)

**Autor:** Claude Sonnet 5 · **Estado:** completado.

### Filtro, no pestaña

El plan dejaba abierto «lista separada (o filtro)». Se eligió filtro: un segundo checkbox junto a «Ver archivados», mutuamente excluyente con él —no tiene sentido pedir las dos vistas a la vez—, que cambia tanto el query (`?status=pendiente`) como qué componente de fila se renderiza (`FilaPendiente` en vez de `Fila`). Reusa toda la pantalla existente en lugar de abrir una ruta nueva.

### El segundo toque, no un diálogo

`Tournament.tsx` ya tiene el patrón para esto —borrar un torneo pide un segundo toque sobre el mismo botón, con un estado local, no un `<dialog>` ni una librería de modales—. Se repitió igual acá para Aprobar y Rechazar, cada uno con su propio estado de confirmación por fila (no uno global, porque la pantalla lista varias altas pendientes a la vez). El texto de confirmar "Rechazar" dice explícitamente que no tiene vuelta atrás, porque no la tiene: `rejectArcher` borra el documento, no lo archiva.

### "Disponible de inmediato en el wizard" ya estaba resuelto

Antes de escribir nada para esto, se revisó `SelectorDeArqueros.tsx` (el componente del wizard de torneo que lista arqueros elegibles): pide `/admin/archers` de nuevo cada vez que se monta, sin caché. Como `archerRepo.list` ya excluye `pendiente` por defecto (desde `BE-19`), aprobar acá y después abrir el wizard ya alcanza — no hizo falta invalidar nada ni construir ningún mecanismo de refresco.

### Deuda / lo que sigue

- Con esto cierra `SH-8`..`FE-30`: todo lo nuevo funciona de punta a punta salvo el ranking por pestañas. Queda `FE-28` (pestañas General/Femenino/Masculino) y `TEST-3` (E2E) para terminar la Fase 8.

---

## 2026-10-26 · WAFA: sexo, DNI y búsqueda por DNI en el padrón (FE-29)

**Autor:** Claude Sonnet 5 · **Estado:** completado.

### El formulario vive adentro de `Archers.tsx`, no en un `ArcherForm.tsx` separado

El plan listaba `{Archers,ArcherForm}.tsx` como si fueran dos archivos; `ArcherForm` siempre fue un componente local dentro de `Archers.tsx`. Se aprovechó para escribir el filtro de DNI bien desde el principio —sin `maxLength` nativo peleando con el `onChange`, el bug que `FE-27` encontró y corrigió en la landing— en vez de reintroducirlo acá y tener que volver a encontrarlo.

### Ninguno de los dos campos bloquea el guardado

Decisión 6 es explícita: el padrón viejo no se fuerza a completarse retroactivamente. El formulario pide sexo y DNI, pero `completo` —lo que habilita "Guardar"— sigue dependiendo sólo de nombre y apellido. El aviso en el listado (`profileIncomplete`, que ya traía `BE-19`) es el mecanismo real: se puso **a la vista** en cada fila, no detrás de un `<details>` como el de "por qué no se puede eliminar" —ese se consulta cuando hace falta, este es para escanear el padrón entero de un vistazo.

### "Búsqueda por DNI" no estaba en los archivos del plan porque es de backend

`archerRepo.list` sólo filtraba por `searchKey` (nombre y apellido armados en una clave normalizada). Se le agregó un `$or` contra `dni`, con el mismo término ya escapado que usaba `searchKey` — no hizo falta tocar la ruta ni el query schema, `q` ya existía desde antes. TDD: el test se escribió primero contra el comportamiento viejo, se lo vio devolver `[]` en rojo, y el fix fue una línea.

### Deuda / lo que sigue

- Con esto cierra todo `SH-8`..`FE-29`. Queda `FE-30` (cola de aprobación en WAFA), `FE-28` (pestañas de sexo en el ranking) y `TEST-3` (E2E) para terminar la Fase 8.

---

## 2026-10-25 · Landing: alta de arquero, queda pendiente (FE-27)

**Autor:** Claude Sonnet 5 · **Estado:** completado. Primera pantalla de la landing que escribe; dos bugs reales sólo aparecieron al probar el formulario en el navegador, no corriendo los tests.

### El `maxLength` nativo pelea con el filtro de `onChange`

El campo DNI tenía `maxLength={8}` y un `onChange` que filtra letras con `/\D/g`. El atributo nativo trunca el valor **crudo** antes de que React vea el cambio, así que tipear `"30ab123cd456xx99"` llegaba al handler ya cortado en los primeros 8 caracteres crudos (`"30ab123c"`), y filtrar las letras de eso deja sólo 5 dígitos — no los 8 esperados. Encontrado tipeando en el navegador con `javascript_tool`, no con un test: el test original tipeaba dígitos limpios y no lo habría atrapado. Se sacó el `maxLength`; el tope de 8 lo pone el `.slice(0, 8)` sobre el valor ya filtrado, y se agregó un test con letras intercaladas.

### El primer mensaje de Zod que llega a una pantalla, sin traducir

`texto()` y `SexSchema`, en `packages/shared/src/schemas.ts`, nunca habían tenido mensajes propios — nadie lo había notado porque hasta ahora ningún formulario mostraba `issue.message` directo al usuario. `ArcherInputSchema` ya los usa, así que el admin también se beneficia del arreglo, no sólo el autoregistro. El fix fue agregar mensajes en español a los dos; el test para el caso de sexo inválido se escribió dos veces: la primera versión comprobaba que el mensaje incluyera `femenino`/`masculino`, pero esas son las mismas palabras en inglés y en español, así que pasaba aunque el armazón del mensaje siguiera en inglés (`"Invalid option: expected one of..."`). Se corrigió para verificar la *ausencia* de ese armazón, no la presencia de palabras del dominio.

### Deuda / lo que sigue

- `FE-29` (sexo/DNI en el alta de WAFA), `FE-30` (cola de aprobación) y `FE-28` (pestañas de sexo en el ranking) siguen siendo lo único pendiente de la Fase 8, más `TEST-3` (E2E).
- El hallazgo de los mensajes de Zod probablemente valga una pasada sobre el resto de los schemas de `packages/shared/src/schemas.ts` el día que otro formulario empiece a mostrar `issue.message` directo — no se hizo acá porque ningún otro lo hace todavía.

---

## 2026-10-25 · Ranking público por sexo: General/Femenino/Masculino (BE-21)

**Autor:** Claude Sonnet 5 · **Estado:** completado — con la misma clase de corrección forzada que ya aparece dos veces en esta fase (`SH-9`, `BE-20`): cambiar un contrato público rompe a quien ya lo consume, y hay que arreglarlo en el mismo cambio.

### Cambiar la forma de la respuesta rompía las dos pantallas ya en producción

`GET /api/public/rankings` pasó de `{ bestN, categories: [{ category, ranked, notYetEligible }] }` a `{ bestN, categories: [{ category, general, femenino, masculino }] }`. Los dos `Ranking.tsx` (landing y WAFA) leían `categoria.ranked`/`categoria.notYetEligible` directo. Ningún `pnpm typecheck` lo iba a atrapar —las interfaces del frontend son una promesa sobre la forma de la respuesta, no algo que TypeScript verifique contra el backend real— así que habría quedado roto en producción sin que ningún check lo dijera, hasta que alguien abriera la pantalla y viera el ranking vacío.

Se adelantó la parte mínima de `FE-28` que hacía falta para no romper nada: las dos pantallas ahora leen `categoria.general.{ranked,notYetEligible}`. **No** se agregaron las pestañas — `femenino`/`masculino` llegan en la respuesta y nadie los usa todavía. Es la misma frontera que ya se usó en `SH-9`: la corrección forzada se hace, la *feature* nueva se deja para la tarea que la tiene asignada.

### El test de integración evita el caso fácil (empates)

El primer borrador del test de "cada vista numera desde 1" usaba `completarTorneo`, el helper compartido — pero ese helper sólo distingue al primer arquero del resto (`i === 0`), así que con 4 participantes, 3 habrían empatado. Se escribieron ops de sync a mano, una por arquero, con cuatro puntajes distintos, para no depender de esa limitación del helper. Con un solo torneo publicado nadie llega a `bestN=2`, así que el test quedó mirando `notYetEligible` —separado por sexo— en vez de `ranked`, que de todos modos es lo que ya prueba `league.test.ts` a nivel unitario.

### Deuda / lo que sigue

- `FE-28`: las pestañas en sí. Es lo único verdaderamente pendiente de esta sub-fase del ranking por sexo.
- Con esto, `SH-8` a `BE-22` —toda la capa de dominio y de backend de la Fase 8— está cerrada. Lo que queda es puramente frontend: `FE-27` (formulario de alta), `FE-29` (sexo/DNI en WAFA), `FE-30` (cola de aprobación), `FE-28` (pestañas), y `TEST-3` (E2E).

---

## 2026-10-25 · Aprobar o rechazar altas pendientes (BE-22)

**Autor:** Claude Sonnet 5 · **Estado:** completado. Cierra el circuito que abrió `BE-20`: ahora hay alguien del otro lado revisando la cola.

Nada sorprendente en esta — es la tarea más directa de la fase. `approveArcher` y `rejectArcher` siguen el mismo patrón que `patrolAdminService.regeneratePin`: la acción, después el audit log, sin transacción porque no hay nada que necesite atomicidad entre dos colecciones. `rejectArcher` repite la guarda `hasParticipated → ARCHER_IN_USE` que ya tenía `archerService.remove`, en vez de llamarlo: son dos acciones distintas (una es "rechazar un alta", la otra "borrar del padrón") que comparten una regla, no una sola acción con dos nombres — no justificaba una abstracción.

`GET /admin/archers?status=pendiente` no necesitó ninguna línea nueva: `BE-19` ya lo había dejado funcionando al agregar el filtro de `status` a la query. Es la segunda vez en esta fase que una tarea posterior encuentra que la anterior ya la completó sin saberlo (la primera fue `db:reconcile` en `BE-19`).

Con esto, el autoregistro público (`BE-20`) deja de ser una ruta que escribe a una cola que nadie mira: hay alta → aprobación/rechazo → disponible para el wizard de torneo, de punta a punta, aunque todavía sin ninguna pantalla — todo probado por API directa.

### Deuda / lo que sigue

- `FE-30`: WAFA todavía no tiene la pantalla de la cola. `GET ?status=pendiente` y los dos POST están, probados, pero nadie los ve sin abrir la consola de red.
- `BE-21`/`FE-28`: el split por sexo del ranking sigue siendo lo único que falta para que `SH-10` tenga alguna pantalla.

---

## 2026-10-25 · Alta pública de arqueros (BE-20)

**Autor:** Claude Sonnet 5 · **Estado:** completado. Primera ruta pública que escribe; `/security-review` corrió sobre el diff completo de la fase antes de este commit.

### `publicCache` nunca había visto un método que no fuera GET

`middleware/cache.ts` le agrega `Cache-Control: public, max-age=60` y un `ETag` a toda respuesta 200 de `/api/public/*`, sin filtrar por método — porque hasta ahora esa ruta **sólo tenía GETs**, así que la pregunta nunca se planteó. Al agregar el primer `POST`, la respuesta de crear un arquero habría salido con cabeceras de caché pública: un intermediario podría haber servido de nuevo la respuesta de **otra** creación para un request posterior. Se acotó el middleware a `c.req.method === 'GET'` antes de escribir la ruta nueva, no después.

Es el mismo tipo de hallazgo que `SH-8` tuvo con `StakeMapSchema` y que `BE-19` no tuvo: código que nadie escribió mal, que simplemente nunca se topó con el caso que esta tarea introduce por primera vez. `pnpm typecheck` no lo iba a encontrar —es una cabecera HTTP, no un tipo— así que quedó para la revisión manual del endpoint nuevo.

### La respuesta nunca repite `dni`, ni el que el mismo cliente mandó

Decisión explícita, documentada en `docs/SECURITY.md` §15: ninguna ruta sin sesión devuelve `dni` ni `registrationStatus`, **tampoco** la de crear, aunque el dato sea el que el propio cliente acaba de escribir en el formulario. Es más estricto que lo mínimo necesario —nadie más que ese cliente podría leer esa respuesta en el momento— pero mantiene la regla sin excepciones: no hay un "sólo esta vez" que alguien tenga que recordar al tocar este archivo en seis meses.

### Documentación que `SH-9` había dejado desactualizada

`docs/FUNCTIONAL.md` §5.2 y `docs/TESTING.md` §4.8 seguían describiendo el ranking «por posición» retirado hace dos commits. No es parte del alcance de `BE-20`, pero tocar `FUNCTIONAL.md` §5 para documentar el alta pública exigía pasar por esa sección, y dejarla mintiendo al lado de la sección nueva era peor que corregirla de paso.

### Deuda / lo que sigue

- `FE-27`: el formulario de la landing todavía no existe. El endpoint está, probado, pero nadie puede llegar a él sin escribir el `curl` a mano.
- `BE-22`: la cola de aprobación (`GET /admin/archers?status=pendiente` ya funciona desde `BE-19`; falta `approve`/`reject`) es lo único que saca a un arquero de `pendiente`.

---

## 2026-10-24 · Sexo y DNI reales en el padrón (BE-19)

**Autor:** Claude Sonnet 5 · **Estado:** completado — backend únicamente: la base ya guarda y propaga `sex`/`dni`, pero ninguna pantalla los pide todavía (`FE-29`) ni hay alta pública (`BE-20`).

### Por qué `sex`/`dni` quedaron opcionales contra lo que decía el plan

El `ACTION_PLAN.md` original decía «nuevos registros los exigen (schema)». Al sentarse a escribir el schema quedó claro que eso **rompería el único alta que existe hoy**: `FE-12` (el formulario de arqueros en WAFA) manda `{ firstName, lastName, category }` desde hace semanas, y nadie lo tocó todavía para pedir sexo o DNI. Si `ArcherInputSchema` los exigiera, cada `POST /admin/archers` del formulario actual empezaría a devolver 400 el día de este deploy, sin que ninguna pantalla supiera por qué.

La resolución: `sex`/`dni` opcionales en `ArcherInputSchema` (con default `null`), y la obligatoriedad real queda para el esquema del autoregistro público (`BE-20`, `ArcherSelfRegisterSchema`), que es un formulario nuevo escrito desde cero para pedir exactamente estos datos. `FE-29` tiene que actualizar el formulario de WAFA para pedirlos ahí también, pero eso es tarea de UI, no de validación del lado del servidor. Quedó anotado en `ACTION_PLAN.md` para que no se lea como si el plan original se hubiera cumplido al pie de la letra.

### Probado de punta a punta, no sólo por capas

En vez de confiar en que cada capa (`ArcherDoc` → `ParticipantDoc` → `StandingDoc`) propagaba bien por separado, el test nuevo en `ciclo.test.ts` crea un arquero con sexo y otro sin, los suma a un torneo real, lo completa y lo publica, y verifica el campo en las tres colecciones. Encontró lo que un test por capas no habría encontrado: nada, en este caso —pasó al primer intento— pero es la única forma de confiar en que el snapshot y el merge `entry.sex ?? actual.sex` de `SH-9`/`SH-10` realmente se activan con datos reales y no sólo con los fixtures de `league.test.ts`.

### `db:reconcile` no necesitó cambios

El DoD pedía que `db:reconcile` recalculara `standings` «con el sex vigente». Ya lo hacía: `reconcileStandings()` llama a `recalcularTemporada`, que llama a `applyTournamentToStandings`, que ya tiene la lógica de merge de `sex` desde `SH-9`. No hay una ruta separada para `sex` que reconciliar — es el mismo camino que `category` y `firstName`, y ya estaba bien.

### Índice único parcial: `$type`, no `$exists`

`{ dni: { $exists: true } }` como filtro parcial también matchea documentos con `dni: null` —la clave existe, sólo que vale `null`— así que dos arqueros viejos con `dni: null` chocarían contra el índice único apenas alguien lo creara. `{ dni: { $type: 'string' } }` excluye tanto la clave ausente como el valor `null`, que es lo que hace falta acá.

### Deuda / lo que sigue

- `FE-29`: el formulario de WAFA sigue sin pedir sexo ni DNI. Mientras no se haga, todo arquero nuevo nace con `profileIncomplete: true`.
- `BE-20`/`BE-22`: el autoregistro público y su cola de aprobación siguen sin escribirse. `archerRepo.create` ya acepta un `registrationStatus` opcional (default `'aprobado'`) pensado para que `BE-20` lo use con `'pendiente'` sin tocar la firma otra vez.
- `BE-21`/`FE-28`: el split General/Femenino/Masculino en el ranking público sigue bloqueado — ya hay dato real de `sex` en la base para alimentarlo.

---

## 2026-10-24 · Ranking de liga por sexo: General / Femenino / Masculino (SH-10)

**Autor:** Claude Sonnet 5 · **Estado:** completado — sólo el dominio puro; sin dato real de `sexo` todavía (eso es `BE-19`).

### Filtrar antes de ordenar, no después

`sortStandingsByGender` llama a `sortStandings` tres veces —general, femenino, masculino— cada una sobre su **propia pool filtrada**, nunca filtrando un ranking ya calculado. La razón está probada con un caso concreto: con 3 varones mejores y una arquera, ella es 4ª en el general pero 1ª en el femenino, porque el puesto compartido y el salto de posición (1, 2, 2, 4) dependen de contra quién se compite. Filtrar el resultado ya ordenado le habría dejado la posición "4" aunque fuera la única en su pool.

### `exactOptionalPropertyTypes` y un campo opcional nuevo

Este monorepo tiene `exactOptionalPropertyTypes: true` desde `INF-1`. Con esa opción, `sex?: Sex` significa que la clave puede **faltar**, pero si está presente tiene que ser `'femenino' | 'masculino'` — nunca `undefined` explícito. Escribir `sex: p.sex` donde `p.sex` es `Sex | undefined` no compila. La solución en los dos lugares que construyen un `ArcherStanding` (`nuevoStanding` y el merge dentro de `applyTournamentToStandings`) fue un spread condicional que omite la clave entera cuando no hay valor, en vez de asignarle `undefined`. Quedó comentado en el código porque no es obvio a simple vista por qué `sex: p.sex` directo no compila.

### Qué generaliza gratis y qué no

`Rankable.sex` y `ArcherStanding.sex` son opcionales y **ningún otro código que ya usaba esos tipos tuvo que cambiar** — ni un test, ni un archivo fuera de `league.ts`/`ranking.ts`/`domain.ts`. Es la ventaja de agregar un campo opcional en vez de uno obligatorio: generaliza sin arrastrar una migración por todo el árbol de dependientes, al revés de lo que pasó con `SH-9` y `leaguePointsForPosition`.

### Deuda / lo que sigue

- No hay ningún arquero real con `sex` cargado todavía: `BE-19` tiene que agregar el campo al padrón (`ArcherDoc`), propagarlo al snapshot del participante y de ahí a `Rankable` en `publishService.ts`.
- `BE-21` (exponer las tres vistas en `/api/public/rankings`) y `FE-28` (pestañas General/Femenino/Masculino en las dos pantallas de Ranking) quedan bloqueadas por `BE-19` — sin dato, no hay nada que mostrar.

---

## 2026-10-24 · Ranking «mejor de N», sin puntos de liga (SH-9, con BE-18 y partes de BE-19/BE-21/FE-28)

**Autor:** Claude Sonnet 5 · **Estado:** completado — `SH-9` y `BE-18` cerradas; dejó parcialmente hechas `BE-19`, `BE-21` y `FE-28` (quedan anotadas en `ACTION_PLAN.md` con lo que falta de cada una).

### El alcance real triplicó al escrito en el plan

`SH-9` nació acotada a `packages/shared/src/league.ts`. Al tocar `leaguePointsForPosition` aparecieron consumidores que el plan no había listado, en cascada:

1. **Dentro de `@bal/shared`:** `stats.ts` (`ArcherTournamentResult.leaguePoints`, sin ningún llamador real — confirmado por búsqueda antes de tocarlo) y dos módulos de presentación, `podio.ts` (`ETIQUETA_DE_MODO`, un diccionario por modo que ya no tiene sentido con un solo modo) y `compartir.ts` (`RankingParaCompartir.modo`, la misma historia).
2. **Fuera de `@bal/shared`:** `pnpm -r typecheck` —no los tests, que con esbuild no chequean tipos— encontró que `StandingDoc` todavía tenía `leaguePoints`/`podiums` en `db/types.ts`, que `standingRepo.ts` los mapeaba, que `publishService.ts` llamaba a `applyTournamentToStandings` con dos argumentos en vez de tres, y que `publico.ts` seguía aceptando `mode` en la query.

Ninguno de los dos grupos estaba en el `ACTION_PLAN.md` original de esta tarea. La razón es mecánica: TypeScript no permite dejar una migración de tipos a mitad de camino entre paquetes — o se sigue la cadena completa de consumidores, o el monorepo no compila. Se decidió seguir la cadena completa en el mismo cambio en vez de cortar en el límite de paquete que marcaba el plan, porque dejar `@bal/api`/`@bal/app`/`@bal/landing` rotos entre un commit y el siguiente viola la Definición de Terminado de `CLAUDE.md` tanto como no terminar la tarea.

Esto adelantó **partes** de `BE-18`, `BE-19`, `BE-21` y `FE-28`:

- `BE-18` (variable `LEAGUE_BEST_N`) quedó **completa** — era chica y la pedía `publishService.ts` para funcionar.
- `BE-19`, `BE-21` y `FE-28` quedaron **parciales**: la parte de «borrar lo que ya no existe» se hizo (porque si no, no compila); la parte de «agregar lo nuevo» —`sexo`/`dni`/`registrationStatus`, el split por sexo del ranking, las pestañas de la UI— sigue pendiente, documentada en `ACTION_PLAN.md` con una nota en cada tarea para que quien la tome no vuelva a buscar lo que ya está.

### `bestNAvgPct` no necesitó el parámetro que el plan le había puesto

El plan original decía que `bestTwoAvgPct` iba a recibir `bestN` como parámetro. Al escribir el primer test quedó claro que no hacía falta: la función ya dividía por `pcts.length`, no por una constante `2`, así que generaliza sola a cualquier N con sólo cambiar quién llena el array (`mejoresCon`, que sí recibe `bestN`). Se eligió la firma más chica — menos superficie es menos que mantener — en vez de seguir el plan al pie de la letra.

### Qué se borró y qué se conservó

Por la decisión confirmada con el usuario el mismo día: `leaguePoints` y `podiums` se borraron **los dos**, de punta a punta — tipo, documento de Mongo, índice (`ix_ranking_posicion`, que ya no indexa nada), endpoints públicos y las cinco pantallas que los mostraban (landing: `Ranking`, `Tournaments`, `Archer`; WAFA: `Ranking`, `Publish`). `bestNormalizedPct` (el mejor resultado suelto) se conserva: es el récord personal que el arquero reconoce, aunque ya no ordene nada.

### Hallazgo: `pnpm typecheck` no revisa los tests de `shared` ni de `api`

`packages/shared/tsconfig.json` y `packages/api/tsconfig.json` tienen `"include": ["src"]`. Sus tests viven en una carpeta `tests/` **al lado** de `src/`, no adentro — así que `pnpm typecheck` nunca los toca. (En `app` y `landing` es al revés: los tests viven dentro de `src/`, así que ahí sí typechequean.)

Se detectó porque `stats.ts` quedó con `leaguePoints` sin borrar —olvidado de verdad, no una decisión— y ni el typecheck de `shared` ni el de todo el monorepo lo encontraron; sólo lo delató revisar a mano después de que todo ya daba verde. `pnpm vitest run` sí corre esos archivos y los ejecuta, así que un cambio de tipo que rompe algo en runtime se termina viendo igual, pero un cambio que sólo deja un campo de más o de menos **sin que ningún assert lo note** puede pasar completamente desapercibido en `shared` y `api`. No se abre una tarea nueva para esto —es de infraestructura de testing, no de esta fase— pero vale la anotación para la próxima vez que algo se sienta raro después de un refactor de tipos: revisar a mano los `tests/` de esos dos paquetes, no confiar en que el typecheck los cubre.

### Deuda / lo que sigue

- `BE-19`: agregar `sexo`/`dni`/`registrationStatus` al padrón — lo único de esa tarea que faltaba de verdad.
- `BE-21` y `FE-28`: el split General/Femenino/Masculino depende de `SH-10`, que todavía no se tocó.
- `ix_ranking_posicion` se borró de `ensureIndexes`, pero **no hay mecanismo en este proyecto para dropear índices de un Mongo ya desplegado** — en cualquier entorno donde ese índice ya se haya creado, queda huérfano hasta que alguien lo borre a mano. Mismo problema preexistente que ya tenía `ix_ranking_puntaje`.

---

## 2026-10-24 · Estaca `naranja` y categoría `principiantes` (SH-8)

**Autor:** Claude Sonnet 5 · **Estado:** completado — es la primera tarea de la Fase 8 (padrón público, categorías/estacas nuevas, ranking por sexo y mejor-de-N), planificada el mismo día en `ACTION_PLAN.md` junto con una tabla de 7 decisiones que el usuario confirmó antes de empezar a tocar código.

### `principiantes` se unió a la bolsa no-senior sin tocar `patrolling.ts`

`isEscuela()` ya generalizaba por el flag `senior` de `CATEGORY_INFO`, no por el nombre de la categoría. El test «`principiantes` dispara el mismo warning que `escuela` cuando no alcanzan los seniors» pasó en el primer intento de implementación —agregar la categoría con `senior: false`—, sin tocar una línea de la lógica de armado. Es la señal de que `H3` estaba bien diseñada desde `SH-3`.

Lo único que se renombró en `patrolling.ts` fue el código del warning: `ESCUELA_SIN_SENIOR` → `CATEGORIA_SIN_SENIOR`, porque con dos categorías no-senior el nombre viejo mentía. Se actualizó en el código y en los dos tests que lo verificaban (`@bal/shared` y `@bal/api`), no sólo en un comentario.

### Una estaca nueva toca más paquetes de los que parece

`SH-8` nació acotada a `packages/shared`, pero `pnpm -r typecheck` encontró tres lugares más que se habrían roto o quedado a medio andar si no se tocaban en el mismo cambio:

- `StakeMapSchema` y `DistancesSchema` en `schemas.ts` no tenían la clave `naranja`: un admin que mandara un `stakeMap` personalizado con `principiantes` se habría encontrado con un 400 de `.strict()` sin explicación obvia.
- `tournamentService.ts` copiaba `stakeMap.{roja,azul,amarilla}` a mano al snapshot del torneo — sin la cuarta clave, `principiantes` se guardaba con un `stakeMap` incompleto.
- `StakeChip.tsx` resuelve el color por un `Record<Stake, …>` propio (no reexporta el de `@bal/shared`): sin la entrada `naranja`, el componente devolvía `null` y la estaca no se veía en ninguna pantalla, en silencio.

Ninguno de los tres rompía un test existente — los tres son cosas que **faltaban**, no que se rompieron — y los tres se encontraron por el typecheck del monorepo, no por cobertura. Queda como lección: una estaca o categoría nueva en `@bal/shared` hay que perseguirla con `pnpm -r typecheck`, no asumir que el paquete de dominio es el único lugar.

### Decisiones de diseño de esta tarea

- **Etiqueta «Iniciación», no «Principiantes».** La clave de dominio es `principiantes` —así la pidió el usuario—, pero la etiqueta visible tiene un límite de 11 caracteres (`tests/etiquetas.test.ts`, por el ancho de fila en celular) y «Principiantes» son 13. «Iniciación» es el término que ya usan los clubes de arquería para esta categoría.
- **Color de categoría `#7a3f73`/`#d9a8d1` (ciruela apagada).** Saturación ~0.32, bien por debajo del 0.6 que dispara el chequeo de «se confunde con una estaca» — igual que `tradicional` ya resolvía su cercanía de tono con `roja`/`naranja` bajando la saturación en vez de alejar el tono.
- **Color de estaca `--stake-naranja: #e8650a`.** Naranja saturado, visible al sol; no hay test que exija que las estacas sean distinguibles entre sí (sólo que las categorías no se les parezcan), así que la elección fue por criterio visual.
- **Ícono `IconoPrincipiantes`:** diana con un impacto lejos del centro, siguiendo la convención de `IconoEscuela` (glifo que no es un arco, porque la categoría no distingue tipo de arco) pero visualmente distinto de él (impacto ya hecho y descentrado, en vez de flecha todavía en camino).

### Deuda / lo que sigue

- El campo `sexo` del arquero (parte del pedido original de `SH-8`) **no** se tocó en esta tarea: pertenece al padrón (`ArcherDoc`), que es `BE-19`, y al ranking por sexo, que es `SH-10`. El título de la tarea en `ACTION_PLAN.md` se acortó para reflejar el alcance real.
- Queda pendiente actualizar `DESIGN_SYSTEM.md` si tiene una paleta de referencia propia (no se encontró una sección de colores duplicada fuera de `paleta.ts`/`tokens.css`, pero no se revisó el documento completo).
## 2026-10-29 · Auditoría de dependencias: de 38 vulnerabilidades a 1 `low` sin parche

**Autor:** Claude Sonnet 5.5 · **Estado:** completado

El job «Auditoría de dependencias» de CI (`pnpm audit --audit-level=high`) fallaba en todo PR **y en `origin/main`**: no lo causaba ningún cambio de código, sino advisories nuevos publicados sobre dependencias que ya estaban. Bloqueaba el merge de cualquier rama. Se reprodujo en un worktree limpio de `origin/main` antes de tocar nada: 38 vulnerabilidades (1 critical, 14 high, 18 moderate, 5 low), con los `package.json` y el lockfile idénticos a los de la rama que lo disparó.

### Qué se hizo

`pnpm update -r --depth Infinity` sólo sobre los paquetes afectados, dentro de los rangos `^` que el repo ya declaraba, más `pnpm dedupe`:

- **Directas:** `zod` ^4.4.3 → ^4.6.7 (`shared`, `api`) · `vite` ^8.2.1 → ^8.3.5 (`app`, `landing`) · `vitest` y `@vitest/coverage-v8` ^4.1.10 → ^4.1.12 (todos) · `hono` ^4.13.1 → ^4.13.14 y `@hono/node-server` ^2.1.0 → ^2.1.5 (`api`).
- **Transitivas:** `fast-uri`, `brace-expansion`, `source-map-js` (1.2.2) y `follow-redirects` (1.16.2).
- **Override** en el `package.json` raíz: `"shell-quote": "^1.11.0"` (resuelve 1.12.0).

Resultado: `pnpm audit --audit-level=high` sale con código 0. Queda **1 `low`** (`deepmerge`, sin versión parcheada publicada: no hay nada que subir).

### Decisiones

- **La `critical` no se podía arreglar con un `update`.** `shell-quote` llega por `concurrently@9.2.4`, que lo **fija exacto** en 1.9.0. Subir `concurrently` a la 10.x es un salto mayor de una herramienta de desarrollo (sólo se usa en `pnpm dev`) por una dependencia transitiva: se eligió el override acotado a 1.x, y se comprobó que `concurrently` sigue corriendo comandos.
- **`vite` subió un minor entero (8.2 → 8.3)**, no sólo hasta el primer parche (8.2.4): el rango `^8.2.1` lo permite y pnpm toma el más alto. Arrastró `rolldown`/`babel` nuevos. 95 paquetes cambiaron de versión en el lockfile y **ninguno con salto mayor** (verificado comparando el lockfile viejo y el nuevo, no a ojo). Se aceptó porque tipos, lint, tests, presupuesto de bundle y E2E pasan; si más adelante se prefiere menos movimiento, es `vite@8.2.4` exacto.
- **`hono` es dependencia de producción de la API**, y 5 de los advisories `moderate` eran suyos. No bloqueaban el job, pero iban en el mismo refresco de lockfile y no tenía sentido dejarlos.
- **Aviso de pnpm que no es un problema:** el `pnpm` instalado en la máquina de desarrollo (un lanzador más nuevo) imprime «the "pnpm" field in package.json is no longer read». Con el `pnpm@9.15.0` que fija `packageManager` —el que usa CI— el override **sí se aplica**: el lockfile lo registra en `overrides:` y `install --frozen-lockfile` + `audit` dan verde con esa versión exacta. Si el repo sube a pnpm ≥ 10, el override se mueve a `pnpm-workspace.yaml`.

### Verificación

Sobre el código de `origin/main`: `pnpm typecheck` y `pnpm lint` sin errores; `pnpm test` en verde (shared 442, api 264, ui 60, app 464, landing 34); presupuestos de bundle en verde (WAFA + WAFL 132,08 KB de 150; landing 106,08 KB de 120); E2E completo (`pnpm test:e2e`, stack real en Chromium): 15 de 15 en verde, 2,2 min.

### Deuda

- Quitar el override de `shell-quote` cuando `concurrently` publique una versión que lo pinee parcheado (o subir a 10.x en una tarea propia).
- El job de auditoría vuelve a romperse cada vez que se publique un advisory `high` sobre algo ya instalado; no es una falla de este repo, pero conviene saber que es esperable y que arreglarlo es un refresco de lockfile, no una investigación.

---

## 2026-08-21 · Recuperar el password del admin sin redesplegar

**Autor:** Claude Opus 5 · **Estado:** completado

La estrategia anterior —resetear al arrancar cuando cambiaba `ADMIN_INITIAL_PASSWORD`— **era inútil en el único momento en que hace falta**: el día del torneo. Exigía un redeploy, que es justo lo que nadie va a hacer con la patrulla esperando.

Ahora la variable es un **código de recuperación**: se ingresa desde el login de WAFA y habilita elegir un password nuevo, sin tocar el deploy.

### Es la única ruta sin sesión que cambia una credencial

Eso define todo el diseño:

- **Comparación de tiempo constante.** Un `===` sobre strings corta en el primer carácter distinto, y esa diferencia deja adivinar el código de a un carácter contra el servidor.
- **Se comparan digest, no valores.** `timingSafeEqual` exige largos iguales: pasarle los secretos crudos expondría el largo del código por la forma de fallar.
- **El error es el mismo que el de un login fallido.** Distinguir «código incorrecto» de «password inválido» convierte el endpoint en un oráculo.
- **Se cierran todas las sesiones.** Si el motivo de recuperar es que alguien más entró, dejar su sesión viva no arregla nada.
- **Los intentos fallidos también se auditan.** Alguien probando el código contra el servidor es exactamente lo que hay que poder ver después.

Hereda el rate limit de `/api/auth/*` y la protección CSRF de `/api/*`, sin agregar nada nuevo.

### La revisión encontró que habían quedado dos caminos

El reset al arrancar seguía en pie. Con la recuperación por interfaz eso dejó de ser redundante y pasó a ser **dañino**: rotar el código de recuperación habría borrado el password del admin en el próximo deploy, **sin que nadie lo pidiera**.

Se sacó. El seed volvió a ser lo que era: idempotente, y nunca pisa un password que el usuario ya cambió.

### Lo que cambia de supuesto

Antes `ADMIN_INITIAL_PASSWORD` sólo se usaba al sembrar y **no era alcanzable desde afuera**. Ahora está expuesto a internet.

Queda escrito en `SECURITY.md`: el código tiene que ser **aleatorio, no memorable**. Un valor elegido a mano convierte la recuperación en la puerta más débil del sistema.

> **5 controles de mutación, murieron 5**: aceptar cualquier código, no cerrar las sesiones vivas, no levantar el bloqueo, guardar el código en el audit log, y que el login deje de ofrecer la salida.

> Uno de esos cinco **no probaba nada la primera vez**: el reemplazo de texto no coincidía porque el formateador había reindentado el archivo, así que la mutación nunca se aplicó y el test pasó «bien». Se detectó comparando el archivo antes y después.

---

## 2026-08-20 · Indicador de conexión en el header de WAFA

**Autor:** Claude Opus 5 · **Estado:** completado

Un punto verde o rojo en el header, con el estado escrito para el lector de pantalla.

**Va sólo donde faltaba.** WAFL ya tenía el `SyncBadge`, que dice lo mismo y además cuántos cambios quedan sin enviar; el header lo agrega únicamente cuando la pantalla no trae el suyo. Dos indicadores de red en la misma barra son dos cosas que pueden contradecirse.

WAFA no tenía ninguno, y es la app que **sí** depende de la red: puede leer de la caché sin señal, pero no crear ni editar. Sin indicador, el admin se enteraba de que estaba sin conexión recién cuando fallaba el guardado.

### `navigator.onLine` no dice que el servidor esté vivo

Dice que hay una interfaz de red levantada. En el monte se tiene señal y no pasa un byte. Por eso el texto habla de la conexión **del dispositivo** y no promete que la app vaya a poder guardar: eso lo sabe el intento real.

Y ante la ausencia de la API se responde **con conexión**: es mejor no avisar nada que teñir de rojo una app que anda bien. Misma lección que `matchMedia` en `REF-4`.

### Agregar un `role="status"` rompió un test de otra pantalla

Un test de publicación buscaba su aviso con `findByRole("status")`, asumiendo que había **una sola** región anunciada en la pantalla. Con el indicador en el header pasaron a ser dos.

Y el modo de fallar fue peor que un simple choque: `findBy*` se resuelve con **el primero que aparezca**, así que el indicador satisfacía la espera al instante y el test dejaba de aguardar al aviso — pasaba a comparar contra una cadena vacía.

Se corrigió esperando **el texto** del aviso y verificando después que esté dentro de una región anunciada. Prueba las dos cosas sin depender de cuántas haya.

> **4 controles de mutación, murieron 4**: quedarse siempre en verde, sacar el nombre accesible y dejar sólo el color, marcar desconectado cuando falta la API, y duplicar el indicador en pantallas que ya traen el suyo.

---

## 2026-08-20 · Recuperar el acceso del admin cambiando la variable de entorno

**Autor:** Claude Opus 5 · **Estado:** completado

Si el administrador se olvida el password no había salida: no hay recupero por mail —la liga no guarda mails de nadie— ni un segundo administrador que pueda rescatarlo. La única opción era entrar a la base a mano.

Ahora **cambiar `ADMIN_INITIAL_PASSWORD` y reiniciar** resetea el password y vuelve a exigir uno nuevo.

### El problema era saber si la variable cambió

El seed no puede comparar la variable contra el password del usuario: después de que el admin elige el suyo, dejan de tener relación. Y comparar contra el valor en claro exigiría guardarlo.

Se guarda un **hash argon2id del valor aplicado por última vez**, aparte del password. En cada arranque se verifica con `verifySecret`:

| Resultado | Qué pasa |
|---|---|
| Coincide | No se toca nada — **redesplegar no pisa el password que el admin eligió** |
| No coincide | Reset, `mustChangePassword: true`, y se levanta el bloqueo por intentos fallidos |
| Sin huella guardada | Se escribe la huella **sin resetear**: no se puede saber, y ante la duda no se pisa nada |

Es un hash y no el valor: si la base se filtra, no entrega la credencial de rescate. Y es argon2id, el mismo del password, para que compararlo no abra una vía de fuerza bruta más barata que la del login.

### El bloqueo se levanta a propósito

Estar bloqueado por intentos fallidos es **justo el escenario previo típico** a que el dueño busque cómo recuperar la cuenta. Si el reset no levantara el bloqueo, el operador cambia la variable, reinicia, y sigue afuera.

### Lo que dejó la revisión de seguridad

`/security-review` no encontró vulnerabilidades. Sí un **supuesto que no estaba escrito**: quien puede editar las variables del proyecto puede tomar la cuenta de administrador reiniciando el servicio.

No es superficie nueva —el primer arranque ya siembra el admin desde esa misma variable— pero ahora está explícito en `SECURITY.md` §3.1, con la consecuencia operativa: ese permiso se trata con el mismo cuidado que la credencial del admin.

> **4 controles de mutación, murieron 4**: resetear en todo arranque, no resetear nunca, no levantar el bloqueo, y **meter el password en el audit log**.

> Ese último control importaba especialmente: el test que verifica que el audit no guarde la credencial **pasaba antes de implementar nada**, porque sin entrada no hay nada que contenga el password. Recién con la mutación se supo que servía.

---

## 2026-08-20 · Salir a la landing desde los dos logins

**Autor:** Claude Opus 5 · **Estado:** completado

Quien abría la PWA sin credenciales **quedaba encerrado**: WAFA pide usuario y password, WAFL pide torneo, patrulla y un PIN de seis dígitos, y desde `ref-3` el botón Atrás ya no saca de la app. La única salida era cerrar la pestaña.

Ahora los dos logins ofrecen volver al sitio público, **después** del botón de entrar: el que vino a entrar entra, y el que se perdió tiene por dónde salir.

### Se extrajo antes de sumar

El enlace ya estaba escrito **dos veces** —en la elección de rol y en la pantalla de torneo finalizado— y con los dos logins iban a ser cuatro. Es exactamente cómo empezó la tarjeta que `REF5-2` tuvo que deshacer 29 veces.

Se extrajo `VolverALaLiga` primero, y las dos copias existentes pasaron a usarlo.

### El password del admin ya estaba por variable de entorno

El pedido lo listaba como pendiente y **ya estaba resuelto**: `ADMIN_INITIAL_PASSWORD` es obligatoria, sin default; el seed es idempotente y nunca pisa un password existente; el usuario se crea con `mustChangePassword: true`.

`CBA2026` aparece en el código **sólo como valor prohibido**, no como default. Y hay tres tests que lo sostienen: falla si falta la variable, si sigue siendo la de desarrollo, y si tiene menos de 12 caracteres en producción.

No se tocó nada. Se verificó y se dijo.

> **3 controles de mutación, murieron 3**: que WAFA deje de montarlo, que WAFL deje de montarlo, y que el enlace pierda el objetivo táctil de 44 px.

> El test importa `fake-indexeddb/auto`: el login de WAFL consulta el bundle local al montar, y sin eso quedaba un error sin manejar en la corrida — ruido que tapa los de verdad.

---

## 2026-08-20 · `REF5-5` — el botón primario fallaba AA en toda la app. Cierra `ref-5`

**Autor:** Claude Opus 5 · **Estado:** completado · **Tareas:** `REF5-5`

La tanda de WAFL empezó midiendo, siguiendo lo aprendido en `REF5-4`. El teclado cumplía los 56 px sin problema. **El contraste no.**

### La tecla del inner tenía 2.70:1

La tecla del `11` usa `--nock` con `--nock-ink`, que en tema claro eran verde oliva `#8FA800` con tinta **blanca**. El par da **2.70:1**: por debajo de AA (4.5), muy por debajo del AAA (7) que §2.4 exige en la pantalla de scoring.

Y no era un detalle de una tecla: **ese par es todo botón primario de las tres aplicaciones**. En el tema claro, que es el default de WAFL porque es el que gana bajo el sol.

### El documento afirmaba lo contrario

§2.1 decía, textual, que en tema claro el verde *«se oscurece a `#8FA800` para llegar a contraste AA»*. Es falso con la tinta que tenía al lado. El párrafo se corrigió.

El par **no tenía test**, y por eso pudo derivar de lo que el documento prometía. Ahora hay uno que lee `tokens.css` —no una copia en TypeScript— y exige AAA en los dos temas.

### Se cambió la tinta y no el verde, a propósito

`--nock` también dibuja el anillo de foco sobre el fondo claro. Aclararlo para ganar contraste con la tinta habría **empeorado** el anillo:

| Opción | Tecla | Anillo de foco sobre `--bg` |
|---|---|---|
| Hoy: blanco sobre `#8FA800` | 2.70 ❌ | 2.59 |
| Aclarar a `#9CB800` con tinta oscura | 7.97 ✅ | **2.17** — peor |
| **Elegida**: tinta `#0D0E05` sobre `#8FA800` | **7.18** ✅ | 2.59 — igual |

`#0D0E05` es el negro oliva del proyecto un paso más profundo que `--ink`. No es negro puro.

### Deuda abierta: el anillo de foco

`--nock` sobre `--bg` da **2.59:1**, y WCAG pide **3:1** para componentes no textuales. Ya fallaba antes de esta tanda y **sigue fallando**.

No se arregló acá porque el único arreglo por esta vía —oscurecer `--nock`— entra en conflicto directo con el contraste de la tecla, que es lo que esta tanda vino a resolver. Un token propio para el anillo es una decisión de diseño, no una corrección: queda planteada.

> **1 control de mutación, murió 1**: reponer la tinta blanca, que es el defecto original.

### `ref-5` cerrado

Cinco tandas. Las dos primeras cambiaron código; las tres últimas encontraron que **lo que faltaba casi siempre era la medición**, no el arreglo: las pantallas ya cumplían la mayoría de las reglas escritas, y nadie las estaba comprobando contra el navegador.

Las excepciones fueron las dos que sí eran defectos: las tablas que obligaban a arrastrar de costado, y este par de contraste.

---

## 2026-08-20 · `REF5-4` — WAFA ya cumplía; lo que faltaba era la medición

**Autor:** Claude Opus 5 · **Estado:** completado · **Tareas:** `REF5-4`

La tanda pedía densidad pareja, jerarquía en las listas largas y foco visible. Al revisarlo, **las tres cosas ya estaban**:

| Ítem | Estado real |
|---|---|
| Densidad | La unificó `REF5-2` al migrar las 29 tarjetas |
| Jerarquía en listas | La resolvieron `ref-3` y `ref-4`: identidad y categoría arriba, estado abajo, acciones después |
| Foco visible | `tokens.css` ya tenía la regla de §10, con el anillo de 3 px |

Lo que **no** existía era la prueba. §11 pide medir los objetivos táctiles *«sobre estilos computados, no a ojo»*, y nadie lo hacía: un `min-h-[44px]` escrito en el código no prueba que el elemento mida 44 en la pantalla — un `flex` que encoge, un contenedor con `overflow` o una clase que gana por orden lo dejan más chico sin que nada avise.

Entonces esta tanda no cambió pantallas: **agregó la medición**. Dos E2E nuevos, en un navegador de verdad porque en jsdom todo mide cero y el test pasaría siempre.

### El primer test medía el elemento equivocado

Marcó como defecto los checkboxes de 20 px de la pantalla de arqueros. Están dentro de un `<label>` de 44: **tocar cualquier punto del label activa el control**, así que el objetivo real es el label y el patrón está bien.

Se corrigió midiendo `e.closest("label") ?? e` — lo que el dedo toca de verdad. No es un atajo para que pase: es la diferencia entre medir el control y medir el objetivo.

### Los dos pasaron a la primera, así que hubo que probar que muerden

Un test que pasa la primera vez no prueba nada. Achicar el botón primario a 30 px hace que el primero nombre cada control con su alto real; apagar el `outline` del `:focus-visible` hace que el segundo falle diciendo que el elemento enfocado no dibuja contorno.

> **2 controles de mutación, murieron 2.**

> El foco se prueba **tabulando**, no con `focus()`: `:focus-visible` distingue el teclado del mouse y un enfoque programático puede no activarlo.

---

## 2026-08-20 · `REF5-3` — los números de la ficha dejaron de ser texto corrido

**Autor:** Claude Opus 5 · **Estado:** completado · **Tareas:** `REF5-3`

Dos datos de la ficha del arquero venían apretados dentro de un mismo valor:

| Antes | Problema |
|---|---|
| `84.5% (279)` | Dos números distintos peleando el mismo renglón: el que ordena el ranking y el puntaje bruto |
| `1-1-0` | Tres números **sin nombre**. Había que adivinar que el orden era primero-segundo-tercero |

Ahora el porcentaje es el valor y el bruto va debajo en chico; los podios llevan cada uno su medalla, con el nombre del puesto para el lector de pantalla — la medalla sola es un emoji que no todos anuncian igual.

### Los estados vacíos no se tocaron, a propósito

El plan pedía «estados vacíos y de carga con la voz de §6.8». Al revisarlos ya estaban en la voz del proyecto —*«Todavía no participó de ningún torneo publicado»*— y §6.8 pide que **inviten a actuar**, con ejemplos de WAFL: *«Empezá por el 10»*.

La landing es de sólo lectura: **no hay acción que invitar**. Inventarle un llamado habría sido mover cosas para llenar un ítem del plan. Se dejaron como estaban.

### El DoD se midió a 320, no a 360

El sistema declara 360 px como ancho mínimo soportado. La verificación va a **320**: un iPhone SE con el zoom de texto activado entrega menos, y si entra a 320 entra en todo lo demás.

Se sumó la ficha del arquero a la comprobación, que es la pantalla con más números por fila.

> **2 controles de mutación, murieron 2**: quitarle el nombre del puesto a los podios, y que el detalle secundario deje de mostrarse.

---

## 2026-08-20 · `REF5-2` — la tarjeta estaba escrita 29 veces

**Autor:** Claude Opus 5 · **Estado:** completado · **Tareas:** `REF5-2`

`rounded-[var(--radius-lg)] border p-3 bg-[var(--surface)]` aparecía **29 veces en 18 archivos**, en las tres aplicaciones. Por eso la densidad y la jerarquía estaban desparejas: no divergieron por decisión, divergieron porque cada pantalla resolvió lo mismo por su cuenta.

Es la misma historia de `cn`, `StakeChip` y `Screen` antes de `REF2-1`.

### Un constructor de clases, no un componente

Las tarjetas reales son `div`, `li`, `section`, `article` y `form`. Un componente sólo servía para 7 de 29, y el resto habría quedado con la copia a mano: **dos formas de hacer lo mismo**, que es justo lo que esta tanda corrige.

Se escribió el componente primero y se lo tiró antes de commitear. Uno que nadie usa es peor que no tenerlo.

### Las variantes que no emiten nada salieron de un defecto de `cn`

`cn` es concatenación pura, **sin resolución de conflictos de Tailwind**. Una tarjeta que trae su propio `px-4 py-3` terminaría con ese Y con `p-3` en el mismo atributo, y quién gana lo decide el orden del CSS, no el del string.

Por eso existen `densidad: ninguna` y `nivel: transparente`: para **poder no emitir**, en vez de pelear una clase contra otra. No es una comodidad; es la única forma de que el default no rompa a quien lo sobreescribe.

### Los tokens de elevación no se hicieron, y está bien

El plan pedía «tokens de elevación por borde y fondo». Al escribirlos quedó claro que serían **alias de `--surface` y `--surface-2`**, que ya existen. Un alias de un token existente no es una escala: es una capa más para mantener.

La escala terminó siendo las variantes del constructor. Se corrigió el plan.

### La guarda contra la próxima copia

Que la primitiva exista no impide que alguien la vuelva a escribir a mano — es exactamente cómo se llegó a 29. Un test recorre el código de las tres aplicaciones y marca cualquier línea que repita el radio junto con el borde.

Dos excepciones, las dos reales: el **canvas de firma**, que comparte el radio y es un área de dibujo con borde punteado; y la **fila que se vuelve tarjeta** en el celular (`REF5-1`), que usa `max-sm:` y no puede salir del constructor, porque este emite clases planas y no variantes.

> **4 controles de mutación, murieron 4**: las dos densidades dando lo mismo, elevar con sombra, que la variante sin relleno igual emita `p-3`, y **reponer una tarjeta escrita a mano** — el que prueba que la guarda sirve.

### El mismo error de escritura, otra vez

Al escribir el test por heredoc, la secuencia de escape de salto de línea se convirtió en un salto real dentro de un string de JavaScript y el archivo dejó de parsear. Es el mismo mecanismo que el carácter de retroceso de la entrada del margen.

Escribir código con barras invertidas desde el shell no es seguro. Para eso está la herramienta de edición.

---

## 2026-08-20 · `REF5-1` — las tablas dejaron de scrollear de costado

**Autor:** Claude Opus 5 · **Estado:** completado · **Tareas:** `REF5-1`

Arranca [`ref-5`](post/ref-5/ACTION_PLAN.md), la pasada de diseño. Alcance acordado: **refresh dentro de las reglas** — la dirección visual de §1 no se toca, se moderniza el acabado.

### La regla la rompía un componente del propio sistema

`TablaScrollable` envolvía toda tabla en `overflow-x-auto`. §7 dice *«ancho mínimo 360 px, cero scroll horizontal, en ninguna pantalla»*, y el podio tiene **ocho columnas**.

La página no desbordaba —el scroll quedaba adentro del contenedor— pero para el que sostiene el celular era lo mismo: **para ver el puntaje había que arrastrar de costado**.

Ahora la misma tabla cambia de forma con CSS: tarjetas hasta `sm`, tabla desde ahí. **Un solo DOM**, porque renderizar tabla más lista duplicaría cada `data-testid` y cada nombre para un lector de pantalla.

Los roles explícitos (`table`, `row`, `cell`) **no son redundantes acá**, aunque el lint lo diga: con `display: block` el navegador le saca la semántica de tabla al árbol de accesibilidad. Se suprimió la regla con el motivo escrito.

### Escribí una aserción que pasaba con la tabla rota

La primera versión del E2E miraba `documentElement.scrollWidth`. **Pasó contra el código sin arreglar**, porque `overflow-x-auto` scrollea adentro del contenedor y el documento nunca desborda. Medía lo que no era.

La segunda busca **cualquier** elemento que scrollee de costado, y falló nombrando las cinco secciones del podio. Ahí sí servía.

> Salió bien de casualidad: corrí la aserción antes de implementar. Si la hubiera escrito después, se habría ido en verde sin probar nada.

### Un filtro que podía tapar el problema

La aserción marcaba también un `legend.sr-only` — 1 px y recortado, incapaz de producir scroll. Se lo excluyó por `clientWidth > 1`, y ese filtro **se verificó con una mutación**: revertir la tabla al comportamiento viejo tiene que volver a fallar. Falla.

La primera mutación fue parcial —dejó vivo el `max-sm:block` del `<table>`— y pasó. No probaba nada.

### La tarjeta correcta no era la tarjeta buena

Con seis renglones etiqueta-valor apilados, cada arquero ocupaba ~210 px: veinte por categoría son un scroll interminable. Las cifras chicas —`X`, `10`, `M`, `%`, `Puntos`— pasaron a fluir **en línea**. La tarjeta bajó a ~110 px con la misma información.

> Eso no lo encontró ningún test: lo encontró **mirar una captura a 360 px**. El E2E prueba que no desborda, no que se lea bien.

---

## 2026-08-20 · El margen que todos anulaban, y un test con un retroceso adentro

**Autor:** Claude Opus 5 · **Estado:** completado

El pie traía `mt-8` y **los dos únicos consumidores lo cancelaban con `mt-0`**. En una columna flex de alto fijo ese margen no es aire: es un hueco entre el contenido y el pie.

Un valor que todo el mundo anula no es un default, es una trampa — el que agregue un consumidor nuevo se come el hueco y no sabe de dónde salió. Se fue del componente, y con él los dos `mt-0` que ya no cancelaban nada.

### El test que lo fija pasaba vacío

La primera versión de la aserción usaba un límite de palabra —`\` seguido de `b`— al principio de la expresión. Ese par de caracteres quedó escrito como **un solo carácter de retroceso**, invisible al leer el archivo y al hacer `grep`: la expresión no matcheaba nunca y el test pasaba con el `mt-8` puesto.

**Lo destapó el control de mutación**, no la revisión: reponer `mt-8` daba verde. Se reescribió comparando clases enteras, sin expresión regular.

> Y pasó de nuevo al escribir esta entrada: el texto que describe el problema se guardó **con dos retrocesos adentro**. Se limpiaron. La herramienta que escribe archivos desde el shell interpreta esas secuencias, y no se ve al releer.

> Es la quinta vez en esta bitácora que una mutación corrige un test que yo ya había dado por bueno — y la primera en que el defecto era un carácter que no se ve.

---

## 2026-08-20 · El pie, en todas las pantallas y con los dos escudos

**Autor:** Claude Opus 5 · **Estado:** completado

Corrección de lo que `REF4-5` había hecho con el header, más un pedido nuevo.

- **Header:** sólo el logo de la liga. El del CBA que yo había puesto ahí se va — duplicaba la marca del club en la misma pantalla y comía el ancho que la navegación necesita en un celular.
- **Pie:** los dos escudos juntos a la izquierda, «Liga Bahiense» a la derecha.
- **Pie en todas las pantallas**, también en las seis que terminan en barra de acción.

### Esto cruza una decisión de `REF3-2`, y el motivo sigue siendo cierto

`REF3-2` había sacado el pie de esas pantallas por **alto útil**: un pie de 5 rem debajo de la barra se come el espacio del contenido, y la regla del proyecto es que **gana el teclado de scoring**.

No se dio de baja esa regla: se hizo que **ceda el pie**. Donde hay barra de acción va una versión compacta de una línea —escudos chicos y el nombre—, unos 34 px contra los ~80 de la completa.

Si en el campo esos 34 px molestan en el teclado, la vuelta atrás es una prop.

### El `alt` del escudo del club dejó de ser decorativo

Era vacío **a propósito**: el nombre del CBA iba escrito al lado y un `alt` con el nombre haría que un lector de pantalla lo dijera dos veces. Ahora el único texto visible es «Liga Bahiense», así que con el `alt` vacío **el club no existiría** para un lector de pantalla.

Es lo que queda de la regla que este archivo documenta —cada logo con su nombre— después de mover el club al lado de la liga. **El nombre del CBA ya no se ve escrito**, y eso es una pérdida real frente a lo que decía el diseño original.

> **4 controles de mutación, murieron 4**: el escudo del club con `alt` vacío, el compacto dejando de serlo, volver a esconder el pie con barra fija, y reponer el CBA en el header.

---

## 2026-08-20 · Un E2E que se muestreaba una vez, y una mutación que no probaba nada

**Autor:** Claude Opus 5 · **Estado:** completado

CI falló «el service worker se registra y responde» en el PR de `REF4-5`, que no toca nada de la PWA. Local pasaba.

### El test tomaba una sola muestra

```ts
await page.goto('/app/');
const reg = await navigator.serviceWorker.getRegistration();
```

`registerSW.js` llama a `register()` en el evento `load`, y `page.goto` resuelve **en** ese evento: la promesa de registro sigue pendiente. En un runner lento la muestra cae antes. Pasaba por suerte de timing desde que se escribió.

Acá **sí** corresponde arreglar el test y no el producto: que el registro sea asincrónico es correcto y nada visible depende de que sea instantáneo. Es lo contrario del caso de `ResultsPage`, donde el estado vacío producía **un número que se firmaba**. Se pasó a `expect.poll`.

### La mutación local no probaba nada

Al intentar matar el test con `injectRegister: false`, pasó igual. Dos motivos, los dos míos:

**`reuseExistingServer: !process.env.CI`.** Localmente Playwright reusa un servidor ya levantado y **no reconstruye**: la mutación nunca llegó al bundle servido. Cualquier control de mutación de E2E corrido a mano sin `CI=1` está midiendo el build anterior.

**Y desde `REF4-3` hay dos vías de registro.** `useRegisterSW` registra el service worker por su cuenta, así que apagar `registerSW.js` ya no lo impide. La mutación era inválida, no el test.

Se verificó apuntando el test a `/` —la landing no registra service worker, por diseño—: falla con su mensaje y agota los 15 s esperando, en vez de pasar de largo.

> La lección no es sobre este test. Es que **una mutación que no se ve fallar no prueba más que un test que no se ve fallar**, y acá pasaron las dos cosas juntas.

---

## 2026-08-18 · `REF4-5` — tres pantallas que no entraban en un celular. Cierra `ref-4`

**Autor:** Claude Opus 5 · **Estado:** completado · **Tareas:** `REF4-5`

Los ítems 3, 4 y 6 del pedido, y con esto cierra [`ref-4`](post/ref-4/ACTION_PLAN.md).

| Pantalla | Antes | Ahora |
|---|---|---|
| Pagos (WAFA) | nombre, categoría, patrulla, estado y botón **en una línea** | arriba quién es y cómo está; abajo la acción, a lo ancho |
| Torneos (landing) | nombre, categoría y estaca **en una línea** | arriba nombre y categoría; abajo la estaca |
| Header (landing) | un `flex-wrap` que a 320 px se partía en tres renglones | fila de identidad que no envuelve, más fila de navegación |

En las dos primeras el síntoma era el mismo: el nombre se truncaba a dos o tres letras para hacerle lugar al accionable. Y saber **a quién** le estás cobrando, o quién está en cada patrulla, es exactamente para lo que se miran esas pantallas.

### El header: los logos primero, la navegación después

El pedido decía «los logos en una sola línea, el CBA a la izquierda, al lado el de la liga, y del lado derecho Liga Bahiense». Meter además los dos enlaces y el conmutador de tema en esa misma fila entra en el papel y no en un celular real, así que quedaron **dos filas fijas**: identidad arriba, navegación abajo. La de arriba no envuelve nunca.

El escudo del CBA va sobre placa blanca literal, igual que en el pie: es un PNG de tinta oscura con fondo transparente y sobre el tema oscuro desaparece. Misma decisión de `REF3-2`.

### Dos controles de mutación destaparon tests vacuos, otra vez míos

Volver pagos a una sola fila, y la estaca a la línea del nombre, **pasaban en verde**. Los tests verificaban el agrupamiento del DOM —que no cambia— y no la dirección del flex, que es justo lo que el pedido llama «se rompe».

Se agregó la aserción que faltaba sobre el layout. Es la cuarta vez en la bitácora que un control de mutación corrige un test que yo ya había dado por bueno.

> **4 controles de mutación, murieron 4** — dos recién después de reforzar las aserciones: pagos en una sola fila, el botón sin ancho completo, la estaca en la línea del nombre, y el escudo del CBA sin texto alternativo.

### `ref-4` cerrado

Siete ítems, cinco tandas. **Dos no eran lo que el pedido decía**: «avisar cuando hay versión nueva» era la regla 7 implementada a medias —nadie podía actualizar— y «la sección de firma se puede mejorar» era un bug de coordenadas.

---

## 2026-08-18 · `REF4-4` — la puerta de entrada deja salir, y recomienda instalar

**Autor:** Claude Opus 5 · **Estado:** completado · **Tareas:** `REF4-4`

La pantalla de elección de rol suma una salida al sitio público y una recomendación de instalar la app.

La salida va **después** de los dos roles: quien abre `/app/` viene a entrar, no a mirar resultados. Pero sin ella la pantalla es un callejón para el que llegó por error — y desde `ref-3` el botón Atrás ya no saca de la app.

### Un botón que no hace nada es peor que no ofrecer nada

Chrome dispara `beforeinstallprompt` y da un diálogo nativo. **iOS no tiene ese evento ni ninguna API equivalente**: instalar es «Compartir → Agregar a inicio», a mano.

Ofrecer «Instalar ahora» en un iPhone daría un botón que se toca, no pasa nada, y el usuario concluye que la app está rota. Así que la decisión es explícita y pura: `instalada` gana sobre todo, después el prompt nativo, después las instrucciones de iOS, y si no, nada.

La ausencia de `beforeinstallprompt` **no distingue** un iPhone de un Firefox de escritorio, así que iOS se detecta por user agent. El iPad moderno se declara «Macintosh»: se lo separa por tener pantalla táctil.

### Acá sí es un modal, y en `REF4-3` no

Parece contradictorio y no lo es. Esto pasa en la puerta de entrada, con el usuario parado y sin nada que perder por interrumpir. El aviso de versión pasa **a mitad de un recorrido**, que es exactamente lo que la regla 7 protege.

### El lint tenía razón sobre el diálogo

La primera versión cerraba al tocar el fondo, con el manejador sobre un `div` sin rol interactivo. Biome lo marcó y la corrección no fue silenciarlo: **un fondo que se comporta como botón no se anuncia a un lector de pantalla y quien navega con teclado nunca llega**. Quedó el botón «Cerrar» como salida accesible y Escape a nivel documento como atajo.

> **5 controles de mutación, murieron 5**: ignorar que ya está instalada, ofrecer el botón nativo en iOS, ofrecer instalar sin evento —el botón muerto—, tirar la guarda de `matchMedia`, y que la pantalla deje de montar la salida a la landing.

> La guarda de `matchMedia` es la lección de `REF-4`, donde una API ausente dejó una pantalla entera en blanco. Acá lo peor que puede pasar es ofrecer instalar algo ya instalado; romper la puerta de entrada, no.

---

## 2026-08-18 · `REF4-3` — la regla 7 estaba a medias

**Autor:** Claude Opus 5 · **Estado:** completado · **Tareas:** `REF4-3`

`registerType: prompt` estaba bien puesto en `vite.config.ts` desde siempre. **Lo que faltaba era alguien que escuchara.**

`registerSW.js` se inyecta solo y registra el service worker. Al haber versión nueva, `sw.js` la descarga y queda en `waiting` esperando un mensaje `SKIP_WAITING` que **ningún código de la página mandaba**: no había un solo `useRegisterSW` ni `onNeedRefresh` en todo `packages/app/src`. En una PWA instalada, que casi no se cierra, el usuario se quedaba con su versión para siempre.

> Los dos E2E de PWA pasaban y decían la verdad: el SW se registra, y no se auto-actualiza. Ninguno verificaba que el usuario **pudiera** actualizar.

### Una barra, nunca un modal

Recargar a mitad de recorrido es lo que la regla 7 prohíbe, así que el aviso no puede tapar la pantalla ni robar el foco. «Ahora no» va primero y con el mismo peso visual: en medio de un torneo esa es casi siempre la respuesta correcta, y la que se toca sin mirar tiene que ser la que no interrumpe.

La barra queda en `z-10`, **por debajo** del pad de firma (`z-20`): ofrecerle una actualización a alguien que está firmando es el peor momento posible. A cambio puede tapar una barra de acción, y se acepta — aparece sólo con versión nueva y se va con un toque.

### El router no renderiza nada si el basename no coincide

El aviso estaba dentro de `BrowserRouter` y el test no lo encontraba. **`BrowserRouter` con un `basename` que no matchea la URL no renderiza absolutamente nada**, ni siquiera los hijos que no son rutas.

Se movió afuera. En producción la PWA siempre se sirve bajo `/app/` y habría funcionado igual, pero atar el aviso de actualización a que el routing esté bien configurado es acoplar dos cosas que no tienen nada que ver.

### El build encontró lo que los tests tapaban

`virtual:pwa-register/react` sólo existe dentro de Vite, así que en los tests se resuelve contra un doble aliaseado en `vitest.config.ts`. Ese doble es lo que permite probar que el aviso está **conectado** — no sólo escrito.

Pero también tapaba un problema real: `workbox-window` **no resolvía** desde `@bal/app` bajo pnpm estricto, y el build fallaba. Los 1184 tests pasaban igual. Se agregó como dependencia directa; cuesta 2,9 KB gz y la PWA queda en 123,76 de 150.

El E2E nuevo mira lo que el navegador **cargó de verdad**, no el código fuente: que un componente importe el módulo virtual no prueba que el chunk llegue al bundle. No llegaba.

> **4 controles de mutación, murieron 4**: que `App` no monte el aviso —el defecto original—, mostrarlo siempre, que «Ahora no» también actualice, y actualizar sin recargar.

### Deuda que quedó abierta

`scripts/presupuesto.mjs` mide el `dist/` que encuentra **sin saber si el build falló**. Con el build roto me dijo «todos los presupuestos en verde» sobre una salida vieja. En CI no engaña —son pasos separados y el job corta antes— pero a mano sí.

---

## 2026-08-18 · `REF4-2` — se firmaba en un lugar mirando otro

**Autor:** Claude Opus 5 · **Estado:** completado · **Tareas:** `REF4-2`

El pedido lo describía como «la sección de firma se puede mejorar». Es un bug.

### Un canvas tiene dos tamaños

El buffer es fijo —900×600, elegido en `REF-6` para que firmar con el dedo no salga tembloroso— y CSS lo muestra al ancho que entre. `clientX` y `getBoundingClientRect` hablan en píxeles **CSS**; `moveTo` y `lineTo` hablan en píxeles del **buffer**. El código restaba el offset y usaba el resultado sin convertir.

En un celular de 360 px el factor es 2,5: tocar el centro dibujaba al 20 % del ancho. **El trazo aparecía arriba y a la izquierda del dedo.**

### La dirección la corrigió el test, no yo

El plan decía «corrido hacia abajo y a la derecha». Es al revés, y me di cuenta recién al ver la aserción fallar: en el centro dibujaba en `180,120` donde correspondía `450,300`. Se corrigió el plan.

> Es la razón de escribir el test antes: la explicación que uno tiene en la cabeza puede estar dada vuelta y el código funcionar igual de mal.

### El stub fue el defecto

La primera versión de `puntoEnElCanvas` era **exactamente el comportamiento viejo**. Así las aserciones no fallaron por un import roto ni por un `undefined`, sino reproduciendo el bug con números concretos. Cinco de trece rojas, y las cinco decían qué píxel estaba mal.

### La guarda del recuadro sin tamaño

Un recuadro de ancho cero —jsdom, o el instante previo al primer layout— daría `NaN`. Y `moveTo(NaN, NaN)` no rompe sólo ese punto: **deja el trazo entero sin dibujar**, sin error visible. Devolver el origen es peor gráficamente y mucho mejor operativamente.

> **5 controles de mutación, murieron 5**: no escalar, invertir la razón, usar la escala de X también para Y, olvidar el offset, y sacar la guarda del recuadro sin tamaño.

---

## 2026-08-18 · `REF4-1` — etiquetas más cortas, y una copia que las contradecía

**Autor:** Claude Opus 5 · **Estado:** completado · **Tareas:** `REF4-1`

Arranca [`ref-4`](post/ref-4/ACTION_PLAN.md). Las etiquetas de categoría y modalidad se acortan según el diccionario del pedido: «Compuesto cazador» pasa a «Cazador», «Sala 18 m» a «18 m», «Juego de campo» a «Campo».

**Ninguna clave cambia.** `recurvo`, `compuesto`, `campo` viajan en la base, en las URLs y en los `data-testid`. Lo que cambia es sólo lo que lee un humano.

El ancho del celular es el recurso escaso de este proyecto, y dos de los tres «la UI se rompe» del pedido son consecuencia de estas etiquetas: «Compuesto cazador» al lado de un nombre y una estaca no entra en 360 px. Por eso esta tanda va primero — las que siguen gastan el ancho que ésta gana.

### La etiqueta estaba escrita dos veces

`TargetPage` tenía su propio `ETIQUETA_MODALIDAD`, copia de `SCORING[*].label`. Cambiar sólo el catálogo habría dejado a WAFL —la app del monte— diciendo «Juego de campo» mientras las otras dos decían «Campo». Ahora lee del catálogo.

### Dos tests se rompieron, y estuvo bien

Uno en el wizard de WAFA y otro en las donas de la landing, los dos afirmando sobre el literal («Recurvo olímpico», «Sala»). **Es la señal correcta**: se estaba usando la etiqueta como identidad.

Se corrigieron leyendo la etiqueta del catálogo, no pegándoles el texto nuevo. Lo que tienen que verificar es que **la categoría se muestre**, no con qué palabra — si no, el próximo cambio de etiqueta los vuelve a romper por nada.

> **3 controles de mutación, murieron 3**: reponer una etiqueta larga, vaciar una, y repetir una entre dos categorías.

> El test de largo máximo es 11 y no 9: `Tradicional` mide 11 y el pedido no lo acorta. El plan decía 9 y se corrigió el plan, no el test.

---

## 2026-08-18 · La imagen de producción no construía, y nadie lo sabía

**Autor:** Claude Opus 5 · **Estado:** completado · **Tareas:** `INF-3`

Preparando el repo para Railway apareció que **el Dockerfile no construye**. La etapa de dependencias copia los manifiestos uno por uno —a propósito, para reusar la capa— y `packages/ui/package.json` no estaba: `@bal/ui` nació en `REF2-1`, después de escribirse el Dockerfile.

`packages/ui` **es un importer del lockfile**, así que `pnpm install --frozen-lockfile` sin ese directorio falla. No es una suposición: está en `pnpm-lock.yaml`.

### Tercera vez, mismo olvido

Las listas de la raíz nombran paquete por paquete, y `@bal/ui` se cayó de tres:

| Dónde | Cómo se notó |
|---|---|
| `build`, `test`, `typecheck` | CI en rojo: `Failed to resolve import "@bal/ui"` |
| `dev` | No rompía: servía un `dist/` viejo y parecía que el código nuevo no se aplicaba |
| `Dockerfile` | **No se notó nunca**: la imagen jamás se había construido |

`scripts/verificar-workspace.mjs` ahora también mira el Dockerfile. Sigue sin llevar lista: descubre los paquetes leyendo el workspace.

### La causa real era que nadie la construía

El Dockerfile existía desde `INF-3` y estaba en `[~]` con la nota «no se pudo correr `docker build`: no hay Docker en la máquina de desarrollo». Esa nota era honesta y **la deuda se cobró sola**: un archivo que nadie ejecuta se pudre en silencio.

Se agregó el job `imagen` al CI. Construye, verifica el `uid` **corriendo el contenedor** y comprueba que sin configuración falle ruidosamente —humo mínimo que prueba que el entrypoint existe y que la validación de entorno corre antes de abrir el puerto—.

Eso cierra además un ítem de [`SECURITY.md`](SECURITY.md) §13 que estaba abierto por el mismo motivo: «el contenedor corre como no root». `USER node` declarado no prueba nada mientras nadie lo construya. El checklist pasa de 36 a **37 de 38**.

> **2 controles de mutación, murieron 2**: sacar el manifiesto de `@bal/api` y el de `@bal/landing` del Dockerfile.
>
> Un quinto job es costo real en cada PR. Se acepta porque el que falta cuesta un deploy caído la noche del torneo, que es cuando no hay nadie para arreglarlo.

### Lo que sigue sin verificarse

`INF-4` no se movió. El deploy necesita la cuenta de Railway y el cluster de Atlas, que son del dueño del proyecto, y el checklist de [`CONFIG.md`](CONFIG.md) §10 sigue sin correr. Lo que cambia es que ahora el repo **está en condiciones** de desplegarse; antes no lo estaba y no había forma de saberlo.

---

## 2026-08-17 · Una sola puerta de entrada, y la vuelta a la landing

**Autor:** Claude Opus 5 · **Estado:** completado

### El enlace que sólo estaba roto en desarrollo

El botón «Ver los resultados de la liga», al terminar el torneo, no llevaba a ningún lado. El enlace era `/` y **en producción eso es correcto**: un solo contenedor sirve la landing en `/` y la PWA en `/app/`.

Con `pnpm dev` son dos Vite en puertos distintos, así que un `/` desde la PWA se queda dentro de la PWA. La ruta relativa mentía sólo ahí.

`enlaceEntreApps` resuelve el destino según `import.meta.env.DEV`. **En producción sigue devolviendo la ruta relativa, y tiene que seguir siendo relativa**: una URL absoluta en el build ataría la imagen a un dominio, y el mismo contenedor se sirve desde donde lo pongan.

Vive en `@bal/shared` y no copiado en cada frontend: los puertos son un dato único del despliegue y las dos aplicaciones lo necesitan, cada una apuntando a la otra. Se descartó proxyear un Vite dentro del otro —que habría dejado el código con `/` a secas— porque rompe el HMR.

### Una sola puerta

«Anotar puntajes (líder de patrulla)» y «Administración» se reemplazan por **«Ingresar»**, que va a la raíz de la PWA. La elección de rol **ya existía ahí** desde siempre.

Dos botones en la landing obligaban a mantener el nombre de cada rol en dos lugares, y ya se habían separado del que usa la app: la landing decía «Anotar puntajes» donde la app dice «Soy líder de patrulla».

**El costo es un toque más para el líder el día del torneo**, y contradice lo que decía `Home.tsx` — *«el líder de patrulla entra por acá, con guantes y apurado»*. Se acepta porque entra una vez y después la PWA queda instalada, que abre directo en `/app/`. Si el toque de más molesta en el campo, la vuelta atrás es una línea.

`FUNCTIONAL.md` §5.1 pedía «accesos directos a WAFA y WAFL»: se actualizó, porque cambió la decisión y no la implementación.

### Se verifica donde importa

Los dos cambios cruzan de una aplicación a la otra, y son **dos builds distintos**. Un test de componente ve el `href` y no si del otro lado hay algo, así que el cruce se prueba en E2E, donde un solo origen sirve las dos igual que en producción.

Las aserciones comparan el `pathname` resuelto y no el atributo: en desarrollo el enlace es absoluto y en producción relativo, y lo que tiene que valer en los dos casos es a dónde apunta.

> **4 controles de mutación, murieron 4**: ignorar el flag de desarrollo, intercambiar los puertos, no limpiar la query del origen, y reponer un segundo acceso por rol en la landing.
>
> Dos de los ocho tests de `enlaceEntreApps` **pasaron contra el stub vacío**, porque esperaban `/` y el stub devolvía `/`. Es el mismo accidente que ya apareció en `REF-6` y en `REF2-6`; acá lo cubrió la mutación que ignora el flag.
## 2026-08-17 · Se podía firmar un puntaje de 0

**Autor:** Claude Opus 5 · **Estado:** completado

**Lo destapó un test que falló en CI y pasaba en la máquina**, en un PR que no tocaba nada de esto. La reacción fácil era relanzar el job y seguir.

### El defecto

En `ResultsPage`, los botones de firmar salen del **bundle**, que está en memoria desde que se entra. Los totales salen de **IndexedDB**, que se lee en un efecto. Entre el primer pintado y esa lectura, `scores` está vacío: todos los totales valen `0` **y los botones ya están vivos**.

Un toque en esa ventana abre el pad mostrando:

```
Pérez, Juan
0
Firmá para validar este puntaje
```

Y lo que se firma es lo que se está viendo. Es exactamente la línea que esa pantalla existe para sostener.

La ventana es de milisegundos en una máquina de escritorio. En un celular barato, al sol, con la app recién abierta, es la clase de ventana que se abre.

### El arreglo, y por qué no fue un `waitFor`

La lista no se pinta hasta que la primera lectura terminó. **Corregir el producto arregló el test de raíz**: si hay un botón «Firmar», los puntajes ya están leídos. Meterle una espera al test habría dejado el defecto intacto y la carrera escondida.

**No es un spinner de guardado**, que sería una violación de la regla: los puntajes están guardados desde la primera flecha. Es la espera de una lectura local para poder *mostrarlos*.

### `CircuitPage` tiene el mismo patrón y no tiene el problema

Ahí el estado vacío **subestima**: ningún blanco figura completo y `recorridoCompleto` queda en `false`. Falla hacia el lado seguro.

La diferencia no es el patrón sino qué produce el estado vacío. En el circuito produce «todavía no hiciste nada». En resultados produce **un número**, y ese número se firma.

> **2 controles de mutación, murieron 2**: sacar la guarda de la lista, y arrancar creyendo que ya se leyó.
>
> El patrón de esta bitácora otra vez, con una vuelta más: un test verde en la máquina no prueba nada sobre otra máquina. Y **un test que falla donde no tocaste puede estar señalando algo tuyo que no es**: acá señalaba un defecto de hace tiempo.
## 2026-08-17 · `dev` servía un `@bal/ui` viejo, y CI se colgaba en `apt`

**Autor:** Claude Opus 5 · **Estado:** completado

Dos fallas de infraestructura que aparecieron el mismo día, ninguna del producto.

### El botón que estaba y no se veía

Mergeado `#56`, el botón de copiar el PIN no aparecía. No era el merge: `pnpm dev` construía `@bal/shared` y **no** `@bal/ui`, así que los frontends resolvían un `dist/` de una build anterior, sin el ícono nuevo.

Es la segunda vez que el mismo olvido muerde. `@bal/ui` nació en `REF2-1` y las listas de la raíz siguieron nombrando sólo a `@bal/shared`; cuando CI falló con `Failed to resolve import "@bal/ui"` se arreglaron `build`, `test` y `typecheck`, y quedó `dev` sin tocar.

**El síntoma en `dev` es peor que en CI.** CI rompe y se ve. `dev` no rompe: sirve lo viejo, la pantalla se ve igual que antes, y lo que parece es que el código nuevo no se aplicó. Se pierde el rato buscando en el lugar equivocado — que es exactamente lo que pasó.

### La guarda no lleva una lista

`scripts/verificar-workspace.mjs` **descubre** los paquetes leyendo el workspace: los que se consumen desde `dist/` y alguien importa. Escribir la lista a mano habría sido repetir el error que se está corrigiendo. Un `@bal/loquesea` nuevo rompe el chequeo hasta entrar en los scripts.

Corre en el job de calidad, antes del lint.

### CI: 13 minutos de silencio en `apt`

El mismo día, el job de E2E se colgó 12 minutos en `Instalar Chromium`. No era la descarga del navegador: `--with-deps` dispara un `apt-get`, el mirror `azure.archive.ubuntu.com` dejó de responder y apt se quedó mudo en una sola línea hasta que se canceló a mano.

Se cachea `~/.cache/ms-playwright` y se le pone **`timeout-minutes: 6`** al paso. El timeout no evita el cuelgue —es infraestructura de terceros— pero lo convierte en un fallo de 6 minutos que se relanza, en vez de uno de 30 que hay que ir a cancelar.

**No se sacó `--with-deps`**, que es lo que eliminaría el `apt` del camino. Sería apostar a que la imagen `ubuntu-latest` trae las libs de Chromium, y de eso no hay evidencia acá: todas las corridas verdes las instalaron ellas mismas.

> **3 controles de mutación, murieron 3**: `build:libs` sin `@bal/ui`, `test` sin `build:libs`, y un paquete que depende de algo inexistente.
>
> El patrón que se repite en toda esta bitácora: **un archivo de configuración que existe no prueba que algo lo lea**. Acá fue un script que existe y no cubre todo lo que debería.

---

## 2026-08-17 · Dos donas al final de la ficha del torneo

**Autor:** Claude Opus 5 · **Estado:** completado

Reparto de modalidades y de categorías, después del recorrido.

### No hizo falta tocar el backend

Los dos repartos salen de datos que **ya venían en la respuesta**: los blancos con su modalidad, y los miembros de cada patrulla con su categoría. Y las dos funciones que los calculan existen desde `REF2-4`, con su barrido de 30 totales × 7 repartos: los porcentajes suman 100 sin que haya que volver a pensarlo.

La paleta también estaba, de `REF2-1`. La dona engancha la misma regla de `tokens.css` que los chips —`--chip` / `--chip-oscuro`— así que el color lo elige el CSS y no hay un frame con el color anterior al conmutar el tema.

> Tres tandas después, el pedido se resolvió casi enteramente con piezas que ya estaban. Es lo que compra haber puesto el reparto porcentual en el dominio en vez de en un componente.

### Dona y no torta

El agujero del medio deja lugar al total, que es el dato que contesta «¿de qué tamaño era este torneo?» sin sumar las porciones a ojo.

### La leyenda no es opcional

Cada porción figura **escrita**, con su nombre, su porcentaje y su conteo. Un color sin nombre no dice nada —ni a quien no distingue dos verdes, ni a quien no conoce el código de colores del proyecto— y el `aria-label` del SVG lleva el reparto entero para quien no lo ve.

SVG puro, sin dependencias: una librería de gráficos para dos donas de cuatro y siete porciones costaría más que toda la landing, que tiene 120 KB de presupuesto. Quedó en **99,37 KB**.

**Tests:** 7 de la dona, 3 de la ficha. 1138 en verde, 8 de 8 E2E. **Controles de mutación: 3, murieron 3.**

---

## 2026-08-17 · Cerrar sesión también desde el header

**Autor:** Claude Opus 5 · **Estado:** completado

En la entrada anterior dejé el cierre de sesión **al final del contenido** y argumenté por qué: es la única puerta de la app, y una que se toca de refilón al lado del indicador de sincronización es peor que ninguna. Pedido explícito de tenerlo también en el header, así que va — **sin perder lo que protegía ese razonamiento**.

### El ícono abre la confirmación, no cierra la sesión

Los dos toques siguen. El ícono del header es un **atajo al mismo panel**, no un disparo directo: el riesgo que me preocupaba era el toque accidental, y la confirmación es lo que lo cubre. Puesto así, el acceso rápido y la protección no se pisan.

### Una sola confirmación, no dos

El panel vive al final del contenido y se **abre desde arriba**. Duplicarlo para el header habría duplicado también el texto de cuántos cambios se pierden, y dos textos que dicen lo mismo terminan diciendo cosas distintas.

Como el bloque está abajo, abrirlo desde el header dejaría al usuario mirando una pantalla que no cambió: se lo trae a la vista con `scrollIntoView`. **Con `?.`**: jsdom no lo implementa y los navegadores viejos tampoco, y que falte una comodidad no puede romper la única salida de la app. Es la misma lección que `matchMedia` en `REF-4`, donde una API ausente dejó una pantalla entera en blanco — y esta vez el test la encontró antes que un usuario.

### Dos botones con el mismo nombre, y está bien

El del header y el del final hacen exactamente lo mismo. Llamarlos distinto para que el test los distinga sería mentirle al lector de pantalla sobre una diferencia que no existe; el test desambigua por orden en el DOM.

**Tests:** 4 del acceso desde el header. 1133 en verde, 8 de 8 E2E. **Controles de mutación: 3, murieron 3.**

---

## 2026-08-17 · Copiar el PIN de la patrulla

**Autor:** Claude Opus 5 · **Estado:** completado

Un botón al lado del código de acceso de cada patrulla.

**Seis dígitos se transcriben mal**, y un PIN mal transcripto es un líder que no entra con el torneo ya empezado — con la patrulla esperando en el primer blanco.

### Dice lo que pasó, incluso cuando falla

`navigator.clipboard` **no existe fuera de un contexto seguro**. Un botón que no hace nada y tampoco avisa deja al admin creyendo que copió, y el PIN se pasa mal igual: el problema aparece recién en el monte, lejos de su causa.

Cuando no puede, lo dice — «No se pudo copiar: anotalo a mano» — que es lo único que queda por hacer.

El acuse es **visible y con `role="status"`**, no sólo un cambio de ícono: un ícono que cambia no lo anuncia nadie, y «copiado» es justo lo que hay que confirmar. Vuelve solo a los dos segundos y medio, porque es un acuse y no un estado de la pantalla.

### Copia el PIN de ESA patrulla

Con seis patrullas en pantalla, un botón que copie el de otra le da al líder un código que no abre nada. El test lo verifica contra el PIN mostrado en esa misma tarjeta, no contra un valor fijo.

> Un test que fallaba de arranque: el temporizador del acuse dispara el cambio de estado, pero sin `act` React no repinta y el acuse seguía en el DOM. No era el componente.

**Tests:** 5 del botón, 2 de la pantalla. 1141 en verde, 8 de 8 E2E. **Controles de mutación: 3, murieron 3.**

---

## 2026-08-17 · Salir de la app sólo a propósito

**Autor:** Claude Opus 5 · **Estado:** completado

Un toque de más en Atrás sacaba al líder de WAFL —o al admin de WAFA— a la pantalla de elección, y volver significaba loguearse de nuevo: con guantes, al sol, y con el PIN en la planilla del bolsillo.

### Las dos apps se escapaban por motivos distintos

**WAFL navega con estado local, no con rutas.** La cabecera de `WaflApp` lo dice desde `FE-4`: *«el botón Atrás del navegador no debería poder sacar al líder del medio de una carga»*. Pero al no empujar entradas de historia, **un solo Atrás salía de la app** — el razonamiento era correcto y le faltaba la mitad.

**WAFA sí usa rutas**, así que Atrás navega bien adentro. Lo que había que bloquear es sólo la salida **desde la raíz**, no toda la navegación.

Se resuelve empujando una entrada centinela y reponiéndola en `popstate`. Sin `beforeunload`: ese aviso lo dispara también recargar, que es lo que uno hace cuando algo se ve raro, y un diálogo del navegador ahí asusta más de lo que evita.

### Y WAFL no tenía cierre de sesión

WAFA tenía un «Salir» de un toque en el header. WAFL **no tenía ninguno** hasta terminar el circuito: la única forma de salir era el Atrás que ahora se bloquea. Sin agregarlo, esto habría dejado al líder encerrado.

**En WAFL cerrar sesión borra el IndexedDB, outbox incluido.** Si hay trabajo sin sincronizar, eso es **perder puntajes cargados**. Se dice cuántos y con esas palabras: la app nunca descarta trabajo en silencio, y que el usuario lo haga a propósito es otra cosa — ahí lo que corresponde es que sepa exactamente qué está tirando.

Los dos botones piden **dos toques** y están **al final del contenido**, no en el header. Es la única puerta de la app: una que se toca de refilón al lado del indicador de sincronización es peor que ninguna.

### Un flake propio, encontrado en el camino

Dos tests del hook fallaban por acumulación de espías: `vi.spyOn` sobre un método ya espiado devuelve **el mismo espía, con su historial**. Un test que afirma «no se llamó» veía las llamadas del test anterior. Se restauran en el `afterEach`, junto con el estado del historial.

**Tests:** 10 de la salida. 1124 en verde, 8 de 8 E2E. **Controles de mutación: 4, murieron 4.**

---

## 2026-08-17 · Todos los blancos figuraban completos, con puntajes de otro torneo

**Autor:** Claude Opus 5 · **Estado:** corregido

Reportado con captura: «Mega Copa · 5 de 5 blancos», los cinco en **Completo**, sin haber cargado nada.

### El guard de `REF-1` estaba, y no alcanzaba

`REF-1` arregló este mismo síntoma con un guard de `total > 0`: con un bundle sin arqueros, `delBlanco.length >= total` era verdadero por vacuidad. Ese guard sigue en su lugar y funciona.

Lo que faltaba es otra cosa: **`readScores()` devuelve el almacén entero**, y el conteo filtraba **sólo por número de blanco**. Los números de blanco se repiten entre torneos, así que un líder que ya usó la app en otro torneo —y entró al siguiente sin cerrar sesión— arrastra esos puntajes y llenan la cuenta con arqueros que no son de su patrulla.

`total` es mayor que cero, así que el guard no dice nada. El recorrido aparece completo y **«Resultados finales» se habilita**: se puede llegar a firmar un torneo en el que nadie tiró.

### Dos correcciones, en dos capas

- **El conteo mira de quién es cada puntaje.** Es la que hace que la pantalla no mienta, pase lo que pase con lo que haya guardado.
- **Entrar a otro torneo limpia lo del anterior.** `descargarBundle` pisaba el bundle pero dejaba puntajes y firmas.

**Con trabajo sin sincronizar no se limpia nada.** Son puntajes que alguien cargó y que todavía no llegaron al servidor: borrarlos los pierde, y eso no se hace ni para arreglar una pantalla. En ese caso la primera corrección ya alcanza — el recorrido se muestra bien igual.

> El síntoma era idéntico al de `REF-1`, y la causa no. Fue tentador dar por hecho que el guard se había roto; estaba intacto. Lo que había cambiado era el supuesto de que el almacén tiene datos de un solo torneo.

**Tests:** 2 del conteo, 3 de la limpieza. 1118 en verde, 8 de 8 E2E. **Controles de mutación: 3, murieron 3.**

---

## 2026-08-16 · `REF3-3` — las patrullas en un celular. Cierra `ref-3`

**Autor:** Claude Opus 5 · **Estado:** completado

### Lo que estaba apretado no era lo que parecía

El pedido decía «la información se ve muy apretada» y «cada patrulla debe mostrar la unidad A y B». Lo segundo **ya estaba** desde `FE-13`: el encabezado `Unidad A · tira primero` está ahí desde entonces.

Lo apretado era la **ficha del arquero**: nombre y categoría a la izquierda, estaca y tres botones a la derecha, todo en una fila. En 360px de ancho el nombre se cortaba con `truncate` y los botones quedaban pegados contra el borde. Los tres botones los agregué yo en `REF2-5` —antes había uno solo— y ahí se terminó de romper.

### Cada renglón responde una pregunta

- **Quién es**: nombre completo. En una planilla impresa el apellido solo no alcanza para desempatar dos hermanos.
- **Con qué tira**: categoría y estaca **juntas**. Son las dos que deciden desde dónde tira y contra quién compite; separadas hay que emparejarlas con la vista.
- **Qué se puede hacer**: el lado y las acciones.

El lado de tiro sale del **orden dentro de la unidad**, no de un dato guardado — es lo mismo que hace el servidor al recibir la distribución. Así la pantalla no puede mostrar algo distinto de lo que se va a registrar.

**Tests:** 4 de la ficha. 1113 en verde, 8 de 8 E2E. **Controles de mutación: 3, murieron 3.**

Con esta tanda cierra `ref-3`.

---

## 2026-08-16 · `REF3-2` — el header y el pie que se iban con el scroll

**Autor:** Claude Opus 5 · **Estado:** completado

### El problema no era que las barras no fueran fijas

Lo primero que revisé fue eso, y ya eran `sticky`. Estaba una capa más arriba: **`min-h-dvh`** en la envoltura de cada pantalla.

Con un alto **mínimo**, la página crece con su contenido, el scroll se va al documento, y el header y el pie se van con él. Con `h-dvh` y `overflow-hidden` lo único que scrollea es el medio — y las barras de acción **dejan de necesitar `sticky`**: son hermanas en la columna y quedan abajo solas.

`dvh` y no `vh`, además: en un celular `vh` mide la ventana con la barra del navegador retraída, así que una pantalla de `100vh` queda más alta que lo que se ve y esconde justo la barra de abajo, que es donde está el botón de continuar.

### La misma envoltura estaba escrita doce veces

`<div className="flex flex-col min-h-dvh">`, literal, en las doce pantallas. Corregir el alto habría sido corregirlo doce veces y esperar no saltearse ninguna, así que primero se extrajo `Pantalla`. Es la misma razón por la que `REF-4` extrajo `Encabezado`: van dos veces que la lección aparece con la misma forma.

> Un tropiezo mío en el camino: la primera conversión emparejó los `</div>` con una expresión regular y cerró etiquetas de **otros** componentes en los archivos que tienen más de uno. El typecheck lo dijo enseguida. Lo rehice contando profundidad, que es lo que había que hacer desde el principio.

### El pie sigue afuera donde hay barra de acción, por otro motivo

La regla venía de `REF2-2` y era por **superposición**: un pie debajo de una barra fija empujaba el último elemento fuera de alcance. Con la columna nueva ya no se pisan.

Se mantiene igual, pero ahora por **alto útil**: en un celular chico, un pie de 5rem debajo de la barra se come el contenido. Una pantalla que termina en una acción no necesita además el crédito institucional — y el teclado de scoring gana siempre.

### El logo del CBA

Es el único asset del proyecto que **depende del fondo**: un PNG con fondo transparente y tinta oscura. El resto es SVG con `currentColor`, y el de la Liga trae su propia placa.

Va sobre una placa **blanca literal, no un token**: si siguiera al tema volvería a desaparecer en oscuro, que es exactamente lo que se está arreglando.

**Tests:** 4 de la cáscara, 2 de la placa. 1100 en verde, 8 de 8 E2E. **Controles de mutación: 3, murieron 3.**

---

## 2026-08-16 · `REF3-1` — el bug de las patrullas, que introduje yo

**Autor:** Claude Opus 5 · **Estado:** corregido

Reportado con el detalle exacto: una patrulla de 2, mover sus arqueros uno a cada una de las de 3, eliminar la que quedó vacía, guardar — y el error *«La patrulla 4 no tiene arqueros»* volviendo una y otra vez, sin forma de avanzar.

### Dos cambios míos que por separado estaban bien

`patrolAdminService.redistribute` decía en su cabecera, desde `BE-6`:

> *«No crea ni borra patrullas: las credenciales pueden estar repartidas en papel. Una patrulla que queda sin nadie queda vacía, y el validador lo informa.»*

Coherente. Hasta que en `REF2-5` agregué **dos cosas**:

- un botón de eliminar, que sólo sacaba la patrulla **de la pantalla**;
- y la regla de que una patrulla vacía **frena el guardado**.

Juntas dan un bloqueo cerrado: se guarda, el servidor deja la patrulla donde estaba, la pantalla recarga, la patrulla vuelve, y el guardado se traba. Repetir no cambia nada.

> Antes de `REF2-5` esto se guardaba mal en silencio —quedaba una patrulla fantasma— y **yo lo convertí en imposible de guardar**. El plan de `ref-2` anotaba que esta era la pantalla más delicada del proyecto. No alcanzó con anotarlo.

### Y un segundo defecto que nadie reportó

El cliente renumera al eliminar, y el servidor mapeaba **por número**. Eliminar una patrulla **del medio** escribía los arqueros de la vieja 3 en el documento de la 2 — con su `username` y su PIN, que pueden estar impresos y repartidos.

No se notó porque el caso reportado eliminaba la última, donde ningún número cambia. Ahora la patrulla se identifica por su **`id`**: el número es un dato editable, la identidad no.

### Un test viejo que dejó de significar lo que decía

«Rechaza un número de patrulla que no existe en el torneo» tenía sentido cuando el número **era** la identidad. Con el modelo nuevo pasa cualquier número, porque el servidor renumera a lo que se le pida.

Se reescribió como la guarda que ahora hace falta: **la numeración tiene que ser 1..N**, sin huecos ni repetidos. No es cosmético — el usuario del líder es `patrulla` más el número, así que un hueco deja un usuario que la botonera del login no ofrece.

### Y otro test vacuo, destapado por una mutación

«El usuario acompaña al número nuevo» eliminaba la **última** patrulla. Con {1,2,3,4} menos la 4 queda {1,2,3}: **ningún número cambia**, el renumerado nunca corre, y el test pasaba sin ejercitar nada. Una mutación que borraba la actualización del `username` no lo rompía.

Ahora elimina la primera y verifica, antes que nada, que algún número haya cambiado de verdad.

> Cuarta tanda seguida en que un control de mutación corrige un test que yo había dado por bueno.

**Tests:** 6 del caso reportado, 2 del cliente, 1 de numeración. 1103 en verde. **Controles de mutación: 3, murieron 3.**

---

## 2026-08-13 · `REF2-7` — landing y WAFL. Cierra `ref-2`

**Autor:** Claude Opus 5 · **Estado:** completado

Última tanda del segundo refactor.

### El gráfico mide porcentaje, no puntaje

El brief pedía «evolución del campo *Mejor* vs cantidad de torneos». Graficar el puntaje bruto habría estado mal: **cada torneo tiene un máximo distinto**, así que una fecha de 14 blancos y una de 8 no se comparan. Una línea que sube podría ser sólo un recorrido más largo.

Va con `normalizedPct`, que es la misma razón por la que el ranking lo usa. Y la escala es **fija de 0 a 100**: adaptarla al máximo de la serie haría que una temporada de 40% y 45% se viera igual de buena que una de 90% y 95%.

Con un solo torneo no dibuja nada. Una línea de un punto es un punto, y el número ya está en la ficha.

### La explicación del ranking va abierta

Estaba detrás de un `<details>` que **no dependía del modo**: con «Mejor de 2» elegido, lo único que se ofrecía explicar era el reparto de puntos del podio, que en ese modo no ordena nada. La columna que se estaba mirando quedaba sin explicar, y la que se explicaba no estaba en pantalla.

Ahora sigue al modo, va abierta —la primera vez que alguien ve esa pantalla necesita saber qué significan los números, no descubrir que hay una explicación escondida— y la de «Mejor de 2» lleva un ejemplo con números: el promedio de dos porcentajes se entiende en un renglón y se explica mal en un párrafo.

### Dos cosas viejas que aparecieron

**El mock de la landing servía `mode=score`**, un modo que `REF-2` eliminó, y no tenía `best_two`. Nadie lo notó porque el test que conmuta de modo sólo verificaba que **cambiara la URL**, no lo que volvía. Al escribir un test que sí mira el contenido, saltó.

**`CircuitPage` tenía una cuarta copia** de las etiquetas de modalidad escritas a mano, después de las tres de estados que unificó `REF2-1`. Dada de baja: los nombres salen de `SCORING`.

### Y otra mutación sobre un test mío

«La escala no se adapta a la serie» comparaba las polilíneas de dos series distintas y afirmaba que fueran distintas — y **con escala adaptativa también lo son**, porque los ratios internos difieren. Pasaba con la mutación puesta. Ahora se mide contra una posición absoluta: un 50% cae exactamente en el medio.

> Tercera tanda seguida en que un control de mutación corrige un test que yo había dado por bueno. Las tres veces el test miraba algo que cambiaba por otro motivo.

**Tests:** 5 del gráfico, 2 de la landing. 1094 en verde, 8 de 8 E2E. **Controles de mutación: 4, murieron 4** —uno recién después de arreglar el test—.

---

## 2026-08-13 · `REF2-6` — la presentación de WAFA

**Autor:** Claude Opus 5 · **Estado:** completado

Recaudación de la temporada, compartir el ranking, porcentajes en la revisión y el aviso plegable. Y la deuda de `REF2-5`.

### El selector de arqueros salió del asistente

Era el trabajo que faltaba para editar participantes: **200 líneas atrapadas dentro de un archivo de 675**. Ahora lo usan la creación y la edición, y la pantalla de edición avisa antes: cambiar quiénes participan **rearma las patrullas y les cambia el PIN**, así que si ya imprimiste las planillas hay que reimprimirlas.

Va en su propio panel, aparte del formulario de nombre y fecha, justo por eso: meterlo en el mismo «Guardar cambios» haría que corregir una tilde reimprima las planillas.

### Una mutación destapó un test débil, y era mío

El test «comparte el modo elegido» verificaba que el texto tuviera «pts» en un caso y «%» en el otro. **Pasaba con la pantalla mandando siempre los puntos de liga**: la unidad la pone el texto compartido según el modo, así que cambiaba igual aunque el número estuviera mal.

Ahora se afirma el valor —`12 pts` contra `81.2 %`— y la mutación muere.

> Es la segunda vez en dos tandas que la mutación dice algo que la corrida en verde no. La otra fue código de más; esta, una aserción que miraba al costado.

### El texto del ranking no se lee del DOM

`textoDeRanking` vive en `@bal/shared`. Lo que se comparte tiene que ser exactamente lo publicado, y armarlo en el componente lo dejaría sin test y atado a cómo esté maquetada la tabla ese día. Sin markdown ni tablas: se pega en WhatsApp, donde una tabla se desarma.

### La recaudación se pide al abrirla

Con cinco temporadas, cargarla con la lista serían cinco consultas para un número que casi nunca se mira: a esta pantalla se entra a cerrar una temporada, no a revisar la caja.

**Tests:** 8 del texto compartido, 2 de la pantalla. 1088 en verde, 8 de 8 E2E. **Controles de mutación: 5, murieron 5** —uno recién después de arreglar el test que dejaba pasar—.

---

## 2026-08-13 · `REF2-5` — el flujo de WAFA

**Autor:** Claude Opus 5 · **Estado:** entregada, menos un ítem

Subir y bajar dentro de la patrulla, eliminar la vacía con renumerado, confirmación al iniciar, la vuelta atrás, y los pagos con color.

### Una patrulla vacía se guardaba, y desaparecía en silencio

`cuerpoDeDistribucion` la filtraba antes de mandar. El torneo terminaba con una patrulla menos y una **numeración con huecos** que nadie había pedido — y eso importa porque el usuario del líder es `patrulla${número}`: un hueco deja un `patrulla3` que no existe.

Había un test que afirmaba esa conducta: **«NO frena una patrulla sin nadie»**, con este razonamiento escrito al lado: *«es un estado intermedio mientras se reacomoda, y no se manda al servidor»*. La primera mitad sigue siendo cierta —por eso el editor deja vaciarla—; la segunda era el problema. Se reescribió el test explicando qué cambió y por qué, en vez de borrarlo.

### Una mutación sobreviviente destapó código duplicado

`moverEnPatrulla` tenía un `if (j < 0 || j >= length)` **y** el `if (!a || !b)` que `noUncheckedIndexedAccess` obliga a escribir igual. Borrar el primero no rompía ningún test — y tenía razón: los dos hacen el mismo trabajo.

No era un test faltante: era una segunda condición que podía quedar desincronizada sin que nadie lo notara. Se sacó, y la mutación sobre el que queda sí mata.

> Es la primera vez en el proyecto que un mutante sobreviviente señala código de más en lugar de un test de menos. Vale anotarlo: la pregunta correcta ante un sobreviviente no es siempre «¿qué test falta?».

### El orden dentro de la patrulla no es cosmético

`unidadesDe` reparte por posición: los dos primeros son la unidad `A`, y **la `A` tira primero**. Subir a un arquero lo puede pasar de la segunda tanda a la primera. Los botones se deshabilitan en los extremos, no se ignoran.

### Lo que no entró

**La edición de arqueros con el torneo sin iniciar.** El backend está desde `REF2-3`; falta la pantalla. El selector de participantes que hace falta **ya existe dentro del asistente de creación** —675 líneas—, y extraerlo es el trabajo real. `REF2-6` ya entra en ese archivo para los porcentajes del paso «Revisión»: hacerlo acá sería tocarlo dos veces.

De paso entraron los glifos que `REF2-4` había dejado pendientes: `BotonIcono` pasa de recibir un `glifo: string` a recibir el componente.

**Tests:** 12 de patrullas, 5 de iniciar y volver atrás. 1077 en verde, 8 de 8 E2E. **Controles de mutación: 7, murieron 7.**

---

## 2026-08-13 · `REF2-4` — la identidad aplicada

**Autor:** Claude Opus 5 · **Estado:** completado

Badges de estado, chips de categoría y modalidad, y el renglón que dice de qué está hecho el recorrido.

### Lo único con lógica real era el reparto de porcentajes

Y no es formateo. Con catorce blancos, seis en 3D son el **42,857…%**: redondear cada parte por su cuenta da 99% o 101%. Un renglón que dice «50% campo · 21% 3D · 29% sala» y no suma cien hace dudar del resto de la pantalla.

Se usa el **método del resto mayor** —el mismo con el que se reparten bancas, y por la misma razón—. El test que importa no es ninguno de los ejemplos sino el barrido sobre 30 totales × 7 repartos: los ejemplos documentan, la propiedad protege. Los ejemplos, de hecho, casi no sirven acá: el recorrido de referencia da 100 **de casualidad** incluso con el redondeo ingenuo. El que rompe es el de tres partes iguales.

### La distribución la calcula el servidor

El listado no manda los blancos. Mandarlos para que el cliente los cuente sería enviar catorce objetos por torneo para mostrar cuatro números.

### Un pendiente que dejo dicho

**Los glifos de texto no pasaron a íconos.** Los íconos existen desde `REF2-1`, pero `BotonIcono` recibe un `glifo: string`: cambiarlos toca la firma del componente y las cuatro pantallas que lo usan. `REF2-5` ya rehace esos mismos botones para agregar subir y bajar, así que entra ahí. Hacerlo dos veces sobre el mismo componente es fabricar un conflicto.

### Y una tercera copia de las etiquetas de estado

`REF2-1` unificó dos —la ficha del torneo y la landing— y apareció una tercera: los títulos de grupo de la home de WAFA, con palabras distintas otra vez. Ahora los cuatro salen de `ESTADO_DE_TORNEO`.

**Tests:** 11 de reparto porcentual, 2 de la tarjeta, 2 del chip con porcentaje. 1040 en verde, 8 de 8 E2E. **Controles de mutación: 4, murieron 4.**

---

## 2026-08-13 · `REF2-3` — edición, vuelta atrás, y un agujero que abrí yo

**Autor:** Claude Opus 5 · **Estado:** completado

Backend de `ref-2`: editar los participantes de un torneo sin iniciar, volver un torneo en curso a `sin_iniciar`, la recaudación de la temporada y la serie del arquero para el gráfico de evolución.

### El `/security-review` encontró algo real, y era mío

`syncService.sync` **nunca miró el estado del torneo**. La autorización de `/wafl/sync` sale de la sesión de patrulla y nada más.

Eso no era un problema mientras el torneo sólo iba para adelante: `sin_iniciar` nunca convivía con sesiones vivas. **La transición nueva crea esa combinación.** Un líder que entró con el torneo en curso, después de que el admin volviera atrás, seguía pudiendo anotar. El test lo confirmó antes de arreglarlo: la op volvió `applied`.

Y el daño no terminaba ahí. Con un puntaje adentro, el rearmado de participantes borraba patrullas y participantes **pero no los puntajes**: quedaban documentos apuntando a gente que ya no existe, que hacen que `blancosBloqueados` marque blancos de arqueros eliminados y que el torneo no pueda volver atrás nunca más.

Dos correcciones:

- `/wafl/sync` verifica el estado. Rechaza **op por op con 200**, no con un 4xx: un 4xx dejaría al outbox reintentando algo que nunca va a entrar — que es exactamente el bug que arreglamos esta misma mañana.
- El borrado de patrullas, participantes y puntajes es **una sola función del repositorio**. Los tres se borran juntos o no se borran.

> De paso: había puesto tres `deleteMany` sueltos en un servicio. La regla 3 dice que ninguna consulta a Mongo vive fuera de `repositories/`, y la había roto yo sin notarlo. Es el tipo de cosa que el review encuentra y una corrida en verde no.

### Cambiar participantes rearma las patrullas

No es comodidad: las patrullas **se derivan** de la lista de arqueros y de `H1`-`H4`. Agregar a alguien sin rehacerlas daría una patrulla de cinco o una 100% escuela, que es justo lo que el algoritmo evita. Los PIN cambian, porque las patrullas son nuevas.

Con el torneo en marcha se rechaza: las patrullas ya están en el monte con su planilla impresa.

### Dos tests que pasaban por la razón equivocada

«Rechaza inscribir a un arquero archivado» y «no deja cambiar los participantes de un torneo en proceso» **pasaban antes de escribir una línea de implementación**: Zod rechazaba `archerIds` por ser un campo desconocido en un `strictObject`, y el 400 coincidía con lo que yo esperaba. Recién cuando el campo se aceptó pasaron a probar lo suyo, y las mutaciones lo confirmaron.

También corregí tres códigos de estado que había adivinado: un conflicto con el estado actual es **409**, como sus vecinos `TARGET_LOCKED` e `INVALID_STATE_TRANSITION`, no 400.

### La serie del gráfico no necesitó migración

`StandingDoc` guarda los dos mejores porcentajes y el mejor suelto, **no la secuencia**. Pero `ParticipantDoc` tiene el `normalizedPct` de cada participación y ya existía el índice `ix_archer`: la serie se deriva, sin campo nuevo y sin recalcular lo publicado. Filtrada a torneos **publicados**, que es un endpoint público.

**Tests:** 17 de edición y vuelta atrás. 1041 en verde. **Controles de mutación: 8, murieron 8** — tres de ellos sobre las correcciones del review.

---

## 2026-08-13 · `REF2-2` — la marca, y un ícono que no existía

**Autor:** Claude Opus 5 · **Estado:** completado

### La PWA se anunciaba instalable con un ícono que daba 404

`vite.config.ts` declara `/app/icon.svg` en el manifest. **Ese archivo no estaba en el repo ni en el build.** En Android eso es un ícono en blanco, o una instalación que directamente no arranca.

El test `pwa-instalable` no lo veía porque comprobaba los **campos declarados** del manifest —que hubiera un ícono, que fuera maskable, que midiera al menos 192— y nunca pidió la URL.

**Y mi primera corrección tampoco servía.** Agregué la comprobación, pasó en verde, y al borrar el archivo para controlarla **siguió pasando**. El servidor devuelve `index.html` para cualquier ruta que no reconoce —es lo que hace andar el ruteo del cliente—, así que un ícono inexistente responde **200 con una página HTML** y mis dos aserciones —estado 200, cuerpo no vacío— se cumplían las dos.

Ahora se verifica el `content-type` y que el cuerpo empiece con `<svg`. Con eso la mutación muere.

> Escribí un test para un bug que acababa de encontrar, lo vi en verde, y estaba mal. Lo destapó la mutación. Un test nuevo tampoco prueba nada hasta que se lo ve fallar.

### El logo nuevo saca una excepción a la regla 8

El anterior usaba los tres colores de estaca —roja, azul, amarilla— como identidad. `REF-4` lo decidió con su lógica: los colores salen del dominio. Pero era **el único lugar de toda la interfaz** donde un color de estaca significaba otra cosa, y con `REF2-1` agregando once colores nuevos, dejar esa excepción justo en la marca era pedir confusión.

El nuevo es el arte de `bv-easy-archery-battle` con el verde de acento, sobre placa oscura para no depender del fondo. Colores fijos en los dos temas: una marca que cambia de color no es una marca.

### Los originales no van en la carpeta que se publica

`wallpaper.png` —2,8 MB— estaba en `packages/shared/assets/`, que **se empaqueta y se publica** con la biblioteca. Se movió a `origen/`, y el script genera las salidas:

| Origen | Salida | Antes | Después |
|---|---|---:|---:|
| `wallpaper.png` | `portada.webp` 1120px | 2732,4 KB | **130,8 KB** |
| logo del CBA | `cba.webp` 192px | 183,5 KB | **18,3 KB** |

El script **no elige el tamaño solo**: cada archivo tiene su presupuesto y sale con código 1 si no entra. Rechazó dos configuraciones antes de la que quedó — el CBA a 256px en PNG daba 55,7 KB contra un máximo de 30.

No se agregó ninguna dependencia: Playwright ya está para los E2E y trae un Chromium que hace exactamente lo que haría `sharp`.

### El pie va donde no hay barra fija

Y no es una lista de excepciones: una pantalla que termina en una barra de acción no tiene lugar para un pie, y meterlo empujaría el último elemento debajo de la barra —el mismo problema que el E2E encontró en Resultados con el último arquero—. En la práctica eso deja el pie fuera del recorrido y del teclado de scoring, que es justo donde no se lo quiere.

**Tests:** 6 de marca. 1025 en verde, 8 de 8 E2E. **Controles de mutación: 3, murieron 3** — el del ícono recién en la segunda vuelta.

---

## 2026-08-13 · `REF2-1` — el paquete de interfaz y la paleta

**Autor:** Claude Opus 5 · **Estado:** completado

Primera tanda del segundo refactor. No se ve nada todavía: es la base que consumen las seis que siguen. Tres decisiones que no estaban en el plan.

### La documentación decía que no hiciéramos esto

`DESIGN_SYSTEM.md` §2.3 era explícito: la modalidad se distingue **«de forma, no de color»**, porque *«el color está saturado de significado con las estacas; agregar cuatro colores más lo arruinaría»*. El brief de `ref-2` pide color por modalidad **y** por categoría.

La advertencia era correcta y sigue en pie. Lo que se agregó son tres candados en lugar de una prohibición: el color nunca va solo, categoría y modalidad se separan **por forma** —píldora y rectángulo—, y los tonos son sordos donde los de estaca son saturados.

El candado de la forma no es un adorno: excluyendo rojo, azul y amarillo quedan **seis familias de tono para once valores**. Sin esa distinción, el reparto no cierra. La sección se reescribió contando que se revierte y por qué, en vez de borrarla.

### El test rechazó tres de los once colores que elegí

Y no por poco. El oliva de `razo` estaba **a 22° del amarillo de estaca con saturación 1,0**. Un oliva es un amarillo oscuro; un marrón es un rojo oscuro. El marrón de `tradicional` y el óxido de `3d` cayeron por lo mismo.

Ninguno se veía mal. Se veían **como estacas**, que es exactamente lo que la regla 8 prohíbe y lo que mirando la paleta en el editor no se nota.

> La regla decía «no uses rojo, azul ni amarillo». Yo la leí como «no uses `#d22b2b`». Un test que compara tono y saturación la lee como está escrita.

### De los cinco componentes «duplicados», sólo tres lo estaban

`cn` y `BotonTema` eran idénticos carácter por carácter. `StakeChip` difería **sólo en el tamaño** —`h-6` en las tablas de la landing, `h-7` donde hay que tocarlo en la PWA—: una diferencia real que nadie había decidido, y que quedó como prop.

**`Screen` y `Encabezado` comparten el nombre y no son el mismo componente.** El de la PWA es una barra fija con vuelta atrás y ranura para el `SyncBadge`; el de la landing, una navegación pública con enlaces. Unificarlos daría un componente con dos modos, que es peor que dos componentes con un nombre repetido. Se dejaron donde están, y el plan se corrigió.

### El brief pedía íconos que no existen

*«Reutilizá también las que se usan en botones y otros componentes»* de `bv-easy-archery-battle`. Ese repo tiene exactamente tres fuentes de iconografía: el logo, cuatro íconos de modalidad y seis de categoría. **De botones, ninguno.** Los once de acción se dibujaron acá con el mismo trazo, y reemplazan a los glifos de texto que había repartidos —`↑ ↓ ✕ ⇄ ☀ ☾ 🔒 ✎ ↺ 🗄 🗑`—, que dependen de la fuente del sistema y se ven distinto en cada Android.

### Y una línea que existe pero podría no leerse

Tailwind ignora `node_modules`, y `@bal/ui` vive ahí por el enlace del workspace. Sin un `@source` explícito, el paquete **compila, se importa y se renderiza sin una sola clase aplicada**. Se agregó, y se controló quitándolo y reconstruyendo: la utilidad de los chips desaparece del CSS.

> Es el mismo control que la bitácora viene pidiendo desde `FE-17`: un archivo de configuración que existe no prueba que algo lo lea.

### Y el CI encontró lo que mi verde local escondía

El PR falló con `Failed to resolve import "@bal/ui"`. Local pasaba; en CI no existía `packages/ui/dist`, porque **nada lo construye antes de los tests**.

Al reproducirlo borrando los `dist` apareció que el problema era más viejo y más grande: sin compilar, **también fallan los siete archivos de test de la API**. `pnpm test` venía dependiendo de que alguien hubiera corrido un build antes, y nadie lo había notado porque en una máquina de trabajo el `dist` siempre está de alguna corrida anterior. En CI, que arranca limpio, el `typecheck` lo tapaba: construía `@bal/shared` de paso y dejaba el `dist` justo a tiempo para los tests. Bastó agregar un segundo paquete para que se cayera.

Ahora `test` y `typecheck` construyen las bibliotecas primero, con un `build:libs` compartido. Verificado borrando los dos `dist` y corriendo cada uno en frío.

> Mi verde local no probaba que el comando funcionara: probaba que yo había corrido otro comando antes. Es la misma trampa que el test que pasa porque espera algo que ya está en pantalla.

**Tests:** 37 de paleta y catálogos, 27 del paquete nuevo. 1019 en verde. **Controles de mutación: 8, murieron 8.** Presupuestos: PWA 116,06 KB gz de 150, landing 97,32 KB de 120.

---

## 2026-08-13 · Tres defectos encontrados usando la WAFL

**Autor:** Claude Opus 5 · **Estado:** corregido

Al probar la app en local, cuatro ops de firma trabadas: **32 a 38 intentos cada una**, todas con «Los datos enviados no son válidos.». El circuito no se podía cerrar. Tirando de ese hilo aparecieron **tres** defectos distintos, encadenados.

### 1 · La firma dejó de entrar en el límite

En `REF-6` agrandé el canvas de firma de 600x240 a 900x600 —firmar con el dedo en un recuadro chico sale tembloroso—. El PNG que sale de ahí pasó a no entrar en `MAX_SIGNATURE_BYTES`. Medido en Chromium, no estimado:

| Canvas | Una raya | Firma de varios trazos |
|---|---:|---:|
| 600x240 (antes) | 20,5 KB | 44,7 KB |
| **900x600 (REF-6)** | 50,2 KB | **104,9 KB** |

El límite son 60 KB. **El E2E dibujaba una raya**, y una raya a 900x600 pesa 50 KB: pasaba por 10 KB de margen mientras la firma de una persona se pasaba por 45.

> Es la cuarta vez en el proyecto que un test pasa por cómo está escrito y no por lo que dice probar. Las tres anteriores eran carreras de tiempo; esta es distinta y peor: la aserción era correcta, **el dato de entrada no se parecía al real**. Un test con datos de juguete mide el juguete.

Se separó el canvas de **dibujo** del PNG que **viaja**: se dibuja grande y se exporta en la escala más grande que entre en el límite, midiendo el resultado en vez de estimarlo —cuánto pesa un PNG depende de cuántos trazos hizo el arquero, y eso no se sabe de antemano—. El E2E ahora firma con rulos y **verifica que la firma cruda supere el límite**: si algún día vuelve a ser una raya, el test avisa que dejó de probar algo.

### 2 · Un 400 se reintentaba para siempre

El más grave, y el que convirtió un PNG pesado en **un estado del que no se sale**. El `catch` del vaciado del outbox trataba cualquier rechazo como error de red: marcaba intentos y programaba reintento. Un 400 de validación no va a pasar por reintentarlo, así que la op tapaba el outbox, y con el outbox tapado no se puede cerrar el circuito. Para siempre.

Lo llamativo: **`OFFLINE_SYNC.md` §5.4 ya decía qué había que hacer** —«400 / 409: no se reintenta, se marca `conflict`»— desde `FE-2`. El código nunca lo cumplió y ningún test lo notó, porque todos los casos de error probados eran de red o de 401.

Se agregó lo que faltaba: distinguir qué vale la pena reintentar. Ante la duda **se reintenta** —sin `status` no se sabe qué pasó, y nunca se pierde trabajo por una suposición—; 401 y 403 se reintentan porque se arreglan volviendo a entrar. Sólo un 4xx que el servidor ya rechazó deja de intentarse.

Un detalle que no estaba documentado y ahora sí: **el 400 llega a nivel de lote**. Zod valida el array entero, así que una firma rota arrastra a los puntajes buenos que iban en el mismo `POST`. Se reenvía op por op para aislar la culpable.

**La op culpable sale del outbox, el dato no.** Queda en IndexedDB marcado `conflict` con el motivo. No contradice la regla de no descartar ops ante un 401: ahí la op se conserva porque **va a poder enviarse**; acá nunca va a poder, y dejarla es garantizar que el líder no termine el torneo. De paso se cerró un hueco vecino: una op de **firma** rechazada por el servidor no marcaba nada —sólo se manejaba el caso del puntaje—, así que se rechazaba en silencio.

### 3 · Una firma rechazada figuraba como firmada

Apareció al verificar una afirmación que estaba por escribir acá: que después de marcar una firma en conflicto el líder podría volver a firmarla. No podía.

`ResultsPage` armaba el conjunto de firmados con **toda** firma guardada en IndexedDB, sin mirar el `syncState`. Una firma rechazada por el servidor hacía desaparecer el botón «Firmar» igual que una aceptada: el líder cerraba el circuito convencido de que estaba todo firmado, y en el servidor no había ninguna firma. El acta quedaba sin validar y nadie se enteraba.

Ahora una firma en `conflict` no cuenta: vuelve a aparecer el botón, y «Finalizar torneo» sigue bloqueado hasta que se firme de nuevo.

> Los tres defectos son el mismo error mirado desde tres lados: **dar por buena una condición sin comprobar que se cumple**. La firma pesa poco porque el test dibuja poco; el rechazo se reintenta porque todo error se supone de red; la firma está hecha porque hay un registro guardado.

**Tests:** 4 de sincronización, 6 de la exportación de la firma, 1 de firmas en conflicto. 947 en verde, 8 de 8 E2E. **Controles de mutación: 8, murieron 8** —incluido uno sobre el E2E, devolviendo el bug tal cual llegó al usuario para verlo fallar—.

### Dos tests intermitentes, encontrados de paso

Corriendo la suite completa diez veces —no una— aparecieron dos fallos que sueltos nunca fallan. Los dos son el mismo error de siempre, esperar algo que ya es cierto antes de tiempo:

- **«firmado, el teclado queda deshabilitado»** esperaba el título del blanco, presente desde la primera pintada, y afirmaba sobre el teclado, que depende de la lectura de firmas. **Ya estaba arreglado en la entrada de abajo**; esta rama salía de antes de ese merge, así que el flake reapareció acá y lo arreglé por segunda vez. Al mergear quedó una sola versión.
- **«Continuar se habilita cuando todos tienen puntaje»** esperaba a que IndexedDB tuviera las flechas del primer arquero y clickeaba las del segundo. La escritura y el paso de selección en React son dos momentos distintos: en el medio, las flechas del segundo le llegaban al primero y se perdían. Ahora espera el `aria-pressed`, que es la pantalla diciendo a quién le está cargando.

Un tercero era **mío, de esta misma tanda**: esperaba «Faltan las firmas de Pérez», que también es verdad en el estado inicial —antes de leer nada faltan los dos—. La espera se cumplía con el estado equivocado.

Diez corridas seguidas en verde después de los tres.

**Sobre las cuatro ops que el usuario ya tiene trabadas:** con este build, el primer vaciado las aísla, las marca en conflicto y libera el outbox. Las cuatro firmas van a volver a pedirse, que es lo correcto: el servidor nunca las recibió.
## 2026-08-13 · WAFL no decía POR QUÉ no sincronizaba

**Autor:** Claude Opus 5 · **Estado:** corregido

Probando la app en local apareció este mensaje al querer finalizar el torneo:

> *Faltan sincronizar 4 cambios. Buscá señal y probá de nuevo. Tus puntajes ya están guardados en el celular.*

**El mensaje siempre culpaba a la señal.** «Buscá señal» es el consejo correcto sin conexión y es **inútil cuando el servidor contesta y rechaza**: manda al líder a caminar buscando antena por un problema que no está en la antena. Con la sesión vencida, con un 500, con un rechazo de validación, decía exactamente lo mismo.

Y el motivo real **ya estaba guardado**: `marcarIntentos` escribe `lastError` en cada op del outbox desde `FE-2`, y `flush` lo emite en `SyncState.lastError`. Ninguno de los dos lugares que le hablan al líder lo miraba.

- El cierre ahora dice: *«Falta sincronizar 4 cambios. El servidor respondió: <motivo>. Tus puntajes ya están guardados en el celular.»* Se toma el error de la op **más intentada**, que es la que mejor representa por qué está trabada.
- El badge pasa de «Hay un problema con la sincronización» a *«Problema al sincronizar: <motivo>»*. Sin motivo registrado no se inventa uno.

De paso, dos cosas más:

- **«1 cambios».** El plural estaba fijo.
- **La frase tranquilizadora vivía en `ResultsPage`**, pegada al mensaje que venía de `outbox`. Ahora el mensaje es uno solo y se arma en un lugar.

**Y un flake propio, encontrado en el camino.** El test «firmado, el teclado queda deshabilitado» —de la tanda anterior— esperaba el **título del blanco**, que está desde la primera pintada, y después afirmaba sobre el teclado. Pero las firmas llegan de IndexedDB en un efecto: la aserción corría carrera contra esa lectura. Ahora espera el aviso de la firma, que es la señal de que las firmas ya se leyeron. Seis corridas seguidas en verde.

> No es el primer test que escribo esperando algo que ya está en pantalla en vez de lo que de verdad indica que el trabajo terminó. Es el mismo error que el `waitFor` de `FE-8` y que la aserción que llegaba antes que la cola de escrituras en `REF-6`.

**Sobre la causa concreta del usuario:** no se determinó. La API respondía 200 en `/api/health` al revisar, así que no era que estuviera caída. Con este cambio, la próxima vez el mensaje lo dice solo.

**Tests:** 3 de cierre, 5 de `syncLabel` —que no tenía ninguno—. 945 en verde. **Controles de mutación: 2, murieron 2.**

---

## 2026-08-13 · `FE-16` — Ranking de liga en WAFA

**Autor:** Claude Opus 5 · **Estado:** completado

Los mismos datos y los mismos dos modos que la landing, contra los mismos endpoints públicos. El admin lo mira sin cambiar de app en medio de la fecha.

**La duplicación que el plan anticipaba, resuelta a medias a propósito**

`ACTION_PLAN.md` avisaba: *«duplica lo que va a mostrar la landing […] conviene reutilizar sus componentes en vez de escribirlo dos veces»*. No se puede literalmente: la landing y la PWA **no comparten bundle**, y es a propósito —arrastrar la biblioteca de la landing a una app que tiene que abrir sin señal le sumaría peso a cambio de nada.

Lo que sí se compartió es **la decisión**, que es lo que no debería divergir: `medallaDe` y `ETIQUETA_DE_MODO` viven en `@bal/shared/src/podio.ts` y los usan las dos pantallas. La landing dejó de tener su copia. Lo duplicado es el JSX, que además es distinto: la landing usa tabla y WAFA una lista, porque el admin la mira en el celular tanto como en la notebook.

**El costo, medido:** el presupuesto de la PWA pasó de 114,45 a **114,46 KB gz** — diez bytes. Sacar el podio a `shared` compensó casi exactamente lo que sumó la pantalla nueva.

**Decisiones**

- **La pantalla pega a los endpoints públicos**, no a unos de admin. El ranking ya es público y no hay nada que ocultarle al admin que no vea cualquiera; agregar rutas equivalentes bajo `/admin` habría sido superficie nueva sin ninguna razón.
- **Si el ranking no carga, lo dice.** WAFA es la app del admin, en el club, con wifi flojo: quedarse en blanco es peor que un mensaje.
- **Los que no llegan al mínimo van aparte, no se ocultan.** Misma regla que la landing, por el mismo motivo: esconderlos haría creer que se perdió su resultado.

**Tests:** 6 en `@bal/shared`, 6 en WAFA. 937 en verde, presupuesto y E2E incluidos. **Controles de mutación: 3, murieron 3** — darle medalla al cuarto, dejar la medalla sin nombre, y no cambiar de endpoint al conmutar el modo.

---

## 2026-08-13 · `TEST-2` — Los cinco escenarios E2E

**Autor:** Claude Opus 5 · **Estado:** completado

Los cinco escenarios adicionales de [`TESTING.md`](TESTING.md) §6. Ocho tests E2E en total, 1,7 minutos.

| Escenario | Qué demuestra |
|---|---|
| `offline-recarga` | Cerrar la app a mitad del recorrido y volver a abrirla **sin conexión** no pierde nada, y se sigue cargando desde donde se dejó |
| `dos-dispositivos` | Gana el `clientUpdatedAt` más reciente, **no** el que llegó último al servidor |
| `sesion-vencida` | Un 401 durante la sincronización **conserva el outbox**, y lo pendiente sale solo al volver la conexión |
| `blanco-bloqueado` | Un puntaje real, por el stack real, bloquea el blanco y la API rechaza el cambio |
| `pwa-instalable` | Manifest instalable, service worker registrado, y **`skipWaiting` detrás del mensaje** |

**Hallazgos**

- **Mi test de la PWA prohibía `skipWaiting()` a secas y fallaba contra un service worker correcto.** Con `registerType: 'prompt'`, Workbox **sí** emite `skipWaiting()`: lo que hace es dejarlo detrás del mensaje `SKIP_WAITING` que manda la página cuando el usuario acepta actualizar. La regla del proyecto es que no se actualice **solo**, no que la función no exista. La aserción correcta es que esté dentro del `addEventListener("message")` y que no haya `clientsClaim()`.
- **También pedía un ícono de 512px** y el manifest tiene un SVG con `sizes: "any"`, que Chrome acepta. Sumar un PNG grande al bundle de la PWA por una regla que no aplica sería pagar peso a cambio de nada.
- **El flujo original se rompió al compartir la base con los nuevos.** Dos causas, las dos suyas y no de la app: su `adminApi` cambiaba el password sin fijarse si ya estaba cambiado, y el ranking de la landing lo abría **sin decir qué temporada** — con varias en la base, la primera era la de otro spec y no tenía nada publicado. Ahora el helper de admin es tolerante y el test navega con su `seasonId` en la URL.

**Decisiones**

- **Los helpers se extrajeron a `e2e/ayudas.ts`.** Estaban dentro de `flujo-completo.spec.ts`; copiarlos cinco veces habría dejado cinco versiones que se separan la primera vez que cambia una pantalla.
- **`blanco-bloqueado` no verifica la pantalla del admin.** Eso ya lo cubre `torneo-ui.test.tsx` con el mismo `motivoDeBloqueo`; repetirlo acá obligaba a un login de admin por interfaz y sumaba fragilidad sin probar nada nuevo. El E2E se queda con lo que sólo él puede demostrar.
- **`dos-dispositivos` manda las dos ops por API, no por clicks.** Lo que se prueba es la regla de resolución, y con clicks los dos relojes quedarían a merced de cuánto tarda cada uno. Acá el orden temporal es el dato del test.

**Tests:** 5 escenarios nuevos, 7 tests. **Controles de mutación: 4, murieron 4** — uno por escenario, cada uno contra la regla que ese escenario existe para proteger:

| Mutación | Lo detectó |
|---|---|
| Un error de red descarta las ops del outbox | `sesion-vencida` — el badge decía «Sincronizado» con el trabajo perdido |
| Gana el que llega último, no el más reciente | `dos-dispositivos` — `applied` donde iba `superseded` |
| Un blanco tirado deja de bloquearse | `blanco-bloqueado` — la lista de bloqueados vino vacía |
| Entrar sin conexión deja de funcionar | `offline-recarga` |

---

## 2026-08-13 · Los dos tests que `REF-6` dejó debiendo

**Autor:** Claude Opus 5 · **Estado:** completado

`REF-6` cerró con dos comportamientos implementados y sin test, anotados en su archivo. Los dos están cubiertos ahora, y **ninguno se arregló insistiendo con el test original**: en los dos casos el problema era el diseño de lo que se probaba.

**1 · El teclado para un arquero que ya firmó.** El guard vivía sólo en el handler: el teclado seguía encendido y se tragaba el toque en silencio. Por eso el test dependía de que la cola de escrituras hubiera drenado, y pasaba con el guard sacado a mano.

La corrección no fue el test sino la pantalla: **el teclado ahora se apaga**. Es lo que el propio design system pide —*un botón que parece activo y no hace nada es peor que uno apagado*— y de paso deja algo visible que verificar, sin depender de ninguna cola. El guard del handler queda como segunda línea.

**2 · Limpiar la patrulla al cambiar de torneo.** El test tocaba la botonera y después cambiaba el torneo, y fallaba afirmando que el click había dejado el campo cargado. La botonera metía una frontera asincrónica de más que no aportaba nada a lo que se quería probar: el comportamiento es del efecto que limpia el usuario, y se llega igual tipeando en el campo. Reescrito así, estable en cinco corridas seguidas.

**Lo que queda como criterio:** cuando un test no se deja escribir de forma confiable, muchas veces el problema no es el test. Acá, uno destapó una pantalla que mentía y el otro, un test que probaba de más.

**Tests:** 4 nuevos. 924 en verde. **Controles de mutación: 3, murieron 3** — apagar el teclado, dejar de pasar el bloqueo, y no limpiar el usuario.

---

## 2026-08-13 · `REF-7` — Landing

**Autor:** Claude Opus 5 · **Estado:** completado

Última tanda de [`post/ref-1/ACTION_PLAN.md`](post/ref-1/ACTION_PLAN.md). Portada, ficha de torneo y ranking.

**Decisiones**

- **La ilustración de portada está dibujada, no fotografiada.** La CSP prohíbe pedidos externos, y una foto que entrara en el presupuesto de la landing tendría que comprimirse hasta verse mal. El SVG pesa 2 KB, usa `currentColor` para acompañar el tema y los tres anillos del blanco son los colores de estaca, que es la identidad de la liga.
- **El recorrido pasó de lista suelta a cajas encadenadas.** Una lista de catorce ítems no deja ver que el recorrido **es una secuencia**, que es justo lo que hay que caminar. Van en grilla y no en una fila: catorce blancos en línea obligarían a scrollear de costado, y la página nunca scrollea de costado. La línea entre cajas es `aria-hidden`: la secuencia ya la da el orden de la lista, que es lo que lee un lector de pantalla.
- **Los puntos de liga de la tabla salen de `leaguePointsForPosition`**, la misma función que corre el servidor al publicar. La landing no reimplementa el criterio.
- **El valor de inscripción sí es público; quién pagó, no.** Cuánto sale entrar es lo que cualquiera quiere saber antes de anotarse, y el club lo publica igual en el grupo y en la puerta. Hay un test de que `paid` y `collected` no salen por ese endpoint.
- **La medalla del podio nunca va sola:** el número del puesto está al lado y el emoji lleva su nombre en `aria-label`. Del cuarto en adelante no hay medalla — inventar una donde no la hay sería decir algo que no pasó.

**Hallazgo**

**La ficha del torneo se rompía entera si faltaba `payment`.** Lo destaparon las fixtures viejas de los tests, que no traían el campo: la página quedaba en blanco, no sin un dato. El acceso quedó opcional. Es una página pública y una respuesta vieja en caché no puede dejarla vacía — pero las fixtures se actualizaron igual, para que los tests ejerciten el payload real y no el degradado.

**Tests:** 2 de API, 7 de landing. 920 en verde. **Controles de mutación: 4, murieron 4.**

El presupuesto de tamaño sigue en verde con la ilustración adentro: landing 96,75 KB gz de 120.

---

## 2026-08-13 · `REF-6` — WAFL

**Autor:** Claude Opus 5 · **Estado:** completado, con dos huecos de test anotados

La app crítica. Botonera de patrullas, puntajes editables hasta la firma, teclado, pad de firma y el cierre.

**Hallazgo: se podía editar el puntaje de alguien que ya firmó.** La firma guarda un `scorecardHash` del puntaje del momento; editarlo después hace que el servidor rechace el cierre con `SIGNATURE_MISMATCH` — un error que aparece **al final del recorrido, lejos de su causa**, cuando la patrulla ya quiere irse. Ahora el puntaje queda congelado al firmar y la pantalla explica que para corregirlo el admin tiene que desbloquear la firma.

**Decisiones**

- **No hizo falta endpoint nuevo para la botonera.** El endpoint público de torneo ya exponía el número de cada patrulla, y el usuario es `patrulla${number}`: se agregó el campo para que el cliente no repita la regla de nombrado, no porque antes fuera secreto. Hay un test que verifica que el PIN nunca salga por ahí.
- **El campo de texto de patrulla se queda además de la botonera.** Si la lista no llega por falta de señal, quedarse sin las dos cosas sería quedarse afuera del torneo.
- **Los arcos del teclado dejan de ser el default.** `FE-6` los dejó como apuesta de usabilidad sin validar. La decisión ahora es el **mismo orden de lectura en las cuatro modalidades**: cambiar de disposición entre un blanco 3D y uno de sala obliga a volver a buscar dónde está cada tecla, en el medio del recorrido y con guantes. Los arcos siguen detrás de la prop.

**Los dos huecos, anotados en el código**

De tres controles de mutación **murió uno**. Los otros dos destaparon tests míos que pasaban por la razón equivocada:

1. **El guard del teclado para arqueros firmados.** El test pasaba con el guard sacado a mano: la aserción llegaba antes de que drenara la cola de escrituras. Lo reescribí usando la escritura de otro arquero como señal de que la cola pasó, y no logré que la selección del segundo arquero funcionara desde el test. Lo que sí queda cubierto es que el botón de borrar desaparece y que la pantalla explica por qué; el guard del handler, no.
2. **Limpiar la patrulla al cambiar de torneo.** El test falla de forma consistente afirmando que el click sobre la botonera dejó el campo cargado, aunque el mismo click funciona en el test de al lado. No encontré la causa.

Los dos están escritos como comentario en su archivo. **Un test que pasa por llegar temprano es peor que ninguno**: el segundo no miente sobre lo que está cubierto.

**Tests:** 2 de API, 11 de UI. 911 en verde, E2E incluido.

---

## 2026-08-13 · `REF-5b` — Los tres que faltaban de WAFA

**Autor:** Claude Opus 5 · **Estado:** completado

Cierra `REF-5`: botones a iconos en Arqueros, tarjeta de tres renglones en el Home, y editar/eliminar el torneo desde el detalle.

**Decisiones**

- **El `aria-label` de los botones de ícono lleva el apellido**, no sólo el verbo. Con quince arqueros en pantalla, quince botones «Editar» no se distinguen en un lector de pantalla. Los tests pasaron de buscar `{ name: 'Eliminar' }` a `{ name: /^Eliminar a/ }`.
- **Editar el torneo es inline y sólo sobre nombre y fecha.** El recorrido tiene sus propias reglas —un blanco con puntajes está bloqueado, y eso ya vive en su pantalla— así que editarlo de refilón desde el detalle habría duplicado esa lógica. Un enlace a una pantalla de edición que no existe habría sido peor: un 404.
- **Borrar pide dos toques sobre el mismo botón**, con el texto cambiado a «Confirmar borrado» y la lista de lo que se pierde. Sin `confirm()`, que bloquea el hilo y en un celular saca del contexto, y sin modal, que tapa la pantalla.

**Hallazgo:** el guard de iconografía de `REF-4` **agarró el código nuevo**. Los `glifo="✎"` que se pasan a `BotonIcono` no llevan `aria-hidden` en su línea, aunque el componente destino sí lo pone. Se agregó la exención con su motivo escrito, junto a la de `textoVolver`: el guard mira línea por línea y no puede saber a dónde va un valor, así que cada exención se anota en vez de aflojar la regla.

**Tests:** 5 de UI. 899 en verde. **Control de mutación: 1, murió 1** — borrar al primer toque rompe los dos tests de confirmación.

---

## 2026-08-13 · `REF-5` — WAFA (5 de 8)

**Autor:** Claude Opus 5 · **Estado:** parcial

Quinta tanda de [`post/ref-1/ACTION_PLAN.md`](post/ref-1/ACTION_PLAN.md). **Entraron cinco de los ocho ítems**, y la elección de cuáles no fue por orden de lista: se hicieron los que **desbloquean backend que ya existía y no se podía alcanzar**.

- Los **pagos de `REF-2`** —endpoints, recaudación derivada, todo probado— no tenían ninguna pantalla que los usara. Ahora hay una.
- Las **temporadas** tenían `status: 'activa' | 'cerrada'` en el modelo desde `BE-1` y ninguna ruta que lo cambiara. Se agregó `POST /admin/seasons/:id/{archive,restore}`.
- El **conteo de torneos por arquero** es backend nuevo, y es lo que distingue al que compite del que está anotado en el padrón y nada más.

Los tres que faltan —botones a iconos en Arqueros, la tarjeta de tres renglones del Home, y editar/eliminar el torneo desde el detalle— son de presentación y **no bloquean nada**: ninguno tiene backend esperando del otro lado.

**Hallazgos**

- **`participatedIds` devolvía un booleano disfrazado de lista.** Hacía un `distinct` sobre `archerId` sólo para preguntar «¿aparece?». Se reemplazó por `tournamentCounts`, que trae el número real con una sola consulta, y `participated` pasó a **derivarse** del conteo: dos fuentes para el mismo hecho son dos que pueden decir cosas distintas.

**Decisiones**

- **El filtro por categoría es del cliente.** El padrón entero son cientos de arqueros y ya está en memoria; filtrar del lado del servidor sería una consulta por cada cambio del select, en la pantalla que se usa justo mientras se arma un torneo. La búsqueda y el archivado sí viajan, porque necesitan el índice.
- **La recaudación se muestra, no se recalcula.** La calcula el servidor. Un total sumado en el cliente puede separarse del que ve el tesorero, y son el mismo número. Hay un test que manda un `collected` deliberadamente incoherente con `paidCount × amount` para verificar que la pantalla no lo rehaga.
- **El monto se anula al desmarcar «cobra inscripción».** Uno que sobrevive apagado reaparece al volver a marcar la casilla, y el torneo termina cobrando sin que nadie lo haya decidido.

**Tests:** 8 de API, 20 de UI. 891 en verde. **Controles de mutación: 3, murieron 2.**

El sobreviviente: cambiar `$addToSet` por `$push` en el conteo de torneos no rompe ningún test. **No es una falla de cobertura, es inalcanzable por construcción** — un arquero repetido dentro del mismo torneo lo impide el schema al crear y, por debajo, el índice único `uk_torneo_archer`. Se intentó insertar el duplicado a mano en la base para cubrirlo y el índice lo rechazó, que es lo correcto. Queda anotado en el test.

---

## 2026-08-13 · `REF-4` — Transversal de interfaz

**Autor:** Claude Opus 5 · **Estado:** completado

Cuarta tanda de [`post/ref-1/ACTION_PLAN.md`](post/ref-1/ACTION_PLAN.md): conmutador de tema, formateo de fechas, iconografía y logo. Lo que atraviesa las tres apps, antes del trabajo por pantalla.

**Hallazgos**

- **El conmutador rompía la pantalla entera.** No por falta de guarda: `temaInicial` llamaba a `matchMedia` dentro del `try` **y otra vez en el `catch`**. Cuando `matchMedia` no existe —navegadores viejos, jsdom sin configurar— el `try` fallaba y el camino de respaldo repetía la misma llamada, así que el error salía sin atrapar. Como el conmutador vive en el header, no faltaba un botón: no se veía nada.

  *Un camino de respaldo que repite la llamada que falló no es un respaldo.* La consulta quedó aislada en su propia función con su propio `try`.

- **Las fechas se mostraban crudas en las tres apps**, y formatearlas en la zona del navegador habría sido peor que dejarlas así: se guardan como medianoche UTC y Argentina es UTC-3, así que un torneo del 8 de agosto se habría mostrado como **7**. En la planilla impresa esa diferencia es un problema real. Todo se formatea en UTC.

- **Los siete headers de WAFA estaban repetidos literalmente**, con el mismo markup. Se extrajo `Encabezado`, que es lo que permitió agregar el conmutador **una vez** en lugar de siete — y lo que evita que la próxima pieza transversal vuelva a pegarse siete veces.

**Decisiones**

- **La decisión del tema vive en `@bal/shared`; la aplicación, en cada app.** Son cuatro lugares que tienen que coincidir: los dos scripts anti-FOUC de los `index.html` —que no pueden importar nada— y los dos conmutadores. Hay un test que **lee los dos HTML** y verifica que usen la misma clave y los mismos colores.
- **Un valor de tema corrupto no cuenta como elección**: se sigue la preferencia del sistema. Forzar claro ignoraría a alguien que tiene el sistema en oscuro por una entrada que nunca eligió.
- **Una fecha que no se puede interpretar se muestra tal cual.** Es un bug, pero romper la pantalla es peor que mostrar el dato crudo, que además deja verlo para reportarlo.
- **El componente de tema se duplica entre la PWA y la landing**, por la misma razón que el resto de las primitivas de la landing: no comparten bundle. Lo que **no** se duplica es la decisión.

**Desvíos**

- **El PNG del CBA no entró.** Es de 2000×2000 y 183 KB, y no hay herramienta de imágenes en el repo para achicarlo. Meterlo en una PWA que tiene que funcionar en un celular en el monte no es aceptable, y precargarlo en el service worker sería peor. El SVG de la Liga sí entró: 1,1 KB, sin degradados ni filtros, legible a 24px y en blanco y negro.

**Deuda:** el logo del CBA, pendiente de redimensionar a ~256px con una herramienta externa. Queda como ítem de `REF-7`, que es donde la landing arma su presentación.

**Tests:** 16 nuevos en `@bal/shared`, 24 en la PWA. 862 en verde. **Controles de mutación: 7, murieron 7.**

Uno sobrevivió al principio y valió la pena: sacar la guarda `typeof matchMedia === 'function'` no rompía ningún test, porque el `try/catch` ya la cubría. Perseguir esa mutación mostró que el arreglo real era otro —el `catch` que repetía la llamada— y que hacía falta un test con **los dos fallos a la vez**: `localStorage` bloqueado *y* sin `matchMedia`. Con uno solo de los dos, el bug no se ve.

El guard de iconografía se verificó inyectándole un glifo suelto en una pantalla.

---

## 2026-08-13 · `REF-3` — Reglas y flujo de patrullas

**Autor:** Claude Opus 5 · **Estado:** completado

Tercera tanda de [`post/ref-1/ACTION_PLAN.md`](post/ref-1/ACTION_PLAN.md). La regla pedida era «como mucho una patrulla de 2; si quedan dos, se juntan».

**La regla no siempre se puede cumplir.** Una patrulla es a lo sumo dos unidades y de 2 a 4 arqueros, así que las formas posibles son `4 = u2+u2` · `3 = u2+u1` · `2 = u2` ó `u1+u1`. Con 1 recurvo y 3 compuestos —4 arqueros en tres unidades— los repartos son **2+2** o **3+1**, y el segundo viola `H1`. Fusionar es estructuralmente imposible.

Eso no se dedujo, se midió: un barrido sobre todas las composiciones de hasta tres categorías encontró **1213** que producían dos patrullas de 2, y de esas, **cero** fusionables. Todas tenían una patrulla `[1,1]` —dos unidades de uno— que no puede entrar en otra sin pasar de dos unidades.

**Pero el barrido encontró algo mejor.** Comparando contra el óptimo teórico, **30 de 960 composiciones daban peor de lo alcanzable**. La causa: `mejorCompañero` elige por categoría y estaca **ignorando el tamaño de la unidad**. Una unidad solitaria con cupo para llevarse una de a dos se lo gastaba en otra solitaria, fabricando una patrulla de 2 evitable. Con 1 recurvo y 5 compuestos salían una de 2 y una de 4, cuando podían ser dos de 3.

Corregido, el mismo barrido da **0 peores que el óptimo**, y los casos con dos patrullas de 2 bajan de 1213 a 894. Los 894 restantes son inevitables.

**Decisiones**

- **`S4` es un objetivo blando, no una restricción dura.** Se documentó así en [`DOMAIN_WA.md`](DOMAIN_WA.md) §5, con la razón. Llamarlo `H5` habría prometido algo que el armado no puede garantizar.
- **El validador sólo avisa cuando existe un reparto mejor.** `minPatrolsOfTwo` calcula el mínimo alcanzable a partir de la forma de las unidades. Marcar como violación algo que no se puede arreglar es enseñarle al admin a ignorar los avisos — y el armado automático habría mostrado una advertencia sobre su propio resultado óptimo.
- **El tamaño ahora sí frena el guardado**, a diferencia del resto de las violaciones. Una patrulla de un arquero no es una excepción que el admin pueda tomar conociendo el terreno: es un torneo que no se puede correr, porque nadie le controla el puntaje. Las violaciones de reglamento siguen avisando sin bloquear.
- **Una patrulla vacía no frena.** Es un estado intermedio mientras se reacomoda, y no se manda al servidor.

**Hallazgos**

- **El `default:` de `textoDeViolacion` se tragó los códigos nuevos** y los imprimió como «Patrulla undefined». Se reemplazó por un caso por código: ahora agregar una violación sin darle texto rompe el `typecheck` en vez de mostrar el mensaje de otra.
- **La clave de React de la lista de violaciones era `${code}-${patrolNumber}`**, y las dos violaciones nuevas no tienen `patrolNumber`. `DUPLICATE_START` puede aparecer varias veces —una por blanco repetido— y todas habrían compartido clave. Pasó a ser el texto del mensaje.
- **El helper `patrulla()` de los tests fijaba `startTargetIndex: 1`** para todas. Con la regla nueva, cada test de validación habría arrastrado un `DUPLICATE_START` de regalo. Ahora usa el número de patrulla.

**Desvíos:** el plan decía que dos patrullas de 2 «se juntan». No se implementó una fusión, porque no existe: se corrigió la causa de que aparecieran de más.

**Tests:** 12 nuevos en `@bal/shared`, 10 en WAFA. 770 en verde. **Controles de mutación: 6, murieron 6.** El barrido que encontró el defecto quedó como test permanente, con su propio oráculo — una copia deliberada de `minPatrolsOfTwo`, para que la implementación no se valide contra sí misma.

---

## 2026-08-12 · `REF-2` — «Mejor de 2» y pago de inscripción

**Autor:** Claude Opus 5 · **Estado:** completado

Segunda tanda de [`post/ref-1/ACTION_PLAN.md`](post/ref-1/ACTION_PLAN.md). Toca dominio y modelo de datos, así que con TDD.

**El ranking de la liga pasa a «mejor de 2»**: el promedio de los dos mejores porcentajes de la temporada, en lugar del mejor suelto. Un porcentaje único premia el día bueno; el promedio de dos mide la regularidad, que es lo que la liga quiere medir. Reemplaza al modo `score`.

**El pago de inscripción es un monto único por torneo.** `TournamentDoc.payment` y `ParticipantDoc.paid`. La recaudación **se deriva** —pagos × monto— y no se acumula: un total guardado puede quedar desfasado de los pagos que lo componen.

**Decisiones**

- **`bestNormalizedPct` NO cambió de significado**, contra lo que decía el plan. Se agregó `topTwoPcts` y el promedio lo deriva `bestTwoAvgPct`. Reinterpretar el campo habría dejado un nombre que miente, y el mejor resultado suelto sigue siendo un dato que la landing muestra: es el récord personal que el arquero reconoce, aunque ya no ordene ningún ranking.
- **Se guardan los dos porcentajes, no su promedio.** El acumulado se construye incrementalmente, torneo por torneo: para saber si el que llega desplaza a alguno hay que conocer a los dos que están. Y el promedio derivado no puede separarse del par que lo produce.
- **El monto nunca se acepta del cliente.** `MarkPaymentSchema` es `{ paid: boolean }` y nada más; el monto lo lee el servidor del torneo. Ver [`SECURITY.md`](SECURITY.md) §2.
- **El pago se puede desmarcar.** Cobrar de más también es un error que hay que poder corregir sin tocar la base a mano.
- **Los pagos van bajo `/admin`**, no en el endpoint público: quién pagó y quién no es información del club, no del ranking.

**Hallazgos**

- **La landing seguía pidiendo `mode=score`**, que la API ahora rechaza con 400. Sus 18 tests pasaban porque el mock acepta cualquier ruta que se le declare: nada verificaba que el modo pedido fuera uno que el servidor conozca. Se corrigió la landing en esta tanda —aunque el trabajo de landing sea `REF-7`— porque dejarla rota una tanda entera no era una opción. El test nuevo recorre los botones y afirma que el conjunto de modos pedidos es exactamente `{position, best_two}`.
- **`ix_ranking_puntaje` no lo usaba ninguna consulta.** Existía «para el otro modo de ranking», pero la landing trae la temporada entera con `find({ seasonId })` y la ordena en memoria con `sortStandings`: el índice que sirve es el del prefijo `seasonId`. Con «mejor de 2» el campo indexado además dejó de ordenar nada. Se dio de baja, y el test de índices ahora afirma que **no** está.
- **`db:reconcile` no alcanzaba a `standings`.** Recalculaba los rollups de `participants` desde `scores`, pero el acumulado de la liga sólo se rehace al publicar: los documentos escritos antes de un cambio de forma se quedan como están si nadie vuelve a publicar esa temporada. Ahora el comando recalcula las dos cosas.

**Desvíos:** el plan decía reinterpretar `bestNormalizedPct`; se agregó un campo en su lugar, por lo dicho arriba. Y se tocó la landing, que estaba asignada a `REF-7`.

**Deuda:** el formulario de creación de torneo de WAFA todavía no tiene el checkbox de pago ni el monto — está en `REF-5`. Hasta entonces todo torneo nuevo se crea gratuito, que es el default del schema. El E2E tampoco ejercita «mejor de 2»: haría falta publicar dos torneos y duplicaría su duración; queda cubierto por integración contra un Mongo real.

**Tests:** 21 nuevos en `@bal/shared`, 12 de integración, 2 de landing. 771 en verde. **Controles de mutación: 7, murieron 7.**

Uno de ellos no concluía al principio: mutar `packages/shared/src` no afecta a los tests de la API, que consumen `@bal/shared` desde `dist/`. La mutación se repitió contra el test de `shared`, que sí corre sobre el fuente. Anotado por si vuelve a aparecer: **una mutación en `shared` sólo la ven los tests de `shared`, salvo que se reconstruya el paquete.**
---

## 2026-08-12 · `REF-1` — Los tres bugs del primer refactor

**Autor:** Claude Opus 5 · **Estado:** completado

Primera tanda de [`post/ref-1/ACTION_PLAN.md`](post/ref-1/ACTION_PLAN.md). Los tres defectos que impedían correr un torneo, más dos que aparecieron tirando del mismo hilo.

**1 · El avance de patrulla contaba uno de menos.** `actualizarAvanceDePatrulla` recibía la `session` de la transacción y se la pasaba **sólo a la escritura**. Las dos lecturas corrían fuera, no veían el puntaje recién escrito, y el último blanco de cada tanda nunca contaba: 13 de 14. Se agregó el parámetro `session` a `listParticipantsOfPatrol` y `listScoresOfPatrol`.

Es el error que la cabecera de `tournamentRepo.ts` advierte para las escrituras. **Vale igual para las lecturas que van después de una escritura en la misma transacción**, y eso no estaba dicho.

**2 · Todos los blancos figuraban completos.** `delBlanco.length >= total` con `total === 0` es verdadero siempre: un bundle sin arqueros daba el recorrido entero por hecho y habilitaba las firmas. La segunda verdad vacua estaba al lado — `completos.size === targets.length` es `0 === 0` con un torneo sin blancos.

El camino es real y está documentado en el propio `patrolAdminService`: *«una patrulla que queda sin nadie queda vacía»*, conservando usuario y PIN.

**3 · El editor perdía al quinto arquero.** `unidadesDe` recortaba en `MAX_PATROL_SIZE`, así que mover un 5º arquero a una patrulla llena **lo movía y lo perdía**: desaparecía de la pantalla y del cuerpo del `PUT`. La causa real era distinta de la que se supuso al reportarlo — no es que la app no dejara mover.

**Decisiones**

- **La `B` se queda con el excedente aunque pase de dos.** Un estado inválido se muestra; `problemaDelBorrador` ya frenaba el guardado. Descartar en silencio es peor que mostrar algo que no cierra.
- **No se agregó guarda de patrulla vacía en `actualizarAvanceDePatrulla`.** Ahí `miembros` nunca viene vacío: sólo se llega después de autorizar a un participante de esa patrulla. Habría sido código sin test posible.

**Hallazgos**

- **Una patrulla vacía cerraba el circuito sin un solo puntaje.** Con cero activos, `esperados` da cero, «faltan puntajes» no se cumple y no falta ninguna firma. Misma familia de verdad vacua, del lado del servidor, y con consecuencia peor. Se rechaza el cierre.
- **El E2E pasaba con el bug 1 adentro.** Verificaba `targetsCompleted` del **participante**, que nunca estuvo roto, y nunca el de la **patrulla**, que es el que WAFA muestra. Se agregó la aserción; con el bug reintroducido da `Expected: 14 · Received: 13`.

**Desvíos:** el plan preveía tres correcciones y salieron cinco. Las dos extra son la misma causa raíz de las que estaban listadas, y separarlas habría dejado el bug conocido en la rama.

**Tests:** 5 nuevos de integración y componente, 4 de lógica pura, 1 aserción de E2E. 745 en verde. **Controles de mutación: 8, murieron 7.**

El que sobrevive es quitar la `session` de la lectura de **participantes** del avance. Sobrevive por una razón concreta: de esa lectura sólo se usa `.length`, y la cantidad de participantes no cambia dentro de la transacción. Se deja la `session` igual —es lo correcto si algún día se lee un campo— dejando constancia de que hoy ningún test la respalda.

**Sobre el método:** una mutación pegó en un **comentario** en vez de en el código, y los tests siguieron pasando. El script de mutación ahora aborta si el patrón aparece más de una vez en el archivo. Es la cuarta vez que una mutación que no se aplica se lee como «el test no sirve».

---

## 2026-08-12 · Nadie cargaba el `.env`

**Autor:** Claude Opus 5 · **Estado:** corregido

Al intentar correr el circuito contra un MongoDB local, la API murió con:

```
Configuración inválida:
  - MONGODB_URI: Invalid input: expected string, received undefined
  - SESSION_SECRET: Invalid input: expected string, received undefined
```

**El `.env` no lo leía nadie.** `env.ts` mira `process.env`, y ningún script inyectaba el archivo: no había `dotenv` ni `--env-file`. [`CONFIG.md`](CONFIG.md) §4.1 decía «copiar `.env.example` a `.env` y editarlo», dando por sentado que algo lo cargaba.

Es **el mismo patrón** que la PWA sin hoja de estilos y la sincronización sin enchufar: algo documentado, con su archivo escrito, que nadie conectaba.

**Por qué ningún test lo vio:** los de integración siembran el entorno a mano con `testEnvRaw`, y el servidor del E2E lo arma en código. Ninguno pasa por el `.env`, que es justamente el camino que usa una persona.

**La corrección:** `--env-file-if-exists=../../.env` en `dev`, `start` y los cuatro comandos de `db:*`. Se usa la variante `-if-exists` y no `--env-file` a propósito: en producción no hay archivo —las variables las inyecta la plataforma— y el arranque no debe fallar por eso.

**Tercera vez el mismo tipo de bug.** Vale como criterio para lo que queda: *que un archivo de configuración exista no prueba que algo lo lea.*

También se documentó en `CONFIG.md` §4.2 cómo convertir una instalación de MongoDB en Windows a replica set de un nodo, que es lo que exigen las transacciones. Un MongoDB standalone acepta la conexión y falla recién al crear un torneo, con `Transaction numbers are only allowed on a replica set member or mongos` — un error que aparece lejos de su causa.

---

## 2026-08-12 · `BE-14` — Auditoría de seguridad · y un `$` que duplicó un documento

**Autor:** Claude Opus 5 · **Estado:** parcial, y se dice cuál parte

**36 de los 38 ítems del checklist de [`SECURITY.md`](SECURITY.md) §13 quedaron verdes**, cada uno con el archivo de test que lo verifica escrito al lado. El checklist dejó de ser una lista de intenciones y pasa a ser un mapa.

La mayoría ya estaba cubierta y sólo hacía falta mapearla. **Faltaban cinco**, y se escribieron en `tests/seguridad.test.ts`:

| Ítem | Por qué importaba |
|---|---|
| Op de otra patrulla **queda en el audit log** | Que se rechace ya estaba probado. El rastro es lo único que distingue un error de sincronización de alguien probando. |
| Recurso de otro torneo → **404, no 403** | Un 403 confirma que el recurso existe. |
| Cambiar un puntaje después de firmar → `SIGNATURE_MISMATCH` | Es lo que hace que la firma signifique algo. **No lo probaba nadie.** |
| Clave con `$` en un objeto anidado | No hace falta sanitizar claves porque nada llega sin pasar por Zod `.strict()`. Faltaba demostrarlo. |
| HSTS **presente** en producción | Sólo estaba probado que no aparece fuera de producción. |

**Cuatro mutaciones probadas, las cuatro detectadas.**

**Un test que pasaba por el motivo equivocado**

El de la clave con `$` usaba arqueros inventados, así que el request fallaba igual y el test pasaba **sin que la clave tuviera nada que ver**. Un 400 no prueba nada si el cuerpo ya era inválido por otro motivo.

Corregido comprobando que el error **apunte al campo inyectado** (`targets.0` · `Unrecognized key: "$where"`), que es algo que ninguna otra falla puede producir.

**Y un control que tampoco probaba nada:** al intentar verificar lo anterior, los scripts de mutación usaban `node -e` con `replace()` **sin guarda**. El patrón no coincidía, el archivo quedaba intacto, y yo leía «sigue pasando» como si la mutación se hubiera aplicado. Tres veces seguidas. **Una mutación que no se aplica no prueba nada** — el guard `if (!s.includes(a)) exit(9)` que ya usaba en otros scripts no estaba en éstos.

---

### El `$` que duplicó `SECURITY.md`

Al marcar el checklist, el documento pasó de **319 a 610 líneas**: las secciones §1 a §13 quedaron duplicadas enteras.

La causa es una trampa de JavaScript que vale anotar: **`String.replace` interpreta `` $` `` dentro del texto de reemplazo** como «insertá todo lo que está antes del match». Uno de los ítems del checklist es literalmente:

> Clave con `` `$` `` o `` `.` `` en un objeto anidado → rechazada.

Al usarlo como reemplazo, ese `` $` `` expandió el documento entero dentro de sí mismo.

**La corrección:** pasar una **función** de reemplazo (`s.replace(viejo, () => nuevo)`), que desactiva por completo la interpretación de `$`. Verificado: 320 → 320 líneas, 38 cambiadas por 38.

Es irónico y merece quedar escrito: el ítem del checklist sobre inyección de `$` produjo una inyección de `$`.

---

**Lo que NO está hecho**

| Ítem | Motivo |
|---|---|
| `aikido:scan` limpio | Exige iniciar sesión en Aikido desde el navegador, que es del dueño del proyecto |
| Contenedor no root | El `Dockerfile` declara `USER node`, pero **la imagen nunca se construyó**. Ver `INF-3` |
| `/security-review` sin HIGH ni MEDIUM | Corrió **sin hallazgos**, pero el diff de la rama sólo tiene docs y tests: el código con superficie de seguridad de esta sesión ya está en `main`. Para cumplir el DoD de verdad hay que correrlo sobre el rango de los PR #20 a #24 |

Por eso `BE-14` queda en `[~]` y no en `[x]`.

**735 tests en el repo.**

---

## 2026-08-12 · `INF-5` completo, `INF-3` e `INF-4` a medias — CI y deploy

**Autor:** Claude Opus 5 · **Estado:** parcial, y se dice cuál parte

**El CI existe.** Los cuatro jobs de [`CONFIG.md`](CONFIG.md) §8: `quality`, `budget`, `e2e` y `audit`.

Llega tarde: **tres bugs llegaron a `main` sin que nada los frenara** —el lint roto desde `FE-3`, la PWA construyéndose sin hoja de estilos, y la sincronización sin enchufar—. Los tres estaban en el rango de lo que estos jobs habrían visto.

**El chequeo del `.css` no es genérico.** Verifica que cada frontend **emita una hoja de estilos**, que es exactamente el bug de `FE-17`. Se comprobó que funciona **borrando el `.css` del build**: falla con exit 1 y dice el motivo probable —«suele significar que el punto de entrada no importa su CSS»—. Un chequeo que nunca se vio fallar no protege nada.

**Lo que NO está hecho, y por qué**

| Tarea | Estado | Motivo |
|---|---|---|
| `INF-3` Dockerfile | **Escrito, sin construir** | No hay Docker en esta máquina. `docker build` no se corrió ni una vez. |
| `INF-4` Deploy | **`railway.json` listo, sin desplegar** | Necesita la cuenta de Railway y el cluster de Atlas, que son del dueño del proyecto. |

Marcarlas `[x]` sería mentir. Quedan en `[~]` con lo que falta escrito al lado.

**Lo que sí se pudo verificar del Dockerfile:** la imagen deja los frontends en `packages/api/public/{app,landing}` y `estaticos.ts` los busca ahí. Esa detección se extrajo a `elegirRutas`, una función pura, y **está probada**: prefiere la primera ubicación con builds, y sin ninguna devuelve la del monorepo y no sirve nada. Es la única parte del deploy que se puede probar sin desplegar.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Ubicación de los frontends | **Se detecta**, no se configura | Una variable de entorno más es una cosa más que puede quedar mal seteada el día del deploy. |
| Base del E2E en CI | El mismo MongoDB en memoria que en local | Sin servicios externos: si corre en la máquina de cualquiera, corre en el runner. |
| Reporte de Playwright | Se sube **sólo si falla** | Un artefacto por corrida verde es basura que nadie mira. |
| `.dockerignore` | Excluye `docs/`, `pre/` y los `dist` locales | Los `dist` del host traerían binarios de otra plataforma; la documentación no se ejecuta. |

**Próximo:** `BE-14`, la auditoría de seguridad. Es `P0` y es lo último bloqueante antes del deploy.

---

## 2026-08-12 · `BE-17` y `TEST-1` — El E2E offline · y los tres bugs que encontró

**Autor:** Claude Opus 5 · **Estado:** completado

Los 23 pasos de [`TESTING.md`](TESTING.md) §6 contra el stack real, con el recorrido completo cargado **sin conexión**. Corre en **47 s**.

Es el test que valida el requisito duro del proyecto. **Encontró tres bugs que ningún test unitario podía encontrar**, y uno de ellos habría arruinado un torneo.

---

### 🔴 1. La sincronización no estaba enchufada

`configureSync` y `startSyncWorker` **no los llamaba nadie fuera de los tests**.

- `deps` quedaba `undefined`, así que `flush()` cortaba en su primera línea: **nunca se mandaba nada al servidor**.
- Sin `startSyncWorker()` no había evento `online`, ni intervalo, ni conteo inicial de pendientes.
- El indicador se quedaba en su valor inicial: **«Sincronizado»**.

El líder cargaba los 14 blancos, la app le decía *«Sincronizado»* y **no había salido una sola operación**. Los datos estaban a salvo en IndexedDB —eso funcionaba— pero no llegaban nunca, y el circuito no se podía cerrar.

**Por qué los tests no lo vieron:** `FE-2` está bien cubierto, pero **inyecta el transporte** con `configureSync`. Probaban el worker, no que la aplicación lo usara.

**La corrección va más allá del arreglo:** el transporte real pasó a ser el **valor por defecto** de `deps`, no algo que haya que acordarse de configurar. Un componente que necesita una llamada de inicialización para funcionar va a fallar de esta misma forma tarde o temprano.

### 🔴 2. La barra fija tapaba el botón de firmar del último arquero

En Resultados, la barra de «Cerrar circuito» quedaba **encima de la última tarjeta**. En un celular, el último arquero de la patrulla **no podía firmar**, y sin su firma no se cierra el circuito.

`Screen` tenía `pb-8` (32 px) contra una barra de ~84 px. Se agregó `conBarraFija` al componente —una sola vez, no seis parches— y se aplicó a las seis pantallas que la usan.

Es el tipo de bug que sólo aparece con un navegador de verdad: en jsdom no hay layout, así que **ningún test de componente podía verlo**.

### 🟡 3. `setOffline(true)` no bloquea `localhost`

Playwright emula las condiciones de red por CDP, y el tráfico a loopback no pasa por ahí. Un E2E que confiara sólo en `setOffline` **daría verde sin haber probado nada**.

Se agregó un interceptor que aborta todo lo que vaya a la API y **se cuenta**: la prueba de que estuvo offline es que hubo intentos bloqueados y que **ninguna petición llegó al servidor**. Sin esa aserción, todo el tramo offline sería decorado.

---

**Y algo que faltaba desde el principio:** la API **no servía los frontends**. `ARCHITECTURE.md` §3 lo pedía —un contenedor, un origen— pero nadie lo había implementado. Sin eso no hay stack real que testear ni contenedor que desplegar. Se agregó con fallback de SPA en las dos apps: recargar en `/app/wafl` tiene que devolver el index, no un 404, que es exactamente lo que hace un líder al que se le cierra el navegador.

**Decisiones del E2E**

| Tema | Decisión | Motivo |
|---|---|---|
| Base de datos | `mongodb-memory-server`, no Docker | Corre igual en la máquina de cualquiera y en el runner. |
| Preparación del torneo | Por **API**, no por interfaz | El wizard ya tiene sus tests; 20 altas a mano acá serían minutos sin verificar nada nuevo. |
| Carga del recorrido | Por **interfaz**, con la primera patrulla | Es lo que se está probando. Las demás van por API. |
| Recarga offline | Vuelve al login y hay que tocar «Seguir sin conexión» | Un toque de más a propósito: el celular puede ser prestado, y entrar solo a la planilla de otro sería peor. |
| Condiciones de corte | Estado del dominio, no del DOM | Preguntarle a un botón si hay que seguir es frágil; contar puntajes completos, no. |

**Un test de componente se volvió intermitente** al enchufar el transporte real: `keypad.test.tsx` empezó a competir con las escrituras de reintento del worker. Se le puso un transporte que **nunca resuelve** —el vaciado queda parado, sin escribir ni programar nada— y quedó estable en seis corridas.

**724 tests unitarios + el E2E.**

**Próximo:** `BE-14` (auditoría de seguridad, `P0`) y el deploy (`INF-3`..`INF-5`). `INF-5` ya acumula tres hallazgos que habría atajado.

---

## 2026-08-12 · `FE-17`..`FE-20` — La landing · y la PWA que se estaba sirviendo sin estilos

**Autor:** Claude Opus 5 · **Estado:** completado

El sitio público: introducción, ranking, torneos y ficha de arquero. **97 KB gz** contra el presupuesto de 120.

---

### 🔴 Hallazgo grave: la PWA nunca importó su CSS

Al comparar los builds apareció que **la PWA no generaba hoja de estilos**. `main.tsx` nunca importó `styles/index.css`: quedó así desde el scaffold de `INF-2` y `FE-3` no lo conectó.

**Todo el design system estuvo sin aplicar desde entonces** — tokens, colores de estaca, tema, contenedores. La app funcionaba, pero se veía como HTML sin estilos.

**Por qué ningún test lo vio:** jsdom no procesa hojas de estilo, así que ningún test de componente podía notarlo. El único que mide tamaños —el de las teclas de 56px— usa **estilos inline**, no clases de Tailwind, así que seguía siendo válido y siguió pasando.

Lo que lo delató fue mirar la **salida del build**: dos frontends, y sólo uno emitía `.css`.

> **La lección:** los tests de componente no verifican que la aplicación esté armada. Un `pnpm build` cuya salida nadie mira puede estar diciendo que falta algo desde hace semanas. `INF-5` (CI) debería incluir un chequeo del presupuesto de bundle, que además habría hecho evidente el `.css` faltante.

Es el **segundo** problema que `INF-5` habría atajado, después del lint roto en `main`.

---

**Tokens en un solo lugar**

La landing necesitaba los mismos tokens. En vez de copiarlos se movieron a `@bal/shared/tokens.css`, exportado desde el package. Dos builds separados, una sola fuente de color: con una copia cada uno, se habrían ido separando sin que nadie lo note hasta ver las dos pantallas juntas.

**El tema oscuro tampoco estaba conectado.** `:root[data-theme='dark']` existía en los tokens y **nada lo activaba**. Se agregó el script anti-FOUC en el `<head>` de las dos apps, como pide [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §9.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Acceso principal de la home | **Anotar puntajes**, primero y grande | Es lo que hace falta el día del torneo. Todo lo demás puede esperar. |
| Orden del ranking | Lo decide **el servidor**; cambiar de modo vuelve a pedirlo | La landing no reordena por su cuenta ni inventa un desempate. |
| Los que no llegan al mínimo | Lista aparte **con la explicación** | Esconderlos haría creer que se perdió su resultado. |
| Torneo en curso | Patrullas y avance, **ningún puntaje**, y lo dice | Lo garantiza el backend; la pantalla lo explica para que nadie crea que está rota. |
| Ficha de arquero | El **porcentaje primero**, el bruto entre paréntesis | Uno es lo comparable entre torneos; el otro es lo que el arquero recuerda. |
| Componentes | La landing tiene los suyos, no importa los de la PWA | Duplicar tres primitivas pesa menos que arrastrar la biblioteca de administración a una página de lectura. |

**Dos tests míos que no probaban lo que decían**

De seis mutaciones, **dos sobrevivieron**:

1. *«la landing ordena por su cuenta»* — el test de podio recibía los resultados **ya ordenados**, así que la aserción de orden se cumplía sola. Corregido mandándolos al revés.
2. *«no vuelve a `cargando` al cambiar de recurso»* — el primer intento de test usaba una ruta que devolvía **error**, y el error también limpia la pantalla. Hizo falta una ruta que **nunca responde** para poder mirar el estado intermedio.

Las dos son la misma trampa de siempre con otra cara: **una aserción que se cumple por accidente no prueba nada**. Tras corregirlas, seis de seis detectadas.

**714 tests en el repo.**

**Próximo:** `TEST-1`, el E2E con tramo offline. Ya no está bloqueado: la landing existe y el paso 22 se puede escribir.

---

## 2026-08-12 · `BE-16`, `FE-14` y `FE-15` — Seguimiento y publicación

**Autor:** Claude Opus 5 · **Estado:** completado

Con esto **WAFA queda usable de punta a punta**: crear el torneo, armar las patrullas, seguirlo mientras se corre, y publicarlo.

**Otro endpoint que faltaba**

Igual que en `FE-13`: la vista previa de podios necesitaba los resultados de un torneo `completado`, y el endpoint público los oculta a propósito —un torneo completado todavía no es oficial—. Se agregó `GET /admin/tournaments/:id/results`. **El admin sí tiene que poder mirar lo que está por aplicar a la liga.**

Aprovechando, expone si una firma fue **desbloqueada**: el podio se mira distinto si alguien no firmó de puño y letra.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Podios y puntos | Se calculan con **`rankByCategory` y `leaguePointsForPosition`**, las mismas del servidor | La vista previa no es una estimación: es lo que va a quedar aplicado. |
| Empates | Se dicen: «empatado», y los dos con los mismos puntos | Dos primeros no es un error de carga, es el reglamento. |
| Publicar | **Confirmación aparte** | Aplica los resultados a la liga. No puede pasar de un toque. |
| Despublicar | Dice **exactamente qué revierte** | Un «¿estás seguro?» genérico no informa. Se aclara que los puntajes no se borran y que se puede volver a publicar. |
| Blanco bloqueado | Muestra **el motivo** | Un blanco gris sin explicación parece un error de la app. |
| Torneo terminado | Ningún blanco se toca, tenga o no puntajes | Una patrulla puede no haber llegado a un blanco; eso no lo vuelve editable. |
| Desbloquear firma | Motivo obligatorio | Es saltarse el control que valida el puntaje, y queda en el audit log. |
| Avance de patrulla | Se **lee** del servidor, no se deriva | Lo actualiza la sincronización. WAFA lee, no calcula el estado del torneo. |

**Siete mutaciones, siete detectadas.** Entre ellas: que todos sumen 5 puntos, que ningún blanco figure bloqueado, que nunca falte nadie por firmar y que publicar no pida confirmación.

Esta vez **no hubo sorpresas de dominio ni tests mal armados** — las tres tandas anteriores dejaron bastante aprendido sobre unidades, empates y esperas asincrónicas.

**698 tests en el repo.**

**Estado:** dominio, backend, WAFL y WAFA completos. `FE-16` (ranking en WAFA) queda pendiente: es `P1` y duplica lo que va a mostrar la landing, así que conviene hacerlo después de `FE-18`.

**Próximo:** la landing (`FE-17`..`FE-20`), o `TEST-1` —el E2E con tramo offline— que es `P0` y ata todo lo construido.

---

## 2026-08-12 · `BE-15` y `FE-13` — Patrullas: el endpoint que faltaba, y el editor

**Autor:** Claude Opus 5 · **Estado:** completado

`FE-11` había dejado anotado que la edición manual de patrullas **no tenía dónde guardarse**: `PatrolDistributionSchema` existía en `@bal/shared` desde `SH-7` pero ninguna ruta lo consumía. Se hizo el endpoint (con TDD, porque es transaccional y toca datos) y después la pantalla.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Distribución incompleta | **Se rechaza**, diciendo a quién falta | Un arquero sin patrulla no aparece en ninguna planilla, y nadie se entera hasta que ya se está tirando. Es el error que rompe el torneo en silencio. |
| Violaciones de `H1`..`H4` | **Se guardan**, y quedan en el audit log con su cantidad | El admin conoce el terreno. Avisar no es impedir. |
| Posición dentro de la unidad | La deriva el servidor del **orden** | Es un dato derivado, no una opinión del cliente. |
| Patrullas | **No se crean ni se borran** | Sus credenciales pueden estar repartidas en papel. Una que queda sin nadie queda vacía. |
| Torneo ya iniciado | No se puede redistribuir | Los líderes ya tienen el recorrido descargado: moverles la patrulla abajo de los pies rompería la sincronización. |
| Elegir destino al mover | Una lista de botones, **no arrastrar** | Arrastrar con guantes en un celular no es una interacción confiable. |
| Validador de la pantalla | Corre **`validatePatrols`**, el mismo del servidor | Lo que se ve en vivo es lo que va a quedar registrado, no una aproximación. |

**Un bug real que encontró una mutación**

El borrador ordena los miembros por unidad y posición. Lo escribí con `localeCompare`, y **`derecha` va antes que `izquierda` en el abecedario** — al revés de la línea de tiro. La patrulla se mostraba con las posiciones invertidas.

Corregido usando el índice de `POSITIONS`, que es además la convención del proyecto: `text.ts` existe justamente para no depender de `localeCompare`. La regla ya estaba escrita y yo la rompí igual.

**Tres supuestos míos sobre el dominio, equivocados**

1. **Una unidad son 1 o 2 arqueros**, nunca 3. Varios tests míos armaban unidades de tres y el schema los rechazaba con otro error del que yo esperaba.
2. **`buildPatrols` empaqueta ajustado**, así que *vaciar* una patrulla que el algoritmo armó es inalcanzable con el tope de 4. Saqué ese test: probar un caso imposible no prueba nada. En su lugar se verifica que la cantidad de patrullas y sus credenciales no cambian.
3. Mover un arquero a otra patrulla **lo deja solo en la unidad `B`**, así que no ensucia la `A`. Para producir una unidad mixta hay que vaciarle un lugar primero. El test quedó documentando eso.

**Trece mutaciones, trece detectadas** — siete en el servicio, seis en el frontend.

**658 tests en el repo.**

**Próximo:** `FE-14` (detalle y seguimiento del torneo) y `FE-15` (publicar), que cierran WAFA.

---

## 2026-08-11 · `FE-11` — Wizard de creación de torneo

**Autor:** Claude Opus 5 · **Estado:** completado

Los cuatro pasos: datos, recorrido, participantes, revisión.

**La lógica vive en `wizard.ts`, puro y sin React.** La pantalla sólo pinta. Es lo que permite probar las decisiones —renumerar, reponer flechas, avisar de la composición— sin pasar por clicks, y hace que los tests se lean.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Cambiar la modalidad de un blanco | **Repone las flechas del reglamento**, incluso pisando las que el admin tocó a mano | Quien pasa un blanco a 3D espera 2 flechas, no las 3 que traía de sala. Conservarlas dejaría un 3D de 6 flechas sin que nadie lo pidiera. |
| Agregar, eliminar y mover | **Renumeran de 1 a N** | El backend exige índices contiguos: un hueco se rechazaría recién al confirmar, después de cargar todo. |
| Mover en los extremos | No hace nada, **no envuelve** | Envolver sorprende: el admin está mirando una lista, no un anillo. |
| Aviso de la regla de escuela | Corre **`buildPatrols`**, el mismo algoritmo del servidor | Una heurística adivinaría. Esto es el resultado real, y puede decir **quiénes** quedarían sin patrulla. |
| Error vs aviso | El error frena, el aviso no | Un error lo rechazaría el servidor igual, y es mejor decirlo antes. Un aviso es información: el admin puede saber algo que el algoritmo no. |
| Arquero nuevo | Se crea **dentro** del wizard | Mandarlo al padrón y de vuelta le haría perder todo lo cargado. |
| Revisión | Se vuelve a cualquier paso sin perder nada | El admin arma el recorrido en el club, con gente alrededor, y se equivoca. Rehacer todo por un blanco mal cargado no es una opción. |

**Una regla del dominio que es más sutil de lo que parece**

Un test mío daba por sentado que **3 de escuela y 2 seniors** alcanzaba. No alcanza: se cuentan **unidades**, no cabezas. Tres de escuela forman **dos** unidades —una de a dos y un solitario— mientras que dos razo forman **una sola**. Una unidad de escuela queda sin senior aunque «haya seniors».

El código tenía razón; el test estaba mal. Quedó como caso explícito, porque es exactamente el tipo de cuenta que un admin va a hacer mal parado en el club.

**Seis mutaciones, seis detectadas.** Entre ellas: que cambiar la modalidad no reponga las flechas, que no se renumere, que mover en el extremo envuelva y que el paso 3 nunca frene.

**Se dejó afuera `FE-13`, a propósito**

La edición manual de patrullas **necesita un endpoint que no existe**: `PatrolDistributionSchema` está escrito en `@bal/shared` pero ninguna ruta lo consume. Hace falta un `PUT /admin/tournaments/:id/patrols` transaccional, permitido sólo en `sin_iniciar`. Hacer la pantalla sin eso sería un validador en vivo que no puede guardar nada.

Quedó anotado en la tarea. Al crear un torneo, por ahora se vuelve al inicio, donde aparece en «Sin iniciar».

**614 tests en el repo.**

---

## 2026-08-11 · `FE-4`, `FE-9`, `FE-10`, `FE-12` — El shell, y WAFA empieza

**Autor:** Claude Opus 5 · **Estado:** completado

**Hasta hoy la app no era alcanzable.** `App.tsx` seguía siendo el scaffold de `INF-2`: las pantallas de WAFL existían y estaban testeadas, pero nada las componía. Esta entrada arma el shell y con eso las dos aplicaciones se pueden abrir.

**Un error de contabilidad que corregí**

`FE-5`, `FE-7` y `FE-8` figuraban como pendientes en `ACTION_PLAN.md` **aunque el trabajo estaba hecho y mergeado** (PR #16). El script que las tenía que marcar en la sesión anterior no las tocó, y yo reporté que sí. Quedaron marcadas ahora, con su nota de lo entregado.

En la misma revisión apareció que **`FE-4` estaba a medias**: se había hecho `sesion.ts` —login, descarga del bundle, entrada sin conexión— pero no la pantalla. Se completó acá.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Navegación de WAFL | **Estado local, no rutas** | El recorrido es lineal y el botón Atrás del navegador no debería poder sacar al líder del medio de una carga. |
| Navegación de WAFA | Rutas, con `basename: '/app'` | El admin sí navega en cualquier orden, y quiere poder compartir un link. |
| Guarda de `mustChangePassword` | **Un solo lugar**: con el cambio pendiente, las demás rutas ni se montan | Repartir el chequeo por pantalla garantiza que alguna se lo olvide. Verificado entrando directo a `/wafa/arqueros`. |
| Torneos en el login de WAFL | Sólo los `en_proceso` | Ofrecer uno publicado sería mandar al líder a un rechazo del servidor. |
| Antigüedad del bundle guardado | En palabras («hace 5 horas») | Una fecha obliga a calcular. Nadie hace esa cuenta con guantes y al sol. |
| Grupos vacíos en la home | **Dicen que están vacíos** | Si el grupo desaparece, no se distingue «no hay» de «no cargó». |
| Búsqueda de arqueros | Contra el servidor | Filtrar en el cliente sólo encontraría lo ya descargado, y el padrón viene topeado a 500. |

**Un cambio de backend que pidió el frontend**

El DoD de `FE-12` exige que Eliminar aparezca deshabilitado **con explicación** si el arquero participó de un torneo. La API no lo decía: sólo se podía descubrir fallando al apretar el botón.

Se agregó `participated` a la vista de arquero, resuelto con **una sola consulta** (`distinct` sobre los ids del listado) en vez de una por arquero. Con eso la pantalla explica antes en vez de fallar después, y ofrece archivar, que es lo que sí sirve.

**Un botón gris sin motivo es una pared, no una respuesta.** Vale como criterio general para el resto de WAFA.

**Un test mío estaba mal armado**

El primer intento montaba `WafaApp` en la raíz del `MemoryRouter`. En la app real va anidado bajo `/wafa/*`, así que las rutas internas no coincidían y el árbol renderizaba vacío. **El test estaba probando una estructura que en la app no existe**; corregido para montarlo anidado igual que `App.tsx`.

Es distinto de los dos casos anteriores: acá no fallaba el test *y* tenía razón el código, fallaba el andamio del test. Pero el aprendizaje es el mismo — un test que no reproduce cómo se usa el componente no prueba lo que dice probar.

**Y un test intermitente, que es peor que uno roto**

La suite de `@bal/app` fallaba **una de cada tres corridas**, siempre en el login de WAFL. La causa: el helper esperaba al `<select>` con `findByLabelText('Torneo')`, y el select **existe desde la primera pintada**. Elegir un valor cuya `<option>` todavía no cargó **no hace nada** y el formulario queda vacío, así que el botón sigue deshabilitado y el click no hace nada. Según cuánto tardara el fetch, el test pasaba o no.

Corregido esperando la **opción** en vez del select, y con un `expect` que verifica que el torneo quedó elegido antes de seguir. Seis corridas seguidas en verde.

Es el mismo modo de falla que el `waitFor` de `FE-8`, con otra cara: **esperar algo que ya está no es esperar**. Conviene revisarlo en el resto de los tests de UI de WAFA cuando se sigan sumando pantallas.

**Siete mutaciones, siete detectadas.** Entre ellas: que `mustChangePassword` deje pasar, que se pueda borrar a quien participó, que el torneo en proceso no vaya primero, que el PIN incompleto sea aceptado y que la API marque a todos como sin historial.

**Y el script de mutaciones dejó basura, otra vez.** Un `cp` mal armado copió los respaldos a `src/wafa/` en vez de `src/wafa/pages/`, y quedaron tres archivos duplicados. **Los tests no lo notaron** —importan desde `./pages/`— pero el `typecheck` sí. Es el segundo incidente del mismo tipo (ver la entrada de `BE-13`) y confirma la regla ya anotada: **typecheck antes que tests**, y revisar `git status` después de mutar.

**567 tests en el repo.**

**Próximo:** `FE-11` (el wizard de crear torneo) y `FE-13` (patrullas con validador en vivo), las dos pantallas más pesadas de WAFA.

---

## 2026-08-11 · `SH-6` — Estadísticas · y el lint que estaba roto en `main`

**Autor:** Claude Opus 5 · **Estado:** completado

Última tarea de dominio. `participantStats`, `tournamentStats`, `patrolProgress` y `archerCareerStats`. Con esto `@bal/shared` queda cerrado: **301 tests, 100 % de líneas, ramas y funciones**.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Mejor y peor blanco | Se comparan por **porcentaje** del techo de cada blanco | Un blanco 3D tiene techo 22 y uno de sala 30. Comparar brutos entre modalidades es el mismo error que comparar torneos entre sí, un nivel más abajo. |
| Mejor y peor torneo del arquero | Ídem, por `normalizedPct` | El bruto premia al recorrido más largo, no al mejor tiro. |
| Empates de porcentaje | Mejor = menor número de blanco; peor = mayor | Sin criterio, cuál gana dependería de por dónde arrancó la patrulla. |
| Evolución | En el orden en que se **tiró**, no por número de blanco | La patrulla que arranca en el 7 tiró el 7 primero. Ordenar por número contaría una historia que no pasó. |
| Distribución por anillo | **Por modalidad**, no agregada | Un `6` de campo es el máximo y un `6` de sala es mediocre. Sumarlos no significa nada. |
| Avance de una patrulla | El del arquero **más atrasado** | Un blanco no está listo hasta que lo cargaron todos. Es lo mismo que muestra WAFL en el circuito. |
| Ausentes | Fuera de todos los promedios | Su cero hundiría el promedio del torneo sin que nadie haya tirado mal. |
| Token inválido | **Revienta**, no vale 0 | El dato ya pasó por la validación del servidor: si acá aparece un token ajeno a la modalidad, es corrupción. Un total equivocado con cara de correcto es peor que un error. |

**Blanco parcial:** el máximo se calcula sobre las flechas **tiradas**, no sobre las que faltan. Si no, un recorrido a medias mostraría un porcentaje hundido que no dice nada del arquero.

**Un test mío estaba mal, otra vez**

El caso que probaba «mejor blanco por porcentaje» usaba `['11', '9']` para un blanco 3D. El 3D no tiene `9` —su set es `11 10 8 5 M`—, así que reventó por token inválido. **El código tenía razón y el test estaba mal**, igual que en `BE-13`. Vale como recordatorio de que un test que falla no siempre acusa al código.

**Nueve mutaciones, nueve detectadas.** Entre ellas: que la `X` deje de contar como diez, que mejor y peor se midan en bruto, que la distribución liste sólo lo que salió, que el acumulado no acumule, y que un token corrupto valga 0 en silencio.

Una fue inválida en el primer intento: usaba un identificador sin importar, así que rompía por `ReferenceError` en 13 tests en vez de por la mutación. Se rehizo con una expresión que compila. **Una mutación que no compila no prueba nada.**

---

**Hallazgo aparte: `pnpm lint` estaba fallando en `main`.**

No lo introdujo esta tarea; se verificó guardando los cambios y corriendo el lint sobre `main` limpio. Eran **dos errores de parseo**, no de estilo: Biome no entiende la sintaxis de Tailwind 4 (`@theme`, `@import 'tailwindcss'`) salvo que se la habilite. Faltaba configuración desde `FE-3`.

Se agregó `css.parser.tailwindDirectives` y, para que el CSS no se reformatee a comillas dobles, `css.formatter.quoteStyle: 'single'`.

Se pasó por alto porque **`INF-5` (CI) todavía no está hecho**: nada bloquea un merge con el lint roto. Es el argumento más concreto a favor de subirle la prioridad.

Al habilitarse el parseo aparecieron avisos nuevos. El del `!important` en el bloque de `prefers-reduced-motion` **es un falso positivo**: ese `!important` es justamente el punto —tiene que ganarle a cualquier animación declarada después, incluidas las utilidades de Tailwind—. Se suprimió con el motivo escrito al lado.

**Deuda técnica abierta**

| Qué | Dónde | Nota |
|---|---|---|
| 5 avisos de `useOptionalChain` | guardas de `auth.ts`, `syncService.ts`, `waflService.ts` | La forma explícita (`!sesion \|\| sesion.subject.type !== 'admin'`) dice la intención mejor que la cadena opcional, y son guardas de autorización. Decidir en `BE-14`: aplicar el cambio o apagar la regla para las guardas. |
| 1 aviso de complejidad | `syncWorker.ts` `flush()` | Refactorizar el camino crítico de sincronización por un aviso de lint no se justifica ahora. Revisar en `TEST-1`, con el E2E offline andando de red. |

**Estado del proyecto:** `@bal/shared` y el backend completos, WAFL completa. **528 tests en el repo.** Falta WAFA, la landing, el E2E offline y el deploy.

**Próximo:** WAFA (`FE-9`..`FE-16`).

---

## 2026-08-10 · `FE-4`, `FE-5`, `FE-7` y `FE-8` — WAFL completa

**Autor:** Claude Opus 5 · **Estado:** completado

**La app crítica queda terminada**: entrar → recorrer → anotar sin señal → ver resultados → firmar → cerrar.

`sesion.ts`, `CircuitPage`, `ResultsPage` y `SignaturePad`.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Entrar sin conexión | Sólo si el bundle guardado es **del mismo torneo** | Los datos de otro torneo no sirven, y usarlos sería peor que no entrar. |
| Puntajes del servidor al entrar | Se siembran, pero **no pisan** lo local pendiente | Un puntaje pendiente es más nuevo que lo que el servidor conoce. Cubre el caso del líder que cambia de dispositivo. |
| `logout` | Borra todo lo local **aunque falle la red** | Un celular prestado no puede quedarse con los datos sólo porque no había señal. |
| Almacenamiento persistente | Se pide al entrar | Sin eso el navegador puede desalojar IndexedDB bajo presión de espacio — a mitad del torneo. Ver [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §11. |
| Blanco completo | Sólo cuando **todos** los arqueros lo cargaron | Un blanco con la mitad de la patrulla no está listo. |
| Firma | El puntaje va **arriba del canvas** | Nadie firma algo que no está viendo. |
| Cierre sin señal | No cierra, y aclara *"tus puntajes ya están guardados en el celular"* | El líder no puede quedarse con la duda de si perdió el trabajo. |

**Una mutación que reveló un test que pasaba antes de tiempo**

De cinco mutaciones, cuatro se detectaron. La que sobrevivió —marcar un blanco como completo con un solo arquero— pasaba porque el `waitFor` que esperaba *"3 Pendiente"* **se cumplía con el estado inicial vacío**, antes de que los puntajes cargaran desde IndexedDB.

Es un modo de falla sutil: `waitFor` tiene éxito en el primer chequeo si la condición ya se cumple por accidente. Corregido esperando al **contador** (`0 de 3 blancos`), que sólo llega a su valor real después de cargar y distingue los dos casos.

**Tests**

64 tests en `@bal/app` (18 nuevos).

Cubren, entre otros: que el bundle de otro torneo no se reusa · que el logout limpia con la red caída · el orden de los blancos desde el de inicio · que Resultados finales se bloquea hasta completar el recorrido · que el cierre nombra a quienes faltan firmar · que con ops pendientes no cierra y lo explica · que no se puede confirmar una firma sin trazo.

**Estado del proyecto:** backend completo y WAFL completa. Falta WAFA (`FE-9`..`FE-16`), la landing (`FE-17`..`FE-20`), el E2E con tramo offline (`TEST-1`) y el deploy (`INF-3`..`INF-5`).

**Próximo:** `TEST-1` —el E2E que ata todo— o arrancar WAFA.

---

## 2026-08-10 · `FE-3` y `FE-6` — Infraestructura y teclado de scoring

**Autor:** Claude Opus 5 · **Estado:** completado

`lib/apiClient.ts`, `components/ui.tsx`, y la pantalla donde de verdad se anota: `ScoreKeypad`, `ArrowRow`, `SyncBadge` y `TargetPage`.

### 🐛 Bug encontrado: dos toques rápidos perdían una flecha

El handler leía las flechas ya cargadas del **estado de React**. Dos toques seguidos —que es exactamente cómo se anota con guantes— se disparan antes de que React re-renderice, así que el segundo leía un valor obsoleto y **pisaba al primero**.

Lo detectó el test que carga dos flechas seguidas: esperaba 19 y daba 8.

Corregido con dos cambios: cada escritura **lee de IndexedDB**, que es la fuente de verdad, y las escrituras se **encadenan en una cola** para que dos toques simultáneos no se solapen.

Es el tipo de bug que no aparece probando a mano en el escritorio y sí el día del torneo, con alguien apurado.

### 🔧 Problema de diseño: la carga es incremental

`validateTargetScore` valida un blanco **completo**, así que cargar la primera de dos flechas fallaba con `ARROW_COUNT`.

Resuelto separando dos cosas que se habían mezclado:

- **Un blanco a medias es un estado legítimo** y se guarda en IndexedDB igual, para que nada se pierda si se apaga el celular a mitad del blanco. Cada token se valida contra la modalidad; sólo no se valida la cantidad.
- **La op se encola recién cuando el blanco está completo.** Un blanco a medias todavía no es un puntaje, y el servidor lo rechazaría con `ARROW_COUNT`.

### Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| Teclas | 56px, con el número **literal** en el test | Comparar contra la constante haría que bajarla cambie los dos lados de la aserción. Ver abajo. |
| Disposición | Arcos para 3D y campo, grilla para sala y aire libre | 3D y campo tienen 5 y 8 tokens, que mapean 1:1 con los anillos de la cara real. Sala y aire libre tienen 12: no caben en anillos legibles. |
| Prop `disposicion` | Permite forzar cualquiera de las dos | La disposición en arcos es **una apuesta sin validar**. Si en la prueba de campo no le gana a la grilla, se cambia el default y listo. |
| Teclas al completar | Se **deshabilitan**, no se ignoran | Un botón que parece activo y no hace nada es peor que uno apagado. |
| Continuar | Dice **quién** falta, no sólo que falta alguien | `Falta cargar: Pérez, Gómez`. |
| `StakeChip` | Color **y** nombre, siempre juntos | Un daltónico lee "Azul"; el resto ve el color. Ninguno depende del otro. |

### Dos tests débiles más, encontrados por mutación

De cuatro mutaciones, dos sobrevivieron. Otra vez, **el problema era el test**:

1. **"Teclas de 44px en vez de 56"** sobrevivía porque la aserción comparaba contra `TAMAÑO_TECLA_PX` — la misma constante que la mutación cambiaba. **Un test tautológico.** Ahora el 56 va literal, más un test que verifica que la constante no bajó.

2. **"El teclado no se deshabilita"** sobrevivía porque el botón ya tenía `disabled`, así que el click no llegaba igual. Ahora se afirma explícitamente que **todas** las teclas quedan deshabilitadas.

**Tests**

46 tests en `@bal/app` (22 nuevos). Cubren: que el teclado ofrece los tokens de la modalidad **de ese blanco**, los 56px sobre el estilo computado, el guardado instantáneo sin botón de guardar, que guarda con `onLine === false`, el paso automático al siguiente arquero, el orden descendente de las flechas, y que Continuar nombra a los que faltan.

**Próximo:** `FE-4` (login de WAFL), `FE-5` (home del circuito), `FE-7`/`FE-8` (resultados y firma).

---

## 2026-08-10 · `FE-1` y `FE-2` — PWA y capa offline

**Autor:** Claude Opus 5 · **Estado:** completado

`FE-2` es el equivalente de `BE-10` del lado del cliente: donde vive la regla de que **la red nunca esté en el camino crítico de anotar un puntaje**.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| `registerType` | **`prompt`**, nunca `autoUpdate` | `autoUpdate` recarga la app sola al detectar una versión nueva. A mitad de recorrido el líder pierde el contexto de lo que estaba anotando. |
| Runtime caching | `/api/wafl/sync` **excluido** | Cachear una escritura no tiene sentido y podría enmascarar fallos. |
| Escritura | Puntaje **y** op en **una sola transacción de IndexedDB** | Nunca queda un puntaje guardado sin su op, ni al revés. |
| Validación | En el cliente **antes** de encolar | Un token inválido no tiene por qué viajar al servidor para que lo rechace. El servidor valida igual: es la autoridad. |
| Total mostrado | Se calcula local, y el del servidor **lo pisa** al sincronizar | Ambos usan la misma función de `@bal/shared`, así que coinciden. Si alguna vez difieren, gana el servidor. |
| Error de red o 401 | **Nunca** descartan ops | Es el antipatrón número uno de [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §12: se pierde trabajo del usuario por un problema de sesión. |
| Cierre del circuito | Bloqueado si hay ops pendientes | Cerrar con puntajes sin enviar dejaría al servidor rechazando por datos incompletos. |
| `nudge()` | No se llama con `await` desde la UI | El puntaje ya está guardado; sincronizar es de fondo. |

**Un problema de infraestructura de tests que vale anotar**

Los primeros 23 tests daban timeout a los 10 segundos, todos. La causa: `indexedDB.deleteDatabase()` **se queda bloqueado indefinidamente** mientras haya una conexión abierta — sin error, sin timeout, sin nada.

Se agregó `closeDb()` y un `deleteDb()` que cierra antes de borrar. Y el test que simula "se cierra la app a mitad" ahora usa `closeDb()` en vez de sólo olvidar la referencia cacheada, que además es la simulación honesta de lo que pasa de verdad.

**Dos tests débiles que las mutaciones revelaron**

De cinco mutaciones probadas, tres se detectaron de entrada. Las otras dos **sobrevivieron, y en ambos casos el problema era el test, no el código**:

1. **"No aplica el total del servidor"** sobrevivía porque el mock devolvía **el mismo** total que el cliente había calculado. No probaba nada. Corregido: ahora el mock responde `777` y el test exige que ese valor gane sobre el `19` local.

2. **"El uuid no lleva timestamp"** sobrevivía porque la aserción sólo comparaba dos uuid consecutivos, y con un byte alterado el orden se mantenía igual. Corregido: se agregó un test que **decodifica los primeros 48 bits** y verifica que sean el momento de creación.

Es exactamente para lo que sirve la prueba de mutación: un test verde que no detecta el bug es peor que no tener test, porque da confianza falsa.

**Tests**

24 tests en `@bal/app`. Cubren los escenarios obligatorios de [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §10: recorrido completo con `onLine === false`, cerrar y reabrir la app sin perder nada, error de red que no descarta ops, 401 que tampoco, op rechazada que marca el puntaje en conflicto, y cierre bloqueado con pendientes.

**Próximo:** `FE-3` (infraestructura de frontend), `FE-4`/`FE-5` (login y home de WAFL) y `FE-6` — el teclado de scoring.

---

## 2026-08-10 · `BE-6`, `BE-7`, `BE-11`, `BE-12` y `BE-13` — Ciclo completo del torneo

**Autor:** Claude Opus 5 · **Estado:** completado

Con esto **el backend queda terminado**: crear → iniciar → anotar sin señal → sincronizar → firmar → cerrar → publicar → ver en la landing.

`tournamentEditService`, `patrolAdminService`, `publishService`, `standingRepo` y `routes/publico.ts`.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Publicar | **Recalcula la temporada desde cero**, no suma el delta | Hace que publicar sea idempotente y que despublicar sea exacto: no hay forma de que un doble click aplique los puntos dos veces ni de que revertir deje residuos. El costo es recorrer los torneos de la temporada, que son doce por año. |
| Orden del recálculo | Cronológico | `bestNormalizedPct` se queda con el mejor, pero `bestTournamentId` tiene que apuntar al **primero** que lo logró. |
| Transiciones de estado | El `updateOne` filtra **también por el estado actual** | Si otra request lo cambió entre la lectura y la escritura, no se pisa. Es lo que evita que dos clicks simultáneos en "publicar" apliquen los puntos dos veces. |
| Blanco bloqueado | Tiene que seguir existiendo **y ser idéntico** | No alcanza con que exista: cambiarle la modalidad o las flechas invalidaría puntajes ya firmados. |
| PIN tras publicar | Deja de exponerse | Una vez publicado el torneo la credencial no sirve para nada; no hay motivo para seguir mostrándola. |
| Torneo `completado` sin publicar | **No visible** desde la landing | Todavía no es oficial. Sólo se ven `en_proceso` (sin puntajes) y `publicado` (completo). |

**Un bug propio que encontraron los tests**

El desbloqueo de firma guardaba `scorecardHash: ''`. El cierre compara ese hash contra el actual para detectar que el puntaje haya cambiado después de firmarse, así que el desbloqueo **hacía imposible cerrar**: siempre daba `SIGNATURE_MISMATCH`.

Corregido calculando el mismo hash que en una firma real. El desbloqueo autoriza cerrar sin el trazo, pero **no renuncia** a detectar que el puntaje cambie después.

Aprovechando el arreglo, la función que calcula el hash se movió a `scoreRepo`: la usan **dos** caminos —firmar desde WAFL y desbloquear desde WAFA— y dos implementaciones que tienen que dar el mismo resultado son un bug esperando a pasar.

**Un error mío en un test, que resultó ser comportamiento correcto**

El test de publicación esperaba `[5, 4]` y salía `[5, 5]`. Los dos arqueros del escenario tiraban exactamente lo mismo, así que **empatan**, y el puesto compartido reparte los puntos de esa posición a los dos. El código estaba bien; el test estaba mal.

Se corrigió el escenario para que tiren distinto **y** se agregó un test explícito del empate, que es la regla que más fácil se rompe.

**Tests**

163 tests en `@bal/api` (27 nuevos).

Los que más importan: **un torneo sin publicar nunca expone puntajes**, verificado en los tres estados previos (`sin_iniciar` → 404, `en_proceso` → sin `results`, `completado` → 404) · **publicar dos veces no duplica** · **despublicar revierte del todo** · `TARGET_LOCKED` con el índice del blanco en el error · regenerar el PIN invalida la sesión activa.

**Cinco mutaciones probadas, las cinco detectadas:**

| Mutación | Tests que fallan |
|---|---|
| No bloquea blancos con puntajes | 1 |
| Despublicar no excluye el torneo (quedarían residuos) | 1 |
| La landing expone resultados de torneos sin publicar | 1 |
| Regenerar PIN no invalida sesiones | 1 |
| El PIN se muestra aun con el torneo publicado | 1 |

**Backend terminado.** Lo próximo es el frontend: `FE-1` (bootstrap PWA) y sobre todo **`FE-2`** (capa offline con IndexedDB y outbox), que es el equivalente de `BE-10` del lado del cliente.

---

## 2026-08-10 · `BE-8`, `BE-9` y `BE-10` — WAFL: login, bundle y sincronización

**Autor:** Claude Opus 5 · **Estado:** completado

El tramo que habilita la app crítica. `patrolRepo`, `scoreRepo`, `patrolAuthService`, `waflService`, `syncService`, `tournamentStateService` y `routes/wafl.ts`.

### 🔎 Hallazgo: en Mongo, un `E11000` dentro de una transacción la aborta

El diseño original ponía el dedup **dentro** de la transacción: insertar en `syncOps` con `_id = opId` y capturar el error de clave duplicada. **No funciona.** En MongoDB, un error de escritura dentro de una transacción la aborta, y capturarlo en JavaScript no la revive: las operaciones siguientes fallan.

Reestructurado así:

1. **Dedup fuera de la transacción** — un `insert` suelto contra el índice único. Atómico, sin ventana entre comprobar y escribir.
2. **Escrituras dentro de la transacción.**
3. **Si algo falla, se borra la marca** para que el reintento del cliente vuelva a entrar.

**Riesgo residual, asumido y documentado:** si el proceso muere entre la marca y el commit, la op queda marcada sin haberse aplicado y el reintento la ve como duplicada. La ventana es de milisegundos y el costo es un puntaje: el líder lo ve faltante en la pantalla de resultados y lo vuelve a cargar, lo que genera un `opId` nuevo. Está explicado en el encabezado de `procesarOp`.

### Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| Autorización | **Dentro del loop, por op** | Un batch puede traer 200 y cualquiera podría apuntar a un participante ajeno. Verificar sólo al abrir la sesión no alcanza. Es lo que impide el IDOR entre patrullas. |
| Validación de tokens | Contra la modalidad **del blanco, leída del torneo en base** | Nunca contra lo que diga el cliente. Un `11` es válido en 3D e inválido en sala del mismo torneo. |
| LWW | Gana el `clientUpdatedAt` mayor; a igualdad, el `opId` mayor | El desempate por `opId` hace el resultado determinista ante relojes idénticos. |
| Rollups | Delta que **descuenta lo que había** | Editar un blanco no puede sumar dos veces. Hay test. |
| Una transacción **por op** | No una por batch | Una op inválida no puede revertir las que ya se aplicaron correctamente en el mismo batch. |
| Op rechazada | Queda registrada como `rejected` | Un reenvío con el mismo `opId` responde `duplicate`, no se reprocesa. |
| Firmas | Se verifican los **magic bytes** del PNG | El prefijo `data:image/png;base64,` es texto que el cliente elige. Hay test con un `<script>` disfrazado. |
| Credencial de patrulla | Sólo vale con el torneo `en_proceso` | Antes no hay nada que anotar; después los puntajes están cerrados. |

### Tests

136 tests en `@bal/api` (30 nuevos).

Los que más importan:

- **Idempotencia**: el mismo batch enviado dos veces deja **un** puntaje, no dos, y el total del participante no se duplica.
- **IDOR**: una op de un participante de otra patrulla se rechaza; y en un **batch mixto** se aplican las propias y se rechazan las ajenas.
- **LWW**: una op más vieja no pisa a una más nueva, y devuelve el valor vigente.
- **Editar**: cargar dos veces el mismo blanco deja `targetsCompleted: 1`, no 2.
- **El batch nunca falla entero**: un batch con una op válida, una inválida y un `close` rechazado responde 200 y **aplica la válida**.
- **200 ops de golpe** no caen en rate limit.

### Seis mutaciones probadas, las seis detectadas

| Mutación | Tests que fallan |
|---|---|
| Sin dedup (el reenvío duplica) | 2 |
| Sin autorización por op (IDOR entre patrullas) | 2 |
| LWW invertido (lo viejo pisa lo nuevo) | 3 |
| El delta no descuenta lo anterior (editar suma dos veces) | 1 |
| La firma no verifica magic bytes | 1 |
| La credencial de patrulla vale en cualquier estado | 2 |

**Nota:** `BE-6` (estados del torneo) quedó **parcial**: se implementó `tournamentStateService` con la matriz de transiciones y el `start`, porque el login de patrulla lo necesitaba. Falta el bloqueo de edición de blancos con puntajes (`TARGET_LOCKED`).

**Próximo:** `BE-11` (firmas y cierre desde WAFA), `BE-12` (publicar) o arrancar el frontend con `FE-1`/`FE-2`.

---

## 2026-08-10 · `BE-4` y `BE-5` — Padrón, temporadas y creación de torneos

**Autor:** Claude Opus 5 · **Estado:** completado

Van juntas porque `BE-5` no se puede probar sin un padrón: crear un torneo necesita arqueros y una temporada que existan.

`repositories/{archerRepo,seasonRepo,tournamentRepo,auditRepo}.ts`, `services/{archerService,tournamentService}.ts`, `lib/ids.ts` y `routes/admin.ts`.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| `lib/ids.ts` | Un único `toObjectId` que valida con Zod antes de construir | Nunca se construye un `ObjectId` con un valor del request sin validarlo: un objeto en lugar de un string se convierte en un operador de Mongo. |
| Id malformado | Responde **404**, no 400 | Un id malformado y uno inexistente no se distinguen, así no se puede sondear qué existe probando. |
| Búsqueda de arqueros | Se **escapan los metacaracteres** del término antes de armar el `$regex` | El término viene del usuario. Sin escapar, `.*` hace match con todo y un patrón como `(a+)+$` es un ReDoS. Hay test. |
| Hashear los PIN | **Fuera** de la transacción | Hashear seis PIN con argon2id tarda cientos de milisegundos; mantener la transacción abierta ese tiempo sostiene locks sin necesidad. Los documentos se arman antes y la transacción sólo inserta. |
| `buildPatrols` | También fuera de la transacción | Es puro y determinista. Si la transacción se reintenta, no tiene sentido recalcularlo. |
| Arqueros archivados | No se pueden inscribir | Archivar significa "no incluir en torneos futuros". Ver [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.4. |
| `unassigned` en la respuesta | Los arqueros que el armado no pudo ubicar vuelven **con nombre y apellido** | El admin tiene que poder actuar sobre ellos sin ir a buscarlos. |

**La `ClientSession` es el detalle que decide si hay transacción o no**

Las funciones de `tournamentRepo` reciben la sesión de forma explícita. **Si no se la pasa, la escritura queda fuera de la transacción** y el rollback no la alcanza — el driver no avisa. Es el error más fácil de cometer con Mongo, así que está documentado en el encabezado del repositorio y cubierto por la mutación M1.

**Tests**

106 tests en `@bal/api` (23 nuevos).

El de más valor es el de **rollback**: inyecta un fallo en `insertParticipants` y verifica que no quede **ni torneo, ni patrullas, ni participantes**. Sin transacción quedaría un torneo con patrullas y sin participantes, que es exactamente el estado imposible de diagnosticar después.

También cubierto: `maxPossibleScore` = **330** en el caso de referencia del brief · que el snapshot congela el nombre y la categoría (editar el arquero después no toca el histórico) · que el PIN descifrado coincide con el que verifica el hash · que el PIN no aparece en claro en ningún campo del documento · que con todos los participantes de escuela no se arma ninguna patrulla y los cuatro vuelven en `unassigned` · que el audit log no contiene nada sensible.

**Cuatro mutaciones probadas, las cuatro detectadas:**

| Mutación | Tests que fallan |
|---|---|
| Sin transacción (las escrituras no se revierten) | 1 |
| El PIN se guarda en claro | 3 |
| No se chequea si el arquero participó | 1 |
| Se permite inscribir arqueros archivados | 1 |

**Próximo:** `BE-6` (estados del torneo) y `BE-7` (patrullas y credenciales), o directo a `BE-8`/`BE-9`/`BE-10` para habilitar la WAFL.

---

## 2026-08-10 · `BE-3` — Autenticación de admin

**Autor:** Claude Opus 5 · **Estado:** completado

`repositories/{userRepo,sessionRepo}.ts`, `lib/session.ts`, `middleware/auth.ts`, `services/authService.ts` y `routes/auth.ts`.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Login timing-safe | Si el usuario no existe, se compara igual contra un hash de referencia | Sin eso, un login contra una cuenta inexistente responde en microsegundos y uno contra una real tarda lo que tarda argon2id. Esa diferencia permite **enumerar cuentas midiendo el tiempo**. |
| Mensaje de error | El **mismo** para usuario inexistente y para password incorrecto | Hay un test que compara los dos cuerpos de respuesta byte a byte. |
| Bloqueo por intentos | 5 fallidos → 15 minutos, y el 6º falla **aun con el password correcto** | Si el bloqueo se levantara al acertar, no serviría de nada contra fuerza bruta. |
| Contador de intentos | Se incrementa con `findOneAndUpdate` atómico | Dos intentos simultáneos no pueden pisarse el contador. |
| `mustChangePassword` | Bloquea con **403** toda ruta protegida salvo el propio cambio de password | El password con el que se hizo el deploy no puede quedar como password permanente. El 403 lleva `details.mustChangePassword` para que el frontend sepa a dónde redirigir. |
| Cambiar el password | Invalida **todas** las sesiones y abre una nueva para quien lo cambió | Si el motivo del cambio es que el password se filtró, dejar vivas las sesiones abiertas no arregla nada. Quien cambió acaba de demostrar que conoce el password, así que su sesión se renueva. |
| Logout | Borra la sesión **en la base**, no sólo la cookie | Si el token se filtró, borrar la cookie del navegador no sirve. |
| Filtro por `expiresAt` al leer la sesión | Explícito, además del índice TTL | Mongo barre los vencidos cada ~60 segundos: entre el vencimiento y el barrido la sesión todavía existe en la colección. Hay test. |

**Tests**

83 tests en `@bal/api` (27 nuevos).

El que más valor tiene es el de **timing**: no verifica por inspección que exista el hash de referencia, sino que **mide** el tiempo de un login contra un usuario existente y contra uno inexistente y exige que sean del mismo orden. Descarta la primera medición, que incluye el cálculo del hash de referencia.

También cubierto: que en la base se guarda `sha256(token)` y nunca el token, que la cookie es `HttpOnly` y `SameSite=Lax`, que una cookie inventada no autentica, y que una sesión vencida no autentica aunque siga en la colección.

**Seis mutaciones probadas, las seis detectadas:**

| Mutación | Tests que fallan |
|---|---|
| Sin hash de referencia (enumeración por tiempo) | 1 |
| Logout no invalida en la base | 1 |
| Se guarda el token en claro en vez del `sha256` | 12 |
| No se filtra por `expiresAt` al leer la sesión | 1 |
| `mustChangePassword` no bloquea | 2 |
| Cambiar el password no invalida las otras sesiones | 2 |

**Nota de proceso:** una de las mutaciones tocó un archivo **nuevo, todavía no trackeado por git**, así que `git checkout` no la revirtió y quedó aplicada. Se detectó al verificar. De acá en adelante, en las pruebas de mutación conviene revertir desde una copia propia, no confiar en git para archivos sin commitear.

**Próximo:** `BE-5` — crear torneo, transaccional. Ya tiene todas sus dependencias listas.

---

## 2026-08-10 · `SH-7` — Schemas Zod compartidos

**Autor:** Claude Opus 5 · **Estado:** completado

`schemas.ts` con los contratos de entrada de auth, padrón, temporadas, torneo, patrullas y sincronización. Todos `z.strictObject`. Con esto el dominio queda cerrado salvo `SH-6` (estadísticas).

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Tokens de flecha | **No** se validan contra una lista fija; sólo se acota la forma (1-2 caracteres) | El set válido depende de la modalidad **de ese blanco**, que el servidor lee del torneo en base. Validarlos acá obligaría a aceptar la unión de las cuatro modalidades, que es más laxo que lo correcto. Ver [`DOMAIN_WA.md`](DOMAIN_WA.md) §7. |
| Tope en el password | 128 caracteres | argon2id sobre un input enorme cuesta caro: sin tope es un vector de DoS barato. |
| Mínimo de arqueros al crear torneo | 2 | Con menos no se puede armar ni una patrulla (`H1`). |
| Índices de blancos | Se exige que sean **contiguos desde 1**, sin huecos ni repetidos | `scores` referencia el blanco por su índice; un hueco rompería la correspondencia. |
| `PatrolDistributionSchema` | Valida la **forma**, no las restricciones `H1`..`H4` | Esas las verifica `validatePatrols`, que informa sin bloquear porque el admin puede tener motivos para una excepción. Ver [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.6. |
| `stakeMap` y `distances` | Escritos explícitos, no generados desde `STAKES` | Las tres estacas son semántica fija del dominio; el schema se lee de un vistazo. Además, generarlos con `Object.fromEntries` y un cast fue justamente lo que rompió (ver abajo). |

**Bug propio, y la lección de proceso**

Al escribir `schemas.ts` importé `MIN_PATROL_SIZE` y `MAX_PATROL_SIZE` desde `constants.ts`, pero vivían en `patrolling.ts`. En runtime llegaban como `undefined`, así que `z.array(...).min(undefined)` producía un issue con `minimum` indefinido y **Zod explotaba al formatear el mensaje de error**: `TypeError: Cannot read properties of undefined (reading 'toString')`. Un error críptico, a tres capas de distancia de la causa.

`tsc` lo habría marcado de inmediato. El problema fue de proceso: corrí los tests antes que el typecheck. **De acá en adelante, typecheck antes de tests** cuando se agregan imports nuevos.

Aprovechando el arreglo, `MIN_PATROL_SIZE` y `MAX_PATROL_SIZE` se movieron a `constants.ts`, que es donde viven el resto de las constantes de dominio. `patrolling.ts` las importa de ahí.

**Tests**

272 tests en el paquete (68 nuevos). **Cobertura 100%** en las cuatro métricas.

El bloque que más importa es el de **inyección NoSQL**: los cuatro schemas que reciben identificadores o nombres rechazan `{ $ne: null }`, y un `$where` no puede colarse como propiedad extra. Sin eso, un operador de Mongo llegaría a un filtro y devolvería el primer documento que encuentre.

También se cubrió: `SyncBatchSchema` acepta 200 ops de golpe —una patrulla que vuelve de tres horas sin señal manda cientos— y rechaza `opId` repetidos dentro del mismo batch.

**Verificación adicional del DoD:** se comprobó que los tres paquetes (`@bal/api`, `@bal/app`, `@bal/landing`) importan los schemas **desde el build**, no desde el fuente, ejecutando un script en cada uno.

**Próximo:** `BE-3` — autenticación de admin.

---

## 2026-08-10 · `SH-4` y `SH-5` — Ranking de torneo y liga

**Autor:** Claude Opus 5 · **Estado:** completado

`ranking.ts`, `league.ts` y `text.ts`. TDD. Van juntas porque `BE-12` (publicar) necesita las dos, y la liga se apoya en el ranking por categoría.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| `text.ts` extraído | Comparación determinista sin `localeCompare`, compartida | `patrolling.ts` ya la tenía, y `ranking.ts` y `league.ts` la necesitaban igual. Tres copias de la misma regla es una de más. |
| Puesto compartido | Una función `asignarPosiciones` que usan ranking y liga | La regla es idéntica en los dos, y es sutil: quien empata hereda la posición del anterior, y el siguiente salta. Tenerla en un solo lugar evita que se implemente distinto en cada uno. |
| Detección de empate | Comparando con los **vecinos**, no contando por posición | La lista está ordenada, así que los que comparten puesto son contiguos. Elimina un `Map` y dos ramas muertas que `noUncheckedIndexedAccess` obligaba a escribir. |
| Participantes `ausente` | Quedan afuera del podio | No puntúan ni entran al ranking. Ver [`FUNCTIONAL.md`](FUNCTIONAL.md) §10. |
| Clave del acumulado | `archerId + categoría`, no sólo `archerId` | Un arquero podría cambiar de categoría entre temporadas, y cada categoría tiene su propio ranking. |
| `notYetEligible` | A los que les faltan torneos se los devuelve **aparte**, no se los descarta | Ocultarlos haría creer que se perdió su resultado. Ver [`FUNCTIONAL.md`](FUNCTIONAL.md) §5.2. |
| `normalizedPct` | Redondeado a dos decimales | Sin redondear, dos porcentajes que deberían empatar difieren por error de punto flotante y el desempate se decide por ruido. |

**Lo que más importa que esté bien**

El **puesto compartido** atraviesa las dos tareas y es la regla que más fácil se implementa mal:

- En el torneo: dos segundos, y el siguiente es **cuarto** — no tercero.
- En la liga: los dos empatados en el primer puesto se llevan **5 puntos cada uno**, y el siguiente queda tercero con **3** — no con 4.

Ambos casos tienen test explícito.

El **mejor puntaje de la temporada se compara por porcentaje, no por bruto**. Hay un test que lo fija con un caso donde el orden se invierte: 200/250 (80%) supera a 240/400 (60%) aunque el bruto sea menor. Es exactamente el escenario que motivó la decisión D7.

**Tests**

204 tests en el paquete (52 nuevos). **Cobertura 100%** en líneas, ramas, funciones y sentencias.

Cinco mutaciones probadas, **las cinco detectadas**:

| Mutación | Tests que fallan |
|---|---|
| Desempate por menos `M` invertido | 2 |
| El puesto compartido no hereda posición (1,2,3,4 en vez de 1,2,2,4) | 16 |
| Mínimo de torneos bajado a 1 | 4 |
| El mejor puntaje se pisa siempre | 1 |
| `normalizedPct` sin redondeo | 1 |

**Próximo:** `BE-5` — crear torneo, transaccional.

---

## 2026-08-10 · `BE-2` — Base de Hono y middlewares de seguridad

**Autor:** Claude Opus 5 · **Estado:** completado

`app.ts`, `index.ts`, `lib/{errors,csrf}.ts`, `middleware/{error,security,csrf,rateLimit,validate,cache}.ts` y `routes/health.ts`.

### Hallazgo: en Hono los errores no se propagan hacia arriba

Se implementó el manejo de errores como middleware con `try { await next() } catch`. **No funciona.** Hono captura los errores del handler dentro de su `compose` y los convierte en respuesta sin propagarlos, así que el `catch` del middleware nunca los ve: todos los errores tipados salían como 500 genérico.

Se detectó porque 15 tests fallaron con `500` donde esperaban `403`, `409` o `400`. Se diagnosticó con un test aislado que confirmó que la variable capturada quedaba en `undefined`.

La forma correcta es `app.onError(handleError)`. Corregido y documentado en el encabezado de `app.ts` y de `middleware/error.ts`, para que no se vuelva a intentar.

### Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| Healthcheck sin rate limit | `/api/health` queda fuera del limitador | Railway lo consulta seguido. Bloquearlo daría de baja el servicio por su propio monitoreo. Hay un test que hace 200 llamadas seguidas y exige 200 en todas. |
| Rate limit de sync | Generoso a propósito (300/min por sesión) | Una patrulla que vuelve de tres horas sin señal manda cientos de operaciones de golpe y **nunca** debe ser rechazada. Ese endpoint está protegido por autenticación y autorización, no por el rate limit. Ver [`SECURITY.md`](SECURITY.md) §3.3. |
| Rate limit en memoria | Estado en el proceso, no en la base | Alcanza para el despliegue de un solo contenedor de [`ARCHITECTURE.md`](ARCHITECTURE.md) §3. **Queda anotado en el código**: si alguna vez se escala a varias instancias, hay que moverlo a Mongo o a Redis. |
| Cookie CSRF legible por JS | `httpOnly: false` a propósito | El frontend tiene que poder copiarla al header. Lo que protege no es el secreto de la cookie sino que un sitio de terceros no puede leerla. |
| Comparación de tokens CSRF | `timingSafeEqual`, con la diferencia de longitud resuelta antes | `timingSafeEqual` exige buffers del mismo tamaño. |
| `NOT_FOUND` para recursos ajenos | Un recurso que existe pero no es tuyo responde 404, no 403 | No se puede enumerar qué existe probando ids. Ver [`SECURITY.md`](SECURITY.md) §4. |
| Errores en producción | Sin stack, sin mensaje original; se loguea con `requestId` correlacionable | Un stack trace en una respuesta le regala al atacante el mapa del sistema. |

### Tests

56 tests en `@bal/api` (27 nuevos). Cubren la parte de esta capa del checklist de [`SECURITY.md`](SECURITY.md) §13:

- Mutación **sin** `x-csrf-token` → 403, en los cuatro verbos.
- Mutación con header que no coincide → 403.
- Todas las cabeceras de seguridad presentes, **también en las respuestas de error**.
- La CSP no permite `unsafe-inline` ni `unsafe-eval` en `script-src`, y sí permite `data:` y `blob:` en `img-src`, que hacen falta para las firmas.
- Sin HSTS fuera de producción.
- Un error inesperado devuelve 500 **sin stack** y con `requestId`.
- Rate limit corta con `Retry-After` y cuenta por IP.
- Zod `.strict()` rechaza propiedades extra **y** `{ $ne: null }` donde se espera un string.
- Body declarado más grande que 1 MB → 413.

**Total del repo: 208 tests verdes.**

**Próximo:** `BE-3` — autenticación de admin.

---

## 2026-08-10 · `BE-1` — Conexión, índices, seed y reconcile

**Autor:** Claude Opus 5 · **Estado:** completado

Base de datos del backend: `env.ts`, `db/{client,types,indexes,seed,reset,reconcile,cli}.ts` y `lib/crypto.ts`.

### 🐛 Bug latente encontrado y corregido

**El build de `@bal/shared` era incargable por Node.**

`tsc` con `moduleResolution: Bundler` emite los imports relativos **sin extensión**, y Node bajo ESM los rechaza. `import('@bal/shared')` fallaba con `ERR_MODULE_NOT_FOUND`. No se había notado porque hasta ahora nada importaba el dominio desde Node: los tests de `shared` corren sobre el código fuente con Vitest, y el scaffold del backend no lo usaba.

Habría explotado en `BE-5`, la primera vez que un servicio importara el dominio — o peor, recién en producción.

Corregido agregando `.js` explícito a los imports relativos de `shared/src`. Verificado con `node -e "import('@bal/shared')"` → 31 exports.

**Decisión relacionada:** el `tsconfig.json` de `@bal/api` anula el alias `paths` de `tsconfig.base.json` con `"paths": {}`. El backend tiene que resolver `@bal/shared` **como lo va a resolver Node en producción**: por los `exports` del paquete hacia `dist`. Apuntar al código fuente ocultaría exactamente esta clase de error de empaquetado. Como contrapartida, `pnpm typecheck` ahora construye `shared` primero.

### Otras decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| `env.ts` | Reúne **todos** los problemas de configuración y los reporta juntos | Quien está configurando un deploy no debería descubrirlos de a uno. |
| Producción | Rechaza explícitamente los valores de desarrollo del `.env.example` (`CBA2026`, el secreto de ejemplo, la clave en ceros), exige `ADMIN_INITIAL_PASSWORD` de 12+ y que `SESSION_SECRET` y `PIN_ENC_KEY` sean distintas | Un servidor de producción que levanta con un secreto de desarrollo es peor que uno que no levanta. |
| `db:reset` | Falla en producción y **no tiene flag para forzarlo** | Si alguna vez hay que vaciar producción, se hace a mano y con backup, no con un comando que se puede tipear por accidente. |
| `seed` | Idempotente, y **nunca pisa** un password ya cambiado | El seed corre en cada arranque del deploy. Pisar el password devolvería la cuenta al valor del `.env`. |
| Argon2 | `@node-rs/argon2`, no `argon2` | Binarios precompilados: `argon2` necesita toolchain de C y falla en Windows y en imágenes slim. |
| Zod 4 | Se adoptó (la doc asumía 3.x) | Verificado antes de apoyarse en él: `.strict()` y `z.strictObject()` rechazan tanto propiedades extra como `{ $ne: null }`. Actualizado [`TECHNICAL.md`](TECHNICAL.md) §1. |
| `syncOps._id` | Es el `opId` del cliente | Deduplicar pasa a ser un `insert` que falla con `E11000`, sin `findOne` previo. Verificado con test. |

### Tests

29 tests contra **MongoDB real en modo replica set** (`mongodb-memory-server`). Sin replica set no hay transacciones, y sin transacciones no se puede probar lo que más importa.

Cubierto: que las transacciones efectivamente funcionan · los 26 índices de `TECHNICAL.md` §2 · idempotencia de `ensureIndexes` · que los índices únicos de patrullas y de `scores` realmente rechazan duplicados (es lo que sostiene la idempotencia de la sincronización) · que el password del admin se guarda hasheado con argon2id y nunca en claro · que `seed` no pisa un password cambiado · que `reset` falla en producción · que `reconcile` recomputa los rollups desde los puntajes crudos.

Sin Docker en el entorno, así que no se pudo probar contra un Atlas real ni correr el CLI `db:indexes` contra una base viva. `mongodb-memory-server` descarga su propio `mongod` 8.2.6 y cubre el caso.

**Deuda saldada:** `--passWithNoTests` sacado de `@bal/api`.

**Próximo:** `BE-2` — base de Hono y middlewares de seguridad.

---

## 2026-08-10 · `SH-3` — Armado de patrullas

**Autor:** Claude Opus 5 · **Estado:** completado

`patrolling.ts` con `buildPatrols` y `validatePatrols`. La tarea más delicada del dominio. TDD.

**Dos reglas que la documentación no explicitaba, y que aparecieron al implementar**

El documento describía el procedimiento a grandes rasgos; escribirlo reveló dos condiciones que, si se ignoran, dejan arqueros sin patrulla. Ambas se agregaron a [`DOMAIN_WA.md`](DOMAIN_WA.md) §5.

1. **Escuela toma primero las unidades senior solitarias.** Una unidad de 1 arquero no puede formar patrulla sola (violaría `H1`); una de 2 sí. Si las unidades de escuela se llevan las senior de a dos, las senior solitarias quedan sin compañero posible. Caso concreto: 2 escuela + 3 razo. Tomando la de a dos quedan 4 arqueros en una patrulla y el razo solitario huérfano; tomando la solitaria salen 3 + 2 y no sobra nadie.

2. **Una unidad solitaria sólo puede llevarse una de a dos si la paridad del resto cierra.** Con `S` solitarias y `P` de a dos, como máximo `min(P, S)` se llevan una, menos uno si `(S - x)` queda impar — porque las solitarias que no se llevan una de a dos tienen que poder emparejarse **entre sí**. Caso concreto: 3 solitarias y 2 pares. Si las tres se llevan un par, falta uno y queda una huérfana. La cuenta da 1: una se lleva un par, las otras dos se emparejan entre sí, y el par restante forma su propia patrulla. Total 3 + 2 + 2, nadie afuera.

**Otras decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Arqueros no ubicables | Van a `unassigned` con warning `ESCUELA_SIN_SENIOR`, **no** se arma la patrulla que violaría `H3` | El documento decía "no se arma una patrulla 100% escuela" pero no decía dónde quedaban esos arqueros. Dejarlos afuera del plan los perdería en silencio. Explícitos, el admin los ubica a mano. |
| Orden determinista | Comparación por `(orden de categoría, apellido, nombre, id)` con normalización NFD propia, **sin `localeCompare`** | `localeCompare` puede variar entre entornos. El armado tiene que ser reproducible en cualquier máquina. |
| `validatePatrols` | Informa, no bloquea. Devuelve la lista de violaciones con el número de patrulla | El admin conoce el terreno y puede tener motivos para una excepción; la decisión queda en el audit log. Ver [`FUNCTIONAL.md`](FUNCTIONAL.md) §6.6. |
| `A` tira primero | Es la unidad de la categoría con menor orden de catálogo | En una patrulla con escuela eso deja siempre al senior tirando primero, que es lo natural. |
| Helper `sacar` | Un único punto con aserción no nula, comentado | `noUncheckedIndexedAccess` obliga a guardas de `undefined` que nunca se ejecutan. Son ramas muertas que ensucian el código y la cobertura. Se concentran en un helper en vez de repartirlas. |

**Tests**

152 tests en el paquete (45 nuevos). **Cobertura 100%** en líneas, ramas y funciones.

Los 12 casos normativos del reglamento del club están traducidos literalmente: 5 patrullas correctas y 7 incorrectas, más los derivados de `H3` (patrulla de 2 y de 3, todas escuela) y de `H1` (patrullas de 1 y de 5).

Determinismo probado con el input barajado y con dos corridas seguidas. Se cubrió el desempate por nombre y por id, que hacen falta con hermanos u homónimos — [`FUNCTIONAL.md`](FUNCTIONAL.md) §10 lo lista como caso borde.

**Mutaciones probadas**

| Mutación | Resultado |
|---|---|
| Sin ajuste de paridad en el cupo de pares | 1 test falla ✔ |
| `validatePatrols` no chequea `H3` | 4 tests fallan ✔ |
| `MAX_PATROL_SIZE` de 4 a 6 | 1 test falla ✔ |
| Escuela toma las unidades senior grandes primero | **Sobrevivió** — era un hueco real. Se agregó el test de 2 escuela + 3 razo y ahora la detecta. |
| `mejorCompañero` ignora la categoría | **Sobrevivió, y es un mutante equivalente.** El pool está ordenado por categoría, así que las unidades de la misma categoría quedan adyacentes y la preferencia por estaca elige exactamente la misma. No se escribió un test artificial: la preferencia por categoría se mantiene porque documenta la intención (`S1`) y porque el invariante de orden podría cambiar. Queda anotado acá para que nadie la borre creyendo que no hace nada. |

**Próximo:** `SH-4` — ranking de torneo.

---

## 2026-08-10 · `SH-2` — Scoring

**Autor:** Claude Opus 5 · **Estado:** completado

`scoring.ts` con `tokenValue`, `isValidToken`, `validateTargetScore`, `maxTargetScore`, `maxPossibleScore` y `sortArrowsDescending`. TDD.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Guarda de prototipo | `lookupValue` usa **`Object.hasOwn`**, no acceso directo al objeto de valores | Los `values` son literales y heredan de `Object.prototype`. Con acceso directo, un token `"toString"` o `"constructor"` devuelve una función, no `undefined`, y **pasa por válido**. Es un agujero real: el token viene del cliente. Hay un test explícito. |
| Qué cuenta como "10" | `tenCount` cuenta las flechas **que valen 10**, así que la `X` entra | El reglamento del club no lo definía. Se siguió la convención de World Archery, donde los 10 incluyen las X. Documentado en [`DOMAIN_WA.md`](DOMAIN_WA.md) §8 para que sea una decisión declarada y no un accidente. |
| Firma de las funciones | Todas reciben la modalidad de forma explícita | Refuerza en el tipo que la modalidad es **del blanco**, no del torneo. Es el error más fácil de cometer en este dominio. |
| `sortArrowsDescending` | Manda los tokens desconocidos al final en vez de fallar | Ordenar no es validar. La validación tiene su propia función y sus propios errores tipados. |
| Bucle de validación | `arrows.entries()` en vez de índice numérico | Con `noUncheckedIndexedAccess`, `arrows[i]` obliga a un `?? ''` que nunca se ejecuta y queda como rama muerta. Se eliminó la rama en vez de escribir un test artificial para cubrirla. |

**Tests**

107 tests en el paquete (56 de `SH-1` + 51 nuevos). **Cobertura 100%** en líneas, ramas y funciones.

Cubierto: los 9 cruces de token entre modalidades (`11` en sala, `X` en 3D, `7` en campo, `X6` en sala, etc.), la precedencia de `ARROW_COUNT` sobre `INVALID_TOKEN`, el índice exacto del primer token inválido, la irrelevancia del orden de entrada, y `maxPossibleScore` contra el caso de referencia del brief (**330**).

Mutaciones verificadas, las tres detectadas:
- `tenCount` contando el token equivocado → 2 tests fallan.
- `lookupValue` sin guarda de prototipo → 2 tests fallan.
- `sortArrowsDescending` ignorando el inner → 1 test falla.

**Próximo:** `SH-3` — armado de patrullas. Es la tarea más delicada del dominio.

---

## 2026-08-10 · `SH-1` — Catálogos de dominio

**Autor:** Claude Opus 5 · **Estado:** completado

Primer módulo de `@bal/shared`, con TDD. `domain.ts` (tipos, tokens, catálogos, `DomainError`) y `constants.ts` (`SCORING`, `CATEGORY_INFO`, `DEFAULT_STAKE_MAP`, `stakeForCategory`, constantes de liga).

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Tablas de `SCORING` | Escritas **explícitas**, no generadas desde el set de tokens | Este archivo se audita contra el reglamento. Una tabla que se lee línea por línea vale más que código ingenioso; el costo de repetir el `values` de sala y aire libre es cero porque comparten constante. |
| `CATEGORY_INFO.senior` | Bandera booleana por categoría, `false` solo en `escuela` | Es lo que va a sostener la restricción `H3` en `SH-3` sin que el algoritmo tenga que conocer el string `'escuela'`. |
| `stakeForCategory` | Recibe un `stakeMap` opcional, con el default como fallback | El mapeo es editable por torneo ([`DOMAIN_WA.md`](DOMAIN_WA.md) §4). Lanza `DomainError('STAKE_MAP_INCOMPLETE')` si el mapeo no cubre la categoría: es un error de configuración y tiene que ser ruidoso. |
| Tokens | `MISS_TOKEN`, `X_TOKEN`, `X6_TOKEN`, `ELEVEN_TOKEN` como constantes exportadas | Evita literales sueltos repartidos por el código de scoring. |

**Tests**

56 tests. **Cobertura 100%** en líneas, ramas, funciones y sentencias — por encima del umbral de 95% de [`TESTING.md`](TESTING.md) §8.

Sobre el rigor del ciclo rojo-verde: el primer rojo fue un fallo de importación (`SCORING` no existía), que hace fallar la recolección **sin ejercitar ninguna aserción individual**. Un rojo así no prueba que los tests sirvan. Se verificó con dos mutaciones sobre el código ya implementado:

- `defaultArrows` del 3D de `2` a `3` → 1 test falla.
- Sacar `cazador` del `DEFAULT_STAKE_MAP` → 3 tests fallan.

Ambas detectadas. Los tests no son vacuos.

**Deuda saldada:** `--passWithNoTests` sacado de `@bal/shared`.

**Próximo:** `SH-2` — scoring, también con TDD.

---

## 2026-08-10 · `INF-2` — Scaffolds de los paquetes

**Autor:** Claude Opus 5 · **Estado:** completado

Los cuatro paquetes existen, compilan y corren: `@bal/shared`, `@bal/api`, `@bal/app`, `@bal/landing`.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| Resolución de módulos en `@bal/api` | `module`/`moduleResolution` en **`NodeNext`**, no `Bundler` | El backend se ejecuta con `node dist/index.js`, sin bundler. Con `Bundler` TypeScript acepta imports sin extensión y el build resultante explota en runtime bajo ESM. Consecuencia: **los imports relativos del backend llevan `.js` explícito.** |
| Resolución de `@bal/shared` en desarrollo | Vía `paths` de `tsconfig.base.json`, apuntando a `src` | Permite `typecheck` sin haber construido `shared` antes. En runtime y en los builds resuelve por `exports` a `dist`, así que `pnpm build` y `pnpm dev` construyen `shared` primero. |
| `base` de Vite | `'/app/'` en la PWA, `'/'` en la landing | Acota el service worker al scope `/app` desde el arranque, como define [`ARCHITECTURE.md`](ARCHITECTURE.md) §3. Fijarlo ahora evita una migración de rutas después. |
| React 19 | Se usa 19.2.8 | Es la versión actual. La documentación decía React 18 de forma estimada; se corrigió [`TECHNICAL.md`](TECHNICAL.md) §1. |
| `--passWithNoTests` | Agregado temporalmente a los cuatro `test` | Todavía no hay tests. **Es deuda**: se saca de cada paquete apenas tenga tests reales. |

**Deuda**

| Tema | Detalle | Resuelve |
|---|---|---|
| `--passWithNoTests` en `@bal/shared` | Sacar al escribir los primeros tests | `SH-1` / `SH-2` |
| `--passWithNoTests` en `@bal/api` | Ídem | `BE-1` |
| `--passWithNoTests` en `@bal/app` y `@bal/landing` | Ídem | `FE-3` / `FE-17` |
| Placeholders | `src/index.ts` de `api`, y `App.tsx` de `app` y `landing`, son scaffolds sin contenido real | `BE-2`, `FE-1`, `FE-17` |

**Verificación**

`pnpm typecheck` 4/4 · `pnpm build` completo (shared por `tsc`, api por `tsc`, app y landing por Vite) · `pnpm start` arranca el binario del backend · `pnpm test` verde · `pnpm lint` limpio sobre 25 archivos.

Bundle inicial de ambos frontends: **190 KB crudo / 60 KB gz**, que es el baseline de React. Los presupuestos de [`TECHNICAL.md`](TECHNICAL.md) §5 son 150 KB gz para WAFL y 120 KB gz para la landing, así que hay margen — pero conviene medirlo en cada tarea de frontend, no al final.

Corrección sobre la marcha: `@types/node` faltaba en `app` y `landing`; sus `vite.config.ts` usan `process.env` para el target del proxy.

**Próximo:** `SH-1` — catálogos de dominio.

---

## 2026-08-10 · `INF-1` — Monorepo

**Autor:** Claude Opus 5 · **Estado:** completado

Monorepo pnpm inicializado: `package.json` raíz con los scripts de [`TECHNICAL.md`](TECHNICAL.md) §8, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `.gitignore` y `.env.example`.

**Decisiones**

| Tema | Decisión | Motivo |
|---|---|---|
| TypeScript | **5.9.3**, no 7.0.2 | TS 7 (reescritura nativa) ya está publicado como `latest`, pero la compatibilidad de Vite, Vitest y Biome con él no está verificada. No es el momento de descubrirlo en la fundación del proyecto. |
| Biome | **2.5.7** con config v2, no la 1.9.4 del repo de referencia | Arrancar un proyecto nuevo dos majors atrás es deuda desde el día uno. La v2 cambia el formato: `files.ignore` → `files.includes` con negaciones, `organizeImports` → `assist.actions.source`, `linter.rules.recommended` → `preset`. Migrado con `biome migrate --write` y verificado. |
| `tsconfig.base.json` | Se agregaron `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes` e `isolatedModules` sobre la base del repo de referencia | Más estrictez cuesta poco al principio y mucho después. |
| Biome — reglas | `noExplicitAny: error` (apagada en tests), `noConsole: warn` permitiendo `error/warn/info`, `noExcessiveCognitiveComplexity: 20` | Alinea el linter con las convenciones de [`CLAUDE.md`](../CLAUDE.md). |

**Desvíos**

Se actualizaron las versiones de [`TECHNICAL.md`](TECHNICAL.md) §1 a las reales instaladas: **Vite 8** (estaba 6), **Vitest 4**, **Biome 2.5.7** (estaba 1.9+), **TS 5.9.3** (estaba "5.6+"), **pnpm 9.15.0**. La documentación se había escrito con versiones estimadas.

Los briefs originales se movieron a `pre/` (commit del usuario `1c7ee9a`). Se corrigieron las referencias en [`../CLAUDE.md`](../CLAUDE.md) y [`README.md`](README.md), que apuntaban a la raíz.

**Deuda**

| Tema | Detalle | Resuelve |
|---|---|---|
| TypeScript 7 | Migrar cuando el toolchain lo soporte de forma verificada. Gana velocidad de compilación de forma significativa | Tarea `P2` a crear |
| pnpm 11 | Hay 11.21.0 disponible; se fijó 9.15.0 para igualar el entorno del autor y el repo de referencia | Cuando se actualice el entorno |

**Verificación**

`pnpm install` sin errores · `pnpm lint` exit 0 · `pnpm typecheck` y `pnpm test` no-op (sin paquetes todavía, corresponde a `INF-2`) · las 22 variables de [`CONFIG.md`](CONFIG.md) §2 cotejadas una a una contra `.env.example` · `.env.example` verificado como trackeable pese al patrón `.env.*` del `.gitignore`.

**Próximo:** `INF-2` — scaffolds de los cuatro paquetes.

---

## 2026-08-10 · Documentación inicial

**Autor:** Claude Opus 5 · **Estado:** completado

Se generó el paquete completo de documentación funcional, técnica y de arquitectura a partir de los briefs `0.prompt`, `1.context.md`, `2.development.md` y `3.stack.md`.

**Documentos creados**

| Documento | Contenido |
|---|---|
| [`FUNCTIONAL.md`](FUNCTIONAL.md) | Actores, glosario, las 3 apps, 9 user stories con criterios de aceptación, máquina de estados, 11 casos borde |
| [`DOMAIN_WA.md`](DOMAIN_WA.md) | Reglamento aplicado, modalidades, estacas, algoritmo de patrullas (`H1..H4`/`S1..S3`), rankings, trazabilidad al brief |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Topología, monorepo, modelo de datos, 5 flujos críticos, reutilización, 9 alternativas descartadas |
| [`TECHNICAL.md`](TECHNICAL.md) | Stack, 11 colecciones con índices, contrato de API completo, schemas Zod, presupuestos de performance |
| [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) | IndexedDB, outbox, contrato de `/sync`, idempotencia, LWW, service worker, 17 escenarios de falla, antipatrones |
| [`SECURITY.md`](SECURITY.md) | Modelo de amenazas, controles por área, tradeoff del PIN cifrado, checklist de 38 ítems |
| [`CONFIG.md`](CONFIG.md) | Variables de entorno, setup local, Atlas, Railway paso a paso, Docker, CI, backups |
| [`TESTING.md`](TESTING.md) | Estrategia TDD, pirámide, casos obligatorios por módulo, umbrales de cobertura |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Dirección visual, paleta, tipografía, componentes, objetivos táctiles, accesibilidad |
| [`ACTION_PLAN.md`](ACTION_PLAN.md) | 57 tareas priorizadas con objetivo, archivos, DoD y tests exigidos |
| `README.md` · `CLAUDE.md` (raíz) | Presentación del proyecto y contexto permanente para modelos de IA |

**Investigación**

- Reglamento World Archery: [Book 4 — Field and 3D (2026-01-27)](https://extranet.worldarchery.sport/documents/index.php/Rules/Rule_Book_versions/2026-01-27/EN-Book_4_-_2026-01-27_Version.pdf), [Archery GB — Field and 3D](https://archerygb.org/about/types-of-archery/field-and-3d-archery). Confirmado: 3D a 2 flechas con zonas 11/10/8/5, campo a 3 flechas con zonas 6→1.
- Estacas roja/azul/amarilla y su asignación por tipo de arco: [Manual del arquero IFAA (español)](https://ifaa-spain.com/wp-content/uploads/2020/08/EL-MANUAL-DEL-ARQUERO-DE-LA-ASOCIACIO%CC%81N-INTERNACIONAL-DE-ARQUERI%CC%81A-DE-CAMPO.pdf).
- Referencia de producto: [Ianseo Scorekeeper NG](https://apps.apple.com/us/app/ianseo-scorekeeper-ng/id1631394400) — scorecard electrónico, página de firma y manejo de desempates.
- **Hallazgo:** el repositorio local `bv-easy-archery-battle` (mismo autor) resuelve aproximadamente el 60% de la infraestructura y usa la misma convención de documentación. Las rutas concretas de reutilización están en [`ARCHITECTURE.md`](ARCHITECTURE.md) §9.

**Decisiones de arquitectura** (consultadas y confirmadas con el usuario)

| # | Decisión | Motivo |
|---|---|---|
| D1 | MongoDB Atlas, no el plugin de Railway | El plugin es standalone: sin replica set no hay transacciones multi-documento |
| D2 | Dos builds de frontend: landing en `/`, PWA en `/app` | La landing pública no debe cargar el bundle de administración ni un service worker |
| D3 | WAFL offline-first total; WAFA online con caché de lectura | Es donde está el requisito real; duplicar el sync en WAFA agregaría conflictos sin beneficio |
| D4 | Hono + driver oficial `mongodb` + Zod | Reutiliza el middleware existente; sin la capa de magia de un ODM |
| D10 | Temporada como entidad creada por el admin | Permite ligas paralelas y temporadas que cruzan años |
| D11 | `escuela` es una categoría más en podios y rankings | Confirmado por el usuario |

**Desvíos respecto del brief original** — cada uno consultado y aprobado

| Brief original | Implementación | Motivo |
|---|---|---|
| PIN de 4 dígitos | **6 dígitos** | 10.000 combinaciones se rompen por fuerza bruta en minutos, y quien entra puede falsear los puntajes de esa patrulla |
| Password de admin `CBA2026` fijo | **Seed por `ADMIN_INITIAL_PASSWORD` + cambio obligatorio** | Un password conocido y presente en el repositorio compromete crear, borrar y publicar torneos. `CBA2026` queda como default de desarrollo local |
| Ranking por mejor puntaje bruto | **Bruto + normalizado %, se muestra el %** | Cada torneo multitarget tiene un máximo distinto; comparar brutos premia al recorrido más largo, no al mejor tiro |
| "Firmas necesarias para poder guardar los datos" | **Autosave siempre; la firma cierra el circuito** | Guardar al final pierde el recorrido completo si se apaga el celular. Sin firmas la patrulla queda `pendiente_firma` y no entra al ranking |

**Aclaración de regla de dominio** — consultada con el usuario

El brief listaba `A:[escuela,escuela] · B:[escuela,escuela]` como patrulla incorrecta sin explicitar la regla. El usuario confirmó: **ninguna patrulla puede ser 100% escuela; siempre debe acompañarlos al menos un arquero senior.** Quedó formalizada como restricción `H3` en [`DOMAIN_WA.md`](DOMAIN_WA.md) §5.

**Deuda y riesgos abiertos**

| Tema | Detalle | Resuelve |
|---|---|---|
| PIN descifrable | Se guarda `pinEnc` (AES-256-GCM) para que el admin pueda volver a mostrar el PIN. Tradeoff documentado en [`SECURITY.md`](SECURITY.md) §9 | `FE-22` (acceso por QR) lo elimina |
| Teclado en arcos | La disposición concéntrica para 3D y campo es una apuesta de usabilidad sin validar | `FE-6` deja la grilla detrás de una prop; se decide con una prueba de campo |
| Network Access de Atlas | Railway no publica IPs de salida fijas; probablemente haya que usar `0.0.0.0/0` con usuario de permisos mínimos | `INF-4` documenta la decisión final |
| Backups en M0 | Sin backup automático en el tier gratuito | `INF-6`; se resuelve solo al pasar a M10 |

**Próximo paso:** ejecutar `INF-1` de [`ACTION_PLAN.md`](ACTION_PLAN.md).

---

## Plantilla para entradas nuevas

```markdown
## AAAA-MM-DD · <ID de tarea> — <título>

**Autor:** · **Estado:** completado | parcial | bloqueado

<Qué se hizo, 1-2 líneas.>

**Decisiones:** <las que no estaban en la documentación, con su porqué.>
**Desvíos:** <respecto de lo planificado, con su justificación.>
**Deuda:** <lo que queda abierto, con el ID que lo resolvería.>
**Tests:** <qué se cubrió; cobertura si aplica.>
```
