/**
 * Home de WAFL: el recorrido.
 *
 * Los blancos aparecen **ordenados desde el de inicio de la patrulla**: si
 * arranca en el 10 de un recorrido de 14, ve `10, 11, …, 14, 1, …, 9`.
 * El backend ya los manda rotados; acá sólo se muestran.
 *
 * Ver `docs/FUNCTIONAL.md` §7.2.
 */

import type { Modality } from '@bal/shared';
import { useEffect, useState } from 'react';
import { Button, cn, Screen } from '../components/ui.js';
import type { BundleTarget, StoredBundle, StoredScore } from '../offline/db.js';
import { readScores } from '../offline/db.js';
import { SyncBadge } from './SyncBadge.js';

const ETIQUETA: Record<Modality, string> = {
  sala: 'Sala 18 m',
  aire_libre: 'Aire libre',
  campo: 'Juego de campo',
  '3d': '3D',
};

export interface CircuitPageProps {
  readonly bundle: StoredBundle;
  readonly onAbrirBlanco: (target: BundleTarget) => void;
  readonly onResultados: () => void;
}

export function CircuitPage({ bundle, onAbrirBlanco, onResultados }: CircuitPageProps) {
  const [scores, setScores] = useState<StoredScore[]>([]);

  useEffect(() => {
    void readScores().then(setScores);
  }, []);

  const total = bundle.participants.length;

  /**
   * Un blanco está completo cuando TODOS los arqueros tienen su puntaje.
   *
   * Con `total === 0` la comparación sería verdadera para todos los blancos:
   * un bundle sin arqueros daba el recorrido entero por hecho y habilitaba las
   * firmas. Sin arqueros no hay nada completo.
   */
  const completos = new Set(
    total === 0
      ? []
      : bundle.tournament.targets
          .map((t) => t.index)
          .filter((index) => {
            const delBlanco = scores.filter(
              (s) => s.targetIndex === index && s.arrows.length === arrowsDe(bundle, index),
            );
            return delBlanco.length >= total;
          }),
  );

  // El `> 0` es por la misma razón: un torneo sin blancos daba `0 === 0`.
  const recorridoCompleto =
    bundle.tournament.targets.length > 0 && completos.size === bundle.tournament.targets.length;

  return (
    <div className="flex flex-col min-h-dvh">
      <header className="sticky top-0 z-10 bg-[var(--bg)] border-b px-4 py-2 flex items-center justify-between gap-3">
        <span className="font-semibold">Patrulla {bundle.patrol.number}</span>
        <SyncBadge />
      </header>

      <Screen conBarraFija>
        <div className="pt-2">
          <h1 className="font-[var(--font-display)] text-[var(--text-display)] font-bold">
            {bundle.tournament.name}
          </h1>
          <p className="text-[var(--ink-muted)]">
            {completos.size} de {bundle.tournament.targets.length} blancos · arrancás en el{' '}
            {bundle.patrol.startTargetIndex}
          </p>
        </div>

        {bundle.tournament.targets.length === 0 && (
          <p className="text-[var(--ink-muted)]">Este torneo todavía no tiene blancos cargados.</p>
        )}

        <ul className="flex flex-col gap-2">
          {bundle.tournament.targets.map((target) => {
            const completo = completos.has(target.index);
            return (
              <li key={target.index}>
                <button
                  type="button"
                  onClick={() => onAbrirBlanco(target)}
                  className={cn(
                    'w-full min-h-[64px] px-4 py-3 rounded-[var(--radius-lg)] border',
                    'flex items-center gap-3 text-left',
                    completo ? 'bg-[var(--surface-2)]' : 'bg-[var(--surface)]',
                  )}
                >
                  <span
                    data-testid="numero-blanco"
                    className="font-[var(--font-display)] text-2xl font-bold tabular-nums w-10 shrink-0"
                  >
                    {target.index}
                  </span>

                  <span className="flex flex-col grow">
                    <span className="font-medium">{ETIQUETA[target.modality]}</span>
                    <span className="text-sm text-[var(--ink-muted)]">
                      {target.arrows} {target.arrows === 1 ? 'flecha' : 'flechas'}
                      {target.description ? ` · ${target.description}` : ''}
                    </span>
                  </span>

                  <span
                    className={cn(
                      'text-sm shrink-0',
                      completo ? 'text-[var(--ok)]' : 'text-[var(--ink-muted)]',
                    )}
                  >
                    {completo ? 'Completo' : 'Pendiente'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Screen>

      <div className="sticky bottom-0 mt-auto px-4 py-4 bg-[var(--bg)] border-t">
        <Button ancho disabled={!recorridoCompleto} onClick={onResultados}>
          Resultados finales
        </Button>

        {!recorridoCompleto && (
          <p className="pt-2 text-sm text-[var(--ink-muted)] text-center">
            Vas a poder firmar cuando estén cargados todos los blancos.
          </p>
        )}
      </div>
    </div>
  );
}

function arrowsDe(bundle: StoredBundle, targetIndex: number): number {
  return bundle.tournament.targets.find((t) => t.index === targetIndex)?.arrows ?? 0;
}
