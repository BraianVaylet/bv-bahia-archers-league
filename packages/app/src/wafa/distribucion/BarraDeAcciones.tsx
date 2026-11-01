/**
 * La barra de abajo de la pantalla de patrullas: guardar, imprimir y volver.
 */

import { Button } from '../../components/ui.js';

export function BarraDeAcciones({
  problema,
  guardado,
  error,
  sinGuardar,
  guardando,
  onGuardar,
  onVolver,
}: {
  readonly problema: string | undefined;
  readonly guardado: boolean;
  readonly error: string | undefined;
  readonly sinGuardar: boolean;
  readonly guardando: boolean;
  readonly onGuardar: () => void;
  readonly onVolver: () => void;
}) {
  return (
    <div
      className="shrink-0 px-4 py-4 bg-[var(--bg)] border-t flex flex-col gap-2 print:hidden"
      data-testid="barra-acciones"
    >
      {problema && <p className="text-sm text-[var(--danger)] text-center">{problema}</p>}

      {/* El aviso va acá y no arriba de todo: con cinco patrullas en pantalla, el admin no llega a
          ver una confirmación que quedó fuera de cuadro, y vuelve a apretar Guardar. */}
      {guardado && !error && (
        <p role="status" className="text-sm text-[var(--ok)] text-center">
          Patrullas guardadas.
        </p>
      )}

      {sinGuardar && (
        <p className="text-sm text-[var(--ink-muted)] text-center">
          Guardá los cambios antes de imprimir: la planilla tiene que decir lo mismo que la app.
        </p>
      )}

      <div className="flex gap-2">
        <Button variante="secundario" disabled={sinGuardar} onClick={() => window.print()}>
          Imprimir
        </Button>
        <Button ancho disabled={guardando || problema !== undefined} onClick={onGuardar}>
          {guardando ? 'Guardando…' : 'Guardar patrullas'}
        </Button>
      </div>

      {guardado && !error && (
        <Button variante="secundario" ancho onClick={onVolver}>
          Volver al inicio
        </Button>
      )}
    </div>
  );
}
