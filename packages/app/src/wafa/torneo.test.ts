import { describe, expect, it } from 'vitest';
import {
  avanceDePatrullas,
  avisosDePublicacion,
  motivoDeBloqueo,
  type PatrullaSeguimiento,
  podiosConPuntos,
  puntosQueSeAplicarian,
  type ResultadoParticipante,
  sePuedePublicar,
} from './torneo.js';

/**
 * Seguimiento y publicación (FE-14 y FE-15).
 *
 * Ver docs/FUNCTIONAL.md §6.7 y docs/DOMAIN_WA.md §9.
 */

let n = 0;

function participante(overrides: Partial<ResultadoParticipante> = {}): ResultadoParticipante {
  n++;
  return {
    id: `p${n}`,
    participantId: `p${n}`,
    archerId: `a${n}`,
    firstName: `Nombre${n}`,
    lastName: `Apellido${String(n).padStart(3, '0')}`,
    category: 'razo',
    stake: 'azul',
    patrolNumber: 1,
    total: 0,
    normalizedPct: 0,
    innerCount: 0,
    tenCount: 0,
    mCount: 0,
    targetsCompleted: 0,
    signed: true,
    signatureUnlocked: false,
    ...overrides,
  };
}

const patrulla = (o: Partial<PatrullaSeguimiento> = {}): PatrullaSeguimiento => ({
  number: 1,
  status: 'en_curso',
  targetsCompleted: 0,
  members: [],
  ...o,
});

// ── Seguimiento ──────────────────────────────────────────────────────────────

describe('avanceDePatrullas', () => {
  it('ordena por número y calcula el porcentaje', () => {
    const avances = avanceDePatrullas(
      [patrulla({ number: 3, targetsCompleted: 6 }), patrulla({ number: 1, targetsCompleted: 3 })],
      [],
      12,
    );

    expect(avances.map((a) => a.number)).toEqual([1, 3]);
    expect(avances[0]?.pct).toBe(25);
    expect(avances[1]?.pct).toBe(50);
  });

  it('lista quiénes de la patrulla no firmaron', () => {
    const avances = avanceDePatrullas(
      [patrulla({ number: 1 }), patrulla({ number: 2 })],
      [
        participante({ patrolNumber: 1, lastName: 'Pérez', signed: false }),
        participante({ patrolNumber: 1, lastName: 'Gómez', signed: true }),
        participante({ patrolNumber: 2, lastName: 'Díaz', signed: false }),
      ],
      12,
    );

    expect(avances[0]?.sinFirmar.map((m) => m.lastName)).toEqual(['Pérez']);
    expect(avances[1]?.sinFirmar.map((m) => m.lastName)).toEqual(['Díaz']);
  });

  it('sin blancos no divide por cero', () => {
    expect(avanceDePatrullas([patrulla()], [], 0)[0]?.pct).toBe(0);
  });
});

describe('motivoDeBloqueo', () => {
  it('un blanco con puntajes está bloqueado, y dice por qué', () => {
    expect(motivoDeBloqueo(3, [3, 7], 'en_proceso')).toMatch(/ya firmó/);
  });

  it('un blanco sin puntajes se puede editar', () => {
    expect(motivoDeBloqueo(1, [3, 7], 'en_proceso')).toBeUndefined();
  });

  // Terminado el torneo no se toca nada, aunque el blanco no tenga puntajes:
  // por ejemplo si una patrulla nunca llegó a él.
  it('con el torneo terminado ningún blanco se toca', () => {
    expect(motivoDeBloqueo(1, [], 'completado')).toMatch(/ya terminó/);
    expect(motivoDeBloqueo(1, [], 'publicado')).toMatch(/ya terminó/);
  });

  it('sin iniciar todo es editable', () => {
    expect(motivoDeBloqueo(1, [], 'sin_iniciar')).toBeUndefined();
  });
});

// ── Podios ───────────────────────────────────────────────────────────────────

describe('podiosConPuntos', () => {
  it('reparte 5-4-3-2-1 por categoría', () => {
    const podios = podiosConPuntos([
      participante({ total: 100 }),
      participante({ total: 90 }),
      participante({ total: 80 }),
    ]);

    expect(podios[0]?.filas.map((f) => f.leaguePoints)).toEqual([5, 4, 3]);
  });

  it('del sexto en adelante no suma nada', () => {
    const podios = podiosConPuntos(
      [100, 90, 80, 70, 60, 50].map((total) => participante({ total })),
    );

    expect(podios[0]?.filas.map((f) => f.leaguePoints)).toEqual([5, 4, 3, 2, 1, 0]);
  });

  // El empate reparte los puntos DE ESA POSICIÓN a los dos, y el siguiente salta
  // al tercer puesto. Ver docs/DOMAIN_WA.md §9.1.
  it('un empate da los mismos puntos a los dos, y el siguiente queda tercero', () => {
    const podios = podiosConPuntos([
      participante({ total: 100 }),
      participante({ total: 100 }),
      participante({ total: 80 }),
    ]);

    expect(podios[0]?.filas.map((f) => f.position)).toEqual([1, 1, 3]);
    expect(podios[0]?.filas.map((f) => f.leaguePoints)).toEqual([5, 5, 3]);
    expect(podios[0]?.filas.map((f) => f.tied)).toEqual([true, true, false]);
  });

  it('cada categoría tiene su propio podio', () => {
    const podios = podiosConPuntos([
      participante({ category: 'razo', total: 50 }),
      participante({ category: 'longbow', total: 90 }),
    ]);

    expect(podios).toHaveLength(2);
    // El de longbow es primero de la suya aunque el otro tenga menos puntaje.
    expect(podios.every((p) => p.filas[0]?.leaguePoints === 5)).toBe(true);
  });

  it('las categorías vacías no aparecen', () => {
    expect(podiosConPuntos([participante({ category: 'razo' })]).map((p) => p.category)).toEqual([
      'razo',
    ]);
  });

  // Un ausente no tiró: su cero no puede ocupar un lugar del podio.
  it('los ausentes quedan fuera del podio', () => {
    const podios = podiosConPuntos([
      participante({ total: 100 }),
      participante({ total: 0, status: 'ausente' }),
    ]);

    expect(podios[0]?.filas).toHaveLength(1);
  });

  it('sin participantes no hay podios', () => {
    expect(podiosConPuntos([])).toEqual([]);
  });
});

describe('puntosQueSeAplicarian', () => {
  it('deja sólo a los que suman', () => {
    const puntos = puntosQueSeAplicarian(
      [100, 90, 80, 70, 60, 50].map((total) => participante({ total })),
    );

    expect(puntos).toHaveLength(5);
    expect(puntos.map((p) => p.puntos)).toEqual([5, 4, 3, 2, 1]);
  });
});

// ── Publicación ──────────────────────────────────────────────────────────────

describe('avisosDePublicacion', () => {
  it('un torneo que no está completado no se puede publicar', () => {
    const avisos = avisosDePublicacion('en_proceso', [participante()]);

    expect(avisos[0]?.nivel).toBe('error');
    expect(sePuedePublicar(avisos)).toBe(false);
  });

  it('un torneo completado se puede publicar', () => {
    expect(sePuedePublicar(avisosDePublicacion('completado', [participante()]))).toBe(true);
  });

  // Es información que el admin tiene que ver antes de aplicar los resultados,
  // no un motivo para impedirlo.
  it('las firmas desbloqueadas se avisan, con nombre, sin frenar', () => {
    const avisos = avisosDePublicacion('completado', [
      participante({ lastName: 'Pérez', signatureUnlocked: true }),
      participante({ lastName: 'Gómez' }),
    ]);

    const aviso = avisos.find((a) => a.mensaje.includes('desbloqueadas'));
    expect(aviso?.nivel).toBe('aviso');
    expect(aviso?.mensaje).toMatch(/Pérez/);
    expect(aviso?.mensaje).not.toMatch(/Gómez/);
    expect(sePuedePublicar(avisos)).toBe(true);
  });

  it('los ausentes se avisan, sin frenar', () => {
    const avisos = avisosDePublicacion('completado', [
      participante(),
      participante({ status: 'ausente' }),
    ]);

    expect(avisos.some((a) => a.mensaje.includes('ausente'))).toBe(true);
    expect(sePuedePublicar(avisos)).toBe(true);
  });

  it('un torneo limpio no avisa nada', () => {
    expect(avisosDePublicacion('completado', [participante(), participante()])).toEqual([]);
  });
});
