/**
 * Firma con el dedo.
 *
 * **El puntaje que se firma está siempre a la vista.** Nadie firma algo que no
 * está viendo. Ver `docs/DESIGN_SYSTEM.md` §6.6.
 */

import { useRef, useState } from 'react';
import { Button } from '../components/ui.js';

export interface SignaturePadProps {
  readonly nombre: string;
  readonly total: number;
  readonly onFirmar: (pngDataUrl: string) => void;
  readonly onCancelar: () => void;
}

export function SignaturePad({ nombre, total, onFirmar, onCancelar }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);

  const contexto = () => canvasRef.current?.getContext('2d') ?? null;

  const puntoDe = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = contexto();
    if (!ctx) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;

    const { x, y } = puntoDe(e);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#16170f';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    const ctx = contexto();
    if (!ctx) return;

    const { x, y } = puntoDe(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setTieneTrazo(true);
  };

  const terminar = () => {
    dibujando.current = false;
  };

  const borrar = () => {
    const ctx = contexto();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazo(false);
  };

  const confirmar = () => {
    const canvas = canvasRef.current;
    if (!canvas || !tieneTrazo) return;
    onFirmar(canvas.toDataURL('image/png'));
  };

  return (
    /* A pantalla completa: firmar con el dedo en un recuadro de 240px sale
       tembloroso, y una firma que no se parece a la de siempre es la que el
       arquero discute después. Fijo sobre todo lo demás para que nada se
       mueva mientras se firma. */
    <div
      className="fixed inset-0 z-20 bg-[var(--bg)] flex flex-col gap-3 p-4 overflow-y-auto"
      data-testid="pad-firma"
    >
      {/* El puntaje va ARRIBA del canvas: se firma lo que se está viendo. */}
      <div className="text-center">
        <p className="font-semibold">{nombre}</p>
        <p className="font-[var(--font-display)] text-[var(--text-score)] font-bold tabular-nums leading-none">
          {total}
        </p>
        <p className="text-sm text-[var(--ink-muted)]">Firmá para validar este puntaje</p>
      </div>

      <canvas
        ref={canvasRef}
        width={900}
        height={600}
        aria-label={`Firma de ${nombre}`}
        data-testid="signature-canvas"
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        //  para comerse todo el alto que sobre: cuanto más grande el
        // área, más se parece al trazo de siempre.
        className="w-full grow min-h-[16rem] rounded-[var(--radius-lg)] border-2 border-dashed bg-white touch-none"
      />

      <div className="flex gap-2">
        <Button variante="secundario" onClick={borrar} disabled={!tieneTrazo}>
          Borrar
        </Button>
        <Button ancho onClick={confirmar} disabled={!tieneTrazo}>
          Confirmar firma
        </Button>
      </div>

      <Button variante="secundario" ancho onClick={onCancelar}>
        Volver
      </Button>
    </div>
  );
}
