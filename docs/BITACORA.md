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
