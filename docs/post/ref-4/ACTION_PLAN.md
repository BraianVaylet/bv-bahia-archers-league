# Plan de acción — Cuarto refactor

Implementación de [`refactor.md`](refactor.md). Mismas convenciones que [`ref-3`](../ref-3/ACTION_PLAN.md).

**Convención de IDs:** `REF4-N` · **Prioridad:** `P0` bloqueante → `P1` necesario · **Estado:** `[ ]` `[~]` `[x]`

---

## Contexto

`ref-3` cerró el flujo de WAFA y la legibilidad en el celular. Este pedido son siete ítems, y **dos no son lo que parecen**: uno es una regla del proyecto implementada a medias, y otro es un bug de la pantalla de firma.

Los otros cinco son de presentación, y tres de ellos dependen de ganar ancho — que es lo que da el ítem 5.

---

## Hallazgos de la investigación

### 1. Nadie puede actualizar la app (ítem 2)

La regla 7 dice `registerType: 'prompt'`, **nunca `autoUpdate`**, y está bien puesta en `vite.config.ts`. Pero el aviso que la completa no existe: no hay un solo `useRegisterSW`, `onNeedRefresh` ni `virtual:pwa-register` en todo `packages/app/src`.

Lo que pasa hoy:

1. `registerSW.js` se inyecta solo y **registra** el service worker.
2. Al haber versión nueva, `sw.js` la descarga y queda en `waiting`.
3. `sw.js` espera un mensaje `SKIP_WAITING` para activarse — que **nadie manda nunca**.

El usuario se queda con la versión que instaló. Para una PWA instalada, que casi no se cierra, eso es *para siempre*.

> **Los dos E2E de PWA pasan y dicen la verdad**: el SW se registra, y no se auto-actualiza. Ninguno de los dos verifica que el usuario **pueda** actualizar. Es el patrón de siempre en esta bitácora: se probó la mitad que estaba escrita.

### 2. La firma dibuja donde no se tocó (ítem 7)

`SignaturePad` toma el punto así:

```ts
const rect = e.currentTarget.getBoundingClientRect();
return { x: e.clientX - rect.left, y: e.clientY - rect.top };
```

El canvas tiene un **buffer de 900×600** y CSS lo muestra al ancho que entre. El resultado son píxeles CSS usados como coordenadas del buffer, **sin escalar**: en un celular de 360 px el factor es 2,5, así que tocar el centro dibuja al 20 % del ancho. El trazo aparece **arriba y a la izquierda del dedo** — la primera versión de este plan decía la dirección al revés, y lo corrigió ver fallar el test.

No es un ajuste estético. Es la pantalla donde el arquero valida su puntaje, y una firma que no se parece a la suya es la que se discute después.

### 3. Las etiquetas largas son la causa de dos de los tres «se rompe»

Las claves del dominio **ya son cortas** (`recurvo`, `compuesto`, `cazador`). Lo largo es sólo el `label`:

| Hoy | Pedido |
|---|---|
| `Recurvo olímpico` | `Recurvo` |
| `Compuesto libre` | `Compuesto` |
| `Compuesto cazador` | `Cazador` |
| `Sala 18 m` | `18 m` |
| `Juego de campo` | `Campo` |

`Campo` además **acerca** la etiqueta al término de `CLAUDE.md`, que ya dice «campo». No se toca ninguna clave, ningún dato guardado, ninguna URL.

### 4. Los dos layouts que se rompen, ubicados

| Pantalla | Hoy |
|---|---|
| Pagos (`Payments.tsx:98`) | `flex items-center justify-between` — nombre, estado y botón en **una** línea |
| Torneos de la landing (`Tournaments.tsx:280`) | `flex items-center gap-2` — nombre, categoría y estaca en **una** línea |

---

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| **Aviso de versión** | `virtual:pwa-register/react`. **El aviso no interrumpe**: es una barra, no un modal. Recargar a mitad de recorrido es lo que la regla 7 prohíbe, así que actualizar es siempre una decisión del usuario |
| **Instalar la app** | `beforeinstallprompt` donde exista. En iOS **no existe**, así que ahí se explican los pasos en texto en vez de ofrecer un botón que no hace nada |
| **Etiquetas** | Cambia el `label`, **nunca la clave**. El diccionario del pedido, tal cual |
| **Escuela** | El pedido no la nombra: queda `Escuela` |
| Entrega | **Cinco tandas, un PR cada una.** El diccionario va primero: es lo que le da ancho a las otras |

---

# Las cinco tandas

### `[x] REF4-1` · El diccionario de etiquetas · **P0** · **TDD**

**Archivos:** `shared/src/constants.ts`, y los tests que afirman sobre las etiquetas viejas

- [x] `CATEGORY_INFO[*].label` y `SCORING[*].label`, según el diccionario del pedido
- [x] **Ninguna clave cambia.** Ni datos, ni URLs, ni `data-testid`

**DoD:** ninguna etiqueta de categoría pasa de 11 caracteres —el largo de `Tradicional`, que el pedido no acorta— · las tres apps siguen verdes.
**Tests:** un test que fije el diccionario · que toda clave de `BowCategory` y de modalidad tenga etiqueta.
**Mutaciones:** dejar una etiqueta vieja · vaciar una etiqueta · repetir una etiqueta entre dos categorías.

> Va primero **porque las otras tandas gastan el ancho que esta gana**. Al revés habría que reacomodar dos veces.

---

### `[x] REF4-2` · La firma dibuja donde se toca · **P0** · **TDD**

**Archivos:** `app/src/wafl/SignaturePad.tsx`

- [x] El punto se escala por `canvas.width / rect.width` y `canvas.height / rect.height`
- [x] Función **pura** para el cálculo, testeable sin DOM

**DoD:** el trazo aparece bajo el dedo en un celular de 360 px y en un escritorio de 1280 px.
**Tests:** el punto en el centro del rectángulo cae en el centro del buffer · una esquina cae en la esquina · con rect y buffer del mismo tamaño el punto no se mueve.
**Mutaciones:** no escalar · escalar con la razón invertida · usar la escala de X también para Y.

> **La pantalla más delicada de WAFL después del teclado.** Es donde el arquero valida su puntaje.

---

### `[ ] REF4-3` · Avisar que hay versión nueva · **P0**

**Archivos:** `app/src/main.tsx` o `App.tsx`, componente nuevo, `vite.config.ts` si hace falta

- [ ] `virtual:pwa-register/react`, con `onNeedRefresh`
- [ ] **Barra, no modal.** Con «Actualizar» y con «Ahora no»
- [ ] «Ahora no» no vuelve a preguntar en esa sesión

**DoD:** con una versión nueva servida, aparece el aviso; al aceptar, la app queda en la nueva; al rechazar, sigue en la vieja **sin perder nada**.
**Tests:** el aviso aparece con `onNeedRefresh` y no antes · aceptar llama a `updateServiceWorker`.
**Mutaciones:** mostrar el aviso siempre · que «Ahora no» también actualice.

> **Nunca a mitad de un recorrido sin permiso.** El E2E que verifica que el SW no se auto-actualiza tiene que seguir verde: esta tanda agrega el consentimiento, no lo saca.

---

### `[ ] REF4-4` · La puerta de entrada · **P1**

**Archivos:** `app/src/App.tsx`, componente nuevo

- [ ] Botón **«Ver la liga»** a la landing, con `enlaceEntreApps`
- [ ] Recomendación de **instalar la app**, con accionable
- [ ] Donde no hay `beforeinstallprompt` —iOS— se explican los pasos, no se ofrece un botón muerto
- [ ] Si ya está instalada (`display-mode: standalone`), no se ofrece nada

**DoD:** en Android aparece el botón y llama al prompt nativo · en iOS aparecen los pasos · instalada, no aparece nada.
**Tests:** los tres estados · el enlace a la landing sale de `/app`.
**Mutaciones:** ofrecer el botón sin evento disponible · mostrar el aviso estando instalada.

---

### `[ ] REF4-5` · Las tres pantallas que se rompen · **P1**

**Archivos:** `wafa/pages/Payments.tsx`, `landing/pages/Tournaments.tsx`, `landing/components/ui.tsx`

- [ ] **Pagos:** nombre y estado en la primera fila; los accionables en la segunda
- [ ] **Torneos (landing):** nombre y categoría en la primera fila; la estaca en la segunda
- [ ] **Header:** CBA a la izquierda, el de la Liga al lado, «Liga Bahiense» a la derecha. Una sola línea

**DoD:** a 320 px de ancho no hay desborde horizontal en ninguna de las tres · los objetivos táctiles siguen en 44 px.
**Tests:** que el estado de pago siga siendo legible **sin color** · que el header nombre a los dos con `alt`.

> El header es lo único que se ve en las tres apps: se toca al final, cuando las etiquetas cortas ya están.

---

## Verificación

Cada tanda, antes de su PR:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

```bash
pnpm test:e2e
```

```bash
pnpm build && pnpm budget
```

Al terminar cada tanda: marcarla acá y anotar en [`BITACORA.md`](../../BITACORA.md).

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Cambiar etiquetas rompe tests que afirman sobre ellas** | Es la señal de que la etiqueta se estaba usando como identidad. Se corrige el test, no se conserva la etiqueta |
| **El aviso de versión interrumpe un recorrido** | Barra, nunca modal, y actualizar siempre es del usuario. El E2E de `prompt` es la red |
| **`beforeinstallprompt` no existe en iOS** | Se detecta y se explica en texto. Un botón que no hace nada es peor que no ofrecerlo |
| **Tocar la firma** | Función pura y testeada antes de tocar el componente |
