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
  BOW_CATEGORIES,
  type BowCategory,
  CATEGORY_INFO,
  formatearFecha,
  formatearMonto,
  MAX_ARROWS_PER_TARGET,
  MIN_ARROWS_PER_TARGET,
  MODALITIES,
  type Modality,
  SCORING,
} from '@bal/shared';
import { useCallback, useEffect, useState } from 'react';
import { Button, cn, Encabezado, Field, Screen } from '../../components/ui.js';
import { ApiError, api } from '../../lib/apiClient.js';
import {
  type ArqueroElegible,
  agregarBlanco,
  avisoDeComposicion,
  type BorradorTorneo,
  borradorVacio,
  conModalidad,
  conteoPorCategoria,
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
        className="rounded-[var(--radius-lg)] border p-3 bg-[var(--surface-2)] flex items-baseline justify-between"
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
            className="rounded-[var(--radius-lg)] border p-3 flex flex-col gap-2 bg-[var(--surface)]"
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
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  aria-label={`Bajar el blanco ${b.index}`}
                  disabled={i === borrador.blancos.length - 1}
                  onClick={() => set(moverBlanco(borrador.blancos, b.index, 1))}
                  className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border disabled:opacity-40"
                >
                  <span aria-hidden="true">↓</span>
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar el blanco ${b.index}`}
                  disabled={borrador.blancos.length === 1}
                  onClick={() => set(eliminarBlanco(borrador.blancos, b.index))}
                  className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border disabled:opacity-40"
                >
                  <span aria-hidden="true">✕</span>
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

function AltaRapida({ onCreado }: { readonly onCreado: (a: ArqueroElegible) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [category, setCategory] = useState<BowCategory>('razo');
  const [error, setError] = useState<string>();

  const crear = async () => {
    try {
      const r = await api.post<{ archer: ArqueroElegible }>('/admin/archers', {
        firstName,
        lastName,
        category,
      });
      onCreado(r.archer);
      setFirstName('');
      setLastName('');
      setAbierto(false);
      setError(undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el arquero.');
    }
  };

  if (!abierto) {
    return (
      <Button variante="secundario" ancho onClick={() => setAbierto(true)}>
        Arquero nuevo
      </Button>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border p-3 flex flex-col gap-3 bg-[var(--surface)]">
      {/* Se crea sin salir del wizard: mandar al admin al padrón y de vuelta le
          haría perder todo lo cargado. */}
      <h3 className="font-semibold">Arquero nuevo</h3>

      <Field label="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      <Field label="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoria-nueva" className="text-sm font-medium">
          Categoría
        </label>
        <select
          id="categoria-nueva"
          value={category}
          onChange={(e) => setCategory(e.target.value as BowCategory)}
          className="min-h-[52px] px-4 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
        >
          {BOW_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_INFO[c].label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variante="secundario" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button ancho disabled={!firstName.trim() || !lastName.trim()} onClick={() => void crear()}>
          Crear y sumar
        </Button>
      </div>
    </div>
  );
}

function PasoParticipantes({
  borrador,
  onCambio,
}: {
  readonly borrador: BorradorTorneo;
  readonly onCambio: (b: Partial<BorradorTorneo>) => void;
}) {
  const [padron, setPadron] = useState<ArqueroElegible[]>();
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    const params = busqueda.trim() ? `?q=${encodeURIComponent(busqueda.trim())}` : '';
    try {
      const r = await api.get<{ archers: ArqueroElegible[] }>(`/admin/archers${params}`);
      setPadron(r.archers);
    } catch {
      setPadron([]);
    }
  }, [busqueda]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const elegidos = new Set(borrador.elegidos.map((a) => a.id));

  const alternar = (a: ArqueroElegible) => {
    onCambio({
      elegidos: elegidos.has(a.id)
        ? borrador.elegidos.filter((x) => x.id !== a.id)
        : [...borrador.elegidos, a],
    });
  };

  const aviso = avisoDeComposicion(borrador.elegidos, borrador.blancos.length);
  const conteo = conteoPorCategoria(borrador.elegidos);

  /**
   * Agrega los que se están viendo, sin sacar ninguno de los ya elegidos.
   *
   * Con la búsqueda vacía es todo el padrón; con una búsqueda escrita, sólo lo
   * filtrado. Es lo que hace usable inscribir a los 30 de la fecha sin 30
   * toques, que es el caso normal.
   */
  const agregarTodos = () => {
    const nuevos = (padron ?? []).filter((a) => !elegidos.has(a.id));
    if (nuevos.length > 0) onCambio({ elegidos: [...borrador.elegidos, ...nuevos] });
  };

  const faltanPorAgregar = (padron ?? []).filter((a) => !elegidos.has(a.id)).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--ink-muted)]" data-testid="conteo-elegidos">
        {borrador.elegidos.length} arqueros elegidos
      </p>

      <div className="flex gap-2 flex-wrap">
        <Button variante="secundario" disabled={faltanPorAgregar === 0} onClick={agregarTodos}>
          {busqueda.trim() ? 'Agregar los filtrados' : 'Agregar todos'}
          {faltanPorAgregar > 0 && ` (${faltanPorAgregar})`}
        </Button>

        {borrador.elegidos.length > 0 && (
          <Button variante="secundario" onClick={() => onCambio({ elegidos: [] })}>
            Quitar todos
          </Button>
        )}
      </div>

      {conteo.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {conteo.map((c) => (
            <li
              key={c.category}
              className="h-7 px-2.5 rounded-full bg-[var(--surface-2)] text-sm flex items-center"
            >
              {CATEGORY_INFO[c.category].label}: {c.cantidad}
            </li>
          ))}
        </ul>
      )}

      {/* El aviso corre el MISMO algoritmo que el servidor, así que no adivina. */}
      {aviso.nivel !== 'ok' && (
        <p
          role={aviso.nivel === 'error' ? 'alert' : 'status'}
          className={cn(
            'text-sm rounded-[var(--radius-md)] border p-3',
            aviso.nivel === 'error' ? 'text-[var(--danger)]' : 'text-[var(--warn)]',
          )}
        >
          {aviso.mensaje}
        </p>
      )}

      <AltaRapida onCreado={(a) => onCambio({ elegidos: [...borrador.elegidos, a] })} />

      <Field
        label="Buscar en el padrón"
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <ul className="flex flex-col gap-1.5">
        {padron?.map((a) => (
          <li key={a.id}>
            <label className="flex items-center gap-3 min-h-[44px] px-3 rounded-[var(--radius-md)] border bg-[var(--surface)]">
              <input
                type="checkbox"
                checked={elegidos.has(a.id)}
                onChange={() => alternar(a)}
                className="w-5 h-5"
              />
              <span className="flex-1">
                {a.lastName}, {a.firstName}
              </span>
              <span className="text-sm text-[var(--ink-muted)]">
                {CATEGORY_INFO[a.category].label}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
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
    <section className="rounded-[var(--radius-lg)] border p-3 flex flex-col gap-2 bg-[var(--surface)]">
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
          <ul className="pt-1 flex flex-wrap gap-1.5">
            {conteoPorCategoria(borrador.elegidos).map((c) => (
              <li
                key={c.category}
                className="px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--surface-2)]"
              >
                {CATEGORY_INFO[c.category].label}: {c.cantidad}
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
    <div className="flex flex-col min-h-dvh">
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

      <div className="sticky bottom-0 mt-auto px-4 py-4 bg-[var(--bg)] border-t flex flex-col gap-2">
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
    </div>
  );
}
