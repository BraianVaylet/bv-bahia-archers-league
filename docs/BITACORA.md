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
| [`ACTION_PLAN.md`](ACTION_PLAN.md) | 56 tareas priorizadas con objetivo, archivos, DoD y tests exigidos |
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
