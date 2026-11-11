/**
 * El hero de la portada (`REF7-6`, `DISENO.md` §5.1-1): la banda `monte` con los anillos, el
 * titular, la bajada, los dos accesos y la foto con la tarjeta del torneo que importa ahora.
 *
 * **No espera a ningún pedido.** El titular y los accesos se dibujan de entrada; la temporada del
 * antetítulo y la tarjeta aparecen cuando llegan. En un celular con señal mala, lo primero que se
 * ve es de qué se trata el sitio, no un «Cargando».
 */

import {
  AnilloDeRecorrido,
  AnillosDeFondo,
  BadgeEstado,
  botonClases,
  clasesDeTarjeta,
  cn,
  IconoFlecha,
} from '@bal/ui';
import { avanceAgregado, type TorneoListado } from '../../lib/portada.js';
import type { Temporada } from '../../lib/temporada.js';
import type { Recurso } from '../../lib/useRecurso.js';
import { EnlaceInterno } from '../ui.js';

export interface DetalleEnCurso {
  readonly targets: readonly unknown[];
  readonly patrols: readonly { readonly targetsCompleted: number }[];
}

/**
 * La tarjeta del torneo que importa ahora: el que está en curso, con su avance; si no hay, la
 * última fecha publicada. Toda la tarjeta enlaza al torneo.
 */
function TarjetaDestacada({
  torneo,
  detalle,
  flotante,
}: {
  readonly torneo: TorneoListado;
  readonly detalle: Recurso<DetalleEnCurso>;
  /** Sobre la foto (con foto) o debajo de los accesos (sin foto). */
  readonly flotante: boolean;
}) {
  const enCurso = torneo.status === 'en_proceso';
  const avance = enCurso && detalle.estado === 'listo' ? avanceAgregado(detalle.datos) : null;

  return (
    <EnlaceInterno
      href={`/torneos/${torneo.id}`}
      data-testid="tarjeta-destacada"
      className={cn(
        clasesDeTarjeta({ densidad: 'ninguna', enlace: true }),
        'grid grid-cols-[auto_1fr] items-center gap-4 p-4 text-[var(--ink)]',
        flotante
          ? 'absolute left-3 right-3 -bottom-10 min-[760px]:left-[-32px] min-[760px]:right-auto min-[760px]:-bottom-7 min-[760px]:w-[320px] min-[760px]:shadow-[var(--shadow-float)]'
          : 'mt-8 max-w-[400px]',
      )}
    >
      {/* El anillo sólo con datos reales (§6.5): el avance de todas las patrullas juntas. */}
      {avance ? (
        <AnilloDeRecorrido total={avance.total} completados={avance.completados} tamaño={76} />
      ) : null}
      <div className={cn('min-w-0', avance ? null : 'col-span-2')}>
        <BadgeEstado status={torneo.status} publico />
        <h2 className="mt-1.5 mb-0.5 text-base font-semibold leading-[1.3]">{torneo.name}</h2>
        <p className="text-[13px] text-[var(--ink-muted)]">
          {enCurso
            ? avance
              ? `${avance.patrullas} patrullas en el recorrido`
              : 'Ver en vivo'
            : 'Ver podios'}
        </p>
      </div>
    </EnlaceInterno>
  );
}

/** «2026», del inicio de la temporada. Del texto y no de `Date`: en UTC−3 el 1/1 es el 31/12. */
const añoDe = (temporada: Temporada | null) => temporada?.startsAt?.slice(0, 4) ?? null;

export function Hero({
  foto,
  temporada,
  destacado,
  detalle,
}: {
  /** `null` si no hay foto (decisión 1): el hero queda en una columna, sólo con los anillos. */
  readonly foto: string | null;
  readonly temporada: Temporada | null;
  readonly destacado: TorneoListado | null;
  readonly detalle: Recurso<DetalleEnCurso>;
}) {
  const año = añoDe(temporada);
  const tarjeta = (flotante: boolean) =>
    destacado ? (
      <TarjetaDestacada torneo={destacado} detalle={detalle} flotante={flotante} />
    ) : null;

  return (
    <section
      data-testid="hero"
      aria-labelledby="titular"
      className="relative overflow-hidden bg-[var(--monte)] text-[var(--monte-ink)]"
    >
      <AnillosDeFondo className="w-[560px] h-[560px] -right-[260px] -top-[140px] min-[760px]:w-[900px] min-[760px]:h-[900px] min-[760px]:-top-[200px]" />

      <div
        className={cn(
          'relative mx-auto w-full max-w-[1200px] grid items-center gap-8 px-4 pt-12 pb-16',
          'min-[760px]:gap-12 min-[760px]:py-16',
          foto ? 'min-[760px]:grid-cols-[1.05fr_1fr]' : null,
        )}
      >
        <div>
          <p className="font-mono text-eyebrow uppercase text-[var(--monte-muted)]">
            {año ? `Temporada ${año} · Bahía Blanca` : 'Bahía Blanca'}
          </p>

          <h1
            id="titular"
            className="font-display my-4 text-[40px] leading-[0.95] font-extrabold tracking-[-0.02em] min-[760px]:text-hero"
          >
            La liga de <em className="not-italic text-[var(--monte-accent)]">arquería</em> de
            Bahía&nbsp;Blanca.
          </h1>

          <p className="max-w-[480px] text-base leading-[1.55] text-[var(--monte-muted)] min-[760px]:text-lg min-[760px]:leading-[1.55]">
            Torneos todo el año, recorridos dinámicos en el predio del Círculo Bahiense de Arquería.
            Seguí los resultados, los podios y el ranking de cada categoría.
          </p>

          <div className="mt-8 flex flex-col gap-3 min-[760px]:flex-row">
            <EnlaceInterno href="/ranking" className={botonClases({ tamaño: 'lg' })}>
              Ver el ranking
              <IconoFlecha />
            </EnlaceInterno>
            <EnlaceInterno
              href="/torneos"
              className={botonClases({ variante: 'sobreMonte', tamaño: 'lg' })}
            >
              Torneos
            </EnlaceInterno>
          </div>

          {foto ? null : tarjeta(false)}
        </div>

        {foto ? (
          <div className="relative mb-10 min-[760px]:mb-0">
            {/*
              Decorativa: el titular dice de qué se trata. `width`/`height` y `height:auto`: sin
              dimensiones el texto salta cuando la imagen llega, y con señal mala eso pasa siempre.
            */}
            <img
              src={foto}
              alt=""
              width={1120}
              height={630}
              loading="eager"
              className="block w-full h-auto aspect-[4/3] min-[760px]:aspect-[4/3.2] object-cover rounded-[var(--radius-lg)]"
            />
            {tarjeta(true)}
          </div>
        ) : null}
      </div>
    </section>
  );
}
