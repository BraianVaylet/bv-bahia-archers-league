import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { botonClases, clasesDeBotonIcono } from './boton.js';
import { BadgeEstado } from './Chips.js';
import { clasesDeTarjeta } from './Tarjeta.js';

/**
 * La piel de los controles (`REF7-4`: `C-1`, `A-2`, `A-3`, `A-5`). Ver `DISENO.md` §4.1 a §4.4.
 *
 * Se prueba qué **token** usa cada variante, no el píxel: el contraste de cada token ya lo mide
 * `contraste.test.ts`. Lo que se cuida acá es que cada control use el token que llega a WCAG.
 */

afterEach(cleanup);

const clases = (s: string) => s.split(/\s+/);

describe('botonClases', () => {
  /**
   * `C-1`: el secundario era un bloque gris relleno (`--surface-2`) con un borde de 1.3:1. Se leía
   * como deshabilitado al lado de un primario.
   */
  it('el secundario va sobre la superficie, con el borde que se ve', () => {
    const c = clases(botonClases({ variante: 'secundario' }));

    expect(c).toContain('bg-[var(--surface)]');
    expect(c).toContain('border-[var(--line-strong)]');
    expect(c).toContain('hover:bg-[var(--surface-2)]');
  });

  it('el primario es el verde con su tinta oscura', () => {
    const c = clases(botonClases());

    expect(c).toContain('bg-[var(--nock)]');
    expect(c).toContain('text-[var(--nock-ink)]');
  });

  /** `A-3`: blanco sobre el rojo del tema oscuro daba ≈3:1. */
  it('el de peligro escribe con --danger-ink, no con blanco', () => {
    const c = clases(botonClases({ variante: 'peligro' }));

    expect(c).toContain('text-[var(--danger-ink)]');
    expect(c).not.toContain('text-white');
  });

  it.each([
    ['fantasma', 'bg-transparent'],
    ['sobreMonte', 'text-[var(--monte-ink)]'],
  ] as const)('existe la variante %s', (variante, clase) => {
    expect(clases(botonClases({ variante }))).toContain(clase);
  });

  it.each([
    ['sm', 'min-h-[44px]'],
    ['base', 'min-h-[52px]'],
    ['lg', 'min-h-[56px]'],
  ] as const)('el tamaño %s mide %s', (tamaño, alto) => {
    expect(clases(botonClases({ tamaño }))).toContain(alto);
  });

  /**
   * `A-5`: `opacity: .4` bajaba el texto por debajo de AA y no decía por qué. Deshabilitado es
   * `--surface-2` con `--ink-muted` (≥ 5.7:1), en un `<button>` y en un enlace con `aria-disabled`.
   */
  it('deshabilitado no se lava con opacidad', () => {
    const c = botonClases({ variante: 'secundario' });

    expect(c).not.toMatch(/opacity/);
    expect(clases(c)).toEqual(
      expect.arrayContaining([
        'disabled:bg-[var(--surface-2)]',
        'disabled:text-[var(--ink-muted)]',
        'aria-disabled:bg-[var(--surface-2)]',
        'aria-disabled:text-[var(--ink-muted)]',
      ]),
    );
  });

  it('al tocarlo baja un pixel, no se aclara', () => {
    const c = clases(botonClases());

    expect(c).toContain('active:translate-y-px');
    expect(c.join(' ')).not.toMatch(/active:opacity/);
  });

  it('suma las clases de quien lo usa', () => {
    expect(clases(botonClases({ ancho: true, className: 'mt-4' }))).toEqual(
      expect.arrayContaining(['w-full', 'mt-4']),
    );
  });
});

describe('clasesDeBotonIcono', () => {
  it('mide 44 × 44, con el radio de los controles', () => {
    const c = clases(clasesDeBotonIcono());

    expect(c).toEqual(
      expect.arrayContaining(['min-h-[44px]', 'min-w-[44px]', 'rounded-[var(--radius-md)]']),
    );
    expect(c).toContain('hover:bg-[var(--surface-2)]');
  });
});

describe('clasesDeTarjeta como enlace', () => {
  it('al pasar por encima, el borde se marca', () => {
    expect(clases(clasesDeTarjeta({ enlace: true }))).toContain(
      'hover:border-[var(--line-strong)]',
    );
    expect(clasesDeTarjeta()).not.toMatch(/hover:/);
  });
});

/**
 * `BadgeEstado` rediseñado (`C-2`, `A-4`): un punto de color y el texto en `--ink`, sobre una
 * píldora con borde. El estado ya no compite con el título, y el texto de «completado» no queda en
 * `--bg` sobre el verde (2.59:1).
 */
describe('BadgeEstado', () => {
  it('el texto va en tinta y el color va al punto', () => {
    const { container } = render(<BadgeEstado status="publicado" />);
    const badge = screen.getByTestId('estado-torneo');
    const punto = container.querySelector('[data-punto]') as HTMLElement;

    expect(badge.className).toContain('text-[var(--ink)]');
    expect(badge.style.backgroundColor).toBe('');
    expect(punto).not.toBeNull();
    expect(punto.getAttribute('aria-hidden')).toBe('true');
    expect(punto.style.getPropertyValue('--st')).toBe('var(--ok)');
  });

  it('«En curso» late; los demás no', () => {
    const { container } = render(<BadgeEstado status="en_proceso" publico />);

    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect((container.querySelector('[data-punto]') as HTMLElement).className).toContain(
      'animate-pulso',
    );

    cleanup();
    const { container: otro } = render(<BadgeEstado status="publicado" publico />);
    expect((otro.querySelector('[data-punto]') as HTMLElement).className).not.toContain(
      'animate-pulso',
    );
  });

  it('completado espera la publicación, con el color de atención', () => {
    const { container } = render(<BadgeEstado status="completado" />);

    expect(screen.getByText('Esperando publicación')).toBeInTheDocument();
    expect(
      (container.querySelector('[data-punto]') as HTMLElement).style.getPropertyValue('--st'),
    ).toBe('var(--warn)');
  });

  it('sobre la banda monte usa sus tokens y el punto vivo en chartreuse', () => {
    const { container } = render(<BadgeEstado status="en_proceso" publico sobreMonte />);
    const badge = screen.getByTestId('estado-torneo');

    expect(badge.className).toContain('bg-[var(--monte-2)]');
    expect(badge.className).toContain('text-[var(--monte-ink)]');
    expect(
      (container.querySelector('[data-punto]') as HTMLElement).style.getPropertyValue('--st'),
    ).toBe('var(--monte-accent)');
  });
});
