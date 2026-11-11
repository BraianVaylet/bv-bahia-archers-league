import { describe, expect, it } from 'vitest';
import { cuerpoDeEdicion, faltaElMonto } from './cuerpoDeEdicion.js';
import type { Torneo } from './useTorneo.js';

/**
 * Qué manda el formulario de «Editar» de la ficha (`FE-32`).
 *
 * Sólo lo que el estado permite (`camposEditables`) y lo que cambió: el servidor rechaza el pedido
 * entero si sobra un campo (`BE-24`), y el audit log no tiene por qué anotar un cambio que no hubo.
 */

const TORNEO: Torneo = {
  id: 't1',
  name: '3ª fecha',
  date: '2026-08-08',
  status: 'sin_iniciar',
  targets: [],
  maxPossibleScore: 0,
  participantCount: 0,
  registrationUrl: null,
  description: 'Se larga 9:30',
  payment: { required: true, amount: 5000 },
};

describe('cuerpoDeEdicion', () => {
  it('sin cambios, manda sólo nombre y fecha', () => {
    expect(cuerpoDeEdicion(TORNEO, { ...TORNEO })).toEqual({
      name: '3ª fecha',
      date: '2026-08-08',
    });
  });

  it('manda la descripción y el pago que cambiaron, recortados', () => {
    const cuerpo = cuerpoDeEdicion(TORNEO, {
      ...TORNEO,
      description: '  Se larga 10  ',
      payment: { required: true, amount: 6000 },
    });
    expect(cuerpo).toMatchObject({
      description: 'Se larga 10',
      payment: { required: true, amount: 6000 },
    });
  });

  it('el link vaciado viaja como null', () => {
    const conLink = { ...TORNEO, registrationUrl: 'https://forms.gle/x' };
    expect(cuerpoDeEdicion(conLink, { ...conLink, registrationUrl: '  ' })).toMatchObject({
      registrationUrl: null,
    });
  });

  /** Esperando publicación sólo se editan nombre y fecha: lo demás no viaja aunque cambie. */
  it('no manda lo que el estado no permite', () => {
    const completado = { ...TORNEO, status: 'completado' as const };
    const cuerpo = cuerpoDeEdicion(completado, {
      ...completado,
      description: 'otra',
      payment: { required: false, amount: 0 },
      registrationUrl: 'https://forms.gle/x',
    });
    expect(Object.keys(cuerpo).sort()).toEqual(['date', 'name']);
  });
});

describe('faltaElMonto', () => {
  it('si se cobra, el monto tiene que ser positivo', () => {
    expect(faltaElMonto({ ...TORNEO, payment: { required: true, amount: 0 } })).toBe(true);
    expect(faltaElMonto({ ...TORNEO, payment: { required: true, amount: 1 } })).toBe(false);
    expect(faltaElMonto({ ...TORNEO, payment: { required: false, amount: 0 } })).toBe(false);
  });

  it('en un estado que no edita el pago, nunca frena', () => {
    const completado = { ...TORNEO, status: 'completado' as const };
    expect(faltaElMonto({ ...completado, payment: { required: true, amount: 0 } })).toBe(false);
  });
});
