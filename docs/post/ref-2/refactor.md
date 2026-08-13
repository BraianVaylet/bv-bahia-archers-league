# Segundo refactor

## Generales (aplica a todo: landing, WAFA, WAFL)
- Deja de usar el logo svg creado y pasa a usar uno nuevo, el de "bv-easy-archery-battle" cambaindo los colores para que corresponda con el verde de acento de la app.
- Agrega el logo en el header de la landing y de las WAFA y WAFL.
- Agrega footers a las 3 aplicaciones con el nuevo logo de la liga y del CBA (circulo-bahiense-de-arqueria-seeklogo.png)
- Cuando se listen los torneos ademas de mostrar el nombre, la fecha, la cantidad de blancos, de arqueros y el estado. Sumar los porcentajes de modalidades (ejemplo: 50% Campo, 10% sala, 20% 3D, 20% aire libre) en un nuevo reenglon de forma representativa.
- Usar un badge de color para cada estado (En Proceso, Sin Iniciar, Completados sin Publicar, Publicados)
- Usar un color para identificar cada categoria (compuesto libre, compuesto cazador, recurvo olimpico, razo, tradicional, longbow y escuela)
- Usar un color para identificar cada una de las modalidades (sala, airelibre, juego de campo, 3D)
- Usar los iconos de "bv-easy-archery-battle" para las modalidades (sala, airelibre, juego de campo, 3D) y aplicarlos en las apps donde corresponda.


## Landingpage
1. Usa la imagen "wallpaper.png" como reemplazo de la actual "arqueria.svg"
2. En la seccion ranking:
- Cuando se tiene seleccionado "Por puntos" se debe mostrar la explicacion de los puntajes (lo que hoy se muestra al darle click a "Como se reparten los puntos")
- Cuando se tiene seleccionado "Mejor de 2" se debe mostrar la explicacion de como se calcula, explicando detalladamente que es el promedio de los dos mejores porcentajes obtenidos en los torneos realizados, con algun ejemplo
3. En la seccion del arquero, donde se muestran las estadisticas, cambiar el texto Emes por la letra M. Mostrar graficos de evolucion del campo "Mejor" vs cantidad de torneos.
4. Colocar dentro de una card cada una de las categorias donde aun no aplica el ranking, para dar separacion entre el contenido. Ejemplo: 
---
Longbow
Nadie llego todavia al minimo de torneos en esta categoria.
3 con menos de 2 torneos
---
Cada uno de esos bloques debe estar dentro de una card

## WAFA
- Usar un badge de color para cada estado (En Proceso, Sin Iniciar, Completados sin Publicar, Publicados)
- Usar un color para identificar cada categoria (compuesto libre, compuesto cazador, recurvo olimpico, razo, tradicional, longbow y escuela)
- El texto "Ya participó de un torneo, así que no se puede eliminar sin romper su histórico y los rankings. Archivalo: deja de aparecer al armar torneos nuevos y conserva todo." no debe estar siempre visible, que se muestre algun icono de notificacion o similar que lo muestre y oculte al presionar.
- Agregar una seccion "Recaudacion" donde se muestre cuando se recaudo por torneo y el total.
- En la seccion Ranking de la liga debe tener la posibilidad de compartirlo (por whatsapp, mail, etc) Debe compartir el ranking seleccionado (Por Puntos o Mejor de 2)
- Durante la creacion de un torneo, en la seccion revision mostrar porcentajes en las card Recorrido y Participantes, (en recorrido mostrar la distribucion de modalidades, ejemplo: que porcentaje del torneo corresponde a 3d, a sala, etc), (en la seccion participantes mostrar la distribucion de categorias, ejemplo: que porcentaje del total son compuestos, razos, etc.)
- Cuando un torneo esta en estado sin Iniciar debe poder editarlo por completo, agregar o quitar arqueros y blancos tambien.
- en la seccion de patrullas, ademas de poder mover arqueros de una patrulla a otra deber poder organizarlos dentro de la misma patrulla, agergar la opcion de subir bajar
- Si una patrulla se queda si arqueros se debe poder eliminar y se reacomodan la numeracion de las patrullas restantes. Ejemplo: si se elimina la patrulla2 porque sus arqueros se movieron a otras patrullas, esta se debe poder eliminar y luego la patrulla3 pasa a ser la patrulla2, la 4 pasa a ser la 3, etc. No se debe poder guardar si una patrulla no cumple las las reglas (tener una patrulla sin arqueros no se debe permitir)
- Al momento de iniciar el torneo debe salir un mensaje de validacion: "estas seguro de iniciar el torneo? si/no"
- Si un torneo en proceso no tiene ninguna actualizacion (ejemplo: ninguna patrulla cargo un resultado) se debe poder pasar a estado sin iniciar
- En la seccion de Pagos darle mas padding entre el boton de accion y el estado "debe/pago" Resaltar con color el estado Pago (verde) y no pago (rojo)

## WAFL
- En el login mostrar el nuevo logo de la liga y el del CBA
- En la home colorear los blancos por modalidad (usar icono tambien)
