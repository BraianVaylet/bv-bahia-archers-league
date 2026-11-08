import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './useWakeLock.js';

/**
 * Pantalla encendida mientras se anota un blanco (`REF6-12` / `U-7`).
 *
 * Entre flecha y flecha el celular se bloquea, y desbloquearlo con guantes es justo lo que el
 * sistema de diseño intenta evitar. La Screen Wake Lock API lo evita; estos tests fijan **cuándo**
 * se pide, cuándo se suelta y qué pasa cuando el navegador la suelta solo (al ocultarse la página).
 */

interface Candado {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (tipo: 'release', cb: () => void) => void;
  /** Lo que hace el navegador al ocultarse la página: soltarlo y avisar. */
  soltar: () => void;
}

let candados: Candado[];
let pedir: ReturnType<typeof vi.fn>;

function nuevoCandado(): Candado {
  const oyentes: Array<() => void> = [];
  const candado: Candado = {
    released: false,
    release: vi.fn(async () => candado.soltar()),
    addEventListener: (_tipo, cb) => {
      oyentes.push(cb);
    },
    soltar: () => {
      if (candado.released) return;
      candado.released = true;
      for (const cb of oyentes) cb();
    },
  };
  candados.push(candado);
  return candado;
}

function instalarWakeLock(request: () => Promise<Candado>) {
  pedir = vi.fn(request);
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request: pedir },
    configurable: true,
  });
}

function visibilidad(estado: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: estado, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Deja correr las promesas pendientes (el pedido es asincrónico). */
const asentar = () => new Promise((r) => setTimeout(r, 0));

function Pantalla({ activo }: { readonly activo?: boolean }) {
  useWakeLock(activo);
  return null;
}

beforeEach(() => {
  candados = [];
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  instalarWakeLock(async () => nuevoCandado());
});

afterEach(() => {
  cleanup();
  // @ts-expect-error — se quita lo que se instaló, para que el siguiente test parta sin la API.
  delete navigator.wakeLock;
});

describe('useWakeLock', () => {
  it('pide un candado de pantalla al montar', async () => {
    render(<Pantalla />);
    await asentar();

    expect(pedir).toHaveBeenCalledTimes(1);
    expect(pedir).toHaveBeenCalledWith('screen');
  });

  it('lo libera al desmontar: fuera del blanco la pantalla se apaga como siempre', async () => {
    const { unmount } = render(<Pantalla />);
    await asentar();

    unmount();
    await asentar();

    expect(candados[0]?.released).toBe(true);
  });

  it('en un navegador sin la API no hace nada ni falla', async () => {
    // @ts-expect-error — un navegador sin Wake Lock.
    delete navigator.wakeLock;

    expect(() => render(<Pantalla />)).not.toThrow();
    await asentar();
  });

  it('con activo en false no pide nada', async () => {
    render(<Pantalla activo={false} />);
    await asentar();

    expect(pedir).not.toHaveBeenCalled();
  });

  it('si pasa a inactivo, libera el candado', async () => {
    const { rerender } = render(<Pantalla activo />);
    await asentar();

    rerender(<Pantalla activo={false} />);
    await asentar();

    expect(candados[0]?.released).toBe(true);
  });

  // Al ocultarse la página el navegador suelta el candado solo. Si no se vuelve a pedir, la
  // pantalla se apaga en el segundo blanco aunque el primero la mantuviera encendida.
  it('lo vuelve a pedir al volver a ser visible, si el navegador lo soltó', async () => {
    render(<Pantalla />);
    await asentar();

    candados[0]?.soltar();
    visibilidad('hidden');
    visibilidad('visible');
    await asentar();

    expect(pedir).toHaveBeenCalledTimes(2);
    expect(candados[1]?.released).toBe(false);
  });

  it('no pide otro si todavía tiene el candado', async () => {
    render(<Pantalla />);
    await asentar();

    visibilidad('visible');
    await asentar();

    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('no pide mientras la página está oculta', async () => {
    render(<Pantalla />);
    await asentar();
    candados[0]?.soltar();

    visibilidad('hidden');
    await asentar();

    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('si el pedido se rechaza (batería baja, sin permiso) no rompe, y reintenta al volver', async () => {
    let intentos = 0;
    instalarWakeLock(async () => {
      intentos++;
      if (intentos === 1) throw new DOMException('batería baja', 'NotAllowedError');
      return nuevoCandado();
    });

    render(<Pantalla />);
    await asentar();
    expect(candados).toHaveLength(0);

    visibilidad('visible');
    await asentar();

    expect(pedir).toHaveBeenCalledTimes(2);
    expect(candados).toHaveLength(1);
  });

  it('si se desmonta antes de que llegue el candado, lo libera apenas llega', async () => {
    let resolver: (c: Candado) => void = () => {};
    instalarWakeLock(() => new Promise<Candado>((r) => (resolver = r)));

    const { unmount } = render(<Pantalla />);
    unmount();
    const tardio = nuevoCandado();
    resolver(tardio);
    await asentar();

    expect(tardio.released).toBe(true);
  });

  it('dos avisos de visibilidad seguidos, con un pedido en camino, piden un solo candado', async () => {
    let resolver: (c: Candado) => void = () => {};
    instalarWakeLock(() => new Promise<Candado>((r) => (resolver = r)));

    render(<Pantalla />);
    visibilidad('visible');
    visibilidad('visible');
    resolver(nuevoCandado());
    await asentar();

    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('desmontado, deja de escuchar la visibilidad', async () => {
    const { unmount } = render(<Pantalla />);
    await asentar();
    unmount();
    await asentar();

    visibilidad('visible');
    await asentar();

    expect(pedir).toHaveBeenCalledTimes(1);
  });
});
