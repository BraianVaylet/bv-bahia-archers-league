# Documentación — BV Bahía Archers League

Índice de la documentación del proyecto. Todos los documentos están en español y se referencian entre sí.

---

## Por dónde empezar

| Si sos… | Leé, en este orden |
|---|---|
| **Nuevo en el proyecto** | [`FUNCTIONAL.md`](FUNCTIONAL.md) → [`ARCHITECTURE.md`](ARCHITECTURE.md) → [`ACTION_PLAN.md`](ACTION_PLAN.md) |
| **Un modelo de IA que va a implementar** | [`../CLAUDE.md`](../CLAUDE.md) → [`ACTION_PLAN.md`](ACTION_PLAN.md) → el documento que referencie tu tarea |
| **Quien va a desplegar** | [`CONFIG.md`](CONFIG.md) → [`SECURITY.md`](SECURITY.md) §13 |
| **Quien va a trabajar en el backend** | [`TECHNICAL.md`](TECHNICAL.md) → [`DOMAIN_WA.md`](DOMAIN_WA.md) → [`SECURITY.md`](SECURITY.md) |
| **Quien va a trabajar en WAFL** | [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) → [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) |

---

## Los documentos

| Documento | Qué responde |
|---|---|
| [`FUNCTIONAL.md`](FUNCTIONAL.md) | Qué hace el sistema, para quién, y bajo qué reglas. Actores, las 3 apps pantalla por pantalla, user stories, estados, casos borde. |
| [`DOMAIN_WA.md`](DOMAIN_WA.md) | Las reglas de arquería y de la liga. Modalidades, tokens de puntaje, estacas, **algoritmo de armado de patrullas**, rankings y desempates. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Cómo está construido y **por qué**. Topología, monorepo, modelo de datos, flujos críticos, alternativas descartadas. |
| [`TECHNICAL.md`](TECHNICAL.md) | El detalle ejecutable. Esquemas de las colecciones con sus índices, contrato de API endpoint por endpoint, schemas Zod, presupuestos de performance. |
| [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) | **El documento más importante.** Cómo WAFL funciona sin señal: IndexedDB, outbox, sincronización idempotente, conflictos, service worker, escenarios de falla. |
| [`SECURITY.md`](SECURITY.md) | Modelo de amenazas, controles, tradeoffs asumidos y el **checklist verificable** que debe estar verde antes de cada release. |
| [`CONFIG.md`](CONFIG.md) | Cómo levantarlo de cero: variables de entorno, MongoDB Atlas, desarrollo local, Docker, Railway, CI, backups. |
| [`TESTING.md`](TESTING.md) | Estrategia TDD, qué se testea en cada capa, **casos obligatorios**, umbrales de cobertura. |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Dirección visual, paleta, tipografía, componentes, y las reglas de uso con guantes y al sol. |
| [`ACTION_PLAN.md`](ACTION_PLAN.md) | **El backlog.** 56 tareas priorizadas, cada una con objetivo, archivos, criterio de terminado y tests exigidos. |
| [`BITACORA.md`](BITACORA.md) | Registro de avance. Se actualiza al terminar cada tarea. |

---

## Las cuatro cosas que hay que saber

1. **La app no puede dejar de funcionar durante un torneo.** Todo lo demás está subordinado a eso. Ver [`OFFLINE_SYNC.md`](OFFLINE_SYNC.md) §1.
2. **El servidor es la autoridad del puntaje.** El cliente manda tokens de flecha; el servidor deriva los valores y recalcula. Ver [`SECURITY.md`](SECURITY.md) §2.
3. **Las reglas de negocio viven en `@bal/shared`**, puras y sin I/O, compartidas entre frontend y backend. Ver [`ARCHITECTURE.md`](ARCHITECTURE.md) §4.
4. **TDD en el dominio.** El test se escribe primero y se lo ve fallar. Ver [`TESTING.md`](TESTING.md) §1.

---

## Documentos de origen

Los briefs originales del cliente están en la raíz del repositorio: `0.prompt`, `1.context.md`, `2.development.md`, `3.stack.md`.

Donde esta documentación **se desvía** del brief original, el desvío está explicitado y justificado: ver [`BITACORA.md`](BITACORA.md), entrada del 2026-08-10, sección "Desvíos respecto del brief original".
