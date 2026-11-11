import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndicadorDeAmbiente, leerAmbiente } from './IndicadorDeAmbiente.js';

/**
 * La barra «estás en modo desarrollo», arriba del encabezado de la landing, WAFA y WAFL.
 *
 * El ambiente lo escribe en el `<html>` quien entrega el documento: la API en Railway (de su
 * `NODE_ENV`) y el Vite de `pnpm dev` en local. Ver `packages/api/src/middleware/estaticos.ts`.
 */

const raiz = document.documentElement;

afterEach(() => {
  cleanup();
  raiz.removeAttribute('data-ambiente');
  vi.restoreAllMocks();
});

describe('leerAmbiente', () => {
  it('lee el ambiente del <html>', () => {
    raiz.setAttribute('data-ambiente', 'development');
    expect(leerAmbiente()).toBe('development');
  });

  it('sin atributo no hay ambiente', () => {
    expect(leerAmbiente()).toBeNull();
  });
});

describe('IndicadorDeAmbiente', () => {
  it('en desarrollo avisa', () => {
    raiz.setAttribute('data-ambiente', 'development');
    render(<IndicadorDeAmbiente />);

    expect(screen.getByText(/estás en modo desarrollo/i)).toBeInTheDocument();
  });

  it.each(['production', 'test'])('en %s no muestra nada', (ambiente) => {
    raiz.setAttribute('data-ambiente', ambiente);
    const { container } = render(<IndicadorDeAmbiente />);

    expect(container).toBeEmptyDOMElement();
  });

  // Un `index.html` viejo, o uno servido por algo que no lo marca: ante la duda, nada. Una
  // barra de desarrollo en producción alarma a quien está compitiendo.
  it('sin ambiente en el documento no muestra nada', () => {
    const { container } = render(<IndicadorDeAmbiente />);
    expect(container).toBeEmptyDOMElement();
  });

  it('el ambiente explícito gana sobre el del documento', () => {
    raiz.setAttribute('data-ambiente', 'production');
    render(<IndicadorDeAmbiente ambiente="development" />);

    expect(screen.getByText(/estás en modo desarrollo/i)).toBeInTheDocument();
  });

  // La UI de WAFL no lee de respuestas HTTP y tiene que arrancar sin red.
  it('no pide nada a la red', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    raiz.setAttribute('data-ambiente', 'development');
    render(<IndicadorDeAmbiente />);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('ocupa todo el ancho', () => {
    render(<IndicadorDeAmbiente ambiente="development" />);
    expect(barra().className).toMatch(/\bw-full\b/);
  });

  // Los colores de estaca son semántica reservada (`CLAUDE.md`, regla 8).
  it('no usa los colores de estaca', () => {
    render(<IndicadorDeAmbiente ambiente="development" />);
    expect(barra().outerHTML).not.toMatch(/stake|roj|azul|amarill|naranja/i);
  });

  // No tiene nada que tocar: no entra en la regla de los 44px ni le roba una parada al Tab.
  it('no es interactiva', () => {
    render(<IndicadorDeAmbiente ambiente="development" />);
    expect(barra().querySelector('a, button, input, [tabindex]')).toBeNull();
  });
});

/**
 * La PWA mide sus pantallas con `h-dvh`: una barra de más arriba haría scrollear el documento y
 * escondería la barra de acción de abajo. El alto que ocupa se reserva en CSS, del mismo
 * atributo del `<html>`, y las pantallas lo descuentan.
 */
describe('alto reservado en tokens.css', () => {
  // `cwd` y no `import.meta.url`: en jsdom la URL del módulo es `http:`.
  const css = readFileSync(join(process.cwd(), 'styles', 'tokens.css'), 'utf8');

  it('por omisión no reserva nada', () => {
    expect(css).toMatch(/:root\s*\{[^}]*--reserva-aviso-de-ambiente:\s*0px;/);
  });

  it('en desarrollo reserva el alto de la barra', () => {
    expect(css).toMatch(
      /:root\[data-ambiente='development'\]\s*\{[^}]*--reserva-aviso-de-ambiente:\s*var\(--alto-aviso-de-ambiente\);/,
    );
  });

  it('la barra mide lo que se reserva', () => {
    render(<IndicadorDeAmbiente ambiente="development" />);
    expect(barra().className).toContain('h-[var(--alto-aviso-de-ambiente)]');
  });
});

function barra(): HTMLElement {
  const texto = screen.getByText(/estás en modo desarrollo/i);
  const contenedor = texto.closest<HTMLElement>('[data-indicador-ambiente]');
  if (!contenedor) throw new Error('la barra no tiene `data-indicador-ambiente`');
  return contenedor;
}
