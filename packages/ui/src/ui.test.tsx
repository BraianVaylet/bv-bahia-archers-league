import {
  BOW_CATEGORIES,
  CATEGORY_INFO,
  MODALITIES,
  SCORING,
  TOURNAMENT_STATUSES,
} from '@bal/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BadgeEstado, ChipCategoria, ChipModalidad } from './Chips.js';
import { ICONO_DE_CATEGORIA } from './iconos/categoria.js';
import { ICONO_DE_MODALIDAD } from './iconos/modalidad.js';
import { StakeChip } from './StakeChip.js';

/**
 * Piezas compartidas (REF2-1).
 *
 * Lo que se prueba acá no es que se vean lindas: es que **el color nunca sea lo
 * único que dice algo**. Un chip que pierde su texto sigue viéndose bien y deja
 * de comunicar, y eso no lo nota nadie mirando la pantalla en el escritorio.
 * Ver `docs/DESIGN_SYSTEM.md` §10.
 */

afterEach(cleanup);

describe('los mapas de íconos cubren el catálogo entero', () => {
  it('hay un ícono por categoría', () => {
    expect(Object.keys(ICONO_DE_CATEGORIA).sort()).toEqual([...BOW_CATEGORIES].sort());
  });

  it('hay un ícono por modalidad', () => {
    expect(Object.keys(ICONO_DE_MODALIDAD).sort()).toEqual([...MODALITIES].sort());
  });
});

describe('ChipCategoria', () => {
  it.each([...BOW_CATEGORIES])('%s dice su nombre, no sólo su color', (category) => {
    render(<ChipCategoria category={category} />);
    expect(screen.getByText(CATEGORY_INFO[category].label)).toBeInTheDocument();
  });

  it('lleva su ícono, y el ícono es decorativo', () => {
    const { container } = render(<ChipCategoria category="recurvo" />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // El nombre lo pone el texto de al lado. Un lector de pantalla que anuncie
    // las dos cosas dice dos veces lo mismo.
    expect(svg).toHaveAttribute('aria-hidden');
  });

  /**
   * El color va como variable, no como valor resuelto: el tema lo elige en CSS.
   * Resolverlo en JavaScript dejaría un frame con el color anterior al
   * conmutar.
   */
  it('emite las dos variantes de color y deja elegir al CSS', () => {
    const { container } = render(<ChipCategoria category="compuesto" />);
    const chip = container.querySelector('[data-chip="categoria"]') as HTMLElement;

    expect(chip.style.getPropertyValue('--chip')).not.toBe('');
    expect(chip.style.getPropertyValue('--chip-oscuro')).not.toBe('');
  });
});

describe('ChipModalidad', () => {
  it.each([...MODALITIES])('%s dice su nombre', (modality) => {
    render(<ChipModalidad modality={modality} />);
    expect(screen.getByText(SCORING[modality].label)).toBeInTheDocument();
  });

  /**
   * **Categoría y modalidad se distinguen por forma, no sólo por tono.** Es lo
   * que permite que los dos ejes compartan familia de color: excluyendo rojo,
   * azul y amarillo —reservados para las estacas— no alcanzan los tonos para
   * once valores distintos.
   */
  it('es un rectángulo donde la categoría es una píldora', () => {
    const { container: mod } = render(<ChipModalidad modality="sala" />);
    const { container: cat } = render(<ChipCategoria category="recurvo" />);

    expect(mod.querySelector('[data-chip="modalidad"]')?.className).toContain('rounded-[var');
    expect(cat.querySelector('[data-chip="categoria"]')?.className).toContain('rounded-full');
  });
});

describe('BadgeEstado', () => {
  it.each([...TOURNAMENT_STATUSES])('%s tiene texto para el admin', (status) => {
    render(<BadgeEstado status={status} />);
    expect(screen.getByText(/\S/)).toBeInTheDocument();
  });

  it('el texto del público no es el del admin', () => {
    render(<BadgeEstado status="completado" />);
    expect(screen.getByText('Completado, sin publicar')).toBeInTheDocument();

    cleanup();

    render(<BadgeEstado status="publicado" publico />);
    expect(screen.getByText('Resultados oficiales')).toBeInTheDocument();
  });

  /**
   * Un torneo que todavía no arrancó **no es noticia para el visitante**. Se
   * devuelve `null` en vez de inventarle un texto público.
   */
  it('no muestra en público un estado que no es público', () => {
    const { container } = render(<BadgeEstado status="sin_iniciar" publico />);
    expect(container.firstChild).toBeNull();
  });
});

describe('StakeChip', () => {
  it.each(['roja', 'azul', 'amarilla'])('%s lleva el nombre escrito', (stake) => {
    render(<StakeChip stake={stake} />);
    expect(screen.getByText(/^Estaca /)).toBeInTheDocument();
  });

  it('una estaca que no existe no dibuja nada', () => {
    const { container } = render(<StakeChip stake="verde" />);
    expect(container.firstChild).toBeNull();
  });

  // Las dos copias que había diferían sólo en esto, sin que nadie lo decidiera.
  it('el modo compacto es más chico', () => {
    const { container: chico } = render(<StakeChip stake="roja" compacto />);
    const { container: grande } = render(<StakeChip stake="roja" />);

    expect((chico.firstChild as HTMLElement).className).toContain('h-6');
    expect((grande.firstChild as HTMLElement).className).toContain('h-7');
  });
});
