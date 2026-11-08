/**
 * Una alta pendiente de aprobar (`FE-30`).
 */

import { ChipCategoria } from '@bal/ui';
import { useState } from 'react';
import { Button, clasesDeTarjeta, cn } from '../../components/ui.js';
import { type ArcherRow, ETIQUETA_DE_SEXO } from './tipos.js';

/**
 * Una alta `pendiente`, con lo que mandó la landing y las dos acciones de
 * `BE-22`.
 *
 * **Cada acción pide un segundo toque**, mismo patrón que borrar un torneo
 * (`Tournament.tsx`): un estado local, no un diálogo aparte. Rechazar borra
 * del padrón sin vuelta atrás, así que el texto de confirmación lo dice.
 */
export function FilaPendiente({
  arquero,
  onAprobar,
  onRechazar,
}: {
  readonly arquero: ArcherRow;
  readonly onAprobar: () => Promise<void>;
  readonly onRechazar: () => Promise<void>;
}) {
  const [confirmando, setConfirmando] = useState<'aprobar' | 'rechazar'>();
  const [procesando, setProcesando] = useState(false);

  const ejecutar = async (accion: 'aprobar' | 'rechazar', fn: () => Promise<void>) => {
    if (confirmando !== accion) {
      setConfirmando(accion);
      return;
    }
    setProcesando(true);
    try {
      await fn();
    } finally {
      setProcesando(false);
      setConfirmando(undefined);
    }
  };

  return (
    <li
      className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}
      data-testid={`arquero-${arquero.lastName}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">
          {arquero.lastName}, {arquero.firstName}
        </span>
        <span className="shrink-0">
          <ChipCategoria category={arquero.category} compacto />
        </span>
      </div>

      {/* Lo que mandó la landing: es lo único que el admin tiene para decidir. */}
      <dl className="text-sm text-[var(--ink-muted)] flex flex-col gap-0.5">
        <div>
          <dt className="inline font-medium">DNI: </dt>
          <dd className="inline">{arquero.dni ?? '—'}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Sexo: </dt>
          <dd className="inline">{arquero.sex ? ETIQUETA_DE_SEXO[arquero.sex] : '—'}</dd>
        </div>
      </dl>

      <div className="flex gap-2">
        <Button
          disabled={procesando}
          onClick={() => void ejecutar('aprobar', onAprobar)}
          className="flex-1"
        >
          {confirmando === 'aprobar' ? 'Sí, aprobar' : 'Aprobar'}
        </Button>
        <Button
          variante="peligro"
          disabled={procesando}
          onClick={() => void ejecutar('rechazar', onRechazar)}
          className="flex-1"
        >
          {confirmando === 'rechazar' ? 'Sí, rechazar' : 'Rechazar'}
        </Button>
      </div>

      {confirmando === 'aprobar' && (
        <p role="status" className="text-sm text-[var(--ink-muted)]">
          Va a quedar disponible para sumarse a un torneo. Tocá de nuevo para confirmar.
        </p>
      )}
      {confirmando === 'rechazar' && (
        <p role="status" className="text-sm text-[var(--danger)]">
          Se borra del padrón, no se puede deshacer. Tocá de nuevo para confirmar.
        </p>
      )}
    </li>
  );
}
