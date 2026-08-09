# Desarrollo

## Stack

- Para el FrontEnd se usara React y TypeScript
- Para el BackEnd se usara Node
- Como base de datos se usara MongoDb
- Se alojara en raillway

## Landing page
Debe tener:
1. Seccion Introduccion: Con Titulo, Descripcion, Accesos a las wab apps WAFA y WAFL.
2. Seccion Ranking: Ranking de la liga separado por categoria. Hay dos tipos de ranking: 
- ranking por mejor puntaje: Se ganan puntos por la posicion de cada torneo, 1er lugar gana 5 puntos, 2do lugar 4 pts, 3re lugar 3pts, 4to lugar 2 pts, 5to lugar 1 punto, el resto no recibe puntaje (esto es por categoria)
- ranking por puntos: Se elije el mejor puntaje de los torneos tirados.
(es necesario tener al menos 2 torneos para entrar en los rankings)
3. Seccion Listado de torneos: Se muestra la lista de torneos realizados, se puede ingresar y ver los puntajes de cada participante.
4. Seccion arquero: Al seleccionar a un arquero del ranking se accede a una nueva pagina donde se pueden ver estadisticas del arquero (cantidad de torneos tirados, mejor puntaje, peor puntaje, cantidad de x, cantidad de 10, cantidad de M)

## WAFA (Web App for Admin)
1. LOGIN: Debe tener un login para acceder. El usuario sera admin y el password CBA2026.
2. HOME: En la pagina principal se veran listados todos los torneos creados (los completados y los en proceso). Se debe poder crear nuevos torneos.
3. CREAR_TORNEO: En la pagina de creacion de torneos se debe poder elegir la cantidad de blancos, para cada blanco se debe elegir la modalidad (sala, aire libre, juego de campo, 3D), la cantidad de flechas a tirar en cada blanco (por defecto usara la del reglamento que corresponda, pero puede setearse por el admin en caso de querer tirar mas o menos), seleccionar (continuar 🚀)


