import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GraficoDeTorta, type ParteDeTorta } from './GraficoDeTorta.js';

/**
 * Gráfico de dona.
 *
 * Lo que se prueba no es el dibujo: es que **el color no sea lo único que dice
 * algo**. Un color sin nombre no comunica ni a quien no distingue dos verdes ni
 * a quien no conoce el código de colores del proyecto.
 */

afterEach(cleanup);

const parte = (clave: string, pct: number, count: number): ParteDeTorta => ({
  clave,
  etiqueta: clave.toUpperCase(),
  pct,
  count,
  color: { claro: '#0a6f6a', oscuro: '#5ecfc4' },
});

describe('GraficoDeTorta', () => {
  it('cada porción figura escrita, con su nombre y su porcentaje', () => {
    render(
      <GraficoDeTorta
        titulo="Modalidades"
        unidad="blancos"
        partes={[parte('sala', 40, 4), parte('campo', 60, 6)]}
      />,
    );

    expect(screen.getByText('SALA')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('CAMPO')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  /**
   * Quien no ve el gráfico **escucha el reparto entero**. Un `<svg>` con
   * `role="img"` y sin descripción es un agujero en la página.
   */
  it('describe el reparto completo para un lector de pantalla', () => {
    render(
      <GraficoDeTorta
        titulo="Modalidades"
        unidad="blancos"
        partes={[parte('sala', 40, 4), parte('campo', 60, 6)]}
      />,
    );

    const etiqueta = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(etiqueta).toMatch(/SALA 40%/);
    expect(etiqueta).toMatch(/CAMPO 60%/);
    expect(etiqueta).toMatch(/10 blancos/);
  });

  /**
   * **Las porciones no se pisan ni dejan huecos.** Cada una arranca donde
   * termina la anterior: si el desplazamiento no se acumulara, todas saldrían
   * del mismo punto y la dona mentiría.
   */
  it('cada porción arranca donde termina la anterior', () => {
    const { container } = render(
      <GraficoDeTorta
        titulo="Modalidades"
        unidad="blancos"
        partes={[parte('a', 25, 1), parte('b', 25, 1), parte('c', 50, 2)]}
      />,
    );

    // El primero es el anillo de fondo; las porciones vienen después.
    const arcos = [...container.querySelectorAll('circle')].slice(1);
    const offsets = arcos.map((c) => Number(c.getAttribute('stroke-dashoffset')));

    expect(offsets).toHaveLength(3);
    // `-0` y `0` son el mismo desplazamiento; `toBe` los distingue.
    expect(offsets[0]).toBeCloseTo(0, 10);
    // Estrictamente decrecientes: el desplazamiento se acumula.
    expect(offsets[1]).toBeLessThan(offsets[0] as number);
    expect(offsets[2]).toBeLessThan(offsets[1] as number);
  });

  it('el largo de cada porción es proporcional a su porcentaje', () => {
    const { container } = render(
      <GraficoDeTorta
        titulo="Modalidades"
        unidad="blancos"
        partes={[parte('a', 25, 1), parte('b', 75, 3)]}
      />,
    );

    const arcos = [...container.querySelectorAll('circle')].slice(1);
    const largos = arcos.map((c) =>
      Number((c.getAttribute('stroke-dasharray') ?? '').split(' ')[0]),
    );

    expect((largos[1] as number) / (largos[0] as number)).toBeCloseTo(3, 5);
  });

  /**
   * El color se emite como variable y lo elige el CSS: resolverlo en JavaScript
   * dejaría un frame con el color anterior al conmutar el tema.
   */
  it('emite las dos variantes de color y deja elegir al CSS', () => {
    const { container } = render(
      <GraficoDeTorta titulo="Modalidades" unidad="blancos" partes={[parte('a', 100, 1)]} />,
    );

    const arco = container.querySelectorAll('[data-chip="torta"]')[0] as HTMLElement;
    expect(arco.style.getPropertyValue('--chip')).not.toBe('');
    expect(arco.style.getPropertyValue('--chip-oscuro')).not.toBe('');
  });

  // Una dona vacía parece un error, no un dato.
  it('sin partes no dibuja nada', () => {
    const { container } = render(
      <GraficoDeTorta titulo="Modalidades" unidad="blancos" partes={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
