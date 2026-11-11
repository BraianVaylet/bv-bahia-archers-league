import { describe, expect, it } from 'vitest';
import {
  avanceDePatrullas,
  avisosDePublicacion,
  motivoDeBloqueo,
  type PatrullaSeguimiento,
  podios,
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

describe('podios', () => {
  it('ordena por puntaje descendente dentro de la categoría', () => {
    const p = podios([
      participante({ total: 100 }),
      participante({ total: 90 }),
      participante({ total: 80 }),
    ]);

    expect(p[0]?.filas.map((f) => f.position)).toEqual([1, 2, 3]);
  });

  // El empate comparte posición y el siguiente salta al tercer puesto.
  // Ver docs/DOMAIN_WA.md §8.
  it('un empate comparte posición, y el siguiente queda tercero', () => {
    const p = podios([
      participante({ total: 100 }),
      participante({ total: 100 }),
      participante({ total: 80 }),
    ]);

    expect(p[0]?.filas.map((f) => f.position)).toEqual([1, 1, 3]);
    expect(p[0]?.filas.map((f) => f.tied)).toEqual([true, true, false]);
  });

  // `/results` manda `id` y **no** `participantId`. El desempate de presentación de `rankParticipants`
  // compara `participantId`: si `podios` no se lo da, queda `undefined` y el orden de dos arqueros
  // iguales en todo depende de cómo hayan llegado (`REF6-11` / `C-3`).
  it('con filas como las manda el servidor, desempata por id y no por el orden de llegada', () => {
    const comoLoManda = (p: ResultadoParticipante): ResultadoParticipante => {
      const { participantId: _sinUsar, ...resto } = p as ResultadoParticipante & {
        participantId?: string;
      };
      return resto as ResultadoParticipante;
    };
    const igual = { firstName: 'Ana', lastName: 'Pérez', total: 100 };
    const nueve = comoLoManda(participante({ ...igual, id: 'p9' }));
    const uno = comoLoManda(participante({ ...igual, id: 'p1' }));

    const llegaronAsi = podios([nueve, uno])[0]?.filas.map((f) => f.participante.id);
    const llegaronAlReves = podios([uno, nueve])[0]?.filas.map((f) => f.participante.id);

    expect(llegaronAsi).toEqual(['p1', 'p9']);
    expect(llegaronAlReves).toEqual(['p1', 'p9']);
  });

  it('cada categoría tiene su propio podio', () => {
    const p = podios([
      participante({ category: 'razo', total: 50 }),
      participante({ category: 'longbow', total: 90 }),
    ]);

    expect(p).toHaveLength(2);
    // El de longbow es primero de la suya aunque el otro tenga menos puntaje.
    expect(p.every((cat) => cat.filas[0]?.position === 1)).toBe(true);
  });

  it('las categorías vacías no aparecen', () => {
    expect(podios([participante({ category: 'razo' })]).map((p) => p.category)).toEqual(['razo']);
  });

  // Un ausente no tiró: su cero no puede ocupar un lugar del podio.
  it('los ausentes quedan fuera del podio', () => {
    const p = podios([participante({ total: 100 }), participante({ total: 0, status: 'ausente' })]);

    expect(p[0]?.filas).toHaveLength(1);
  });

  it('sin participantes no hay podios', () => {
    expect(podios([])).toEqual([]);
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

  /**
   * Un torneo ya publicado no está «sin poder publicarse»: ya lo está. La pantalla de resultados
   * le mostraba al admin un error rojo diciendo que sólo se publica un completado, encima del
   * cartel verde de «Publicado» (encontrado probando `FE-35`).
   */
  it('un torneo publicado no muestra el error de que no se puede publicar', () => {
    const avisos = avisosDePublicacion('publicado', [participante()]);
    expect(avisos.filter((a) => a.nivel === 'error')).toEqual([]);
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
