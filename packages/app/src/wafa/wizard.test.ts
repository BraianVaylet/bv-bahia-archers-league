import { describe, expect, it } from 'vitest';
import {
  type ArqueroElegible,
  agregarBlanco,
  avisoDeComposicion,
  blancoNuevo,
  borradorVacio,
  conModalidad,
  conteoPorCategoria,
  cuerpoDeCreacion,
  eliminarBlanco,
  maximoDelRecorrido,
  moverBlanco,
  problemaDelPaso,
  renumerar,
} from './wizard.js';

/**
 * Lógica del wizard de creación de torneo (FE-11).
 *
 * Se prueba acá y no a través de la interfaz: son las decisiones del wizard, y
 * pasarlas por clicks las haría más difíciles de leer sin probar nada más.
 */

let n = 0;

function arquero(category: ArqueroElegible['category'], apellido?: string): ArqueroElegible {
  n++;
  return {
    id: `a${n}`,
    firstName: `Nombre${n}`,
    lastName: apellido ?? `Apellido${String(n).padStart(3, '0')}`,
    category,
  };
}

function varios(category: ArqueroElegible['category'], cantidad: number): ArqueroElegible[] {
  return Array.from({ length: cantidad }, () => arquero(category));
}

// ── Blancos ──────────────────────────────────────────────────────────────────

describe('blancoNuevo', () => {
  it('precarga las flechas del reglamento de cada modalidad', () => {
    expect(blancoNuevo(1, 'sala').arrows).toBe(3);
    expect(blancoNuevo(1, 'aire_libre').arrows).toBe(6);
    expect(blancoNuevo(1, 'campo').arrows).toBe(3);
    expect(blancoNuevo(1, '3d').arrows).toBe(2);
  });
});

describe('conModalidad', () => {
  it('al cambiar la modalidad repone las flechas por defecto', () => {
    // Quien pasa un blanco a 3D espera 2 flechas, no las 3 que traía de sala.
    const sala = blancoNuevo(1, 'sala');
    expect(conModalidad(sala, '3d')).toMatchObject({ modality: '3d', arrows: 2 });
  });

  it('pisa incluso las flechas que el admin había tocado a mano', () => {
    // Conservarlas dejaría un 3D de 6 flechas sin que nadie lo haya pedido.
    const manual = { ...blancoNuevo(1, 'aire_libre'), arrows: 6 };
    expect(conModalidad(manual, 'campo').arrows).toBe(3);
  });

  it('no toca la descripción', () => {
    const conDesc = { ...blancoNuevo(1, 'sala'), description: 'Jabalí' };
    expect(conModalidad(conDesc, '3d').description).toBe('Jabalí');
  });
});

describe('renumerar', () => {
  it('deja los índices contiguos desde 1', () => {
    const sueltos = [blancoNuevo(5), blancoNuevo(2), blancoNuevo(9)];
    expect(renumerar(sueltos).map((b) => b.index)).toEqual([1, 2, 3]);
  });

  it('respeta el orden de la lista, no el número que traían', () => {
    const b1 = { ...blancoNuevo(9, '3d'), description: 'primero' };
    const b2 = { ...blancoNuevo(1, 'sala'), description: 'segundo' };

    expect(renumerar([b1, b2]).map((b) => b.description)).toEqual(['primero', 'segundo']);
  });
});

describe('agregar y eliminar blancos', () => {
  it('agregar deja el nuevo al final, numerado', () => {
    const dos = agregarBlanco([blancoNuevo(1)]);
    expect(dos.map((b) => b.index)).toEqual([1, 2]);
  });

  // El backend exige índices contiguos: si quedara un hueco, el torneo se
  // rechazaría recién al confirmar, después de cargar todo.
  it('eliminar del medio NO deja huecos', () => {
    const tres = [blancoNuevo(1), blancoNuevo(2), blancoNuevo(3)];
    expect(eliminarBlanco(tres, 2).map((b) => b.index)).toEqual([1, 2]);
  });

  it('eliminar conserva los datos de los que quedan', () => {
    const tres = [
      { ...blancoNuevo(1, 'sala'), description: 'uno' },
      { ...blancoNuevo(2, '3d'), description: 'dos' },
      { ...blancoNuevo(3, 'campo'), description: 'tres' },
    ];

    const quedan = eliminarBlanco(tres, 2);
    expect(quedan.map((b) => b.description)).toEqual(['uno', 'tres']);
    expect(quedan.map((b) => b.modality)).toEqual(['sala', 'campo']);
  });
});

describe('moverBlanco', () => {
  const tres = () => [
    { ...blancoNuevo(1, 'sala'), description: 'A' },
    { ...blancoNuevo(2, '3d'), description: 'B' },
    { ...blancoNuevo(3, 'campo'), description: 'C' },
  ];

  it('sube y renumera', () => {
    const r = moverBlanco(tres(), 3, -1);
    expect(r.map((b) => b.description)).toEqual(['A', 'C', 'B']);
    expect(r.map((b) => b.index)).toEqual([1, 2, 3]);
  });

  it('baja y renumera', () => {
    expect(moverBlanco(tres(), 1, 1).map((b) => b.description)).toEqual(['B', 'A', 'C']);
  });

  // Envolver al otro extremo sorprende: el admin está mirando una lista, no un
  // anillo.
  it('en los extremos no hace nada, no envuelve', () => {
    expect(moverBlanco(tres(), 1, -1).map((b) => b.description)).toEqual(['A', 'B', 'C']);
    expect(moverBlanco(tres(), 3, 1).map((b) => b.description)).toEqual(['A', 'B', 'C']);
  });

  it('no muta el array recibido', () => {
    const original = tres();
    moverBlanco(original, 1, 1);
    expect(original.map((b) => b.description)).toEqual(['A', 'B', 'C']);
  });
});

describe('maximoDelRecorrido', () => {
  it('suma el techo de cada blanco según su modalidad', () => {
    // sala 3×10 = 30 · 3D 2×11 = 22 · campo 3×6 = 18
    const recorrido = [blancoNuevo(1, 'sala'), blancoNuevo(2, '3d'), blancoNuevo(3, 'campo')];
    expect(maximoDelRecorrido(recorrido)).toBe(70);
  });

  it('cambia al cambiar las flechas de un blanco', () => {
    const uno = [{ ...blancoNuevo(1, 'sala'), arrows: 6 }];
    expect(maximoDelRecorrido(uno)).toBe(60);
  });

  it('un recorrido vacío vale 0', () => {
    expect(maximoDelRecorrido([])).toBe(0);
  });
});

// ── Composición ──────────────────────────────────────────────────────────────

describe('conteoPorCategoria', () => {
  it('cuenta por categoría y omite las vacías', () => {
    const conteo = conteoPorCategoria([...varios('razo', 3), ...varios('escuela', 1)]);

    expect(conteo).toHaveLength(2);
    expect(conteo.find((c) => c.category === 'razo')?.cantidad).toBe(3);
    expect(conteo.find((c) => c.category === 'escuela')?.cantidad).toBe(1);
  });
});

describe('avisoDeComposicion', () => {
  it('con menos de dos arqueros no se puede armar ni una patrulla', () => {
    expect(avisoDeComposicion([], 10).nivel).toBe('error');
    expect(avisoDeComposicion(varios('razo', 1), 10).nivel).toBe('error');
  });

  it('una composición cómoda no avisa nada', () => {
    expect(avisoDeComposicion(varios('razo', 4), 10).nivel).toBe('ok');
  });

  // H3: ninguna patrulla puede ser 100% escuela. Ver docs/DOMAIN_WA.md §5.
  it('sólo arqueros de escuela es un ERROR, y dice quiénes quedan afuera', () => {
    const aviso = avisoDeComposicion(
      [arquero('escuela', 'Pérez'), arquero('escuela', 'Gómez')],
      10,
    );

    expect(aviso.nivel).toBe('error');
    if (aviso.nivel === 'error') {
      expect(aviso.mensaje).toMatch(/Pérez/);
      expect(aviso.mensaje).toMatch(/Gómez/);
      // Y dice qué hacer, no sólo que está mal.
      expect(aviso.mensaje).toMatch(/Sumá un senior/);
    }
  });

  it('más escuela que seniors avisa que va a quedar justo, sin frenar', () => {
    // 2 de escuela forman una unidad; el senior solitario la acompaña. Entra,
    // pero sin margen.
    const aviso = avisoDeComposicion([...varios('escuela', 2), ...varios('razo', 1)], 10);

    expect(aviso.nivel).toBe('aviso');
  });

  /**
   * Se cuentan UNIDADES, no cabezas: 3 de escuela forman dos unidades —una de a
   * dos y un solitario— mientras que 2 razo forman una sola. Una unidad de
   * escuela queda sin senior aunque «haya seniors».
   */
  it('3 de escuela y 2 seniors NO alcanza, aunque parezca que sí', () => {
    expect(avisoDeComposicion([...varios('escuela', 3), ...varios('razo', 2)], 10).nivel).toBe(
      'error',
    );
  });

  it('el aviso corre el mismo algoritmo que el servidor, no una heurística', () => {
    // 1 escuela + 1 senior alcanza: el senior la acompaña. Una regla del tipo
    // "escuela <= seniors/2" diría que no, y estaría equivocada.
    expect(avisoDeComposicion([arquero('escuela'), arquero('razo')], 10).nivel).toBe('ok');
  });
});

// ── Pasos ────────────────────────────────────────────────────────────────────

describe('problemaDelPaso', () => {
  const completo = () => ({
    ...borradorVacio(),
    name: '3ª fecha',
    date: '2026-08-08',
    seasonId: 's1',
    elegidos: varios('razo', 4),
  });

  it('el paso 1 exige nombre, fecha y temporada', () => {
    const b = borradorVacio();
    expect(problemaDelPaso(1, b)).toMatch(/nombre/i);
    expect(problemaDelPaso(1, { ...b, name: '3ª fecha' })).toMatch(/fecha/i);
    expect(problemaDelPaso(1, { ...b, name: '3ª fecha', date: '2026-08-08' })).toMatch(
      /temporada/i,
    );
    expect(problemaDelPaso(1, completo())).toBeUndefined();
  });

  it('el paso 2 exige al menos un blanco', () => {
    expect(problemaDelPaso(2, { ...completo(), blancos: [] })).toMatch(/al menos un blanco/);
    expect(problemaDelPaso(2, completo())).toBeUndefined();
  });

  it('el paso 3 frena ante un error de composición', () => {
    const soloEscuela = { ...completo(), elegidos: varios('escuela', 2) };
    expect(problemaDelPaso(3, soloEscuela)).toMatch(/No alcanzan los arqueros senior/);
  });

  // Un aviso es información, no una pared: el admin puede saber algo que el
  // algoritmo no.
  it('el paso 3 NO frena ante un aviso', () => {
    const justo = { ...completo(), elegidos: [...varios('escuela', 2), ...varios('razo', 1)] };
    expect(problemaDelPaso(3, justo)).toBeUndefined();
  });
});

describe('cuerpoDeCreacion', () => {
  it('manda lo que espera el backend, con los nombres recortados', () => {
    const b = {
      ...borradorVacio(),
      seasonId: 's1',
      name: '  3ª fecha  ',
      date: '2026-08-08',
      description: '  ',
      blancos: [blancoNuevo(1, 'sala'), { ...blancoNuevo(2, '3d'), description: 'Jabalí' }],
      elegidos: varios('razo', 2),
    };

    expect(cuerpoDeCreacion(b)).toEqual({
      seasonId: 's1',
      name: '3ª fecha',
      date: '2026-08-08',
      description: '',
      targets: [
        { index: 1, modality: 'sala', arrows: 3, description: null },
        { index: 2, modality: '3d', arrows: 2, description: 'Jabalí' },
      ],
      archerIds: b.elegidos.map((a) => a.id),
    });
  });

  // El servidor deriva los valores desde los tokens y calcula el máximo por su
  // cuenta. Mandarlo desde el cliente sería ofrecerle un dato que no va a usar.
  it('NO manda el máximo posible ni ningún total', () => {
    const cuerpo = cuerpoDeCreacion({ ...borradorVacio(), seasonId: 's1', name: 'x', date: 'y' });
    expect(Object.keys(cuerpo)).not.toContain('maxPossibleScore');
  });
});
