/**
 * El trazo común de toda la iconografía.
 *
 * **Un solo `Svg` para las tres familias.** Los íconos de modalidad vienen de
 * `bv-easy-archery-battle`; los de categoría se remapearon; los de acción se
 * dibujaron acá porque en aquel repo no existen. Si cada familia trajera su
 * propio grosor de línea, se vería que vienen de tres lados distintos.
 *
 * `currentColor` es lo que permite que un ícono tome el color de su chip sin
 * que nadie se lo pase: es la razón por la que son componentes y no archivos
 * `.svg` cargados con `<img>`.
 */

import type { ReactNode, SVGProps } from 'react';

export interface IconoProps extends SVGProps<SVGSVGElement> {
  readonly size?: number;
}

export function Svg({
  size = 20,
  strokeWidth = 1.8,
  children,
  ...resto
}: IconoProps & { readonly children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorativo por defecto: el texto que acompaña dice qué es. Quien lo use
      // suelto tiene que pasarle su propio `aria-label` y `role="img"`.
      aria-hidden
      {...resto}
    >
      {children}
    </svg>
  );
}

export type Icono = (p: IconoProps) => ReactNode;
