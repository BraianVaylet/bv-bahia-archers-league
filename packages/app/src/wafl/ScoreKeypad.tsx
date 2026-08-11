/**
 * Teclado de scoring.
 *
 * El componente más importante de la interfaz. Se usa con guantes, al sol,
 * caminando. **Objetivos táctiles de 56px**, sin excepción.
 *
 * Se adapta a la modalidad **de ese blanco**, no del torneo: un blanco 3D
 * ofrece `11 10 8 5 M`; el de sala del mismo torneo ofrece `X 10 … 1 M`.
 *
 * Ver `docs/DESIGN_SYSTEM.md` §6.1.
 */

import { type Modality, SCORING } from '@bal/shared';
import { cn } from '../components/ui.js';

/** Mínimo del design system. No se baja: se rediseña el componente. */
export const TAMAÑO_TECLA_PX = 56;

export type Disposicion = 'grilla' | 'arcos';

/**
 * Elige la disposición según la cantidad de tokens.
 *
 * Sala y aire libre tienen 12 tokens: doce zonas no caben en anillos legibles,
 * así que van en grilla. 3D y campo tienen 5 y 8, y sus zonas mapean 1:1 con los
 * anillos de la cara real del blanco.
 */
export function disposicionPara(modality: Modality): Disposicion {
  return SCORING[modality].scoringSet.length <= 8 ? 'arcos' : 'grilla';
}

export interface ScoreKeypadProps {
  readonly modality: Modality;
  /** Cuántas flechas ya se cargaron. Al llegar al tope, el teclado se deshabilita. */
  readonly cargadas: number;
  readonly total: number;
  readonly onToken: (token: string) => void;
  /**
   * Fuerza una disposición. La automática es `disposicionPara`.
   *
   * Existe porque la disposición en arcos es **una apuesta sin validar**: si en
   * la prueba de campo no le gana a la grilla, se cambia el default y listo.
   * Ver `docs/DESIGN_SYSTEM.md` §6.1.
   */
  readonly disposicion?: Disposicion;
}

export function ScoreKeypad({ modality, cargadas, total, onToken, disposicion }: ScoreKeypadProps) {
  const cfg = SCORING[modality];
  const completo = cargadas >= total;
  const modo = disposicion ?? disposicionPara(modality);

  const tocar = (token: string) => {
    if (completo) return;
    // Feedback háptico donde exista. No reemplaza al visual.
    navigator.vibrate?.(10);
    onToken(token);
  };

  return (
    <div
      className="flex flex-col items-center gap-2 p-3 rounded-t-[var(--radius-lg)] bg-[var(--surface)] shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"
      data-disposicion={modo}
      data-testid="score-keypad"
    >
      {completo && (
        <p className="text-sm text-[var(--ink-muted)]">
          Ya cargaste las {total} flechas de este blanco.
        </p>
      )}

      <div
        className={cn(
          'w-full',
          modo === 'grilla'
            ? 'grid grid-cols-4 gap-2 justify-items-center'
            : 'flex flex-col items-center gap-2',
        )}
      >
        {modo === 'arcos'
          ? enArcos(cfg.scoringSet).map((fila, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: las filas son posicionales
              <div key={`fila-${i}`} className="flex gap-2 justify-center">
                {fila.map((token) => (
                  <Tecla
                    key={token}
                    token={token}
                    inner={token === cfg.innerToken}
                    disabled={completo}
                    onPress={tocar}
                  />
                ))}
              </div>
            ))
          : cfg.scoringSet.map((token) => (
              <Tecla
                key={token}
                token={token}
                inner={token === cfg.innerToken}
                disabled={completo}
                onPress={tocar}
              />
            ))}
      </div>
    </div>
  );
}

/**
 * Reparte los tokens en arcos concéntricos: el inner al centro, los valores
 * menores hacia afuera. Espeja la cara real del blanco, así la memoria espacial
 * de lo que el arquero acaba de mirar se traslada a la pantalla.
 */
function enArcos(tokens: readonly string[]): string[][] {
  const filas: string[][] = [];
  let resto = [...tokens];
  let ancho = 1;

  while (resto.length > 0) {
    filas.push(resto.slice(0, ancho));
    resto = resto.slice(ancho);
    ancho = Math.min(ancho + 1, 3);
  }

  return filas;
}

interface TeclaProps {
  readonly token: string;
  readonly inner: boolean;
  readonly disabled: boolean;
  readonly onPress: (token: string) => void;
}

function Tecla({ token, inner, disabled, onPress }: TeclaProps) {
  const esMiss = token === 'M';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPress(token)}
      aria-label={esMiss ? 'Miss, flecha sin puntaje' : `Puntaje ${token}`}
      // 56px es el mínimo para acertar con guante de tiro, caminando.
      style={{ minWidth: TAMAÑO_TECLA_PX, minHeight: TAMAÑO_TECLA_PX }}
      className={cn(
        'rounded-[var(--radius-md)] font-[var(--font-display)] text-xl font-semibold',
        'border transition-opacity duration-[80ms] active:opacity-70',
        'disabled:opacity-30 disabled:cursor-not-allowed',
        esMiss
          ? 'bg-[var(--surface-2)] text-[var(--ink-muted)]'
          : inner
            ? 'bg-[var(--nock)] text-[var(--nock-ink)]'
            : 'bg-[var(--surface-2)] text-[var(--ink)]',
      )}
    >
      {token}
    </button>
  );
}
