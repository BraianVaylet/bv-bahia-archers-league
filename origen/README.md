# Imágenes de origen

Los archivos grandes **tal como llegaron**, sin tocar. De acá salen los assets
que se publican, con `node scripts/imagenes.mjs`.

Están afuera de `packages/shared/assets/` a propósito: esa carpeta se empaqueta
y se publica con `@bal/shared`, y un PNG de 2,8 MB no tiene por qué viajar con
la biblioteca. Acá quedan como referencia, para poder volver a generar las
salidas si cambia un tamaño o un formato.

| Archivo | Qué genera |
|---|---|
| `wallpaper.png` | `packages/shared/assets/portada.webp` |

El logo del CBA vive en `packages/logos/` y genera `assets/cba.webp`. Es de un
club, no del proyecto: se reescala y nada más.
