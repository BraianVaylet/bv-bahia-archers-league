import { SCORING } from '@bal/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AnilloDeRecorrido } from './AnilloDeRecorrido.js';
import { AnillosDeFondo } from './AnillosDeFondo.js';
import { BarraDeModalidades } from './BarraDeModalidades.js';
import { RotuloDeSeccion } from './RotuloDeSeccion.js';
import { TarjetaDeTorneo } from './TarjetaDeTorneo.js';

/**
 * Los componentes nuevos de `REF7-4` (`DISENO.md` §4.6 a §4.9).
 *
 * Como en `ui.test.tsx`, lo que se prueba es que **nada diga algo sólo con el color**: cada barra
 * lleva su nombre, cada anillo su texto y cada rótulo es un encabezado de verdad.
 */

afterEach(cleanup);

// ── BarraDeModalidades (ModalityBar, §4.6) ───────────────────────────────────

describe('BarraDeModalidades', () => {
  const reparto = [
    { modality: 'campo', pct: 40 },
    { modality: '3d', pct: 33 },
    { modality: 'sala', pct: 27 },
  ] as const;

  it('cada tramo ocupa su porcentaje, y suman cien', () => {
    const { container } = render(<BarraDeModalidades modalidades={reparto} />);
    const tramos = [...container.querySelectorAll('[data-tramo]')] as HTMLElement[];

    expect(tramos.map((t) => Number(t.style.flexGrow))).toEqual([40, 33, 27]);
    expect(tramos.reduce((n, t) => n + Number(t.style.flexGrow), 0)).toBe(100);
  });

  it('la barra se describe entera en palabras', () => {
    render(<BarraDeModalidades modalidades={reparto} />);

    const esperado = `Distribución de modalidades: ${SCORING.campo.label} 40%, ${SCORING['3d'].label} 33%, ${SCORING.sala.label} 27%`;
    expect(screen.getByRole('img', { name: esperado })).toBeInTheDocument();
  });

  it('la leyenda lleva un ícono y un nombre por modalidad, con su porcentaje', () => {
    const { container } = render(<BarraDeModalidades modalidades={reparto} />);
    const items = [...container.querySelectorAll('[data-leyenda] > li')] as HTMLElement[];

    expect(items).toHaveLength(3);
    for (const [i, item] of items.entries()) {
      const parte = reparto[i];
      expect(item.querySelector('svg')).toHaveAttribute('aria-hidden');
      expect(item.textContent).toContain(SCORING[parte?.modality ?? 'sala'].label);
      expect(item.querySelector('b')?.textContent).toBe(`${parte?.pct}%`);
    }
  });

  it('el color va como variable, y el tema lo elige en CSS', () => {
    const { container } = render(<BarraDeModalidades modalidades={reparto} />);
    const tramo = container.querySelector('[data-tramo]') as HTMLElement;

    expect(tramo.getAttribute('data-chip')).toBe('modalidad');
    expect(tramo.style.getPropertyValue('--chip')).not.toBe('');
    expect(tramo.style.getPropertyValue('--chip-oscuro')).not.toBe('');
  });

  it('sin modalidades no dibuja nada', () => {
    expect(render(<BarraDeModalidades modalidades={[]} />).container.firstChild).toBeNull();
  });
});

// ── RotuloDeSeccion (SectionHeader, §4.7) ────────────────────────────────────

describe('RotuloDeSeccion', () => {
  it('es un encabezado, con la cantidad adentro', () => {
    render(<RotuloDeSeccion titulo="En curso" cantidad={3} />);
    const titulo = screen.getByRole('heading', { level: 2 });

    expect(titulo).toHaveTextContent('En curso');
    expect(within(titulo).getByText('3')).toBeInTheDocument();
  });

  it('el nivel se elige', () => {
    render(<RotuloDeSeccion titulo="Patrullas" nivel={3} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Patrullas' })).toBeInTheDocument();
  });

  /**
   * Cuando la sección ya tiene su título grande (la portada: «FECHAS DE LA TEMPORADA» arriba de
   * «Torneos»), el rótulo es un antetítulo y no otro encabezado: dos `h2` seguidos dirían lo mismo.
   */
  it('puede ser un antetítulo, sin ser encabezado', () => {
    render(<RotuloDeSeccion titulo="Fechas de la temporada" cantidad={2} nivel={false} />);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('Fechas de la temporada')).toBeInTheDocument();
  });

  it('sin cantidad no dibuja el contador', () => {
    const { container } = render(<RotuloDeSeccion titulo="Modalidades" />);
    expect(container.querySelector('[data-cantidad]')).toBeNull();
  });

  it('la acción es un enlace con su flecha decorativa', () => {
    render(<RotuloDeSeccion titulo="Torneos" accion={{ texto: 'Ver todas', href: '/torneos' }} />);
    const enlace = screen.getByRole('link', { name: 'Ver todas' });

    expect(enlace).toHaveAttribute('href', '/torneos');
    expect(enlace.querySelector('svg')).toHaveAttribute('aria-hidden');
  });

  it('usa el enlace de quien lo monta, para navegar sin recargar', () => {
    function EnlaceDePrueba(p: { href: string; className?: string; children: ReactNode }) {
      return (
        <a data-propio href={p.href} className={p.className}>
          {p.children}
        </a>
      );
    }
    render(
      <RotuloDeSeccion
        titulo="Torneos"
        accion={{ texto: 'Ver todas', href: '/torneos' }}
        enlace={EnlaceDePrueba}
      />,
    );

    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('data-propio');
  });
});

// ── AnilloDeRecorrido (CircuitRing, §4.9 y DESIGN_SYSTEM.md §6.5) ────────────

describe('AnilloDeRecorrido', () => {
  const completos = (c: HTMLElement) =>
    ([...c.querySelectorAll('[data-segmento]')] as SVGElement[])
      .filter((s) => s.hasAttribute('data-completo'))
      .map((s) => Number(s.getAttribute('data-segmento')));

  it('dibuja un segmento por blanco', () => {
    const { container } = render(<AnilloDeRecorrido total={6} completados={2} />);
    expect(container.querySelectorAll('[data-segmento]')).toHaveLength(6);
  });

  it('dice el avance en palabras', () => {
    render(<AnilloDeRecorrido total={6} completados={2} />);
    expect(screen.getByRole('img', { name: '2 de 6 blancos cargados' })).toBeInTheDocument();
  });

  it('cuenta los completos desde el blanco de inicio, dando la vuelta', () => {
    // Una patrulla que arranca en el blanco 5 (índice 4) y ya hizo tres: 5, 6 y 1.
    const { container } = render(<AnilloDeRecorrido total={6} completados={3} inicio={4} />);
    expect(completos(container)).toEqual([0, 4, 5]);
  });

  it('también acepta cuáles blancos están cargados, si no fueron en orden', () => {
    const { container } = render(<AnilloDeRecorrido total={6} completados={[1, 3]} />);

    expect(completos(container)).toEqual([1, 3]);
    expect(screen.getByRole('img', { name: '2 de 6 blancos cargados' })).toBeInTheDocument();
  });

  it('los completos se pintan con el verde que se lee', () => {
    const { container } = render(<AnilloDeRecorrido total={4} completados={1} />);
    const completo = container.querySelector('[data-completo]') as SVGElement;
    const pendiente = container.querySelector('[data-segmento]:not([data-completo])') as SVGElement;

    expect(completo.getAttribute('class')).toContain('stroke-[var(--nock-text)]');
    expect(pendiente.getAttribute('class')).toContain('stroke-[var(--line)]');
  });

  it.each([36, 44, 76, 120] as const)('mide %ipx', (tamaño) => {
    const { container } = render(<AnilloDeRecorrido total={6} completados={0} tamaño={tamaño} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', String(tamaño));
  });

  it('a 120px lleva la etiqueta del centro', () => {
    render(<AnilloDeRecorrido total={6} completados={4} tamaño={120} conEtiqueta />);
    expect(screen.getByText('4/6')).toBeInTheDocument();
    expect(screen.getByText('blancos')).toBeInTheDocument();
  });

  it('sin blancos no dibuja nada', () => {
    expect(render(<AnilloDeRecorrido total={0} completados={0} />).container.firstChild).toBeNull();
  });
});

// ── TarjetaDeTorneo (TournamentCard, §4.8) ───────────────────────────────────

describe('TarjetaDeTorneo', () => {
  const torneo = {
    id: 't1',
    name: '3ª fecha',
    date: '2026-08-08',
    status: 'publicado' as const,
    targetCount: 6,
    participantCount: 8,
    modalities: [
      { modality: 'campo' as const, pct: 50 },
      { modality: '3d' as const, pct: 50 },
    ],
  };

  it('es un enlace entero al torneo', () => {
    render(<TarjetaDeTorneo torneo={torneo} href="/torneos/t1" publico />);
    const tarjeta = screen.getByTestId('torneo-t1');

    expect(tarjeta.tagName).toBe('A');
    expect(tarjeta).toHaveAttribute('href', '/torneos/t1');
    expect(within(tarjeta).getByRole('heading', { name: '3ª fecha' })).toBeInTheDocument();
  });

  it('dice qué tan grande es, y las patrullas sólo si el dato está', () => {
    render(<TarjetaDeTorneo torneo={torneo} href="/x" publico />);
    expect(screen.getByTestId('torneo-t1')).toHaveTextContent('6 blancos · 8 arqueros');
    expect(screen.getByTestId('torneo-t1')).not.toHaveTextContent('patrullas');

    cleanup();
    render(<TarjetaDeTorneo torneo={{ ...torneo, patrolCount: 3 }} href="/x" />);
    expect(screen.getByTestId('torneo-t1')).toHaveTextContent(
      '6 blancos · 8 arqueros · 3 patrullas',
    );
  });

  it('lleva el estado del público o el del admin', () => {
    render(<TarjetaDeTorneo torneo={torneo} href="/x" publico />);
    expect(screen.getByTestId('estado-torneo')).toHaveTextContent('Resultados oficiales');

    cleanup();
    render(<TarjetaDeTorneo torneo={torneo} href="/x" />);
    expect(screen.getByTestId('estado-torneo')).toHaveTextContent('Publicado');
  });

  it('muestra la distribución de modalidades, y sigue en pie sin ella', () => {
    render(<TarjetaDeTorneo torneo={torneo} href="/x" publico />);
    expect(screen.getByTestId('modalidades')).toBeInTheDocument();

    cleanup();
    const { modalities: _sinModalidades, ...viejo } = torneo;
    render(<TarjetaDeTorneo torneo={viejo} href="/x" publico />);
    expect(screen.getByTestId('torneo-t1')).toBeInTheDocument();
    expect(screen.queryByTestId('modalidades')).toBeNull();
  });

  it.each([
    ['en_proceso', 'Ver en vivo'],
    ['publicado', 'Podios y estadísticas'],
  ] as const)('el pie de un torneo %s dice qué vas a encontrar', (status, texto) => {
    render(<TarjetaDeTorneo torneo={{ ...torneo, status }} href="/x" publico />);
    expect(screen.getByTestId('torneo-t1')).toHaveTextContent(texto);
  });

  it('el pie se puede reemplazar (WAFA en proceso: un anillo por patrulla)', () => {
    render(
      <TarjetaDeTorneo
        torneo={{ ...torneo, status: 'en_proceso' }}
        href="/x"
        pie={<span>anillos</span>}
      />,
    );
    expect(screen.getByText('anillos')).toBeInTheDocument();
    expect(screen.getByTestId('torneo-t1')).not.toHaveTextContent('Ver en vivo');
  });

  it('el texto del pie se puede cambiar', () => {
    render(
      <TarjetaDeTorneo
        torneo={{ ...torneo, status: 'sin_iniciar' }}
        href="/x"
        accion="Armar patrullas"
      />,
    );
    expect(screen.getByTestId('torneo-t1')).toHaveTextContent('Armar patrullas');
  });
});

// ── AnillosDeFondo (decoración del hero y de la puerta) ──────────────────────

describe('AnillosDeFondo', () => {
  /** §6.5 reserva el anillo con datos a sus tres lugares: este no dice nada, y no se anuncia. */
  it('es decoración: no se anuncia ni se puede enfocar', () => {
    const { container } = render(<AnillosDeFondo />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg?.querySelectorAll('circle')).toHaveLength(5);
  });
});
