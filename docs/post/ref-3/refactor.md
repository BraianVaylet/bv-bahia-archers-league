# Tercer Refactor

## Generales
- Los footers de las 3 aplicaciones deben estan fijos y visibles en el fondo, de la pantalla, los headers deben estar fijos y visibles en la parte superior de la pantalla. Si el contenido no cabe entre ambos componentes se debe gestionar con un scroll.
- El logo del CBA es un png que en modo oscuro no se visualiza correctamente, colocar el logo del cba dentro de un div con background fijo y blanco.

## WAFA
- En la seccion de patrullas la informacion se ve muy apretada en moviles. Cada patrulla debe mostrar la unidad A y B, dentro de cada unidad debe verse en la primera fila el nombre completo, en la segunda fila la categoria y la estaca, en la tercera fila el lado de tiro y los accionables.
- BUG: Me encontre con esta situacion, tenia un torneo donde me quedaron 1 patrulla de 4 personas, 2 patrullas de 3 personas y una patrulla de 2, movi los arqueros de la patrulla de 2 uno a cada una de las patrullas de 3 personas. De esa forma me quede con 3 patrullas de 4 para el torneo. Elimine la patrulla que se quedo sin arqueros y al momento de guardar las patrullas me aparecio un error "La patrulla 4 no tiene arqueros, Movele alguien o eliminala" y volvio a aparecer. Volvi a repetir el proceso y no me permite avanzar.
