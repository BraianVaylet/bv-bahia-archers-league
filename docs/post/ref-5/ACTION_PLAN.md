# Plan de acción — Refresh visual

Pasada de diseño sobre las tres aplicaciones. Mismas convenciones que [`ref-4`](../ref-4/ACTION_PLAN.md).

**Convención de IDs:** `REF5-N` · **Prioridad:** `P0` bloqueante → `P1` necesario · **Estado:** `[ ]` `[~]` `[x]`

---

## Contexto

El pedido fue «mejorar el diseño y la UI siguiendo las mejores prácticas y tendencias del mercado actual», con la aclaración de que **la app es móvil, muestra mucha información en tablas y cards, y no se debe romper**.

**Alcance acordado: refresh dentro de las reglas.** La dirección visual de [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) §1 no se toca — sale de los objetos del deporte y descarta explícitamente las tendencias como *«defaults, no decisiones»*. Lo que se moderniza es el **acabado**: elevación, radios, densidad, jerarquía y microinteracciones.

Se respetan sin excepción: estacas reservadas (§2.2), contraste AA / AAA en scoring (§2.4), objetivos táctiles (§5) y presupuestos de bundle.

---

## Hallazgos de la investigación

### 1. Las tablas violan una regla escrita del propio sistema

`TablaScrollable` envuelve toda tabla en `overflow-x-auto`. §7 dice, textual:

> *«Ancho mínimo soportado: **360px**. Cero scroll horizontal, en ninguna pantalla.»*

El componente que usan **las dos** tablas de la landing existe para hacer justamente lo contrario.

| Tabla | Columnas | Qué pasa a 360 px |
|---|---|---|
| Podio (`Tournaments.tsx:151`) | **8** — `# · Arquero · Puntaje · X · 10 · M · % · Puntos` | El nombre solo come media pantalla; el resto se ve scrolleando de costado |
| Ranking (`Ranking.tsx:256`) | 4, pero una celda dice `81.2% (mejor 84.5%)` | Ídem |

Es lo único que el pedido señala como «se rompe», y tiene causa concreta.

### 2. La tarjeta está escrita a mano **29 veces**

`rounded-[var(--radius-lg)] border … bg-[var(--surface)]` aparece **29 veces en 18 archivos**, en las tres aplicaciones. No hay una primitiva `Tarjeta`.

Por eso la densidad y la jerarquía están desparejas: no divergieron por decisión, divergieron porque cada pantalla resolvió lo mismo por su cuenta. **Arreglar el acabado sin extraer la primitiva es arreglarlo 29 veces**, y es lo mismo que ya pasó con `cn`, `StakeChip` y `Screen` antes de `REF2-1`.

### 3. La elevación no tiene tokens

§4 decide elevación **por borde y fondo, no por sombra** —«las sombras se disuelven bajo el sol»— y reserva una sola sombra real para el teclado de scoring. Pero no hay tokens para eso: cada tarjeta elige su borde y su fondo a mano.

Sin una escala nombrada no hay jerarquía; hay 29 criterios.

### 4. Lo que **no** está roto

Los `grid-cols-2 sm:grid-cols-5` de la ficha del arquero y las grillas de la home ya son responsivas. Las filas de pagos y de patrullas se acomodaron en `REF4-5`. No se tocan.

---

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| **Dirección visual** | **No se toca.** Paleta, tipografía y `CircuitRing` quedan como están. El refresh es de acabado |
| **Tablas** | **Tarjetas en móvil, tabla desde `sm`.** No es «tabla que scrollea menos»: a 360 px la tabla desaparece y cada fila pasa a ser una tarjeta legible. La landing es la única superficie que también se ve en escritorio, y ahí la tabla sigue siendo lo correcto |
| **Primitiva** | `Tarjeta` en `@bal/ui`, con variantes de densidad y elevación. Las 29 copias migran |
| **Elevación** | Tokens nombrados sobre borde + fondo. **Ninguna sombra nueva**: la única sigue siendo la del teclado |
| **WAFL** | **Última tanda y sin tocar geometría.** El teclado no cambia de tamaño ni de disposición; la firma no se toca |
| Entrega | **Cinco tandas, un PR cada una** |

---

# Las cinco tandas

### `[x] REF5-1` · Las tablas que no entran · **P0**

**Archivos:** `landing/components/ui.tsx`, `landing/pages/{Ranking,Tournaments}.tsx`

- [x] A 360 px cada fila es una **tarjeta**: nombre y puesto arriba, las cifras como pares etiqueta-valor
- [x] Desde `sm`, la tabla de siempre
- [x] `TablaScrollable` deja de ser la respuesta por defecto

**DoD:** ninguna de las dos pantallas scrollea de costado a 320 px · en escritorio la tabla se ve igual que hoy.
**Tests:** que a ancho de celular no exista scroll horizontal · que las ocho cifras del podio sigan estando, cada una con su etiqueta.
**Mutaciones:** volver a la tabla en móvil · perder una columna al pasar a tarjeta.

> Es lo único que el pedido llama «se rompe». Va primero y solo.

---

### `[x] REF5-2` · La primitiva `Tarjeta` y la escala de elevación · **P0**

**Archivos:** `packages/ui/src/Tarjeta.tsx` (nuevo), y los 18 archivos que la copiaban

- [x] `clasesDeTarjeta` con variantes de **densidad** (`normal`, `amplia`, `ninguna`) y **nivel** (`base`, `anidada`, `transparente`)
- [x] Elevación por **borde y fondo**, sin sombras. **No hicieron falta tokens nuevos**: la escala son las variantes, y `--surface` / `--surface-2` ya existían. Un alias de un token existente no es una escala
- [x] Las **29 copias** migran, más el panel del diálogo que estaba en `--bg`

**DoD:** ninguna pantalla escribe `rounded-[var(--radius-lg)] border` a mano · el presupuesto no se mueve.
**Tests:** que la tarjeta respete el radio y el borde del token · que la variante compacta sea efectivamente más chica.
**Mutaciones:** que las dos densidades den lo mismo · agregar una sombra.

> Sin esto, las tres tandas que siguen aplican el acabado **29 veces**. Es la misma lección de `cn`, `StakeChip` y `Screen` antes de `REF2-1`.

---

### `[x] REF5-3` · Landing · **P1**

**Archivos:** `landing/pages/{Home,Ranking,Tournaments,Archer}.tsx`

- [x] Portada revisada: la jerarquía ya era correcta, no se tocó
- [x] Ficha del arquero: `84.5% (279)` y `1-1-0` dejaron de ser un solo valor
- [x] Estados vacíos revisados: **ya estaban en la voz**, y §6.8 pide invitar a actuar sobre una superficie que es de sólo lectura. No se tocaron

**DoD:** a 320 px no hay desborde —verificado en E2E sobre torneo, ranking y ficha— · el podio se lee sin zoom.

---

### `[x] REF5-4` · WAFA · **P1**

**Archivos:** `e2e/objetivos-tactiles.spec.ts` (nuevo)

- [x] Densidad pareja: **ya la unificó `REF5-2`** al migrar las 29 tarjetas
- [x] Jerarquía en listas largas: **ya resuelta** por `ref-3` y `ref-4`
- [x] Foco visible: la regla ya existía; **lo que faltaba era verificar que llegue al elemento**

**DoD:** objetivos táctiles de §5 medidos sobre estilos computados · nada por debajo de 44 px. **Cumplido con dos E2E nuevos** — la tanda no cambió pantallas, agregó la medición que faltaba.

---

### `[x] REF5-5` · WAFL · **P1**

**Archivos:** `shared/styles/tokens.css`, `shared/tests/accion-primaria.test.ts` (nuevo), `e2e/objetivos-tactiles.spec.ts`, `docs/DESIGN_SYSTEM.md`

- [x] Se midió antes de tocar, y apareció un defecto de contraste que valía más que el acabado: **el botón primario daba 2.70:1 en tema claro**, en toda la app
- [x] **El teclado no cambió de geometría.** Se verificó que las teclas midan 56 px en un navegador real
- [x] **La firma no se tocó**

**DoD:** **15 E2E** en verde · el teclado en 56 px **medidos** · contraste AAA en scoring, que **no se cumplía**: pasó de 2.70:1 a 7.18:1.

> **Va última y es la de mayor riesgo.** Es la app que decide si el sistema sirve el día del torneo. Si algo de acabado entra en conflicto con legibilidad al sol, gana la legibilidad.

---

## Verificación

Cada tanda, antes de su PR:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

```bash
CI=1 pnpm exec playwright test
```

```bash
pnpm build && pnpm budget
```

**`CI=1` no es decorativo**: sin eso Playwright reusa un servidor ya levantado y no reconstruye, así que se mide el build anterior. Ver [`BITACORA.md`](../../BITACORA.md), 2026-08-20.

Y la lista de §11 del sistema de diseño: contraste en los dos temas, objetivos táctiles sobre estilos computados, `prefers-reduced-motion`, teclado completo.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **«Refresh» se convierte en rediseño** | La dirección de §1 no se toca. Cualquier cambio de paleta o tipografía queda fuera de alcance |
| **Migrar 29 tarjetas rompe pantallas sin test de render** | La primitiva sale antes que las pantallas, y se migra de a una tanda |
| **Tocar WAFL** | Última, con los 11 E2E como red, y sin tocar teclado ni firma |
| **El acabado cuesta bytes** | El presupuesto corre en cada tanda: PWA 150 KB gz, landing 120 |
