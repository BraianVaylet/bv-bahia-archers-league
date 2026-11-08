# Rediseño

Plan para aplicar este sistema al código, ordenado por impacto. Cada punto nombra los archivos que toca. Hay que aplicarlo en una rama nueva desde `main`. Cuando una decisión de `docs/DESIGN_SYSTEM.md` cambie, el cambio se registra en `docs/BITACORA.md`.

## 0. El hallazgo que más pesa: las fuentes nunca cargan

`tokens.css` declara `'Archivo Expanded'`, `'Archivo'` y `'Martian Mono'`, pero ningún paquete tiene `@font-face` ni importa las fuentes. Todo el producto se ve en la fuente del sistema: Segoe UI en Windows, Roboto en Android. Además, "Archivo Expanded" no existe como familia: en Archivo, el ancho expandido es un eje (`wdth`) de la fuente variable.

**Arreglo** (sin red externa, compatible con la CSP `font-src 'self'`):

```bash
pnpm --filter @bal/ui add @fontsource-variable/archivo @fontsource-variable/martian-mono
```

```css
/* packages/ui/styles/tokens.css, antes de @theme */
@import '@fontsource-variable/archivo/wdth.css';      /* ejes wght + wdth */
@import '@fontsource-variable/martian-mono/wdth.css';

@theme {
  --font-display: 'Archivo Variable', system-ui, sans-serif;
  --font-sans: 'Archivo Variable', system-ui, sans-serif;
  --font-mono: 'Martian Mono Variable', ui-monospace, monospace;
}

/* utilidad para todo lo que hoy usa font-[var(--font-display)] */
@utility font-display {
  font-family: var(--font-display);
  font-stretch: 125%;
  font-variation-settings: 'wdth' 125;
}
```

Es un solo cambio y alcanza a las tres apps: la mejora de profesionalismo más grande por línea de código. Agregá un test en `@bal/ui` que verifique que `tokens.css` importa las dos fuentes.

## 1. Landing `/`: diseño nuevo (prioridad absoluta)

Previews: **Landing** y **LandingMovil**.

| Hoy | Nuevo |
|---|---|
| Encabezado en dos filas, links de 14px sin estado activo | `SiteHeader`: una fila de 64px, sticky, con nav activa en `nock-text` e "Ingresar" siempre visible |
| Foto en una tarjeta + título de 16px | Hero a sangre sobre `monte`, anillos concéntricos de fondo, titular `hero` en display expandido, CTA "Ver el ranking" |
| Botón verde gigante "Ingresar" en el medio | "Ingresar" pasa al encabezado: el público viene a mirar resultados y los líderes ya tienen la PWA instalada |
| Tres tarjetas de texto ("Ranking de la liga", "Torneos", "Sumarte") | Contenido real: el torneo en curso flotando sobre el hero, las fechas con `TournamentCard` + `ModalityBar`, el top 5 por categoría, las modalidades con sus valores de flecha y una banda "Sumate al padrón" |
| Pie fijo que tapa contenido (`h-dvh` + `overflow-hidden`) | Documento que scrollea normal y `Footer` estático con columnas |

**Archivos:** `landing/src/App.tsx` (sacar `h-dvh overflow-hidden` y `data-scroll-principal`; revisar el foco al navegar, que hoy apunta a ese contenedor), `landing/src/components/ui.tsx` (`Encabezado`, `Screen` con `max-w-[1200px]`), `landing/src/pages/Home.tsx` (reescritura), `@bal/ui/Footer.tsx`.

**Datos:** el hero y las secciones usan lo que la landing ya trae (`/api/publico/torneos`, ranking). Si no hay torneo en curso, la tarjeta flotante muestra la última fecha oficial con su podio. Si no hay ninguno, la sección de torneos muestra un estado vacío que invita a sumarse.

👀 **La foto de portada** parece generada: tiene rótulos en inglés ("INDOOR", "3D RANGE") y no es el predio. Para una liga real resta credibilidad. Reemplazala por una foto del predio del CBA en una fecha (horizontal, 1600px o más), o sacala y dejá el hero solo con los anillos.

## 2. Puerta `/app`: diseño nuevo

Previews: **Puerta** y **PuertaMovil**.

- Hoy: título + dos botones ("Soy líder de patrulla" en verde, "Soy administrador" en gris) + un link. No dice qué hace cada app.
- Nuevo: un panel `monte` con la marca y la promesa, `¿Cómo entrás hoy?` y dos `RoleCard` con descripción. El líder va primero y lleva el tag "Funciona sin señal". Abajo, "Ver resultados y rankings" y la invitación a instalar (`InstalarApp`, rediseñada como tarjeta con borde punteado).
- Bonus de UX: recordar el último rol elegido en `localStorage` y mostrarlo primero con "Seguís como líder de patrulla".

**Archivos:** `app/src/App.tsx` (`Elegir`), `app/src/components/InstalarApp.tsx`, `VolverALaLiga.tsx`.

## 3. Admin (WAFA): cambios simples y de alto impacto

Preview: **WafaInicio**.

1. **Inicio:** un solo primario ("Crear torneo"). Arqueros, Temporadas y Ranking pasan de botones grises del mismo peso a tres accesos con ícono y dato (`42 · 2 altas`).
2. **Rótulos de sección** → `SectionHeader` con contador. Las secciones vacías explican qué va a aparecer ahí.
3. **Estado del torneo** → el nuevo `BadgeEstado` (punto + texto), así deja de competir con el título.
4. **Fila de chips de modalidad con %** → `ModalityBar`.
5. **Torneo en curso:** un `CircuitRing` chico por patrulla (ya especificado en §6.5, hoy sin implementar).
6. **Botón secundario** con borde `line-strong` en lugar del gris relleno, que se leía como deshabilitado. Es un cambio en `botonClases` y alcanza a todas las pantallas.
7. **Pie:** fuera de WAFA. El escudo y el logo ya están en el encabezado y en la landing.

## 4. Líder (WAFL): cambios simples y de alto impacto

Preview: **WaflBlanco**. Sin tocar la lógica offline ni el teclado.

1. **Sacar el pie de las pantallas de scoring.** Hoy `Footer compacto` queda **entre** la lista y el teclado (`Screen conBarraFija`): ocupa alto útil justo donde no sobra. En `ui.tsx`, `Screen` no debería renderizar `Footer` cuando `conBarraFija`.
2. **Encabezado del blanco:** número en display 56px + `ChipModalidad` + "2 flechas · Jabalí · 1 de 6". Es lo primero que hay que leer al llegar al puesto.
3. **`UnitCard`:** total visible a la derecha (`aria-live`), próxima flecha marcada y casilleros de 48px. Hoy hay un "—" sin contexto.
4. **Teclado:** teclas de 64px (siguen pasando los 56 del mínimo), cifras en display, "Continuar" dentro del panel.
5. **Recorrido:** `CircuitRing` arriba de la lista de blancos, y "Cerrar sesión" fuera del final de la lista (ya está en el encabezado).

## 5. UI/UX general

- **Foco visible:** `--nock` en claro da 2.59:1 sobre `bg`, así que el anillo no llega a 3:1. Usá `focus-ring` (`#556500` en claro).
- **Bordes de controles:** `line` da 1.3:1. Inputs y botones secundarios pasan a `line-strong`.
- **Peligro en oscuro:** el blanco sobre `#f06449` da ~3:1. Usá `danger-ink`.
- **Estados deshabilitados:** nada de `opacity: .4`. Usá `surface-2` + `ink-muted`, con el motivo escrito al lado.
- **Fechas:** formato corto en mono (`08/08/2026`) en listas, y largo (`8 de agosto de 2026`) en el detalle.
- **Jerarquía tipográfica:** hoy casi todo es 16px semibold. Usá la escala completa (`display` / `h2` / `h3` / `body` / `sm` / `eyebrow`).

## Orden sugerido

1. Fuentes (§0). Medio día, impacto en todo.
2. Tokens nuevos en `tokens.css` (`line-strong`, `nock-text`, `nock-soft`, `focus-ring`, `danger-ink`, `monte*`) + foco + bordes (§5).
3. Landing (§1).
4. Puerta (§2).
5. Componentes compartidos: `BadgeEstado`, `ModalityBar`, `SectionHeader`, botón secundario.
6. WAFA (§3) y WAFL (§4).
7. Verificación de `DESIGN_SYSTEM.md` §11: contraste en los dos temas, objetivos táctiles medidos, 360px, `prefers-reduced-motion`, teclado. Actualizar los tests de snapshot y de E2E que dependan de los textos que cambian (por ejemplo "En curso ahora" → "En curso").
