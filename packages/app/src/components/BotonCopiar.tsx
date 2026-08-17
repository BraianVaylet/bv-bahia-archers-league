/**
 * Copiar un dato corto al portapapeles.
 *
 * **Nace para el PIN de la patrulla**, que el admin le pasa al líder por
 * WhatsApp o lo dicta en la línea de tiro. Seis dígitos se transcriben mal, y
 * un PIN mal transcripto es un líder que no entra con el torneo empezado.
 *
 * **Dice lo que pasó, incluso cuando falla.** `navigator.clipboard` no existe
 * fuera de un contexto seguro, y un botón que no hace nada y tampoco avisa
 * deja al admin creyendo que copió. Ahí se muestra el dato para copiarlo a
 * mano, que es lo único que queda.
 */

import { IconoCopiar, IconoTilde } from '@bal/ui';
import { useEffect, useState } from 'react';

export interface BotonCopiarProps {
  readonly valor: string;
  /** Qué se copia, para el nombre accesible: «el PIN de la patrulla 2». */
  readonly queEs: string;
}

type Estado = 'listo' | 'copiado' | 'fallo';

export function BotonCopiar({ valor, queEs }: BotonCopiarProps) {
  const [estado, setEstado] = useState<Estado>('listo');

  // La confirmación vuelve sola: es un acuse, no un estado de la pantalla.
  useEffect(() => {
    if (estado === 'listo') return;
    const t = setTimeout(() => setEstado('listo'), 2500);
    return () => clearTimeout(t);
  }, [estado]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setEstado('copiado');
    } catch {
      setEstado('fallo');
    }
  };

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void copiar()}
        aria-label={estado === 'copiado' ? `${queEs} copiado` : `Copiar ${queEs}`}
        title={`Copiar ${queEs}`}
        className="min-h-[44px] min-w-[44px] rounded-[var(--radius-sm)] border
          flex items-center justify-center shrink-0 print:hidden"
      >
        {estado === 'copiado' ? <IconoTilde /> : <IconoCopiar />}
      </button>

      {/*
        `role="status"` y no un `aria-label` a secas: el cambio de ícono no lo
        anuncia nadie, y «copiado» es justo lo que hay que confirmar.
      */}
      {estado !== 'listo' && (
        <span
          role="status"
          data-testid="acuse-copiar"
          className="text-xs text-[var(--ink-muted)] print:hidden"
        >
          {estado === 'copiado' ? 'Copiado' : 'No se pudo copiar: anotalo a mano'}
        </span>
      )}
    </span>
  );
}
