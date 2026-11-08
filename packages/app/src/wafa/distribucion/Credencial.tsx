/**
 * El usuario y el PIN de una patrulla, para copiar o regenerar.
 */

import { useState } from 'react';
import { BotonCopiar } from '../../components/BotonCopiar.js';
import { Button } from '../../components/ui.js';
import { rpc } from '../../lib/rpc.js';
import type { PatrullaVista } from '../patrullas.js';

export function Credencial({
  patrulla,
  onRegenerado,
}: {
  readonly patrulla: PatrullaVista;
  readonly onRegenerado: () => void;
}) {
  const [regenerando, setRegenerando] = useState(false);

  const regenerar = async () => {
    setRegenerando(true);
    try {
      await rpc.admin.patrols[':id'].pin.regenerate.$post({ param: { id: patrulla.id } });
      onRegenerado();
    } finally {
      setRegenerando(false);
    }
  };

  if (!patrulla.pin) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2">
      <div>
        <p className="font-mono text-sm">{patrulla.username}</p>
        <p className="font-mono text-lg tracking-widest" data-testid={`pin-${patrulla.number}`}>
          {patrulla.pin}
        </p>
      </div>

      <div className="flex items-start gap-2 shrink-0">
        {/* Seis dígitos se transcriben mal, y un PIN mal transcripto es un
            líder que no entra con el torneo ya empezado. */}
        <BotonCopiar valor={patrulla.pin} queEs={`el PIN de la patrulla ${patrulla.number}`} />

        <Button variante="secundario" disabled={regenerando} onClick={() => void regenerar()}>
          Regenerar
        </Button>
      </div>
    </div>
  );
}
