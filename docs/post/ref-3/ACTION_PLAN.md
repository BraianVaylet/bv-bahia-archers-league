# Plan de acción — Tercer refactor

Implementación de [`refactor.md`](refactor.md). Mismas convenciones que [`ref-2`](../ref-2/ACTION_PLAN.md).

**Convención de IDs:** `REF3-N` · **Prioridad:** `P0` bloqueante → `P1` necesario · **Estado:** `[ ]` `[~]` `[x]`

---

## Contexto

`ref-2` cerró con las tres apps con identidad propia y el flujo de WAFA completo. Probándolo apareció **un bug que bloquea el armado de patrullas**, y que introduje yo en `REF2-5`.

Lo demás es legibilidad: los headers y pies se van con el scroll, el logo del CBA desaparece en modo oscuro, y la pantalla de patrullas es ilegible en un celular — que es donde se usa.

---

## Hallazgos de la investigación

### 1. El bug de las patrullas: **el servidor nunca borra una patrulla**

`patrolAdminService.redistribute` lo dice en su propia cabecera:

> *«No crea ni borra patrullas: las credenciales pueden estar repartidas en papel. Una patrulla que queda sin nadie queda **vacía**, y el validador lo informa.»*

Esa decisión era coherente **hasta `REF2-5`**. Ahí agregué dos cosas que juntas la rompen:

- `eliminarPatrulla`, que saca la patrulla del borrador **sólo en la pantalla**;
- y que **una patrulla vacía frena el guardado**.

El resultado es el que reportaste, y es un **bloqueo del que no se sale**:

1. Movés los dos arqueros de la patrulla 4 a las otras. La 4 queda vacía.
2. La eliminás. La pantalla muestra 1, 2 y 3.
3. Guardás. El servidor reasigna los arqueros a las patrullas 1, 2 y 3 — **y deja la 4 donde estaba**, ahora vacía.
4. La pantalla recarga, vuelven a aparecer cuatro patrullas, y la cuarta vacía frena el guardado.
5. Repetir no cambia nada.

> Antes de `REF2-5`, `cuerpoDeDistribucion` filtraba la patrulla vacía y el guardado pasaba: quedaba un torneo con una patrulla fantasma, mal pero utilizable. **Lo convertí en imposible de guardar.** Es exactamente el riesgo que el plan de `ref-2` anotaba sobre esta pantalla, y no alcanzó con anotarlo.

### 2. Y renumerar del lado del cliente mueve arqueros de patrulla

El cliente renumera 1..N y el servidor **mapea por `number`**. Eliminar la patrulla 2 de `{1,2,3,4}` convierte la vieja 3 en la 2, y el servidor escribe los arqueros de la vieja 3 en el **documento** de la 2 — que tiene su propio `username` y su propio PIN.

No se notó porque el caso reportado eliminaba la última. **Eliminar una del medio reparte los PIN impresos entre grupos equivocados.**

### 3. El logo del CBA es un PNG con fondo transparente

Y su tinta es oscura. Sobre `--bg` claro se ve; sobre el oscuro desaparece. Es el único asset del proyecto que depende del fondo — el resto es SVG con `currentColor` o lleva su propia placa.

---

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| **Identidad de la patrulla** | El cliente manda el **`id`** de cada patrulla, no sólo su número. El servidor sabe cuál es cuál sin adivinar por posición |
| **Eliminar** | El servidor **borra** las patrullas que no vengan en la distribución, y renumera. Sólo con el torneo `sin_iniciar` |
| **PIN al renumerar** | **Cada patrulla conserva el suyo.** El PIN viaja con el grupo de arqueros, no con el número. La pantalla avisa que los números cambian |
| Entrega | **Tres tandas, un PR cada una.** El bug va solo y primero |

---

# Las tres tandas

### `[x] REF3-1` · El bug de las patrullas · **P0** · **TDD**

**Archivos:** `shared/src/schemas.ts`, `api/src/services/patrolAdminService.ts`, `api/src/repositories/patrolRepo.ts`, `app/src/wafa/patrullas.ts`, `app/src/wafa/pages/Patrols.tsx`

- [x] `PlannedPatrolSchema` acepta el **`id`**. El servidor deja de mapear por número
- [x] `redistribute` **borra** las que no vengan y **renumera** las que quedan, con su `username`
- [x] Cada patrulla conserva su PIN
- [x] El borrador del cliente lleva el `id`
- [x] **Guarda nueva:** la numeración tiene que ser 1..N, sin huecos ni repetidos

**DoD:** el caso reportado se completa de punta a punta — mover los dos, eliminar la vacía, guardar, recargar y ver **tres** patrullas · eliminar una del medio deja a cada grupo con su propio PIN.
**Tests:** integración del caso exacto del reporte · eliminar la primera, una del medio y la última · que el PIN de cada patrulla siga siendo el suyo después de renumerar.
**Mutaciones:** no borrar las que faltan · renumerar sin actualizar el `username` · mapear por número en vez de por `id`.

> **La pantalla más delicada del proyecto.** El barrido de 960 composiciones de `REF-3` tiene que seguir en verde.
>
> **Cerrada el 2026-08-16.**
>
> **Apareció un segundo defecto que nadie había reportado.** El cliente renumera y el servidor mapeaba por número, así que eliminar una patrulla **del medio** escribía los arqueros de la vieja 3 en el documento de la 2 — con el `username` y el PIN de la 2, que pueden estar impresos. El caso reportado eliminaba la última, donde ningún número cambia, y por eso no se notó.
>
> **Y un test viejo dejó de significar lo que decía.** «Rechaza un número de patrulla que no existe» tenía sentido cuando el número era la identidad; ahora el número es editable. Se reescribió como lo que hace falta hoy: **la numeración tiene que ser 1..N**, porque el usuario del líder se deriva de ella.
>
> **Un control de mutación destapó un test vacuo, otra vez mío.** «El usuario acompaña al número nuevo» eliminaba la **última** patrulla — y ahí ningún número cambia, así que el renumerado no se ejercitaba. Ahora elimina la primera y verifica primero que algún número haya cambiado de verdad.
>
> 1103 tests. **3 controles de mutación, murieron 3.**

---

### `[ ] REF3-2` · Header y pie fijos, y el logo del CBA · **P1**

**Archivos:** `packages/ui/src/Footer.tsx`, `app/src/components/ui.tsx`, `landing/src/components/ui.tsx`, `landing/src/App.tsx`

- [ ] **Header arriba y pie abajo, fijos**, en las tres apps. El contenido scrollea entre los dos
- [ ] El **teclado de scoring y las barras de acción** no pueden quedar tapados: WAFL ya tiene barras fijas propias y hay que resolver la convivencia
- [ ] `env(safe-area-inset-bottom)` sigue respetado: la barra de gestos de iOS no puede tapar nada
- [ ] El **logo del CBA** va sobre una placa blanca fija, para que no dependa del tema

**DoD:** con el teclado abierto en un celular no se tapa ninguna acción · el pie no roba alto a la pantalla de scoring · el logo del CBA se ve en los dos temas.
**Tests:** que el pie no se renderice donde hay barra fija —la regla de `REF2-2`— sigue valiendo.

> **El riesgo es el alto útil.** Un pie fijo en un celular chico se come el espacio del teclado de scoring, que es la pantalla que decide si la app sirve. Si no entra, gana el teclado.

---

### `[ ] REF3-3` · Patrullas legibles en el celular · **P1**

**Archivos:** `app/src/wafa/pages/Patrols.tsx`

- [ ] Cada patrulla muestra sus **unidades `A` y `B`** como tales
- [ ] Dentro de cada unidad, **tres renglones**: nombre completo · categoría y estaca · lado de tiro y acciones
- [ ] Los objetivos táctiles de 44px se mantienen

**DoD:** en 360px de ancho no hay scroll horizontal y ningún texto se corta.

---

## Verificación

```bash
pnpm lint && pnpm typecheck && pnpm test
```

```bash
pnpm test:e2e && pnpm build && pnpm budget
```

Y **a mano**, con el caso del reporte: un torneo que dé una patrulla de 2, mover sus arqueros, eliminarla, guardar y recargar.

Al terminar cada tanda: marcarla acá y anotar en [`BITACORA.md`](../../BITACORA.md).

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Borrar patrullas del lado del servidor** | Sólo con el torneo `sin_iniciar`, que es cuando nadie tiene el recorrido descargado. La guarda ya existe y se testea |
| **Renumerar cambia el usuario del líder** | El PIN viaja con la patrulla, no con el número, y la pantalla lo avisa. Imprimir ya está bloqueado hasta guardar |
| **El pie fijo come alto en el celular** | Si no entra, gana el teclado de scoring. El E2E offline es la red |
