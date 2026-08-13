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
