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
import { memo } from 'react';
import { cn } from '../components/ui.js';

/** Mínimo del design system. No se baja: se rediseña el componente. */
export const TAMAÑO_TECLA_PX = 56;

export type Disposicion = 'grilla' | 'arcos';

/**
 * Grilla en las cuatro modalidades: izquierda a derecha, arriba abajo.
 *
 * Los arcos mapeaban 1:1 con los anillos de la cara real del blanco, y eran una
 * apuesta que `FE-6` dejó explícitamente sin validar. Con la app en la mano ganó
 * el **orden de lectura igual en todas**: cambiar de disposición entre un blanco
 * 3D y uno de sala obliga a volver a buscar dónde está cada tecla, en el medio
 * del recorrido y con guantes.
 *
 * Los arcos siguen existiendo detrás de la prop `disposicion`. Ver
 * `docs/DESIGN_SYSTEM.md` §6.1.
 */
export function disposicionPara(_modality: Modality): Disposicion {
  return 'grilla';
}

export interface ScoreKeypadProps {
  readonly modality: Modality;
  /** Cuántas flechas ya se cargaron. Al llegar al tope, el teclado se deshabilita. */
  readonly cargadas: number;
  /**
   * El arquero seleccionado ya firmó: el teclado se apaga.
   *
   * Dejarlo encendido y tragar el toque en un guard es peor que apagarlo — un
   * botón que parece activo y no hace nada no explica nada.
   */
  readonly bloqueado?: boolean;
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

function ScoreKeypadBase({
  modality,
  cargadas,
  total,
  onToken,
  disposicion,
  bloqueado,
}: ScoreKeypadProps) {
  const cfg = SCORING[modality];
  const completo = cargadas >= total || bloqueado === true;
  const modo = disposicion ?? disposicionPara(modality);

  const tocar = (token: string) => {
    if (completo) return;
    // Feedback háptico donde exista. No reemplaza al visual.
    navigator.vibrate?.(10);
    onToken(token);
  };

  return (
    <div
      // El panel (superficie, sombra `--shadow-dock`, «Continuar» adentro) lo arma `TargetPage`
      // (`REF7-10`, `DISENO.md` §4.14): acá van sólo el aviso y la grilla.
      className="flex flex-col items-center gap-2"
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
          modo === 'grilla' ? 'grid grid-cols-4 gap-2' : 'flex flex-col items-center gap-2',
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
      // 56px es el PISO (`TAMAÑO_TECLA_PX`): la tecla mide 64 de alto (decisión 6 de `ref-7`) y se
      // estira a lo ancho de la grilla. Cuanto más grande, menos se erra con guantes.
      style={{ minWidth: TAMAÑO_TECLA_PX, minHeight: TAMAÑO_TECLA_PX }}
      className={cn(
        'w-full h-16 rounded-[var(--radius-md)] border',
        'font-display text-[26px] font-bold',
        // Al tocar se achica y se enciende: con el sol de frente, un cambio de opacidad no se ve.
        'transition-[transform,background-color] duration-[80ms] ease-out active:scale-[.96]',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100',
        esMiss
          ? 'bg-[var(--surface)] border-dashed border-[var(--line-strong)] text-[var(--ink-muted)]'
          : inner
            ? 'bg-[var(--nock)] text-[var(--nock-ink)] border-transparent'
            : 'bg-[var(--surface-2)] text-[var(--ink)] border-[var(--line-strong)] active:bg-[var(--nock)] active:text-[var(--nock-ink)]',
      )}
    >
      {token}
    </button>
  );
}

/**
 * El teclado sólo se repinta si cambió lo suyo: las flechas cargadas, el bloqueo o `onToken`
 * (`REF6-14` / `P-7`). Un error en pantalla o el cambio de otra fila no lo toca.
 */
export const ScoreKeypad = memo(ScoreKeypadBase);
