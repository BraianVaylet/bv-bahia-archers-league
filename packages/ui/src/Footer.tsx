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
 *
 * **No trae margen propio.** Tenía `mt-8` y los dos únicos consumidores lo
 * cancelaban con `mt-0`: en una columna flex de alto fijo ese margen no es
 * aire, es un hueco entre el contenido y el pie. Un valor que todo el mundo
 * anula no es un default, es una trampa — el que agregue un consumidor nuevo se
 * come el hueco y no sabe de dónde salió. El espacio, si hace falta, lo pone
 * quien lo usa.
 */

import cba from '@bal/shared/assets/cba.webp';
import { cn } from './cn.js';
import { Logo } from './Logo.js';

export interface FooterProps {
  readonly className?: string;
  /** La landing tiene su propio ancho de columna. */
  readonly anchoMaximo?: string;
  /**
   * Versión de una línea, para las pantallas que terminan en barra de acción.
   *
   * **El alto es el recurso escaso.** `REF3-2` había sacado el pie de esas
   * pantallas justamente por eso; ahora se muestra siempre, y lo que cede es el
   * tamaño del pie, no el del teclado de scoring. Ver `docs/DESIGN_SYSTEM.md`.
   */
  readonly compacto?: boolean;
}

export function Footer({ className, anchoMaximo = 'max-w-3xl', compacto }: FooterProps) {
  /** Los dos escudos, juntos y a la izquierda. */
  const escudos = (
    <span className="flex items-center gap-2 shrink-0">
      {/*
        **El del CBA sobre una placa blanca, fija en los dos temas.**

        Es un PNG con fondo transparente y tinta oscura: sobre el fondo claro se
        ve, sobre el oscuro desaparece. Es el único asset del proyecto que
        depende del fondo —el resto es SVG con `currentColor` o trae su propia
        placa— y no se puede recolorear sin reinterpretar un logo que es de un
        club, no del proyecto.

        La placa es blanca literal, no un token: si siguiera al tema volvería a
        desaparecer, que es justo lo que se está arreglando.
      */}
      <span className="shrink-0 rounded-[var(--radius-sm)] bg-white p-1 flex items-center">
        {/*
          El `alt` no es decorativo acá.

          Antes el nombre del club iba escrito al lado, y ahora el texto visible
          es sólo el de la liga: si el `alt` quedara vacío, para un lector de
          pantalla el CBA **no existiría**. Es lo que queda de la regla de este
          archivo —cada logo con su nombre— después de mover el club al lado de
          la liga.
        */}
        <img
          src={cba}
          alt="Círculo Bahiense de Arquería"
          width={compacto ? 18 : 24}
          height={compacto ? 18 : 24}
        />
      </span>
      <Logo size={compacto ? 20 : 28} className="shrink-0" />
    </span>
  );

  return (
    <footer className={cn('border-t print:hidden text-sm text-[var(--ink-muted)]', className)}>
      <div
        className={cn(
          'mx-auto w-full px-4 flex items-center justify-between gap-4',
          compacto ? 'py-1.5' : 'py-6',
          anchoMaximo,
        )}
      >
        {escudos}
        <span className="truncate">Liga Bahiense</span>
      </div>
    </footer>
  );
}
