/**
 * Paso 3 del wizard de creación de torneo: quiénes participan.
 */

import { SelectorDeArqueros } from '../components/SelectorDeArqueros.js';
import type { BorradorTorneo } from '../wizard.js';

export function PasoParticipantes({
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
