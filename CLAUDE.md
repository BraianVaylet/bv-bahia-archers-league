# CLAUDE.md — contexto permanente del proyecto

Instrucciones para modelos de IA que trabajen en este repositorio. **Leer esto antes de tocar cualquier archivo.**

---

## Qué es esto

Sistema de gestión de torneos de la Liga Bahiense de Arquería. Tres aplicaciones: una landing pública, una PWA para el administrador (**WAFA**) y una PWA para el líder de patrulla (**WAFL**).

**El requisito duro es operativo, no técnico: la app se usa en el monte, con guantes, al sol, sin señal confiable, mientras se compite. No puede dejar de funcionar.**

Si una decisión de implementación entra en conflicto con ese requisito, gana el requisito. Siempre.

---

## Antes de empezar cualquier tarea

1. Leer [`docs/ACTION_PLAN.md`](docs/ACTION_PLAN.md) y buscar tu tarea por ID.
2. Leer el documento que esa tarea referencia.
3. Si la tarea toca lógica de dominio, **usar la skill `tdd`**.
4. Al terminar: marcar `[x]` en `ACTION_PLAN.md` **y** anotar en [`docs/BITACORA.md`](docs/BITACORA.md).

---

## Las diez reglas

Estas no se rompen. Si algo parece exigir romper una, la respuesta es preguntar, no improvisar.

1. **El servidor es la autoridad del puntaje.** El cliente manda tokens de flecha (`"X"`, `"11"`, `"M"`). El servidor deriva los valores y recalcula los totales. **Nunca** se lee un `total` del request.

2. **Ninguna regla de negocio fuera de `@bal/shared`.** Scoring, patrullas, rankings y estadísticas viven ahí, puros y sin I/O. Los servicios del backend orquestan y persisten; no deciden.

3. **Ninguna consulta a MongoDB fuera de `packages/api/src/repositories/`.** Sin excepciones. Es lo que permite auditar la seguridad de la capa de datos en un solo lugar.

4. **Ningún `await fetch()` en el camino de anotar un puntaje.** Se escribe en IndexedDB y se encola una op. La red es asincrónica y opcional. Ver [`docs/OFFLINE_SYNC.md`](docs/OFFLINE_SYNC.md) §12 para la lista de antipatrones.

5. **Ningún objeto del request llega a un filtro de Mongo sin pasar por Zod `.strict()` primero.** Es lo que previene la inyección NoSQL.

6. **La UI de WAFL lee de IndexedDB, nunca de una respuesta HTTP.** No existe un "modo offline"; existe un solo modo que resulta funcionar sin red.

7. **`registerType: 'prompt'` en la PWA. Nunca `autoUpdate`.** Recargar la app a mitad de recorrido es inaceptable.

8. **Los colores de estaca (`roja`, `azul`, `amarilla`) son semántica reservada.** No se usan para nada más en toda la interfaz.

9. **Objetivos táctiles: 56px en el teclado de scoring, 44px en el resto.** Si un componente no llega, se rediseña el componente, no se baja el número.

10. **TDD en el dominio.** El test se escribe primero y **se lo ve fallar** por la razón correcta. Un test que nunca se vio fallar no prueba nada.

---

## Las cuatro tareas que definen el proyecto

Si estás por trabajar en alguna, tomate el tiempo. Son las que deciden si la app funciona el día del torneo.

| Tarea | Qué es | Documento |
|---|---|---|
| `SH-3` | Algoritmo de armado de patrullas | [`DOMAIN_WA.md`](docs/DOMAIN_WA.md) §5 |
| `BE-10` | Sincronización idempotente | [`OFFLINE_SYNC.md`](docs/OFFLINE_SYNC.md) §6 |
| `FE-2` | Capa offline con IndexedDB y outbox | [`OFFLINE_SYNC.md`](docs/OFFLINE_SYNC.md) §3-§5 |
| `FE-6` | Teclado de scoring | [`DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) §6.1 |

---

## Convenciones

- **TypeScript `strict`.** Sin `any` salvo justificación en comentario.
- **Programación funcional** donde aplique: funciones puras, sin mutar argumentos, composición sobre herencia.
- **Capas del backend, estrictas:** `routes` (validación Zod) → `services` (negocio, transacciones) → `repositories` (Mongo).
- **Nombres:** componentes `PascalCase`, hooks `useX`, módulos de dominio `camelCase`, colecciones en plural.
- **Errores tipados con `code`.** Nunca strings sueltos.
- **Código, comentarios y tests en español.** Nombres de variables en español cuando refieren al dominio (`patrulla`, `blanco`, `estaca`).
- **Biome** para lint y formato. CI bloquea si falla.

---

## Reutilización

`C:\Users\braia\projects\bv-easy-archery-battle` es un repositorio del mismo autor que resuelve buena parte de la infraestructura: scoring WA, sesión httpOnly + CSRF, argon2id, rate limit, headers de seguridad, tema claro/oscuro anti-FOUC, PWA, componentes de UI, Docker y configuración de Railway.

**Antes de escribir algo desde cero, revisá si ya existe ahí.** El mapa completo de qué portar y con qué adaptación está en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §9.

Lo que **no** se reutiliza: la capa de persistencia (ese repo usa SQLite, este usa MongoDB) y todo lo de offline (no existe en el origen).

---

## Skills a usar

| Skill | Cuándo |
|---|---|
| `tdd` | **Obligatoria** en toda tarea `SH-*` y en los servicios críticos del backend |
| `nodejs-backend-patterns` | Al estructurar las capas del backend |
| `vercel-react-best-practices` | Al escribir o revisar componentes de React |
| `web-design-guidelines` | Al terminar cualquier pantalla |
| `audit-website` | Contra el deploy, en `FE-21` |
| `frontend-design` | Al definir dirección visual de una pantalla nueva |
| `/security-review` | Antes de mergear cualquier cambio que toque auth, datos o entrada del usuario |
| `aikido:scan` | Después de generar código nuevo |

---

## Terminología del dominio

Usar estas palabras, en el código y en la interfaz. **No** traducirlas ni inventar sinónimos.

| Término | Qué es |
|---|---|
| **Blanco** (`target`) | Cada puesto de tiro del recorrido |
| **Recorrido** / circuito | La secuencia completa de blancos |
| **Modalidad** | Sala, aire libre, campo o 3D. **Es por blanco, no por torneo** |
| **Patrulla** (`patrol`) | Grupo de 2 a 4 arqueros que recorre junto |
| **Unidad de tiro** (`unit`) | 1 o 2 arqueros que tiran a la vez. `A` y `B`. `A` tira primero |
| **Estaca** (`stake`) | Marca de distancia: roja, azul o amarilla. Se asigna por categoría |
| **Blanco de inicio** | Desde dónde arranca cada patrulla |
| **Cerrar el circuito** | Acción final de la patrulla, con todas las firmas |
| **Publicar** | Acción del admin que aplica los resultados a la liga |
| **Temporada** (`season`) | Agrupación de torneos para el ranking |

---

## Errores fáciles de cometer en este dominio

- **Asumir que la modalidad es del torneo.** Es de **cada blanco**. Un `11` es válido en un blanco 3D e inválido en el de sala del mismo torneo.
- **Validar los tokens de flecha contra una lista fija.** Se validan contra el set de la modalidad **de ese blanco**, leída del torneo en base.
- **Comparar puntajes brutos entre torneos.** Cada torneo multitarget tiene un máximo distinto. Para comparar se usa `normalizedPct`.
- **Olvidar que `escuela` no puede quedar sola.** Ninguna patrulla puede ser 100% escuela (restricción `H3`).
- **Poner un spinner al guardar un puntaje.** No hay nada que esperar.
- **Descartar ops del outbox ante un 401.** Se pierde trabajo del usuario. Jamás.
- **Editar un blanco que ya tiene puntajes.** Está bloqueado a propósito.

---

## Qué no tocar

- **`0.prompt`, `1.context.md`, `2.development.md`, `3.stack.md`** — son los briefs originales del cliente. Son un registro histórico. No se editan.
- **`LICENSE`**.
- **La documentación de `docs/`** solo se modifica cuando cambia una decisión de diseño, y el cambio se registra en [`docs/BITACORA.md`](docs/BITACORA.md).

---

## Si algo no está claro

Preguntá. Este proyecto tiene decisiones tomadas de forma explícita y documentada; improvisar sobre una que ya se discutió genera trabajo que hay que deshacer.

Los desvíos respecto del brief original ya están consultados y aprobados; están listados en [`docs/BITACORA.md`](docs/BITACORA.md), entrada del 2026-08-10.
