import { useEffect, useRef } from 'react';

/** Cada cuánto se refresca el seguimiento de un torneo en curso. */
export const REFRESCO_MS = 30_000;

/**
 * Llama a `refrescar` cada `cadaMs` mientras `activo` y la pestaña es visible
 * (`REF6-7` / `U-6`).
 *
 * Con la pestaña oculta se pausa, y no acumula lo que se perdió: al volver
 * refresca **una vez**, de inmediato, porque lo que se ve puede tener minutos de
 * atraso, y retoma el ritmo.
 *
 * La función se guarda en una ref: la pantalla crea una nueva en cada render, y si
 * el efecto dependiera de ella el intervalo se reiniciaría y un torneo con
 * actividad constante nunca llegaría a los 30 s.
 */
export function useRefrescoPeriodico(
  refrescar: () => void,
  activo: boolean,
  cadaMs: number = REFRESCO_MS,
): void {
  const vigente = useRef(refrescar);
  vigente.current = refrescar;

  useEffect(() => {
    if (!activo) return;

    let intervalo: ReturnType<typeof setInterval> | undefined;

    const parar = () => {
      if (intervalo !== undefined) clearInterval(intervalo);
      intervalo = undefined;
    };
    const arrancar = () => {
      parar();
      intervalo = setInterval(() => vigente.current(), cadaMs);
    };

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        vigente.current();
        arrancar();
      } else {
        parar();
      }
    };

    if (document.visibilityState === 'visible') arrancar();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    return () => {
      parar();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [activo, cadaMs]);
}
