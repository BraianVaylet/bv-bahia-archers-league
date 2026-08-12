# Primer gran Refactor 

Modificaciones detectadas luego del primer MVP generado por Claude Code Opus 5.

## Generales

- Todas las aplicaciones deben tener la posibilidad de cambiar el tema (claro/oscuro) desde un icono en el header.
- Crear un logo para la liga Bahiense de Arqueros de Bahia Blanca al estilo del de el CBA (club donde se organiza la liga)
- Incorporar en la landingpage el logo del CBA (circulo Bahiense de Arqueria) que se encuentran en el fichero circulo-bahiense-de-arqueria-vector-logo-seeklogo.
- Usa iconografia o emojis para complementar y mejorar la UI.
- Formatear correctamente todas las fechas.
- Cambiar el ranking "Por mejor puntaje" a un nuevo Ranking "mejor de 2" en este nuevo ranking se toman los mejores dos % de todos los torneos tirados por el arquero se calculo el promedio de ambos y ese se usa.


## Landingpage
1. Agregar los logos del CBA y de la Liga Bahiense de Arqueros.
2. Agrega un imagen relacionada al tiro con arco en la seccion de presentacion, arriva coloca el titulo, descripcion y los botones de acceso a las apps (WAFA y WAFL)
3. Luego muestra los accesos al ranking y a los torneos
4. Seccion Torneos:
- Resalta el estado del torneo.
- Mostrar el valor de la inscripcion del torneo.
- Dentro del torneo mostrar para cada arquero el puntaje, X, 10 y M, % y cuantos puntos sumaron.
- En las patrullas, mostrar nombre en un renglon y categoria y estaca en el renglon de abajo (en caso de nombres largos).
- En las seccion de recorrido dibujar un diagrama con cajas y lineas los blancos, cada caja debe mostrar la modalidad y la cantidad de flchas tiradas.
5. Seccion Ranking
- Resaltar los podios de cada categoria con color y agregar emojis.
- Agregar informacion de como se suman los puntos (cuantos puntos gana cada podio).

## WAFA
1. Seccion Arqueros:
- Agregar un filtro por categoria.
- Resaltar la categoria.
- Cambiar los botones de editar, archivar, eliminar cambiar por iconografia.
- mostrar la cantidad de torneos que tiro cada arquero.
2. Seccion Temporadas:
- Las temporadas deben poder editarse o archivarse (agregar iconografia para acceder a esas funciones).
3. Seccion Crear Torneo:
- En la etapa "Datos". Agregar un campo extra para pagos. Se debe mostrar un checkbox para determinar si el torneo es pago. Si se selecciona se muestra un input para ingresar el monto de la inscripcion (el campo debe estar formateado).
- En la etapa "Participantes" agregar una opcion de agregar todos.
4. Seccion "Patrullas":
- Valide casos en donde quedan dos patrullas de 2 arqueros, no se puede tener mas de 1 patrulla de 2 personas, en caso de tener mas de una se deben juntar.
- Cuando se editen las patrullas (moviendo arqueros de una a otra) debe permitir tener mas de 4, pero no dejarte Guardar las patrullas hasta que todas tengan maximo 4 y minimo 2. Ahora mismo si queres hacer un switch entre dos arqueros de patrullas de 4 no te permiten mover de una patrulla a la otra porque ambas ya tienen 4, deberia dejarte pero no guardar hasta que todas esten correctas.
- Antes de guardar las patrullas se debe validar que todas tengan un maximo de 4 y un minimo de 2 arqueros por patrulla. Tambien que todas inicien desde un blanco distinto, no pueden ser el mismo. Mostrar logs representativos para avisar al admin.
- No deberia poder imprimir hasta que se guarden las patrullas.
- Cuando se guarda una patrulla se muestra solo al inicio de la pagina, debe mostrarse al final, arriba del boton de Guardar y de imprimir.
- Una vez se guarda debe aparecer un boton para volver al inicio.
5. En la Home, mostrar cada torneo en 3 renglones Nombre, fecha, blancos · arqueros · patrullas.
6. Seccion torneos:
- Al ingresar a un torneo creado, ademas de los botones: "Patrullas y credenciales", "Iniciar torneo", agregar un tercer boton "Arqueros", este boton te lleva a una seccion con el listado de arqueros y un checkbox para registrar quienes pagaron y quienes no. 
- Mostrar la recaudacion del torneo en base a cuantos pagaron.
- Si el torneo esta en estado sin iniciar permitir eliminarlo o editarlo.
- BUG: En los avances de las patrullas en el torneo se esta calculando mal, hay patrullas con los 8 blancos realizados y se muestra como que tienen 7 de 8. (no se esta sumando correctamente)

## WAFL
Al seleccionar un torneo todas las patrullas tienen un usuario que se llaman patrulla y un numero.
- Cuando un usuario selecciona el torneo se debe cargar una botonera donde se escoja la patrullas correspondiente asi el usuario solo debe cargar el pin. El input Patrulla desaparece y aparece una serie de botones seleccionables con todas las patrullas disponibles para ese torneo.
- BUG: Los blancos aparecen todos con estado Completado, deben tener ese estado una vez tengan todos los puntos cargados.
- Los puntages deben poder editarse en todo momento hasta que los arqueros firmen.
- El Pad de puntejes debe permitir que los botones ocupen el mayor espacio posible, reduciendo los padings entre ellos. Ordenar para todas las modalidades de izquierda a derecha y de arriba hacia abajo.
- En la seccion de carga de puntos debe poder editarse en caso de ser mal cargados.
- El pad para firmar debe ocupar todo el espacio posible.
- El boton "cerrar circuito" debe cambiar a "finalizar torneo"
- La pagina de Circuito Cerrado debe tener un boton para redireccionar a la landingpage para esperar los resultados del torneo.
