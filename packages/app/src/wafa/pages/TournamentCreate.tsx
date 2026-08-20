/**
 * Wizard de creación de torneo.
 *
 * Cuatro pasos. **Se puede volver a cualquiera desde la revisión**: el admin
 * arma el recorrido en el club, con gente alrededor, y se equivoca. Rehacer todo
 * por un blanco mal cargado no es una opción.
 *
 * Ver `docs/FUNCTIONAL.md` §6.3.
 */

import {
  distribucionDeCategorias,
  distribucionDeModalidades,
  formatearFecha,
  formatearMonto,
  MAX_ARROWS_PER_TARGET,
  MIN_ARROWS_PER_TARGET,
  MODALITIES,
  type Modality,
  SCORING,
} from '@bal/shared';
import { ChipCategoria, ChipModalidad, IconoBajar, IconoQuitar, IconoSubir } from '@bal/ui';
import { useEffect, useState } from 'react';
import {
  Button,
  clasesDeTarjeta,
  cn,
  Encabezado,
  Field,
  Pantalla,
  Screen,
} from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';
import { SelectorDeArqueros } from '../components/SelectorDeArqueros.js';
import {
  agregarBlanco,
  type BorradorTorneo,
  borradorVacio,
  conModalidad,
  cuerpoDeCreacion,
  eliminarBlanco,
  maximoDelRecorrido,
  moverBlanco,
  problemaDelPaso,
} from '../wizard.js';
import type { SeasonRow } from './Seasons.js';

const PASOS = ['Datos', 'Recorrido', 'Participantes', 'Revisión'] as const;

// ── Paso 1 · Datos generales ─────────────────────────────────────────────────

function PasoDatos({
  borrador,
  onCambio,
}: {
  readonly borrador: BorradorTorneo;
  readonly onCambio: (b: Partial<BorradorTorneo>) => void;
}) {
  const [temporadas, setTemporadas] = useState<SeasonRow[]>();

  useEffect(() => {
    api
      .get<{ seasons: SeasonRow[] }>('/admin/seasons')
      .then((r) => setTemporadas(r.seasons))
      .catch(() => setTemporadas([]));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Nombre"
        value={borrador.name}
        onChange={(e) => onCambio({ name: e.target.value })}
        placeholder="3ª fecha"
        required
      />
      <Field
        label="Fecha"
        type="date"
        value={borrador.date}
        onChange={(e) => onCambio({ date: e.target.value })}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="temporada" className="text-sm font-medium">
          Temporada
        </label>
        <select
          id="temporada"
          value={borrador.seasonId}
          onChange={(e) => onCambio({ seasonId: e.target.value })}
          className="min-h-[52px] px-4 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
          required
        >
          <option value="">Elegí una temporada</option>
          {temporadas?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {temporadas?.length === 0 && (
          <p className="text-sm text-[var(--ink-muted)]">
            No hay temporadas cargadas. Creá una antes de armar el torneo.
          </p>
        )}
      </div>

      <Field
        label="Descripción"
        value={borrador.description}
        onChange={(e) => onCambio({ description: e.target.value })}
        placeholder="Opcional"
      />

      {/* El monto es del torneo, uno solo para todos. Quién pagó se marca
          después, desde el detalle. Ver docs/SECURITY.md §2. */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Inscripción</legend>

        <label className="flex items-center gap-2 min-h-[44px]">
          <input
            type="checkbox"
            checked={borrador.payment.required}
            onChange={(e) =>
              onCambio({
                // Al desmarcar, el monto se va con la casilla: uno que sobrevive
                // apagado reaparece al volver a marcarla.
                payment: e.target.checked
                  ? { ...borrador.payment, required: true }
                  : { required: false, amount: 0 },
              })
            }
            className="w-5 h-5"
          />
          Este torneo cobra inscripción
        </label>

        {borrador.payment.required && (
          <Field
            label="Monto por arquero"
            type="number"
            min={1}
            step={1}
            value={borrador.payment.amount === 0 ? '' : String(borrador.payment.amount)}
            onChange={(e) =>
              onCambio({ payment: { required: true, amount: Number(e.target.value) || 0 } })
            }
            hint={
              borrador.payment.amount > 0
                ? `${formatearMonto(borrador.payment.amount)} por arquero`
                : 'En pesos, sin centavos.'
            }
          />
        )}
      </fieldset>
    </div>
  );
}

// ── Paso 2 · Recorrido ───────────────────────────────────────────────────────

function PasoRecorrido({
  borrador,
  onCambio,
}: {
  readonly borrador: BorradorTorneo;
  readonly onCambio: (b: Partial<BorradorTorneo>) => void;
}) {
  const set = (blancos: BorradorTorneo['blancos']) => onCambio({ blancos });

  return (
    <div className="flex flex-col gap-3">
      {/* El máximo posible se recalcula con cada cambio: es el número que hace
          comparable este torneo con los demás, y conviene verlo mientras se arma. */}
      <div
        className={cn(clasesDeTarjeta({ nivel: 'anidada' }), 'flex items-baseline justify-between')}
        data-testid="maximo-posible"
      >
        <span className="text-sm text-[var(--ink-muted)]">Máximo posible</span>
        <span className="font-[var(--font-display)] text-2xl font-bold tabular-nums">
          {maximoDelRecorrido(borrador.blancos)}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {borrador.blancos.map((b, i) => (
          <li
            key={b.index}
            className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}
            data-testid={`blanco-${b.index}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Blanco {b.index}</span>

              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label={`Subir el blanco ${b.index}`}
                  disabled={i === 0}
                  onClick={() => set(moverBlanco(borrador.blancos, b.index, -1))}
                  className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border disabled:opacity-40"
                >
                  <IconoSubir />
                </button>
                <button
                  type="button"
                  aria-label={`Bajar el blanco ${b.index}`}
                  disabled={i === borrador.blancos.length - 1}
                  onClick={() => set(moverBlanco(borrador.blancos, b.index, 1))}
                  className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border disabled:opacity-40"
                >
                  <IconoBajar />
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar el blanco ${b.index}`}
                  disabled={borrador.blancos.length === 1}
                  onClick={() => set(eliminarBlanco(borrador.blancos, b.index))}
                  className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border disabled:opacity-40"
                >
                  <IconoQuitar />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1.5">
                <label htmlFor={`modalidad-${b.index}`} className="text-sm font-medium">
                  Modalidad
                </label>
                <select
                  id={`modalidad-${b.index}`}
                  value={b.modality}
                  onChange={(e) =>
                    set(
                      borrador.blancos.map((x) =>
                        x.index === b.index ? conModalidad(x, e.target.value as Modality) : x,
                      ),
                    )
                  }
                  className="min-h-[52px] px-3 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
                >
                  {MODALITIES.map((m) => (
                    <option key={m} value={m}>
                      {SCORING[m].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-28">
                <Field
                  label="Flechas"
                  id={`flechas-${b.index}`}
                  type="number"
                  min={MIN_ARROWS_PER_TARGET}
                  max={MAX_ARROWS_PER_TARGET}
                  value={b.arrows}
                  onChange={(e) =>
                    set(
                      borrador.blancos.map((x) =>
                        x.index === b.index ? { ...x, arrows: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
              </div>
            </div>

            <Field
              label="Descripción"
              id={`descripcion-${b.index}`}
              value={b.description ?? ''}
              onChange={(e) =>
                set(
                  borrador.blancos.map((x) =>
                    x.index === b.index ? { ...x, description: e.target.value || null } : x,
                  ),
                )
              }
              placeholder="Opcional — «Jabalí», «bajada larga»…"
            />
          </li>
        ))}
      </ul>

      <Button variante="secundario" ancho onClick={() => set(agregarBlanco(borrador.blancos))}>
        Agregar blanco
      </Button>
    </div>
  );
}

// ── Paso 3 · Participantes ───────────────────────────────────────────────────

function PasoParticipantes({
  borrador,
  onCambio,
}: {
  readonly borrador: BorradorTorneo;
  readonly onCambio: (b: Partial<BorradorTorneo>) => void;
}) {
  return (
    <SelectorDeArqueros
      elegidos={borrador.elegidos}
      blancos={borrador.blancos.length}
      onCambio={(elegidos) => onCambio({ elegidos })}
    />
  );
}

// ── Paso 4 · Revisión ────────────────────────────────────────────────────────

function PasoRevision({
  borrador,
  onIrA,
}: {
  readonly borrador: BorradorTorneo;
  readonly onIrA: (paso: number) => void;
}) {
  const seccion = (titulo: string, paso: number, contenido: React.ReactNode) => (
    <section className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{titulo}</h3>
        {/* Editable: se vuelve al paso, no se rehace el torneo. */}
        <button
          type="button"
          onClick={() => onIrA(paso)}
          className="min-h-[44px] text-sm underline"
        >
          Editar
        </button>
      </div>
      {contenido}
    </section>
  );

  return (
    <div className="flex flex-col gap-3">
      {seccion(
        'Datos',
        1,
        <div className="text-sm text-[var(--ink-muted)]">
          <p>{borrador.name}</p>
          <p>{formatearFecha(borrador.date)}</p>
        </div>,
      )}

      {seccion(
        'Recorrido',
        2,
        <div className="text-sm text-[var(--ink-muted)]">
          <p>
            {borrador.blancos.length} blancos · máximo {maximoDelRecorrido(borrador.blancos)}
          </p>
          {/* De qué está hecho el recorrido, antes de la lista blanco por
              blanco: es lo que se mira para decidir si el torneo es el que se
              quiso armar. */}
          <ul className="pt-1 flex flex-wrap gap-1.5" data-testid="reparto-modalidades">
            {distribucionDeModalidades(borrador.blancos.map((b) => b.modality)).map((m) => (
              <li key={m.modality}>
                <ChipModalidad modality={m.modality} pct={m.pct} compacto />
              </li>
            ))}
          </ul>

          <ol className="pt-1 flex flex-wrap gap-1.5">
            {borrador.blancos.map((b) => (
              <li
                key={b.index}
                className="px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--surface-2)]"
              >
                {b.index}. {SCORING[b.modality].label} ×{b.arrows}
              </li>
            ))}
          </ol>
        </div>,
      )}

      {seccion(
        'Participantes',
        3,
        <div className="text-sm text-[var(--ink-muted)]">
          <p>{borrador.elegidos.length} arqueros</p>
          {/* Con el porcentaje, no sólo el conteo: «6 compuestos» dice poco
              sin saber si son 6 de 8 o 6 de 40. */}
          <ul className="pt-1 flex flex-wrap gap-1.5" data-testid="reparto-categorias">
            {distribucionDeCategorias(borrador.elegidos.map((a) => a.category)).map((c) => (
              <li key={c.category} className="flex items-center gap-1">
                <ChipCategoria category={c.category} compacto />
                <span>
                  {c.count} · {c.pct}%
                </span>
              </li>
            ))}
          </ul>
        </div>,
      )}

      <p className="text-sm text-[var(--ink-muted)]">
        Al confirmar se congela un snapshot de cada arquero, se asignan las estacas, se arman las
        patrullas y se generan las credenciales. El torneo queda sin iniciar y todavía editable.
      </p>
    </div>
  );
}

// ── Wizard ───────────────────────────────────────────────────────────────────

export interface TournamentCreatePageProps {
  readonly onVolver: () => void;
  readonly onCreado: (tournamentId: string) => void;
}

export function TournamentCreatePage({ onVolver, onCreado }: TournamentCreatePageProps) {
  const [paso, setPaso] = useState(1);
  const [borrador, setBorrador] = useState<BorradorTorneo>(borradorVacio);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const cambiar = (parcial: Partial<BorradorTorneo>) => setBorrador((b) => ({ ...b, ...parcial }));

  const problema = problemaDelPaso(paso, borrador);

  const confirmar = async () => {
    setError(undefined);
    setEnviando(true);

    try {
      const r = await api.post<{ tournament: { id: string } }>(
        '/admin/tournaments',
        cuerpoDeCreacion(borrador),
      );
      onCreado(r.tournament.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear. Revisá la conexión.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Pantalla>
      <Encabezado titulo="Crear torneo" onVolver={onVolver} />

      <Screen conBarraFija>
        <ol className="pt-4 flex gap-1.5" aria-label="Pasos">
          {PASOS.map((nombre, i) => (
            <li
              key={nombre}
              aria-current={paso === i + 1 ? 'step' : undefined}
              className={cn(
                'flex-1 text-center text-xs py-2 rounded-[var(--radius-sm)]',
                paso === i + 1
                  ? 'bg-[var(--nock)] text-[var(--nock-ink)] font-semibold'
                  : 'bg-[var(--surface-2)] text-[var(--ink-muted)]',
              )}
            >
              {nombre}
            </li>
          ))}
        </ol>

        {paso === 1 && <PasoDatos borrador={borrador} onCambio={cambiar} />}
        {paso === 2 && <PasoRecorrido borrador={borrador} onCambio={cambiar} />}
        {paso === 3 && <PasoParticipantes borrador={borrador} onCambio={cambiar} />}
        {paso === 4 && <PasoRevision borrador={borrador} onIrA={setPaso} />}

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </Screen>

      <div className="shrink-0 px-4 py-4 bg-[var(--bg)] border-t flex flex-col gap-2">
        {problema && paso !== 4 && (
          <p className="text-sm text-[var(--ink-muted)] text-center">{problema}</p>
        )}

        <div className="flex gap-2">
          {paso > 1 && (
            <Button variante="secundario" onClick={() => setPaso(paso - 1)}>
              Atrás
            </Button>
          )}

          {paso < 4 ? (
            <Button ancho disabled={problema !== undefined} onClick={() => setPaso(paso + 1)}>
              Continuar
            </Button>
          ) : (
            <Button ancho disabled={enviando} onClick={() => void confirmar()}>
              {enviando ? 'Creando…' : 'Crear torneo'}
            </Button>
          )}
        </div>
      </div>
    </Pantalla>
  );
}
