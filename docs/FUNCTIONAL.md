# Documentación funcional — BV Bahía Archers League

Qué hace el sistema, para quién, y bajo qué reglas. Este documento es la fuente de verdad del **comportamiento esperado**. Para las reglas de puntaje y patrullas ver [`DOMAIN_WA.md`](DOMAIN_WA.md); para el cómo técnico, [`TECHNICAL.md`](TECHNICAL.md).

---

## 1. El problema

La Liga Bahiense de Arquería (CBA, Bahía Blanca) corre **un torneo por mes** durante la temporada. Compiten socios del club e invitados de otros clubes, en 7 categorías.

Los torneos son **multitarget**: un recorrido por el predio con N blancos, donde cada blanco tiene su propia modalidad (sala 18 m, aire libre, juego de campo, 3D) y su propio reglamento de flechas. Los arqueros se reparten en **patrullas** que arrancan en blancos distintos y recorren el circuito en paralelo.

Hoy los puntajes se anotan en planilla de papel y se cargan a mano después. Eso es lento, propenso a errores y hace que los resultados tarden días.

### La restricción que manda sobre todo lo demás

**La app se usa mientras se compite, en el monte, con guantes, al sol y sin señal confiable.** Si se traba, si tarda, o si pide conexión para guardar un puntaje, entorpece el torneo y deja de usarse. Todo lo demás — features, estética, reportes — está subordinado a esto.

Consecuencias funcionales directas:
- Anotar una flecha **nunca** espera a la red.
- La app funciona el recorrido completo sin conexión.
- Nada se pierde si se cierra el navegador, se apaga el celu o se va la batería a mitad de camino.
- El líder de patrulla ve en todo momento si sus datos están sincronizados.

---

## 2. Actores

| Actor | Quién es | Dónde opera | Autenticación |
|---|---|---|---|
| **Visitante** | Arquero, familiar, público | Landing | Ninguna |
| **Administrador** | Organizador del torneo | WAFA | Usuario + password |
| **Líder de patrulla** | Un arquero de la patrulla designado por el admin | WAFL | `patrullaN` + PIN 6 dígitos |
| **Arquero** | Participante del torneo | WAFL (solo para firmar) | Ninguna — firma en el dispositivo del líder |

El líder de patrulla es un **rol de la patrulla**, no una persona registrada: la credencial pertenece a la patrulla, no al individuo. Si el líder se queda sin batería, otro miembro puede entrar con la misma credencial en su celu y seguir.

---

## 3. Glosario

| Término | Definición |
|---|---|
| **Blanco** (target) | Cada puesto de tiro del recorrido. Tiene número, modalidad, cantidad de flechas y descripción opcional. |
| **Recorrido** (circuito) | La secuencia completa de blancos del torneo. |
| **Modalidad** | Sala, aire libre, juego de campo o 3D. Define flechas y valores válidos. Es **por blanco**, no por torneo. |
| **Patrulla** | Grupo de 2 a 4 arqueros que recorre el circuito junto. |
| **Unidad de tiro** (par) | 1 o 2 arqueros de la patrulla que tiran a la vez. Una patrulla tiene 1 o 2 unidades: `A` y `B`. |
| **Estaca** | Marca de distancia (roja / azul / amarilla). Se asigna por categoría. |
| **Blanco de inicio** | El blanco desde el cual arranca cada patrulla. Se reparten para que no se amontonen. |
| **Cerrar el circuito** | Acción final de la patrulla: con todas las firmas, sus puntajes quedan definitivos. |
| **Publicar** | Acción del admin que hace visibles los resultados en la landing y los aplica a la liga. |
| **Temporada** | Agrupación de torneos para el ranking de liga (ej. "Liga Bahiense 2026"). |
| **Puntaje normalizado** | `total / máximo posible del torneo × 100`. Permite comparar entre torneos. |

---

## 4. Las tres aplicaciones

```
                    ┌──────────────────────────────┐
                    │  LANDING  (pública, sin auth)│
                    │  resultados, rankings, fichas│
                    └───────────┬──────────────────┘
                                │ enlaces
                 ┌──────────────┴───────────────┐
                 ▼                              ▼
      ┌────────────────────┐        ┌────────────────────────┐
      │  WAFA  (admin)     │───────▶│  WAFL  (líder patrulla)│
      │  crea y publica    │ genera │  anota los puntajes    │
      │  online            │creds   │  OFFLINE-FIRST         │
      └────────────────────┘        └────────────────────────┘
```

---

## 5. Landing page (pública)

Sin autenticación. Optimizada para móvil y para carga rápida.

### 5.1 Sección Introducción
- Título, descripción de la liga.
- Accesos directos a **WAFA** y **WAFL**.
- Si hay un torneo en curso, un banner con su estado.

### 5.2 Sección Ranking
Ranking de la temporada activa, **separado por categoría**, con selector de temporada para ver años anteriores.

Dos modos, conmutables:

| Modo | Ordena por | Muestra |
|---|---|---|
| **Por posición** | Puntos de liga acumulados (5-4-3-2-1 por torneo) | Puntos, torneos disputados, desglose de podios |
| **Por mejor puntaje** | Mejor puntaje normalizado de la temporada | %, puntaje bruto, torneo donde lo logró |

Solo figuran arqueros con **≥ 2 torneos publicados** en la temporada. Se muestra un aviso explicando el requisito, y una lista aparte de "aún no clasifican" para que nadie crea que se perdió su resultado.

Al tocar un arquero se navega a su ficha (§5.4).

### 5.3 Sección Listado de torneos
Torneos **publicados** y **en proceso**, ordenados por fecha descendente.

Al entrar a un torneo:
- **Si está publicado:** configuración del recorrido (cantidad de blancos, modalidad y flechas de cada uno), podios por categoría y general, mejores puntajes por categoría, puntaje de cada arquero por blanco, totales de `X`, `10` y `M`, estadísticas agregadas.
- **Si está en proceso:** la distribución de patrullas (quién con quién, en qué estaca, desde qué blanco arranca) y el avance (cuántos blancos completó cada patrulla). **No se muestran puntajes** de un torneo sin publicar.

### 5.4 Sección Arquero (ficha)
Estadísticas históricas del arquero: torneos disputados, mejor y peor puntaje (bruto y %), acumulados de `X`, `10` y `M`, evolución torneo a torneo, y su posición en los rankings de cada temporada.

---

## 6. WAFA — Web App for Admin

Requiere sesión de administrador. Funciona **online**; puede leer datos cacheados sin conexión pero no crear ni editar.

### 6.1 Login
Usuario y password. Si es el primer ingreso, la app **obliga a cambiar el password** antes de dejar hacer cualquier otra cosa.

### 6.2 Home
Listado de torneos agrupados por estado: en proceso, sin iniciar, completados, publicados. Accesos a crear torneo, gestionar arqueros y gestionar temporadas.

### 6.3 Crear torneo (wizard)

**Paso 1 — Datos generales:** nombre, fecha, descripción, temporada a la que pertenece.

**Paso 2 — Recorrido:** cantidad de blancos; para cada blanco, modalidad y cantidad de flechas (precargada con el default del reglamento, editable de 1 a 12) y descripción opcional. Se puede reordenar, agregar y eliminar blancos. Un panel muestra en vivo el **máximo posible del torneo**.

**Paso 3 — Participantes:** se eligen del padrón de arqueros o se crean nuevos ahí mismo. Se ve el conteo por categoría, con un aviso si la composición va a hacer difícil respetar la regla de escuela.

**Paso 4 — Revisión:** resumen completo, editable. Al confirmar, el sistema:
1. Congela un snapshot de cada arquero.
2. Asigna estacas según categoría.
3. Arma las patrullas (ver [`DOMAIN_WA.md`](DOMAIN_WA.md) §5).
4. Asigna blanco de inicio a cada patrulla.
5. Genera las credenciales de cada patrulla.

El torneo queda en estado `sin_iniciar`.

### 6.4 Arqueros
Padrón del club. Alta con **nombre, apellido y categoría**. Se pueden editar, archivar y eliminar.

- **Eliminar** solo está permitido si el arquero no participó de ningún torneo.
- Si ya participó, se puede **archivar**: deja de aparecer al armar torneos nuevos pero conserva todo su histórico y su lugar en los rankings.
- Un arquero archivado se puede **restaurar**.

### 6.5 Temporadas
Alta de temporadas con nombre, fecha de inicio y fin. Una temporada activa por vez (puede haber varias, pero la landing destaca la activa).

### 6.6 Patrullas (de un torneo)
Vista de todas las patrullas: composición, unidades `A`/`B`, posición izquierda/derecha, estaca, blanco de inicio y credenciales.

- **Mientras el torneo está `sin_iniciar`:** el admin puede reacomodar arqueros entre patrullas y unidades. Un validador en vivo muestra qué reglas se estarían violando (ver `DOMAIN_WA.md` §5). **Avisa pero no bloquea**: el admin puede tener motivos válidos, y la excepción queda registrada.
- **Credenciales:** usuario y PIN visibles, con botón para **regenerar** el PIN y opción de mostrar un **QR** para que el líder entre sin tipear.
- Una vez el torneo pasa a `en_proceso`, las patrullas quedan congeladas.

### 6.7 Torneo (detalle)

**Sin iniciar:** configuración completamente editable. Botón **Iniciar torneo**.

**En proceso:**
- Seguimiento en vivo: blancos completados por patrulla, puntajes cargados, patrullas pendientes de firma.
- Solo se pueden editar los blancos **en los que ninguna patrulla cargó puntajes**. Un blanco con al menos un puntaje queda bloqueado.
- Acción de **desbloquear firma** si un arquero se fue sin firmar (queda en el audit log con motivo).

**Completado** (todas las patrullas cerraron su circuito):
- Vista de resultados completa: podios por categoría, puntos de liga que sumaría cada arquero.
- Botón **Publicar**.

**Publicado:**
- Solo lectura. Los resultados están visibles en la landing y aplicados a la liga.
- Existe **Despublicar** como escape de emergencia ante un error grave; revierte el impacto en la liga y queda en el audit log.

---

## 7. WAFL — Web App for Leader

**La aplicación crítica.** Offline-first total: una vez que el líder entra con conexión, la app funciona el recorrido completo sin señal.

### 7.1 Login
`patrullaN` + PIN de 6 dígitos, o escaneo del QR que muestra el admin. Al autenticar, la app **descarga el recorrido completo** (blancos, miembros, unidades, estacas, orden de inicio) y lo guarda en el dispositivo. A partir de ahí ya no necesita red.

Si el torneo no está `en_proceso`, la credencial no funciona.

### 7.2 Home
El torneo en curso y la lista de blancos **ordenados desde el blanco de inicio de esa patrulla**. Si la patrulla arranca en el 10 de un recorrido de 14, ve: `10, 11, 12, 13, 14, 1, 2, …, 9`.

Cada blanco muestra número, modalidad, cantidad de flechas y estado (pendiente / completo). Se toca para cargar.

Arriba, siempre visible, el **indicador de sincronización**: `Sincronizado` / `N cambios pendientes` / `Sin conexión`.

### 7.3 Página de blanco
Muestra modalidad, cantidad de flechas, descripción, y los arqueros de la patrulla con **qué unidad tira primero, quién a la izquierda, quién a la derecha, y en qué estaca**.

La carga de puntaje:
- Teclado de tokens grande, adaptado a la modalidad de **ese** blanco (un blanco 3D ofrece `11 10 8 5 M`; el de sala ofrece `X 10 9 … 1 M`).
- Las flechas se ordenan automáticamente de mayor a menor al mostrarse.
- Se puede corregir una flecha ya cargada.
- **Cada toque guarda al instante en el dispositivo.** No hay botón "guardar" y no hay espera de red.
- Cuando todos los arqueros tienen su puntaje cargado, se habilita **Continuar** y se pasa al siguiente blanco del recorrido.

Un blanco se puede volver a editar mientras el circuito no esté cerrado.

### 7.4 Resultados (seguimiento)
Accesible en cualquier momento durante el recorrido: puntaje acumulado de cada arquero, cantidad de `X`, `10` y `M`, y su puntaje blanco por blanco. Sirve para ir controlando.

### 7.5 Cierre y firmas
Cuando **todos los blancos del recorrido tienen puntaje de todos los arqueros**, se habilita **Resultados finales**.

Ahí, para cada arquero: puntaje por blanco, total, `X`, `10`, `M`, y un botón **FIRMAR** que abre un canvas para firmar con el dedo en la pantalla.

Con **todas** las firmas presentes, se habilita **Finalizar**. Al confirmarse:
- El circuito de esa patrulla queda **cerrado**: los puntajes ya no se editan desde la WAFL.
- Los datos se sincronizan con el servidor.
- Cuando todas las patrullas cerraron, el torneo pasa automáticamente a `completado`.

> **Aclaración importante frente al brief original.** El brief dice que hacen falta las firmas "para poder guardar los datos". En esta implementación los puntajes se **guardan siempre**, desde la primera flecha: guardar recién al final significaría perder el recorrido entero si el celu se apaga. Las firmas no habilitan el guardado, habilitan el **cierre**: sin todas las firmas, la patrulla queda `pendiente_firma`, el puntaje no es definitivo y no entra al ranking hasta resolverse.

---

## 8. Máquina de estados del torneo

```
   ┌──────────────┐  iniciar   ┌──────────────┐  todas las patrullas   ┌──────────────┐  publicar  ┌───────────┐
   │ sin_iniciar  │───────────▶│  en_proceso  │  cerraron el circuito  │  completado  │───────────▶│ publicado │
   └──────────────┘            └──────────────┘───────────────────────▶└──────────────┘            └───────────┘
          ▲                            │                                                                 │
          └────────────────────────────┘                                                           despublicar
              volver atrás, sólo con                                                          (emergencia, auditado)
              CERO puntajes cargados
```

| Estado | Quién escribe | Visible en landing |
|---|---|---|
| `sin_iniciar` | Admin (todo, **incluidos los participantes**) | No |
| `en_proceso` | Líderes (puntajes) · Admin (blancos vírgenes) | Solo patrullas y avance, sin puntajes |
| `completado` | Nadie | Solo patrullas y avance |
| `publicado` | Nadie | Todo: resultados, podios, rankings |

Transiciones inválidas rechazadas por el servidor con `409 INVALID_STATE_TRANSITION`.

### 8.1 Volver a `sin_iniciar` (`REF2-3`)

Es la vuelta atrás de **un arranque por error**, y por eso su guarda es dura: sólo si el torneo no tiene **ni un solo puntaje**. Con un blanco anotado ya hay trabajo de una patrulla en el monte, y volver atrás lo dejaría colgando de un torneo que dice no haber empezado. Se responde `409 TOURNAMENT_HAS_SCORES`, con cuántos puntajes hay.

**Las patrullas y sus PIN se conservan.** Si arrancaste por error, volvés, corregís y arrancás de nuevo: la planilla impresa sigue sirviendo. Regenerar los PIN obligaría a reimprimir por un error de un toque.

**Las sesiones de patrulla vivas dejan de poder anotar.** Este estado es el único momento en que una sesión emitida con el torneo en curso sobrevive a que el torneo deje de estarlo, así que `/wafl/sync` verifica el estado del torneo y rechaza las ops —una por una, con 200, para que el outbox del cliente no reintente para siempre—. Lo destapó el `/security-review` de esa tanda; ver `BITACORA.md`.

### 8.2 Cambiar los participantes

Sólo con el torneo `sin_iniciar`, y **rearma las patrullas**: las patrullas se derivan de la lista de arqueros y de las restricciones `H1`-`H4`, así que agregar a alguien sin rehacerlas daría una patrulla de cinco o una 100% escuela. Los PIN cambian, porque las patrullas son nuevas.

Con el torneo en marcha se rechaza con `409`: las patrullas ya están en el monte con su planilla impresa, y rearmarlas desde el escritorio dejaría al líder mirando una lista que no coincide con la gente que tiene al lado.

---

## 9. User stories con criterios de aceptación

### US-01 · El admin crea el torneo del mes
> Como administrador, quiero crear un torneo definiendo su recorrido y sus participantes, para que las patrullas queden armadas antes de que empiece.

- **Dado** un recorrido de 14 blancos (1-6 en 3D a 2 flechas, 7-12 en campo a 3, el 13 aire libre a 6 y el 14 sala a 3) **y** 20 arqueros inscriptos, **cuando** confirmo la creación, **entonces** el torneo queda en `sin_iniciar` con las 14 configuraciones de blanco, los 20 participantes con su estaca asignada, las patrullas armadas y las credenciales generadas.
- **Y** el máximo posible del torneo se calcula como `6×(2×11) + 6×(3×6) + 1×(6×10) + 1×(3×10) = 132 + 108 + 60 + 30 = 330`.
- **Y** ninguna patrulla es 100% escuela; si no alcanzan los seniors, veo un aviso explícito.
- **Y** las patrullas arrancan en blancos repartidos a lo largo del circuito.

### US-02 · El líder anota sin señal
> Como líder de patrulla, quiero anotar todo el recorrido sin conexión, para que la falta de señal no frene el torneo.

- **Dado** que ingresé con conexión y la app descargó el recorrido, **cuando** pierdo la señal por completo, **entonces** puedo cargar el puntaje de los 14 blancos, ver los resultados parciales y navegar entre blancos, sin ningún error.
- **Y** cada toque de flecha se refleja en pantalla en menos de 50 ms.
- **Y** el indicador muestra `Sin conexión` y la cantidad de cambios pendientes.
- **Cuando** vuelve la señal, **entonces** todo se sincroniza solo y el indicador pasa a `Sincronizado`, sin que yo haga nada.

### US-03 · No se pierde nada
> Como líder de patrulla, quiero que nada se pierda si se cierra la app, para no tener que recargar puntajes.

- **Dado** que cargué 8 blancos, **cuando** cierro el navegador, se apaga el celu o se recarga la página, **entonces** al volver a abrir la app veo los 8 blancos cargados exactamente igual.
- **Y** si un cambio no había llegado al servidor, sigue en la cola y se envía cuando haya señal.

### US-04 · Cargar el puntaje de un blanco
> Como líder, quiero cargar las flechas de cada arquero rápido y sin errores.

- **Dado** un blanco 3D de 2 flechas, **cuando** abro la carga, **entonces** el teclado ofrece solo `11 10 8 5 M`.
- **Y** al cargar `8` y luego `11`, se muestran como `11, 8` con total `19`.
- **Cuando** intento continuar sin haber cargado a todos los arqueros, **entonces** el botón está deshabilitado y se indica quién falta.
- **Y** puedo corregir una flecha ya cargada y el total se recalcula.

### US-05 · Firmar y cerrar
> Como arquero, quiero revisar y firmar mi puntaje, para validar que es correcto.

- **Dado** que todos los blancos están cargados, **cuando** abro Resultados finales, **entonces** veo mi puntaje por blanco, mi total y mis `X`, `10` y `M`.
- **Cuando** firmo en la pantalla, **entonces** mi firma queda guardada con fecha y hora.
- **Y** el botón Finalizar solo se habilita con **todas** las firmas de la patrulla.
- **Cuando** finalizo, **entonces** el circuito de mi patrulla queda cerrado y ya no se edita.

### US-06 · El admin sigue el torneo en vivo
> Como administrador, quiero ver el avance de todas las patrullas durante el torneo.

- **Dado** un torneo `en_proceso`, **cuando** entro al detalle, **entonces** veo cuántos blancos completó cada patrulla y los puntajes cargados hasta el momento.
- **Y** puedo editar un blanco solo si ninguna patrulla cargó puntaje en él.
- **Cuando** intento editar un blanco ya tirado, **entonces** la acción está bloqueada con una explicación.

### US-07 · Publicar resultados
> Como administrador, quiero publicar el torneo para que los resultados lleguen a los arqueros.

- **Dado** un torneo `completado`, **cuando** publico, **entonces** los podios por categoría, los puntajes y las estadísticas quedan visibles en la landing.
- **Y** los puntos de liga (5-4-3-2-1 por categoría) se suman al ranking de la temporada.
- **Y** el mejor puntaje normalizado de cada arquero se actualiza si mejoró su marca.
- **Y** la acción queda en el audit log con quién y cuándo.

### US-08 · Consultar el ranking
> Como visitante, quiero ver el ranking de la liga por categoría.

- **Dado** una temporada con ≥ 2 torneos publicados, **cuando** entro a Ranking, **entonces** veo cada categoría con sus arqueros ordenados por puntos de liga.
- **Y** puedo conmutar al ranking por mejor puntaje, que muestra %, bruto y torneo de origen.
- **Y** los arqueros con menos de 2 torneos aparecen aparte, marcados como "aún no clasifican".

### US-09 · Instalar la app y actualizarla
> Como usuario de WAFA o WAFL, quiero instalar la app en el celu y enterarme cuando hay una versión nueva.

- **Cuando** entro desde el navegador por primera vez, **entonces** la app me propone instalarla en el dispositivo.
- **Cuando** hay una versión nueva disponible, **entonces** veo un aviso con un botón para actualizar.
- **Y la app nunca se actualiza sola en medio de un torneo** — la actualización es siempre una decisión explícita del usuario.

---

## 10. Casos borde y su resolución

| Situación | Resolución |
|---|---|
| Un arquero se va antes de firmar | La patrulla queda `pendiente_firma`. El admin puede **desbloquear la firma** desde WAFA indicando el motivo; queda en el audit log. |
| El celu del líder muere a mitad del recorrido | Otro miembro entra con la misma credencial en su celu y descarga el estado del servidor. Se pierde solo lo que no se había sincronizado; con señal intermitente, casi nada. |
| El líder anota desde dos dispositivos a la vez | Gana la escritura con `clientUpdatedAt` más reciente por blanco y arquero. Se registra el conflicto. |
| Un arquero no se presenta | El admin lo quita del torneo mientras esté `sin_iniciar`. Si el torneo ya arrancó, se marca su participación como `ausente`: no puntúa ni entra al podio. |
| No hay suficientes seniors para acompañar a los escuela | El armado automático **no** genera una patrulla 100% escuela: marca `requiereRevisionManual` y avisa al admin, que resuelve a mano. |
| Empate en el podio | Se aplica el desempate de `DOMAIN_WA.md` §8. Si persiste, **puesto compartido**: ambos en la misma posición, ambos reciben los puntos de liga de esa posición, y la siguiente posición se saltea. |
| Solo 1 arquero en una categoría | Gana su categoría y recibe 5 puntos de liga. Es correcto: la categoría existe con esa cantidad de participantes. |
| Un torneo se publica con un error | El admin puede **despublicar**: se revierte el impacto en la liga, el torneo vuelve a `completado` y todo queda en el audit log. |
| Se corta el wifi del club entero durante el torneo | Todas las WAFL siguen funcionando offline. Al volver la señal sincronizan en orden. El torneo nunca se detiene. |
| Un blanco quedó mal configurado y ya lo tiraron | No se puede editar. La corrección se hace por despublicación o se acepta como está — la integridad del puntaje ya firmado prevalece. |
| Dos arqueros con el mismo nombre y apellido | El padrón lo permite; se distinguen por su identificador interno y la UI muestra la categoría junto al nombre. |

---

## 11. Requisitos no funcionales

| Requisito | Criterio verificable |
|---|---|
| **Disponibilidad durante el torneo** | WAFL completa el recorrido entero con `navigator.onLine === false`. Verificado en E2E. |
| **Respuesta al anotar** | < 50 ms percibidos entre el toque y el cambio en pantalla. Sin red en el camino crítico. |
| **Carga inicial** | WAFL utilizable en < 2.5 s en 3G simulado. |
| **Móvil primero** | Todas las pantallas usables en 360 px de ancho. Cero scroll horizontal. |
| **Usable con guantes y al sol** | Targets táctiles ≥ 56 px en el teclado de scoring, ≥ 44 px en el resto. Contraste AA mínimo. |
| **Tema claro y oscuro** | Ambos disponibles, con respeto de la preferencia del sistema y sin parpadeo al cargar. |
| **Instalable** | WAFA y WAFL proponen instalación al primer ingreso desde el navegador. |
| **Aviso de actualización** | Notificación no intrusiva; la actualización nunca es automática. |
| **Seguridad** | Ver [`SECURITY.md`](SECURITY.md). Checklist completo verde antes de cada release. |
| **Idioma** | Español rioplatense en toda la interfaz. |

---

## 12. Fuera de alcance (versión 1)

Se dejan explícitamente afuera, para que nadie los asuma incluidos:

- Inscripción online de arqueros (los carga el admin).
- Pagos o cuotas.
- Fotos o perfiles de arqueros con imagen.
- Notificaciones push.
- Eliminatorias, matchplay o rondas de desempate por tiro.
- Múltiples clubes con administración separada (multi-tenant).
- Exportación a formatos federativos (Ianseo, etc.).
- Idiomas además del español.
