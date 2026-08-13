/**
 * Resultados finales, firmas y cierre del circuito.
 *
 * **Las firmas no habilitan el guardado, habilitan el cierre.** Los puntajes ya
 * están guardados desde la primera flecha. Ver `docs/FUNCTIONAL.md` §7.5.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button, cn, Encabezado, Screen } from '../components/ui.js';
import type { StoredBundle, StoredScore, StoredSignature } from '../offline/db.js';
import { readScores, readSignatures } from '../offline/db.js';
import { requestClose, writeSignature } from '../offline/outbox.js';
import { nudge } from '../offline/syncWorker.js';
import { SignaturePad } from './SignaturePad.js';
import { SyncBadge } from './SyncBadge.js';

export interface ResultsPageProps {
  readonly bundle: StoredBundle;
  readonly onVolver: () => void;
  readonly onCerrado: () => void;
}

export function ResultsPage({ bundle, onVolver, onCerrado }: ResultsPageProps) {
  const [scores, setScores] = useState<StoredScore[]>([]);
  const [firmas, setFirmas] = useState<StoredSignature[]>([]);
  const [firmando, setFirmando] = useState<string>();
  const [aviso, setAviso] = useState<string>();

  const recargar = useCallback(async () => {
    const [s, f] = await Promise.all([readScores(), readSignatures()]);
    setScores(s);
    setFirmas(f);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  /**
   * **Una firma que el servidor rechazó no es una firma.**
   *
   * Contar toda firma guardada dejaba pasar las que quedaron en `conflict`: el
   * botón desaparecía, el líder cerraba el circuito, y en el servidor no había
   * nada. Hay que poder volver a firmar.
   */
  const firmados = new Set(
    firmas.filter((f) => f.syncState !== 'conflict').map((f) => f.participantId),
  );

  const resumen = bundle.participants.map((p) => {
    const propios = scores.filter((s) => s.participantId === p.id);
    return {
      ...p,
      total: propios.reduce((n, s) => n + s.total, 0),
      inner: propios.reduce((n, s) => n + s.innerCount, 0),
      dieces: propios.reduce((n, s) => n + s.tenCount, 0),
      emes: propios.reduce((n, s) => n + s.mCount, 0),
      firmado: firmados.has(p.id),
      porBlanco: propios.sort((a, b) => a.targetIndex - b.targetIndex),
    };
  });

  const faltanFirmas = resumen.filter((r) => !r.firmado);

  const firmar = async (participantId: string, png: string) => {
    await writeSignature(participantId, png);
    setFirmando(undefined);
    await recargar();
    nudge();
  };

  const cerrar = async () => {
    const r = await requestClose();
    if (!r.ok) {
      // Sin señal no se puede cerrar, pero los puntajes YA están guardados:
      // se dice explícitamente para que nadie crea que perdió el trabajo.
      setAviso(r.message);
      nudge();
      return;
    }

    setAviso(undefined);
    nudge();
    onCerrado();
  };

  if (firmando) {
    const quien = resumen.find((r) => r.id === firmando);
    if (quien) {
      return (
        <Screen>
          <div className="pt-4">
            <SignaturePad
              nombre={`${quien.lastName}, ${quien.firstName}`}
              total={quien.total}
              onFirmar={(png) => void firmar(quien.id, png)}
              onCancelar={() => setFirmando(undefined)}
            />
          </div>
        </Screen>
      );
    }
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <Encabezado onVolver={onVolver} textoVolver="← Blancos">
        <SyncBadge />
      </Encabezado>

      <Screen conBarraFija>
        <h1 className="pt-2 font-[var(--font-display)] text-[var(--text-display)] font-bold">
          Resultados
        </h1>

        {aviso && (
          <p role="alert" className="text-[var(--warn)] text-sm">
            {aviso}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {resumen.map((r) => (
            <article
              key={r.id}
              className="rounded-[var(--radius-lg)] border p-3 flex flex-col gap-2 bg-[var(--surface)]"
              data-testid={`resultado-${r.lastName}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">
                  {r.lastName}, {r.firstName}
                </span>
                <span className="font-[var(--font-display)] text-3xl font-bold tabular-nums">
                  {r.total}
                </span>
              </div>

              <dl className="flex gap-4 text-sm text-[var(--ink-muted)]">
                <div className="flex gap-1">
                  <dt>Inner</dt>
                  <dd className="tabular-nums">{r.inner}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>10</dt>
                  <dd className="tabular-nums">{r.dieces}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>M</dt>
                  <dd className="tabular-nums">{r.emes}</dd>
                </div>
              </dl>

              <ol className="flex gap-1.5 flex-wrap">
                {r.porBlanco.map((s) => (
                  <li
                    key={s.targetIndex}
                    className="min-w-[44px] px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-center"
                  >
                    <span className="block text-xs text-[var(--ink-muted)]">{s.targetIndex}</span>
                    <span className="block tabular-nums font-medium">{s.total}</span>
                  </li>
                ))}
              </ol>

              {r.firmado ? (
                <p className={cn('text-sm text-[var(--ok)]')}>Firmado</p>
              ) : (
                <Button ancho onClick={() => setFirmando(r.id)}>
                  Firmar
                </Button>
              )}
            </article>
          ))}
        </div>
      </Screen>

      <div className="sticky bottom-0 mt-auto px-4 py-4 bg-[var(--bg)] border-t">
        <Button ancho disabled={faltanFirmas.length > 0} onClick={() => void cerrar()}>
          Finalizar torneo
        </Button>

        {faltanFirmas.length > 0 && (
          <p className="pt-2 text-sm text-[var(--ink-muted)] text-center">
            Faltan las firmas de {faltanFirmas.map((r) => r.lastName).join(', ')}.
          </p>
        )}
      </div>
    </div>
  );
}
