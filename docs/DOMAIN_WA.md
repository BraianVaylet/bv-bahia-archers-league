# Dominio — Reglamento aplicado

Reglas de arquería que el sistema implementa. Toda esta lógica vive en `@bal/shared`: **pura, sin I/O, testeable y compartida entre frontend y backend**. El servidor es la **autoridad**: deriva el valor de cada flecha desde su token y recalcula todos los totales. Nunca confía en un total enviado por el cliente.

**Fuentes:**
- [World Archery — Rulebook](https://www.worldarchery.sport/rulebook)
- [World Archery — Book 4: Field and 3D Archery (2026-01-27)](https://extranet.worldarchery.sport/documents/index.php/Rules/Rule_Book_versions/2026-01-27/EN-Book_4_-_2026-01-27_Version.pdf)
- [World Archery — Field archery](https://www.worldarchery.sport/sport/disciplines/field-archery)
- [Archery GB — Field and 3D: bows & scoring](https://archerygb.org/about/types-of-archery/field-and-3d-archery)
- [Manual del arquero IFAA (español) — estacas y distancias](https://ifaa-spain.com/wp-content/uploads/2020/08/EL-MANUAL-DEL-ARQUERO-DE-LA-ASOCIACIO%CC%81N-INTERNACIONAL-DE-ARQUERI%CC%81A-DE-CAMPO.pdf)

> **Nota de alcance.** La Liga Bahiense corre torneos **multitarget**, un formato de club que no existe como tal en el reglamento WA: un mismo recorrido mezcla blancos de sala, aire libre, campo y 3D. Lo que se toma de WA es el **reglamento de cada blanco** (flechas, zonas, valores). La composición del recorrido, las patrullas y la liga son reglas propias del club, documentadas acá y marcadas como tales.

---

## 1. Modalidades de blanco

Cada blanco del recorrido tiene **su propia modalidad**. Esto es la diferencia central con un torneo tradicional, donde la modalidad es del torneo entero.

| Modalidad | `key` | Flechas default | Tokens válidos (orden descendente) | Máx por flecha | Token inner (desempate 1º) | Token desempate 2º |
|---|---|---|---|---|---|---|
| Sala 18 m | `sala` | **3** | `X 10 9 8 7 6 5 4 3 2 1 M` | 10 | `X` | `10` |
| Aire libre | `aire_libre` | **6** | `X 10 9 8 7 6 5 4 3 2 1 M` | 10 | `X` | `10` |
| Juego de campo | `campo` | **3** | `X6 6 5 4 3 2 1 M` | 6 | `X6` | `6` |
| 3D | `3d` | **2** | `11 10 8 5 M` | 11 | `11` | `10` |

`X6` es el inner-6 del campo. Es **opcional**: si el club no lo distingue, simplemente nunca se carga ese token y el desempate cae en el conteo de `6`.

### Valor canónico por token

```
X   -> 10   (suma a xCount e innerCount)
X6  -> 6    (suma a innerCount)
11  -> 11   (suma a innerCount)
M   -> 0    (suma a mCount)
n   -> n    (entero del token)
```

### Fórmulas

```
maxTargetScore(modalidad, flechas) = maxPorFlecha(modalidad) × flechas
maxPossibleScore(torneo)           = Σ  maxTargetScore(blanco.modalidad, blanco.flechas)
                                   blancos
normalizedPct(participante)        = (total / maxPossibleScore) × 100
```

`maxPossibleScore` se calcula al crear el torneo y se **congela en el documento del torneo**. Si el admin edita un blanco todavía sin puntajes, se recalcula. Una vez publicado, nunca cambia.

### Cantidad de flechas configurable

El default sale de la tabla, pero el admin puede sobreescribir las flechas de cualquier blanco (ej. un 3D a 1 flecha para acelerar el recorrido). Rango permitido: **1 a 12**. El cambio recalcula `maxPossibleScore`.

---

## 2. Notación de carga

- Las flechas de un blanco se registran **de mayor a menor** (ej. `9, 9, 9, 5, 3, M`). Es la convención WA de planilla.
- El orden **no altera el puntaje**. La UI ordena automáticamente al mostrar; el validador no exige orden.
- `M` (miss) = flecha sin puntaje. Se registra explícitamente, no se omite.
- `X` = impacto en el anillo interno del 10. Vale 10 y cuenta como X para desempate.
- A igual valor, el token inner se muestra primero (`X` antes que `10`).

---

## 3. Categorías de arco

Ocho categorías. Todas las de la liga son **senior** salvo `escuela` y `principiantes`.

| `key` | Etiqueta | Estaca |
|---|---|---|
| `recurvo` | Recurvo olímpico | `roja` |
| `compuesto` | Compuesto libre | `roja` |
| `cazador` | Compuesto cazador | `roja` |
| `razo` | Razo | `azul` |
| `tradicional` | Tradicional | `azul` |
| `longbow` | Longbow | `azul` |
| `escuela` | Escuela | `amarilla` |
| `principiantes` | Iniciación | `naranja` |

> **`principiantes` es no senior, igual que `escuela`.** `H3` (ver §5) la protege de la misma manera: ninguna patrulla puede ser 100% `principiantes`, y el armado automático la mezcla en la misma bolsa no-senior que `escuela` — `isEscuela()` ya generaliza por el flag `senior` de `CATEGORY_INFO`, no por el nombre de la categoría. La etiqueta visible es «Iniciación» porque «Principiantes» (13 caracteres) no entra en el límite de 11 de las etiquetas de categoría (`docs/DESIGN_SYSTEM.md`); la clave de dominio sigue siendo `principiantes`.

> **Nota terminológica.** `razo` (barebow / arco desnudo) y `cazador` (bowhunter) vienen del uso de campo y 3D en federaciones hispanohablantes. Se respeta la grafía **`razo`** que usa el club. WA Field internacional reconoce recurvo, compuesto y barebow; el mapeo de estacas se ofrece **editable por torneo** para adaptarse al reglamento vigente del club.

---

## 4. Estacas

Estacas por cercanía al blanco: **roja** (más lejos) › **azul** (media) › **amarilla** › **naranja** (más cerca).

| Estaca | Categorías por defecto | Referencia IFAA de distancia máxima |
|---|---|---|
| `roja` | recurvo, compuesto, cazador | hasta ~45 m |
| `azul` | razo, tradicional, longbow | hasta ~30 m |
| `amarilla` | escuela | distancias cortas |
| `naranja` | principiantes | distancias muy cortas |

- El mapeo es **editable por torneo** (`stakeMap`), pero por defecto es el de la tabla.
- Las distancias son **informativas**: se guardan por torneo para mostrarlas en la app, y **no afectan el cálculo del puntaje**.
- En blancos de **sala** y **aire libre** todos tiran desde la misma línea; la estaca se muestra igual (identifica al arquero) pero no implica distancia distinta.

---

## 5. Armado de patrullas

> **Regla propia del club**, no de WA. Es el algoritmo más delicado del sistema. Vive en `@bal/shared/src/patrolling.ts`.

### Vocabulario

- **Patrulla**: grupo de arqueros que recorre el circuito junto. Tiene un líder con credenciales para la WAFL.
- **Unidad de tiro** (o par): 1 o 2 arqueros que tiran a la vez. Una patrulla se compone de 1 o 2 unidades, identificadas como `A` y `B`. `A` tira primero.
- **Posición**: dentro de una unidad de 2, uno tira a la **izquierda** y otro a la **derecha**.

### Restricciones duras (`H`) — nunca se violan en el armado automático

| ID | Regla |
|---|---|
| `H1` | Tamaño de patrulla entre **2 y 4** arqueros. |
| `H2` | Cada unidad de tiro es **homogénea de categoría**: si tiene 2 arqueros, ambos son de la misma categoría. |
| `H3` | **Ninguna patrulla puede ser 100% no senior** (`escuela` y/o `principiantes`). Toda patrulla que incluya arqueros no senior debe incluir al menos 1 arquero senior que los acompañe. |
| `H4` | La estaca de cada arquero se deriva de su categoría vía `stakeMap`. Por `H2`, los dos arqueros de una unidad siempre comparten estaca. |

### Objetivos blandos (`S`) — se optimizan en este orden

| ID | Objetivo |
|---|---|
| `S1` | Reunir la mayor cantidad de arqueros de la misma categoría en la misma patrulla (minimizar unidades solitarias). |
| `S2` | Balancear el tamaño de las patrullas (evitar una de 4 y otra de 2 si se puede repartir 3 y 3). |
| `S3` | Repartir los blancos de inicio uniformemente a lo largo del circuito. |
| `S4` | **Como mucho una patrulla de dos.** Una unidad solitaria prefiere llevarse una de a dos —formando una patrulla de 3— antes que emparejarse con otra solitaria. |

#### Por qué `S4` es blando y no duro

Una patrulla de dos es la peor de las válidas: si uno falta el día del torneo, el otro queda solo y no puede tirar, porque nadie le controla el puntaje. Conviene evitarlas.

Pero **no siempre se puede.** Una patrulla es a lo sumo dos unidades y de 2 a 4 arqueros, así que las formas posibles son:

```
4 = u2 + u2      3 = u2 + u1      2 = u2   ó   u1 + u1
```

Con 1 recurvo y 3 compuestos —4 arqueros en tres unidades— los repartos posibles son **2 + 2** o **3 + 1**, y el segundo viola `H1`. Dos patrullas de dos es el mejor reparto que existe.

Por eso el validador **sólo avisa cuando hay un reparto mejor**. Marcar como violación algo que no se puede arreglar es enseñarle al admin a ignorar los avisos.

### Ejemplos del reglamento del club

Estos casos son **normativos** y se traducen literalmente a tests (ver `TESTING.md`).

**Válidos:**

| Patrulla | Por qué es válida |
|---|---|
| `A:[razo, razo]` · `B:[razo, razo]` | Ambas unidades homogéneas. 4 arqueros. Cumple `H1`,`H2`; sin escuela, `H3` no aplica. |
| `A:[razo, razo]` · `B:[escuela, escuela]` | Unidades homogéneas; la patrulla tiene 2 seniors → cumple `H3`. |
| `A:[compuesto, compuesto]` · `B:[escuela, escuela]` | Ídem anterior. |
| `A:[compuesto, compuesto]` · `B:[cazador]` | Unidad `B` solitaria: permitido. Patrulla de 3. |
| `A:[compuesto, compuesto]` · `B:[escuela]` | Patrulla de 3, con 2 seniors acompañando a 1 escuela. |

**Inválidos:**

| Patrulla | Regla violada |
|---|---|
| `A:[razo, tradicional]` · `B:[razo, cazador]` | `H2` — ninguna unidad es homogénea. |
| `A:[longbow, compuesto]` · `B:[razo, compuesto]` | `H2` — ídem. |
| `A:[escuela, escuela]` · `B:[escuela, escuela]` | `H3` — patrulla 100% escuela, sin ningún senior. |

Casos derivados que también fallan por `H3`: una patrulla `A:[escuela, escuela]` sola (2 arqueros, todos escuela) o `A:[escuela, escuela] · B:[escuela]` (3 arqueros, todos escuela).

### Procedimiento (determinista)

Mismo input → mismo output, siempre. Sin aleatoriedad, sin dependencia del orden de llegada.

```
1. Agrupar participantes por categoría.
2. Ordenar cada grupo por (sortCategoria, apellido, nombre, archerId).
3. Formar UNIDADES dentro de cada categoría:
      floor(n / 2) unidades de 2  +  (n impar → 1 unidad de 1)
4. Separar las unidades en dos bolsas: ESCUELA y SENIOR.
5. Combinar en patrullas, en este orden de preferencia:
   a. Cada unidad de ESCUELA se empareja con una unidad SENIOR   → garantiza H3.
      Se prefieren las unidades senior SOLITARIAS: son las que no pueden
      formar patrulla por su cuenta. Consumir primero las de a dos dejaría
      solitarias sin compañero posible.
   a-bis. Al combinar, una unidad SOLITARIA sólo puede llevarse una unidad
      de a dos mientras queden suficientes: con S solitarias y P de a dos,
      como máximo min(P, S) se llevan una, menos uno si la paridad no cierra
      (las restantes tienen que poder emparejarse entre sí, o sea quedar en
      número par). Ej.: S=3, P=2 → sólo 1 se lleva un par.
   a-ter. Mientras tenga ese cupo, la solitaria elige entre las de A DOS,
      no entre todas (S4). Ofrecerle el conjunto entero la dejaba emparejarse
      con otra solitaria —una patrulla de 2— gastando el cupo igual: con
      1 recurvo y 5 compuestos salían una de 2 y una de 4 en vez de dos de 3.
   b. Las unidades SENIOR restantes se combinan entre sí,
      priorizando misma categoría (S1), luego misma estaca.
   c. Una unidad que queda sola forma su propia patrulla
      (válida si tiene 2 arqueros; si tiene 1, se fusiona con otra
      unidad solitaria respetando H1..H3).
6. Si quedan unidades no senior (ESCUELA o PRINCIPIANTES) sin SENIOR disponible:
      NO se arma una patrulla 100% no senior.
      Esos arqueros quedan en `unassigned`, se emite el warning
      `CATEGORIA_SIN_SENIOR` y se marca `requiresManualReview = true`.
      El admin los ubica a mano. Nunca se pierde un arquero en silencio.
7. Ordenar las patrullas y numerarlas 1..N.
8. Asignar blanco de inicio:  startTarget = floor(k × T / N) + 1   (k 0-based, T = cantidad de blancos)
9. Dentro de cada unidad, asignar posición izquierda/derecha por el mismo orden determinista.
10. Generar credenciales de patrulla (ver §6).
```

### Salida

```ts
interface PatrolPlan {
  patrols: Array<{
    number: number;
    startTargetIndex: number;
    units: Array<{                       // A y B
      label: 'A' | 'B';
      stake: Stake;
      category: BowCategory;
      members: Array<{ archerId: string; position: 'izquierda' | 'derecha' }>;
    }>;
  }>;
  warnings: PatrolWarning[];             // ej. { code: 'CATEGORIA_SIN_SENIOR', patrolNumber: 3 }
  requiresManualReview: boolean;
}
```

### Edición manual

El admin puede reacomodar patrullas a mano **antes de iniciar el torneo**. El validador `validatePatrols()` vuelve a chequear `H1..H4`, más dos reglas del conjunto, y devuelve la lista de violaciones:

| Código | Qué informa |
|---|---|
| `PATROL_SIZE` · `MIXED_UNIT` · `ALL_ESCUELA` · `STAKE_MISMATCH` | `H1`..`H4`, patrulla por patrulla |
| `TOO_MANY_PAIRS` | Más de una patrulla de dos, **y existe un reparto mejor** (`S4`) |
| `DUPLICATE_START` | Dos patrullas arrancan en el mismo blanco: se cruzan en el recorrido |

La UI las muestra de forma prominente, **pero no bloquea el guardado**: el admin conoce el terreno y puede tener razones válidas para una excepción. La decisión queda registrada en el audit log.

**El tamaño es la excepción.** El guardado exige entre 2 y 4 arqueros en todas las patrullas que tengan gente. Un arquero solo no tiene quién le controle el puntaje: no es una excepción que alguien pueda decidir, es un torneo que no se puede correr. Una patrulla **vacía** sí se puede guardar —es un estado intermedio mientras se reacomoda— y simplemente no se manda al servidor.

**No se puede imprimir con cambios sin guardar.** La planilla en papel es la única fuente de verdad en el monte; no puede decir algo distinto de lo que la app va a mandar.

Una vez el torneo pasa a `en_proceso`, las patrullas quedan **congeladas**.

---

## 6. Credenciales de patrulla

- Usuario: `patrulla` + número. Ej. `patrulla1`, `patrulla2`, …
- PIN: **6 dígitos**, generado con RNG criptográfico (`crypto.randomInt`). Nunca secuencial ni derivado del número de patrulla.
- Alcance: la credencial solo es válida **mientras el torneo está `en_proceso`**. Al pasar a `completado`, las sesiones de patrulla se invalidan.
- Almacenamiento: `pinHash` con argon2id (verificación) + `pinEnc` con AES-256-GCM (para que el admin pueda volver a mostrarlo). Ver el tradeoff completo en [`SECURITY.md`](SECURITY.md).
- El admin puede **regenerar** el PIN de una patrulla en cualquier momento (invalida las sesiones activas de esa patrulla).

---

## 7. Validación de un blanco (`validateTargetScore`)

Dado `{ modalidad, flechas, arrows[] }`:

1. `arrows.length === flechas` → si no, error `ARROW_COUNT`.
2. Cada token ∈ set de la modalidad → si no, error `INVALID_TOKEN` con índice y token.
3. `total = Σ valor(token)`; se verifica `0 ≤ total ≤ maxTargetScore` (invariante, no debería fallar si 1 y 2 pasan).
4. Se recalculan `innerCount`, `xCount`, `mCount` y `tiebreakCounts` desde los tokens.

Errores tipados: `ARROW_COUNT` · `INVALID_TOKEN` · `SCORE_RANGE`.

**Importante:** el token válido depende de la modalidad **de ese blanco**, no del torneo. Un `11` es válido en un blanco 3D e inválido en el blanco de sala del mismo torneo.

---

## 8. Ranking dentro de un torneo (podios)

Se calculan tres vistas: **general**, **por categoría** y **por estaca**.

Orden de clasificación (mayor a menor):

1. **Puntaje total** (desc).
2. **Cantidad de inner** (desc): suma de `X` + `X6` + `11` según los blancos tirados.
3. **Cantidad de 10** (desc).
4. **Menor cantidad de `M`** (asc).

> **Qué cuenta como "10".** `tenCount` cuenta las flechas **que valen 10**, así que la `X` entra (vale 10) y también el `10` del 3D. El juego de campo aporta 0, porque su máximo por flecha es 6 y no existe el token.
>
> Esto sigue la convención de World Archery, donde los 10 incluyen las X. Como el criterio 2 ya separó por inner, contar la X de nuevo en el criterio 3 no altera el orden entre dos arqueros con distinto conteo de X: solo desempata a los que empataron en inner.
>
> El criterio 2 usa el token inner **de cada modalidad**, así que en un recorrido multitarget se suman `X` (sala y aire libre), `X6` (campo) y `11` (3D). Los tres representan lo mismo: la zona central del blanco.

Si persiste el empate → **puesto compartido**: ambos figuran en la misma posición y la siguiente posición se saltea (1, 2, 2, 4).

> **Nota sobre multitarget.** Como todos los arqueros de un torneo recorren los **mismos blancos** (solo cambia el orden de inicio), los totales del torneo sí son directamente comparables entre sí. La normalización de §9 aplica solo al comparar **entre torneos distintos**.

---

## 9. Ranking de liga (temporada)

> **Regla propia del club.**

Una **temporada** es una entidad creada por el admin (ej. "Liga Bahiense 2026") con fecha de inicio y fin. Cada torneo pertenece a una temporada.

Solo los torneos en estado **`publicado`** impactan la liga.

> **El ranking «por posición» (puntos 5-4-3-2-1 por puesto en el podio de cada torneo) se retiró el 2026-10-24.** Existió hasta entonces como uno de los dos modos de ranking de liga. Queda **un solo modo**: «mejor de N» (§9.1), con N configurable. Ver la entrada de esa fecha en [`BITACORA.md`](BITACORA.md) para el porqué y el detalle de qué se borró (`leaguePoints`, `podiums` y todo lo que los mostraba).

### 9.1 Ranking «mejor de N»

Se toma el **promedio de los N mejores `normalizedPct`** que el arquero logró en la temporada. `N` es la variable de entorno `LEAGUE_BEST_N` (default 2) — ver [`CONFIG.md`](CONFIG.md) §2 — no un número fijo en el código.

```
normalizedPct = (totalDelTorneo / maxPossibleScore(eseTorneo)) × 100
mejorDeN       = promedio(los N normalizedPct más altos de la temporada)
```

> **Por qué N y no el mejor.** Un porcentaje suelto premia el día bueno: un arquero que tira excelente una vez y flojo el resto queda por encima de otro que sostiene un nivel alto todo el año. El promedio de los N mejores mide lo que la liga quiere medir, que es la regularidad.

> **Por qué normalizado.** Cada torneo multitarget tiene una configuración distinta (14 blancos vs 20, distinta mezcla de modalidades) y por lo tanto un máximo posible distinto. Comparar puntajes brutos entre torneos premiaría al que tiró el recorrido más largo, no al que mejor tiró. El % es lo comparable; el bruto se conserva porque es el dato que los arqueros reconocen.

El **mejor resultado suelto** de la temporada se sigue guardando y mostrando —el `%`, el puntaje bruto que lo originó y el torneo donde ocurrió— porque es el récord personal que el arquero reconoce. Pero **no ordena el ranking**: eso lo hace el promedio de los N mejores.

### 9.2 Requisito de participación

Un arquero necesita **al menos N torneos publicados** en la temporada para figurar en el ranking — el mismo `N` de §9.1. Con menos, el promedio de «mejor de N» no tiene sentido: con 2 torneos y `N=3`, el promedio sería de 2 valores, no de 3, y el arquero no clasificaría en igualdad de condiciones con el resto.

Con menos torneos que `N` publicados, el arquero aparece en el podio de cada torneo que disputó, pero no en el ranking de liga.

### 9.3 Desempate en la liga

Mejor promedio de «mejor de N» → más inner totales (`X`+`X6`+`11`) → menos `M`.

Si persiste, puesto compartido.

### 9.4 Escuela y principiantes

`escuela` y `principiantes` son dos categorías más: cada una tiene su podio en cada torneo y su ranking de liga, con las mismas reglas que el resto.

---

## 10. Estadísticas derivadas

### Por participante en un torneo
`total` · `normalizedPct` · promedio por flecha y por blanco · mejor y peor blanco · `xCount` · `tenCount` · `innerCount` · `mCount` · evolución blanco a blanco · distribución por anillo · desglose por modalidad (cuánto sumó en los 3D vs en los de campo).

### Por torneo
Total de `X`, de `10` y de `M` · promedio general y por categoría · mejor puntaje general y por categoría · distribución agregada · cantidad de blancos completados por patrulla.

### Por arquero en la liga (ficha pública)
Torneos disputados · mejor y peor puntaje (bruto y %) · total de `X`, `10` y `M` acumulados · evolución torneo a torneo.

Todas se calculan desde los **rollups denormalizados** de `participants`, no recorriendo las flechas. Ver [`TECHNICAL.md`](TECHNICAL.md).

---

## 11. Trazabilidad al brief

| Requisito del brief | Dónde se resuelve |
|---|---|
| "en los blancos 3d se tiran 2 flechas, en campo y sala 3, en los fita 6" | §1 |
| "estacas azul, amarilla y roja para determinar las distancias" | §4 |
| Los 5 criterios de armado de patrullas | §5 (`H1`–`H4`, `S1`–`S3`) |
| Los ejemplos de patrullas correctas e incorrectas | §5, tabla de ejemplos normativos |
| "usuarios patrulla + numero, password de 4 digitos" | §6 — elevado a **6 dígitos**, ver `SECURITY.md` |
| "ranking por mejor puntaje" (puntos por posición 5-4-3-2-1) | Implementado y luego **retirado** el 2026-10-24 — ver nota al inicio de §9 y `BITACORA.md` |
| "ranking por puntos" (mejor puntaje de los torneos) | §9.1, «mejor de N» normalizado — `N` configurable desde el 2026-10-24, antes fijo en 2 |
| "es necesario tener al menos 2 torneos para entrar en los rankings" | §9.2 — el mínimo es `N`, no un 2 fijo, desde el 2026-10-24 |
| "puntajes ordenados de mayor a menor" | §2 |
| "cantidad de X, de 10 y de M" | §10 |
