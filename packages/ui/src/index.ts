/**
 * `@bal/ui` — piezas de interfaz compartidas por la PWA y la landing.
 *
 * **Qué entra acá:** lo que tiene que verse igual en las tres aplicaciones —el
 * logo, el pie, la iconografía, los chips de categoría, modalidad y estaca, los
 * badges de estado, la piel de los botones y, desde `REF7-4`, la barra de
 * modalidades, el rótulo de sección, la tarjeta de torneo y el anillo de
 * recorrido—. Son builds separados; si cada uno tuviera su copia, se
 * irían separando sin que nadie lo note hasta ver las dos pantallas juntas. Es
 * el mismo razonamiento que puso los tokens de color en `@bal/shared`.
 *
 * **Qué NO entra:** los contenedores de página. `Screen` y `Encabezado` existen
 * con ese nombre en las dos aplicaciones y **no son el mismo componente**: el
 * de la PWA es una barra fija con vuelta atrás y ranura para el `SyncBadge`; el
 * de la landing es una navegación pública con enlaces. Unificarlos daría un
 * componente con dos modos, que es peor que dos componentes con un nombre
 * repetido.
 *
 * Sin I/O y sin estado global, igual que `@bal/shared`.
 */

export {
  AnilloDeRecorrido,
  type AnilloDeRecorridoProps,
  type TamañoDeAnillo,
} from './AnilloDeRecorrido.js';
export { AnillosDeFondo } from './AnillosDeFondo.js';
export {
  BarraDeModalidades,
  type BarraDeModalidadesProps,
  type ParteDeLaBarra,
} from './BarraDeModalidades.js';
export { BotonTema } from './BotonTema.js';
export {
  botonClases,
  clasesDeBotonIcono,
  type OpcionesDeBoton,
  type TamañoDeBoton,
  type VarianteDeBoton,
} from './boton.js';
export {
  BadgeEstado,
  type BadgeEstadoProps,
  ChipCategoria,
  ChipModalidad,
  type ChipProps,
} from './Chips.js';
export { cn } from './cn.js';
export {
  type AplicacionDestino,
  enlaceEntreApps,
  PUERTOS_DE_DESARROLLO,
} from './despliegue.js';
export { type ComponenteDeEnlace, EnlaceNativo, type PropsDeEnlace } from './enlace.js';
export { Footer, type FooterProps } from './Footer.js';
export {
  GraficoDeEvolucion,
  type GraficoDeEvolucionProps,
  type PuntoDeEvolucion,
} from './GraficoDeEvolucion.js';
export {
  type ColorDeParte,
  GraficoDeTorta,
  type GraficoDeTortaProps,
  type ParteDeTorta,
} from './GraficoDeTorta.js';
export * from './iconos/acciones.js';
export type { Icono, IconoProps } from './iconos/base.js';
export { Svg } from './iconos/base.js';
export * from './iconos/categoria.js';
export { ICONO_DE_CATEGORIA } from './iconos/categoria.js';
export * from './iconos/modalidad.js';
export { ICONO_DE_MODALIDAD } from './iconos/modalidad.js';
export * from './iconos/navegacion.js';
export { Logo, type LogoProps } from './Logo.js';
export { NOMBRE_DEL_SITIO, useAlCambiarDeRuta, useTituloDePagina } from './navegacion.js';
export {
  COLOR_DE_CATEGORIA,
  COLOR_DE_MODALIDAD,
  type ParDeColor,
  TONOS_DE_ESTACA,
} from './paleta.js';
export { RotuloDeSeccion, type RotuloDeSeccionProps } from './RotuloDeSeccion.js';
export { StakeChip, type StakeChipProps } from './StakeChip.js';
export {
  clasesDeTarjeta,
  type DensidadDeTarjeta,
  type NivelDeTarjeta,
  type OpcionesDeTarjeta,
} from './Tarjeta.js';
export {
  type ResumenDeTorneo,
  TarjetaDeTorneo,
  type TarjetaDeTorneoProps,
} from './TarjetaDeTorneo.js';
export { alternarTema, COLOR_DE_BARRA, resolverTema, TEMA_KEY, type Tema } from './tema.js';
