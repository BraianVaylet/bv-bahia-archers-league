import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cargando, DEMORA_DE_CARGA_MS } from './Cargando.js';
import { Button } from './ui.js';

/**
 * El indicador de carga único de WAFA y WAFL.
 *
 * Lo que se prueba es lo que decide si ayuda o estorba: **no aparece** en una carga rápida
 * —la caché del service worker, una lectura de IndexedDB—, dice **qué** se está cargando, se
 * anuncia a un lector de pantalla y el esqueleto no se lee como contenido.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Avanza el reloj dentro de `act`, para que el `setState` del temporizador se aplique. */
function esperar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('Cargando', () => {
  it('antes de la demora no muestra nada, pero la región ya existe', () => {
    render(<Cargando texto="Cargando los torneos…" />);

    // La región vive desde el primer render: un lector de pantalla sólo anuncia los cambios de
    // una región que ya conocía.
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');
    expect(screen.queryByText('Cargando los torneos…')).toBeNull();
  });

  it('pasada la demora dice qué se está cargando', () => {
    render(<Cargando texto="Cargando los torneos…" />);
    esperar(DEMORA_DE_CARGA_MS);

    expect(screen.getByRole('status').textContent).toContain('Cargando los torneos…');
  });

  it('la demora es corta: entre 200 y 300 ms', () => {
    expect(DEMORA_DE_CARGA_MS).toBeGreaterThanOrEqual(200);
    expect(DEMORA_DE_CARGA_MS).toBeLessThanOrEqual(300);
  });

  it('si se desmonta antes de la demora, no queda nada pendiente', () => {
    const { unmount } = render(<Cargando texto="Cargando el torneo…" />);
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('la forma lista dibuja tarjetas fantasma ocultas para el lector', () => {
    render(<Cargando texto="Cargando el padrón…" forma="lista" filas={4} />);
    esperar(DEMORA_DE_CARGA_MS);

    const esqueleto = screen.getByTestId('esqueleto');
    expect(esqueleto.getAttribute('aria-hidden')).toBe('true');
    expect(esqueleto.children).toHaveLength(4);
  });

  it('la forma línea es sólo el texto, sin esqueleto', () => {
    render(<Cargando texto="Cargando la recaudación…" forma="linea" />);
    esperar(DEMORA_DE_CARGA_MS);

    expect(screen.queryByTestId('esqueleto')).toBeNull();
    expect(screen.getByText('Cargando la recaudación…')).toBeTruthy();
  });

  it('el pulso del esqueleto es sólo con movimiento permitido', () => {
    render(<Cargando texto="Cargando el torneo…" forma="detalle" />);
    esperar(DEMORA_DE_CARGA_MS);

    // `motion-safe:` de Tailwind: con `prefers-reduced-motion: reduce` no hay animación.
    expect(screen.getByTestId('esqueleto').className).toContain('motion-safe:animate-pulse');
  });
});

describe('Button ocupado', () => {
  it('queda deshabilitado y avisa que está trabajando', () => {
    render(<Button ocupado>Guardando…</Button>);

    const boton = screen.getByRole('button', { name: 'Guardando…' });
    expect(boton).toHaveProperty('disabled', true);
    expect(boton.getAttribute('aria-busy')).toBe('true');
  });

  it('sin ocupado no lleva aria-busy', () => {
    render(<Button>Guardar</Button>);

    expect(screen.getByRole('button').getAttribute('aria-busy')).toBeNull();
  });
});
