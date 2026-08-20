/**
 * `@bal/ui` — piezas de interfaz compartidas por la PWA y la landing.
 *
 * **Qué entra acá:** lo que tiene que verse igual en las tres aplicaciones —el
 * logo, el pie, la iconografía, los chips de categoría, modalidad y estaca, y
 * los badges de estado—. Son builds separados; si cada uno tuviera su copia, se
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

export { BotonTema } from './BotonTema.js';
export {
  BadgeEstado,
  type BadgeEstadoProps,
  ChipCategoria,
  ChipModalidad,
  type ChipProps,
} from './Chips.js';
export { cn } from './cn.js';
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
export { Logo, type LogoProps } from './Logo.js';
export { StakeChip, type StakeChipProps } from './StakeChip.js';
export {
  clasesDeTarjeta,
  type DensidadDeTarjeta,
  type NivelDeTarjeta,
  type OpcionesDeTarjeta,
} from './Tarjeta.js';
