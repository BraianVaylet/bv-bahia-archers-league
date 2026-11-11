/**
 * Próximas fechas: los torneos que todavía no arrancaron, de hoy en adelante (`FE-38`,
 * `docs/FUNCTIONAL.md` §5.3, decisión 7 de la Fase 9).
 *
 * Sale de `GET /api/public/tournaments/upcoming` (`BE-28`) y muestra **sólo la convocatoria**:
 * cuándo, qué se tira, cuánto sale y, si el admin lo cargó, el botón para pre-anotarse. Quién está
 * anotado y cómo se arman las patrullas no: cambian hasta minutos antes de largar.
 *
 * **Sin próximas fechas, o si el pedido falla, no se dibuja nada.** Es un extra: un «no hay
 * fechas» o un error en la portada no le dicen nada útil a nadie, y el resto de la página se ve
 * igual.
 *
 * Vive en su propio archivo, y no en `Secciones.tsx`, para no tocar las secciones que ya existen.
 */

import { BarraDeModalidades, clasesDeTarjeta, cn, RotuloDeSeccion } from '@bal/ui';
import { bloqueDeFecha, proximasDeLaPortada, textoDeInscripcion } from '../../lib/proximas.js';
import type { Recurso } from '../../lib/useRecurso.js';
import { BotonPreinscripcion } from '../BotonPreinscripcion.js';
import { CONTENEDOR, TituloDeSeccion } from './Secciones.js';

/** Lo que manda `GET /api/public/tournaments/upcoming`. */
export interface ProximaFecha {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  readonly description: string;
  readonly registrationUrl: string | null;
  readonly payment: { readonly required: boolean; readonly amount: number };
  readonly targetCount: number;
  readonly modalities: readonly {
    readonly modality: Parameters<typeof BarraDeModalidades>[0]['modalidades'][number]['modality'];
    readonly count: number;
    readonly pct: number;
  }[];
}

function TarjetaDeProxima({ torneo }: { readonly torneo: ProximaFecha }) {
  const fecha = bloqueDeFecha(torneo.date);

  return (
    <article className={cn(clasesDeTarjeta(), 'flex h-full gap-4')}>
      {/* La fecha, grande: es lo primero que se busca. Un lector de pantalla lee «sáb 5 dic»; el
          `dateTime` es para las máquinas. Arriba (`self-start`), no estirada al alto de la tarjeta. */}
      {fecha ? (
        <time
          dateTime={torneo.date.slice(0, 10)}
          className="flex w-14 shrink-0 self-start flex-col items-center rounded-[var(--radius-md)] border py-2 text-center"
        >
          <span className="font-mono text-xs uppercase text-[var(--ink-muted)]">
            {fecha.diaDeLaSemana}
          </span>
          <span className="font-display text-[28px] leading-none font-bold">{fecha.dia}</span>
          <span className="font-mono text-xs uppercase text-[var(--ink-muted)]">{fecha.mes}</span>
        </time>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="text-h3 leading-tight">{torneo.name}</h3>
        <p className="text-sm text-[var(--ink-muted)]">
          {torneo.targetCount} blancos · {textoDeInscripcion(torneo.payment)}
        </p>
        {torneo.modalities.length > 0 ? (
          <BarraDeModalidades modalidades={torneo.modalities} />
        ) : null}
        {torneo.description ? (
          <p className="line-clamp-2 text-[15px] text-[var(--ink-muted)]">{torneo.description}</p>
        ) : null}
        <BotonPreinscripcion href={torneo.registrationUrl} className="mt-auto pt-1" />
      </div>
    </article>
  );
}

export function ProximasFechas({
  proximas,
  enPortada = false,
}: {
  readonly proximas: Recurso<{ tournaments: ProximaFecha[] }>;
  /** En la portada: las tres más cercanas, con el título grande de las secciones. */
  readonly enPortada?: boolean;
}) {
  if (proximas.estado !== 'listo') return null;
  const todas = proximas.datos.tournaments;
  if (todas.length === 0) return null;

  const lista = enPortada ? proximasDeLaPortada(todas) : todas;

  return (
    <section
      aria-label="Próximas fechas"
      data-testid="proximas-fechas"
      className={cn('flex flex-col gap-4', enPortada && `${CONTENEDOR} pt-12 pb-4`)}
    >
      {enPortada ? (
        <>
          <RotuloDeSeccion titulo="Lo que viene" cantidad={todas.length} nivel={false} />
          <TituloDeSeccion id="proximas-fechas">Próximas fechas</TituloDeSeccion>
        </>
      ) : (
        <RotuloDeSeccion titulo="Próximas fechas" cantidad={todas.length} />
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((t) => (
          <li key={t.id} className="grid">
            <TarjetaDeProxima torneo={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}
