/**
 * Ficha histórica de un arquero.
 *
 * Se arma desde los acumulados de temporada, que son los que quedan al publicar
 * un torneo. Un arquero **sin torneos publicados no tiene ficha**: el padrón del
 * club no se filtra hacia afuera.
 *
 * Ver `docs/FUNCTIONAL.md` §5.4.
 */

import { type BowCategory, CATEGORY_INFO } from '@bal/shared';
import { GraficoDeEvolucion } from '@bal/ui';
import { Link, useParams } from 'react-router-dom';
import { Cargando, Dato, Fallo, Screen } from '../components/ui.js';
import { useRecurso } from '../lib/useRecurso.js';

interface TemporadaDelArquero {
  readonly seasonId: string;
  readonly category: BowCategory;
  readonly tournamentsPlayed: number;
  readonly bestNormalizedPct: number;
  readonly bestRawScore: number;
  /** Promedio de los `bestN` mejores porcentajes: es lo que ordena el ranking. */
  readonly bestNAvgPct: number;
  readonly totalX: number;
  readonly totalTens: number;
  readonly totalM: number;
}

interface Arquero {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly seasons: readonly TemporadaDelArquero[];
  /**
   * Un punto por torneo publicado, del más viejo al más nuevo.
   *
   * Opcional: una respuesta vieja en caché no lo trae, y la ficha no puede
   * quedar en blanco por eso. Ver la entrada de `REF-7` en `BITACORA.md`.
   */
  readonly history?: readonly { seasonId: string; name: string; normalizedPct: number }[];
}

export function ArcherPage() {
  const { id = '' } = useParams();
  const ficha = useRecurso<{ archer: Arquero }>(`/archers/${id}`);

  if (ficha.estado === 'cargando') {
    return (
      <Screen>
        <Cargando />
      </Screen>
    );
  }

  if (ficha.estado === 'error') {
    return (
      <Screen>
        <Fallo mensaje={ficha.mensaje} />
        <Link to="/ranking" className="underline">
          Volver al ranking
        </Link>
      </Screen>
    );
  }

  const a = ficha.datos.archer;

  return (
    <Screen>
      <div className="pt-6">
        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
          {a.lastName}, {a.firstName}
        </h1>
      </div>

      {a.seasons.map((s) => (
        <section
          key={s.seasonId}
          className="flex flex-col gap-3"
          data-testid={`temporada-${s.seasonId}`}
        >
          <h2 className="font-semibold">{CATEGORY_INFO[s.category].label}</h2>

          <dl className="grid gap-2 grid-cols-2 sm:grid-cols-5">
            <Dato etiqueta="Torneos" valor={s.tournamentsPlayed} />
            {/* El que ordena el ranking va primero; el mejor suelto queda al
                lado porque es el récord que el arquero recuerda. */}
            <Dato etiqueta="Promedio" valor={`${s.bestNAvgPct}%`} />
            <Dato
              etiqueta="Mejor"
              valor={`${s.bestNormalizedPct}%`}
              detalle={`${s.bestRawScore} puntos`}
            />
            <Dato etiqueta="Inner" valor={s.totalX} />
            <Dato etiqueta="Dieces" valor={s.totalTens} />
            {/* «M» y no «Emes»: es como se anota en la planilla y como se dice
                en la línea de tiro. */}
            <Dato etiqueta="M" valor={s.totalM} />
          </dl>

          {/*
            Cómo viene la temporada, torneo por torneo.

            Mide **porcentaje**, no puntaje bruto: cada torneo tiene un máximo
            distinto y los puntajes de dos fechas no se comparan entre sí. Es la
            misma razón por la que el ranking usa `normalizedPct`.

            Con un solo torneo no dibuja nada, y de eso se hace cargo el
            componente.
          */}
          <GraficoDeEvolucion
            puntos={(a.history ?? [])
              .filter((h) => h.seasonId === s.seasonId)
              .map((h) => ({ name: h.name, normalizedPct: h.normalizedPct }))}
          />
        </section>
      ))}

      {a.seasons.length === 0 && (
        <p className="text-[var(--ink-muted)]">Todavía no participó de ningún torneo publicado.</p>
      )}
    </Screen>
  );
}
