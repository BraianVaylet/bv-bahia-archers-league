/**
 * Cómo un componente de `@bal/ui` dibuja un enlace sin depender del router.
 *
 * `@bal/ui` no importa `react-router-dom`: lo usan dos apps con routers propios, y la PWA ni
 * siquiera navega igual que la landing. Un componente que tiene enlaces (`RotuloDeSeccion`,
 * `TarjetaDeTorneo`, `Footer`) recibe **con qué** dibujarlos; si nadie le pasa nada, usa un `<a>`
 * común. Quien lo monta le pasa su `<Link>` para navegar sin recargar.
 */

import type { ComponentType, ReactNode } from 'react';

export interface PropsDeEnlace {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
  readonly 'data-testid'?: string;
}

export type ComponenteDeEnlace = ComponentType<PropsDeEnlace>;

/** El enlace por defecto: un `<a>` común, que recarga la página. */
export function EnlaceNativo({ href, className, children, ...resto }: PropsDeEnlace) {
  return (
    <a href={href} className={className} {...resto}>
      {children}
    </a>
  );
}
