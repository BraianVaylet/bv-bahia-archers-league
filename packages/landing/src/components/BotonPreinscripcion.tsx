/**
 * El botón al formulario de pre-inscripción de un torneo (`FE-36`).
 *
 * El link lo carga el admin y el servidor sólo acepta `https:` (`BE-27`, `docs/SECURITY.md` §16).
 * Acá se vuelve a mirar antes de dibujarlo: React **no** bloquea un `javascript:` en un `href`, y
 * una respuesta vieja en caché o un intermediario podrían traer otra cosa. Si no es `https:`, no se
 * dibuja nada.
 *
 * Sale del sitio: otra pestaña, sin `window.opener` ni referer para el sitio externo. El dominio va
 * a la vista, para que se sepa adónde lleva antes de tocarlo.
 *
 * Lo usan el detalle de un torneo y «Próximas fechas» (`FE-38`).
 */

import { botonClases, cn, IconoEnlaceExterno } from '@bal/ui';

/** El link parseado si es `https:`, o `null` si no hay o no sirve. */
export function linkDePreinscripcion(valor: string | null | undefined): URL | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function BotonPreinscripcion({
  href,
  className,
}: {
  readonly href: string | null | undefined;
  readonly className?: string;
}) {
  const url = linkDePreinscripcion(href);
  if (!url) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <a
        // El valor tal cual llegó: no se reconstruye ni se «arregla» (`SECURITY.md` §16).
        href={href ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(botonClases({}), 'gap-2')}
      >
        Pre-inscribirme
        <IconoEnlaceExterno size={18} />
        <span className="sr-only">(se abre en otra pestaña)</span>
      </a>
      <span className="text-sm text-[var(--ink-muted)]">{url.hostname}</span>
    </div>
  );
}
