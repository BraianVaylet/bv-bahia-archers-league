/**
 * Ranking de liga dentro de WAFA.
 *
 * **Los mismos datos y los mismos endpoints públicos que la landing.** El admin
 * lo mira desde acá para no cambiar de app en medio de la fecha; el JSX está
 * duplicado a propósito, por la misma razón que el resto de las primitivas de
 * cada paquete: no comparten bundle, y arrastrar la biblioteca de la landing a
 * la PWA le sumaría peso a una app que tiene que abrir sin señal.
 *
 * Lo que **no** se duplica son las decisiones —qué medalla lleva cada puesto—
 * que viven en `@bal/shared`.
 *
 * Un solo modo desde el 2026-10-24: «mejor de N», con `bestN` que manda el
 * servidor (`LEAGUE_BEST_N`). El ranking por posición se retiró. Ver
 * `docs/FUNCTIONAL.md` §5.2 · `docs/DOMAIN_WA.md` §9.
 */

import { type BowCategory, CATEGORY_INFO, medallaDe, textoDeRanking } from '@bal/shared';
import { IconoCompartir } from '@bal/ui';
import { useCallback, useEffect, useState } from 'react';
import { Button, clasesDeTarjeta, cn, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { api } from '../../lib/apiClient.js';

interface Temporada {
  readonly id: string;
  readonly name: string;
}

interface Entrada {
  readonly archerId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly tournamentsPlayed: number;
  readonly bestNormalizedPct: number;
  readonly bestNAvgPct: number;
  readonly position?: number;
  readonly tied?: boolean;
}

interface VistaDeRanking {
  readonly ranked: readonly Entrada[];
  readonly notYetEligible: readonly Entrada[];
}

interface CategoriaRankeada {
  readonly category: BowCategory;
  readonly general: VistaDeRanking;
  readonly femenino: VistaDeRanking;
  readonly masculino: VistaDeRanking;
}

/** El emoji nunca va solo: lleva su nombre. Ver `docs/DESIGN_SYSTEM.md` §10. */
function Medalla({ puesto }: { readonly puesto?: number | undefined }) {
  const medalla = medallaDe(puesto);
  if (!medalla) return null;

  return (
    <span role="img" aria-label={medalla.nombre}>
      {medalla.emoji}
    </span>
  );
}

const VISTAS = [
  { key: 'general', label: 'General' },
  { key: 'femenino', label: 'Femenino' },
  { key: 'masculino', label: 'Masculino' },
] as const;

type Vista = (typeof VISTAS)[number]['key'];

/**
 * Una sola tira de pestañas arriba de todas las categorías, no una por
 * tarjeta. Mismo componente que la landing, duplicado por la misma razón que
 * el resto del JSX de este archivo: no comparten bundle. Ver `docs/FUNCTIONAL.md` §5.2.
 */
function Pestañas({
  vista,
  onElegir,
}: {
  readonly vista: Vista;
  readonly onElegir: (v: Vista) => void;
}) {
  return (
    <div role="tablist" aria-label="Ver ranking" className="flex gap-2">
      {VISTAS.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={vista === v.key}
          onClick={() => onElegir(v.key)}
          className={cn(
            'flex-1 min-h-[52px] rounded-[var(--radius-md)] border',
            vista === v.key
              ? 'bg-[var(--nock)] text-[var(--nock-ink)] font-semibold'
              : 'bg-[var(--surface)]',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function RankingPage({ onVolver }: { readonly onVolver: () => void }) {
  const [temporadas, setTemporadas] = useState<Temporada[]>();
  const [elegida, setElegida] = useState('');
  const [bestN, setBestN] = useState(2);
  const [categorias, setCategorias] = useState<CategoriaRankeada[]>();
  const [error, setError] = useState<string>();
  const [copiado, setCopiado] = useState(false);
  const [vista, setVista] = useState<Vista>('general');

  /**
   * Manda el ranking como texto.
   *
   * El texto lo arma `@bal/shared`, que es donde está probado: lo que se
   * comparte tiene que ser exactamente lo publicado, no una lectura del DOM.
   *
   * **Comparte la pestaña que está mirando**, no siempre General: las
   * pestañas no sirven de nada si lo que se manda por WhatsApp es otra cosa
   * que lo que se ve en pantalla. El nombre de la vista se suma al de la
   * temporada —`textoDeRanking` no sabe de sexo, es dominio puro de puntajes—
   * así que quien lo recibe sabe cuál de las tres está leyendo.
   */
  const compartir = async () => {
    const nombreTemporada =
      (temporadas ?? []).find((t) => t.id === elegida)?.name ?? 'Liga Bahiense';
    const etiquetaVista = VISTAS.find((v) => v.key === vista)?.label;
    const texto = textoDeRanking({
      temporada: vista === 'general' ? nombreTemporada : `${nombreTemporada} — ${etiquetaVista}`,
      bestN,
      categorias: (categorias ?? []).map((c) => ({
        category: c.category,
        ranked: c[vista].ranked.map((e, i) => ({
          position: e.position ?? i + 1,
          firstName: e.firstName,
          lastName: e.lastName,
          valor: e.bestNAvgPct,
        })),
      })),
    });

    try {
      if (navigator.share) {
        await navigator.share({ text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      // Cancelar el diálogo de compartir tira igual que un fallo. No es un
      // error del que haya que avisar: el usuario decidió no compartir.
    }
  };

  useEffect(() => {
    api
      .get<{ seasons: Temporada[] }>('/public/seasons')
      .then((r) => {
        setTemporadas(r.seasons);
        // La primera es la más reciente: el servidor las ordena por fecha.
        setElegida(r.seasons[0]?.id ?? '');
      })
      .catch(() => setTemporadas([]));
  }, []);

  const cargar = useCallback(async () => {
    if (!elegida) return;

    try {
      const r = await api.get<{ bestN: number; categories: CategoriaRankeada[] }>(
        `/public/rankings?seasonId=${elegida}`,
      );
      setBestN(r.bestN);
      setCategorias(r.categories);
      setError(undefined);
    } catch {
      setError('No se pudo cargar el ranking. Revisá la conexión.');
    }
  }, [elegida]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <Pantalla>
      <Encabezado titulo="Ranking" onVolver={onVolver} />

      <Screen>
        {temporadas?.length === 0 && (
          <p className="text-[var(--ink-muted)]">
            Todavía no hay temporadas cargadas. Creá una y publicá un torneo.
          </p>
        )}

        {temporadas !== undefined && temporadas.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="temporada-ranking" className="text-sm font-medium">
                Temporada
              </label>
              <select
                id="temporada-ranking"
                value={elegida}
                onChange={(e) => setElegida(e.target.value)}
                className="min-h-[52px] px-4 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
              >
                {temporadas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {/*
          Compartir el ranking **del modo que está elegido**.

          `navigator.share` donde exista —en el celular abre WhatsApp, mail y lo
          que el sistema ofrezca—; donde no, se copia al portapapeles. Nada de
          SDKs: la CSP prohíbe pedidos a otros hosts, y un botón de WhatsApp que
          no carga es peor que uno que copia.
        */}
        {categorias !== undefined && categorias.length > 0 && (
          <>
            <Pestañas vista={vista} onElegir={setVista} />

            <Button variante="secundario" onClick={() => void compartir()}>
              <span className="flex items-center justify-center gap-2">
                <IconoCompartir />
                {copiado ? 'Copiado' : 'Compartir'}
              </span>
            </Button>
          </>
        )}

        {categorias?.map((c) => (
          <section
            key={c.category}
            className="flex flex-col gap-2"
            data-testid={`cat-${c.category}`}
          >
            <h2 className="font-semibold">{CATEGORY_INFO[c.category].label}</h2>

            {c[vista].ranked.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">
                Nadie llegó todavía al mínimo de torneos en esta categoría.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {c[vista].ranked.map((e) => (
                  <li
                    key={e.archerId}
                    className={cn(clasesDeTarjeta(), 'flex items-center justify-between gap-3')}
                    data-testid={`fila-${e.lastName}`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="tabular-nums font-semibold w-8 shrink-0">
                        {e.position}
                        {e.tied && <span className="text-[var(--ink-muted)]">=</span>}
                      </span>
                      <Medalla puesto={e.position} />
                      <span className="truncate">
                        {e.lastName}, {e.firstName}
                      </span>
                    </span>

                    <span className="text-sm tabular-nums shrink-0 text-right font-semibold">
                      {e.bestNAvgPct}%
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* No se ocultan: esconderlos haría creer que se perdió su resultado. */}
            {c[vista].notYetEligible.length > 0 && (
              <details className="text-sm">
                <summary className="min-h-[44px] flex items-center cursor-pointer text-[var(--ink-muted)]">
                  {c[vista].notYetEligible.length} con menos de {bestN} torneos
                </summary>
                <ul className="flex flex-col gap-1 pb-2">
                  {c[vista].notYetEligible.map((e) => (
                    <li key={e.archerId} data-testid={`pendiente-${e.lastName}`}>
                      {e.lastName}, {e.firstName}{' '}
                      <span className="text-[var(--ink-muted)]">
                        — {e.tournamentsPlayed} {e.tournamentsPlayed === 1 ? 'torneo' : 'torneos'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        ))}
      </Screen>
    </Pantalla>
  );
}
