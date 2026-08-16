/**
 * Pie de página de las tres aplicaciones.
 *
 * **Los dos logos llevan su nombre escrito.** Un logo es una imagen: si la red
 * no lo trajo, si el usuario tiene las imágenes apagadas, o si está leyendo con
 * un lector de pantalla, lo único que queda es el texto. Es la misma regla que
 * gobierna los chips de `REF2-1` y los colores de estaca desde el principio.
 *
 * **No se imprime.** El pie es navegación y crédito; una planilla de puntajes
 * no lo necesita y el papel del monte es caro.
 */

import cba from '@bal/shared/assets/cba.webp';
import { cn } from './cn.js';
import { Logo } from './Logo.js';

export interface FooterProps {
  readonly className?: string;
  /** La landing tiene su propio ancho de columna. */
  readonly anchoMaximo?: string;
}

export function Footer({ className, anchoMaximo = 'max-w-3xl' }: FooterProps) {
  return (
    <footer className={cn('border-t mt-8 print:hidden text-sm text-[var(--ink-muted)]', className)}>
      <div
        className={cn(
          'mx-auto w-full px-4 py-6 flex flex-wrap items-center justify-between gap-4',
          anchoMaximo,
        )}
      >
        <span className="flex items-center gap-2">
          <Logo size={28} className="shrink-0" />
          <span>Liga Bahiense de Arquería</span>
        </span>

        <span className="flex items-center gap-2">
          {/*
            **Sobre una placa blanca, fija en los dos temas.**

            Es un PNG con fondo transparente y tinta oscura: sobre el fondo
            claro se ve, sobre el oscuro desaparece. Es el único asset del
            proyecto que depende del fondo —el resto es SVG con `currentColor` o
            trae su propia placa— y no se puede recolorear sin reinterpretar un
            logo que es de un club, no del proyecto.

            La placa es blanca literal, no un token: si siguiera al tema volvería
            a desaparecer, que es justo lo que se está arreglando.
          */}
          <span className="shrink-0 rounded-[var(--radius-sm)] bg-white p-1 flex items-center">
            <img src={cba} alt="" width={24} height={24} />
          </span>
          <span>Círculo Bahiense de Arquería</span>
        </span>
      </div>
    </footer>
  );
}
