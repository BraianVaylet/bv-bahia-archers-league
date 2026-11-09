/**
 * El rótulo de una sección: eyebrow, cantidad, filete y una acción opcional (`REF7-4` / `C-4`). Es
 * el `SectionHeader` de `docs/post/ref-7/DISENO.md` §4.7.
 *
 * **Semántica de encabezado, aspecto de rótulo.** Es un `<h2>` (o el nivel que se pida): un lector
 * de pantalla lo encuentra al saltar por títulos, y la cantidad va adentro para que se escuche
 * «En curso 3» y no un número suelto.
 */

import { cn } from './cn.js';
import { type ComponenteDeEnlace, EnlaceNativo } from './enlace.js';
import { IconoFlecha } from './iconos/navegacion.js';

export interface RotuloDeSeccionProps {
  readonly titulo: string;
  readonly cantidad?: number;
  /** A la derecha: «Ver todas», «Ranking completo». */
  readonly accion?: { readonly texto: string; readonly href: string };
  /** Con qué se dibuja el enlace de la acción. Ver `enlace.tsx`. */
  readonly enlace?: ComponenteDeEnlace;
  readonly nivel?: 2 | 3;
  readonly className?: string;
}

export function RotuloDeSeccion({
  titulo,
  cantidad,
  accion,
  enlace: Enlace = EnlaceNativo,
  nivel = 2,
  className,
}: RotuloDeSeccionProps) {
  const Titulo = nivel === 2 ? 'h2' : 'h3';

  return (
    <div className={cn('flex items-center gap-2 pb-2 border-b', className)}>
      <Titulo className="flex items-center gap-2 font-mono text-eyebrow uppercase text-[var(--ink-muted)]">
        {titulo}
        {cantidad === undefined ? null : (
          <span
            data-cantidad
            className="font-mono text-xs font-semibold min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--surface-2)] text-[var(--ink)]"
          >
            {cantidad}
          </span>
        )}
      </Titulo>

      {accion ? (
        <Enlace
          href={accion.href}
          className="ml-auto min-h-[44px] inline-flex items-center gap-1 text-sm font-semibold text-[var(--nock-text)] hover:underline underline-offset-[3px]"
        >
          {accion.texto}
          <IconoFlecha size={16} />
        </Enlace>
      ) : null}
    </div>
  );
}
