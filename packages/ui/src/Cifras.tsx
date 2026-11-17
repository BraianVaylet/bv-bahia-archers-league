/**
 * Las cifras de una tarjeta, **rótulo primero**: «Blancos 6 · Arqueros 8 · Patrullas 3» (`FE-42`).
 *
 * Devolución de la prueba 1: «6 blancos · 8 arqueros» se leía como una frase y no como una ficha,
 * y obligaba a acertar el plural («1 blancos»). Con el rótulo adelante se lee qué es y cuánto, y el
 * número —lo que se busca— va resaltado al final.
 *
 * Cada par va junto (`whitespace-nowrap`): en una tarjeta angosta el renglón se corta **entre**
 * cifras, nunca entre «Inscripción» y su monto.
 */

import { Fragment, type ReactNode } from 'react';
import { cn } from './cn.js';

export interface Cifra {
  /** Qué es: «Blancos». Sin rótulo, el valor va solo («Sin costo»). */
  readonly rotulo?: string | undefined;
  readonly valor: ReactNode;
}

export interface CifrasProps {
  /** Las que son `null` no se escriben: un dato que no está no se inventa. */
  readonly cifras: readonly (Cifra | null)[];
  readonly className?: string;
}

export function Cifras({ cifras, className }: CifrasProps) {
  const presentes = cifras.filter((c): c is Cifra => c !== null);

  return (
    <p className={cn('text-sm text-[var(--ink-muted)]', className)}>
      {presentes.map((c, i) => (
        <Fragment key={c.rotulo ?? i}>
          {i > 0 ? ' · ' : null}
          <span className="whitespace-nowrap">
            {c.rotulo ? `${c.rotulo} ` : null}
            <span className="font-semibold tabular-nums text-[var(--ink)]">{c.valor}</span>
          </span>
        </Fragment>
      ))}
    </p>
  );
}
