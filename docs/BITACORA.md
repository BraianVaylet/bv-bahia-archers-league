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
