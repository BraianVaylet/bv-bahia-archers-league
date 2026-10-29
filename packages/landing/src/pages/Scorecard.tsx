/**
 * Tarjeta de puntajes de un arquero en un torneo publicado: cada flecha de
 * cada blanco.
 *
 * Es a donde lleva cada fila de los resultados. La landing **no calcula nada**:
 * el valor de cada flecha, el total de cada blanco y el general vienen del
 * servidor, que los deriva de los tokens con `@bal/shared`.
 *
 * Un torneo sin publicar no tiene tarjetas: el endpoint responde 404 y acá se ve
 * como cualquier recurso que no existe.
 *
 * Ver `docs/FUNCTIONAL.md` §5.3.
 */

import {
  type BowCategory,
  formatearFecha,
  type Modality,
  type TarjetaDePuntajes,
} from '@bal/shared';
import { ChipCategoria, ChipModalidad } from '@bal/ui';
import { Link, useParams } from 'react-router-dom';
import { Cargando, clasesDeTarjeta, cn, Dato, Fallo, Screen, StakeChip } from '../components/ui.js';
import { useRecurso } from '../lib/useRecurso.js';

interface Tarjeta extends TarjetaDePuntajes {
  readonly tournament: { readonly id: string; readonly name: string; readonly date: string };
  readonly archer: {
    readonly firstName: string;
    readonly lastName: string;
    readonly category: BowCategory;
    readonly stake: string;
  };
  readonly normalizedPct: number;
  readonly xCount: number;
  readonly tenCount: number;
  readonly mCount: number;
}

type Flecha = NonNullable<TarjetaDePuntajes['rows'][number]['arrows']>[number];

const puntos = (n: number) => `${n} ${n === 1 ? 'punto' : 'puntos'}`;

/**
 * Una flecha: su token, y debajo lo que vale **sólo si el token no lo dice**.
 *
 * Una `X` vale 10 y una `M` vale 0: sin el valor al lado, quien no conoce la
 * notación no puede sumar lo que ve. Un `9` que vale 9 no necesita aclaración, y
 * repetirlo en cada caja sería ruido.
 *
 * Las cajas miden lo mismo con o sin aclaración, para que los totales de cada
 * renglón queden alineados. El nombre accesible dice las dos cosas con palabras.
 */
function CajaDeFlecha({ flecha }: { readonly flecha: Flecha }) {
  const aclara = flecha.token !== String(flecha.value);

  return (
    <li
      aria-label={`${flecha.token}, ${puntos(flecha.value)}`}
      className="min-w-[44px] h-11 px-2 grid place-content-center rounded-[var(--radius-sm)] border bg-[var(--surface)] text-center tabular-nums leading-none"
    >
      <span className="text-base font-semibold">{flecha.token}</span>
      {aclara && <span className="pt-0.5 text-xs text-[var(--ink-muted)]">{flecha.value}</span>}
    </li>
  );
}

function Blanco({ fila }: { readonly fila: TarjetaDePuntajes['rows'][number] }) {
  return (
    <li
      className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}
      data-testid={`blanco-${fila.index}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-semibold">Blanco {fila.index}</span>
          <ChipModalidad modality={fila.modality as Modality} compacto />
        </div>

        <span className="shrink-0 tabular-nums">
          <span className="font-[var(--font-display)] text-xl font-bold">
            {fila.arrows ? fila.total : '—'}
          </span>
          <span className="text-sm text-[var(--ink-muted)]"> / {fila.maxTotal}</span>
        </span>
      </div>

      {fila.arrows ? (
        <ol aria-label="Flechas" className="flex flex-wrap gap-1.5">
          {fila.arrows.map((flecha, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: las flechas se repiten (dos `10` iguales) y su lugar es lo único que las distingue
            <CajaDeFlecha key={`${fila.index}-${i}`} flecha={flecha} />
          ))}
        </ol>
      ) : (
        // No es un cero: a este arquero no se le cargó nada en este blanco.
        <p className="text-sm text-[var(--ink-muted)]">Sin puntaje</p>
      )}
    </li>
  );
}

export function ScorecardPage() {
  const { id = '', participantId = '' } = useParams();
  const resultado = useRecurso<{ scorecard: Tarjeta }>(
    `/tournaments/${encodeURIComponent(id)}/participants/${encodeURIComponent(participantId)}`,
  );

  if (resultado.estado === 'cargando') {
    return (
      <Screen>
        <Cargando />
      </Screen>
    );
  }

  if (resultado.estado === 'error') {
    return (
      <Screen>
        <Fallo mensaje={resultado.mensaje} />
        <Link to={`/torneos/${encodeURIComponent(id)}`} className="underline">
          Volver al torneo
        </Link>
      </Screen>
    );
  }

  const t = resultado.datos.scorecard;

  return (
    <Screen>
      <div className="pt-6">
        {/* Adonde se vino: la fila de los resultados. Es lo primero porque en un
            celular el botón «atrás» no siempre está a mano. */}
        <Link
          to={`/torneos/${encodeURIComponent(id)}`}
          className="inline-flex items-center min-h-[44px] text-sm underline"
        >
          ← {t.tournament.name}
        </Link>

        <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
          {t.archer.lastName}, {t.archer.firstName}
        </h1>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ChipCategoria category={t.archer.category} />
          <StakeChip stake={t.archer.stake} />
        </div>

        <p className="pt-2 text-[var(--ink-muted)]">{formatearFecha(t.tournament.date)}</p>
      </div>

      {/* En el celular, dos renglones —puntaje y porcentaje; X, 10 y M— y no
          cuatro: lo que se vino a ver son las flechas, y no tienen que quedar
          abajo de una pantalla de números. */}
      <dl className="grid gap-2 grid-cols-3 sm:grid-cols-5" data-testid="resumen">
        <div className="col-span-2 sm:col-span-1">
          <Dato etiqueta="Puntaje" valor={t.total} detalle={`de ${t.maxTotal}`} />
        </div>
        <Dato etiqueta="Porcentaje" valor={`${t.normalizedPct}%`} />
        <Dato etiqueta="X" valor={t.xCount} />
        <Dato etiqueta="10" valor={t.tenCount} />
        <Dato etiqueta="M" valor={t.mCount} />
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Flechas por blanco</h2>

        <ol className="flex flex-col gap-2">
          {t.rows.map((fila) => (
            <Blanco key={fila.index} fila={fila} />
          ))}
        </ol>
      </section>
    </Screen>
  );
}
