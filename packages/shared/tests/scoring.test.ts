import { describe, expect, it } from 'vitest';
import {
  isValidToken,
  MODALITIES,
  type Modality,
  maxPossibleScore,
  maxTargetScore,
  SCORING,
  sortArrowsDescending,
  tokenValue,
  validateTargetScore,
} from '../src/index';

/**
 * Scoring (SH-2).
 *
 * El servidor es la autoridad: deriva el valor de cada flecha desde su token y
 * recalcula los totales. Estos tests fijan ese contrato.
 *
 * Referencia: docs/DOMAIN_WA.md §1, §2 y §7 · casos en docs/TESTING.md §3.1.
 */

// Helper: exige que el resultado sea válido y devuelve el cómputo.
function computar(modality: Modality, arrows: string[], flechas = arrows.length) {
  const resultado = validateTargetScore(modality, flechas, arrows);
  if (!resultado.ok) {
    throw new Error(`Se esperaba un end válido, se obtuvo ${resultado.error.code}`);
  }
  return resultado.value;
}

describe('tokenValue', () => {
  it('devuelve el valor canónico de cada token de cada modalidad', () => {
    for (const modality of MODALITIES) {
      for (const token of SCORING[modality].scoringSet) {
        expect(tokenValue(modality, token)).toBe(SCORING[modality].values[token]);
      }
    }
  });

  it('X vale 10 en sala y aire libre', () => {
    expect(tokenValue('sala', 'X')).toBe(10);
    expect(tokenValue('aire_libre', 'X')).toBe(10);
  });

  it('X6 vale 6 en campo', () => {
    expect(tokenValue('campo', 'X6')).toBe(6);
  });

  it('11 vale 11 en 3D', () => {
    expect(tokenValue('3d', '11')).toBe(11);
  });

  it('M vale 0 en las cuatro modalidades', () => {
    for (const modality of MODALITIES) {
      expect(tokenValue(modality, 'M')).toBe(0);
    }
  });

  it('lanza error tipado ante un token que no pertenece a la modalidad', () => {
    expect(() => tokenValue('sala', '11')).toThrow(/11/);
  });
});

describe('isValidToken', () => {
  it('acepta los tokens del set de la modalidad', () => {
    for (const modality of MODALITIES) {
      for (const token of SCORING[modality].scoringSet) {
        expect(isValidToken(modality, token)).toBe(true);
      }
    }
  });

  // El error más fácil de cometer en este dominio: validar contra una lista fija
  // en vez de contra el set de la modalidad DE ESE BLANCO.
  it.each([
    ['sala', '11'],
    ['aire_libre', '11'],
    ['3d', 'X'],
    ['3d', '9'],
    ['3d', '7'],
    ['campo', '7'],
    ['campo', 'X'],
    ['campo', '10'],
    ['sala', 'X6'],
  ] as const)('rechaza el token %s en %s', (modality, token) => {
    expect(isValidToken(modality, token)).toBe(false);
  });

  it('rechaza basura', () => {
    expect(isValidToken('sala', '')).toBe(false);
    expect(isValidToken('sala', 'x')).toBe(false);
    expect(isValidToken('sala', '10 ')).toBe(false);
    expect(isValidToken('sala', 'constructor')).toBe(false);
    expect(isValidToken('sala', '__proto__')).toBe(false);
  });
});

describe('maxTargetScore', () => {
  it('multiplica el máximo por flecha por la cantidad de flechas', () => {
    expect(maxTargetScore('sala', 3)).toBe(30);
    expect(maxTargetScore('aire_libre', 6)).toBe(60);
    expect(maxTargetScore('campo', 3)).toBe(18);
    expect(maxTargetScore('3d', 2)).toBe(22);
  });

  it('respeta una cantidad de flechas personalizada', () => {
    expect(maxTargetScore('3d', 1)).toBe(11);
    expect(maxTargetScore('sala', 6)).toBe(60);
  });
});

describe('maxPossibleScore', () => {
  // Caso de referencia del brief: 14 blancos.
  // 6 × 3D(2 flechas) + 6 × campo(3) + 1 × aire libre(6) + 1 × sala(3)
  //   = 6×22 + 6×18 + 60 + 30 = 132 + 108 + 60 + 30 = 330
  it('suma el máximo de cada blanco del recorrido', () => {
    const recorrido = [
      ...Array.from({ length: 6 }, () => ({ modality: '3d' as const, arrows: 2 })),
      ...Array.from({ length: 6 }, () => ({ modality: 'campo' as const, arrows: 3 })),
      { modality: 'aire_libre' as const, arrows: 6 },
      { modality: 'sala' as const, arrows: 3 },
    ];
    expect(maxPossibleScore(recorrido)).toBe(330);
  });

  it('devuelve 0 para un recorrido vacío', () => {
    expect(maxPossibleScore([])).toBe(0);
  });
});

describe('validateTargetScore', () => {
  describe('cómputo', () => {
    it('suma el total de un blanco de sala', () => {
      expect(computar('sala', ['X', '9', '7']).total).toBe(26);
    });

    it('suma el total de un blanco 3D', () => {
      expect(computar('3d', ['11', '8']).total).toBe(19);
    });

    it('suma el total de un blanco de campo', () => {
      expect(computar('campo', ['6', '5', 'M']).total).toBe(11);
    });

    it('X suma a xCount y a innerCount', () => {
      const r = computar('sala', ['X', 'X', '9']);
      expect(r.xCount).toBe(2);
      expect(r.innerCount).toBe(2);
      expect(r.total).toBe(29);
    });

    it('X6 suma a innerCount pero no a xCount', () => {
      const r = computar('campo', ['X6', '5', '4']);
      expect(r.innerCount).toBe(1);
      expect(r.xCount).toBe(0);
      expect(r.total).toBe(15);
    });

    it('11 suma a innerCount pero no a xCount', () => {
      const r = computar('3d', ['11', '11']);
      expect(r.innerCount).toBe(2);
      expect(r.xCount).toBe(0);
      expect(r.total).toBe(22);
    });

    it('M suma a mCount y aporta 0', () => {
      const r = computar('aire_libre', ['9', 'M', 'M', '5', '3', 'M']);
      expect(r.mCount).toBe(3);
      expect(r.total).toBe(17);
    });

    // tenCount cuenta flechas que VALEN 10, así que X entra.
    // Ver docs/DOMAIN_WA.md §8.
    it('tenCount incluye la X porque vale 10', () => {
      const r = computar('sala', ['X', '10', '9']);
      expect(r.tenCount).toBe(2);
      expect(r.innerCount).toBe(1);
    });

    it('tenCount cuenta el 10 del 3D', () => {
      expect(computar('3d', ['10', '8']).tenCount).toBe(1);
    });

    it('tenCount es 0 en campo, donde no existe el 10', () => {
      expect(computar('campo', ['6', '6', '6']).tenCount).toBe(0);
    });

    it('expone los contadores de desempate de la modalidad', () => {
      // campo: tiebreakTokens = ['X6', '6']
      const r = computar('campo', ['X6', '6', '4']);
      expect(r.tiebreakCounts).toEqual([1, 1]);
    });

    it('un blanco todo M da total 0', () => {
      const r = computar('3d', ['M', 'M']);
      expect(r.total).toBe(0);
      expect(r.mCount).toBe(2);
      expect(r.innerCount).toBe(0);
    });

    it('un blanco perfecto da el máximo del blanco', () => {
      expect(computar('3d', ['11', '11']).total).toBe(maxTargetScore('3d', 2));
      expect(computar('sala', ['X', 'X', 'X']).total).toBe(maxTargetScore('sala', 3));
    });
  });

  describe('el orden de las flechas no altera el resultado', () => {
    it('mismo total y mismos contadores en cualquier orden', () => {
      const ascendente = computar('aire_libre', ['M', '3', '5', '9', '10', 'X']);
      const descendente = computar('aire_libre', ['X', '10', '9', '5', '3', 'M']);
      expect(ascendente).toEqual(descendente);
    });
  });

  describe('errores', () => {
    it('rechaza menos flechas de las que pide el blanco', () => {
      const r = validateTargetScore('sala', 3, ['X', '9']);
      expect(r).toEqual({ ok: false, error: { code: 'ARROW_COUNT', expected: 3, got: 2 } });
    });

    it('rechaza más flechas de las que pide el blanco', () => {
      const r = validateTargetScore('3d', 2, ['11', '10', '8']);
      expect(r).toEqual({ ok: false, error: { code: 'ARROW_COUNT', expected: 2, got: 3 } });
    });

    it('rechaza un blanco sin flechas', () => {
      const r = validateTargetScore('sala', 3, []);
      expect(r).toEqual({ ok: false, error: { code: 'ARROW_COUNT', expected: 3, got: 0 } });
    });

    // El caso que importa: el token se valida contra la modalidad DEL BLANCO.
    it('rechaza un 11 en un blanco de sala, con índice y token', () => {
      const r = validateTargetScore('sala', 3, ['X', '11', '9']);
      expect(r).toEqual({ ok: false, error: { code: 'INVALID_TOKEN', index: 1, token: '11' } });
    });

    it('rechaza una X en un blanco 3D', () => {
      const r = validateTargetScore('3d', 2, ['X', '10']);
      expect(r).toEqual({ ok: false, error: { code: 'INVALID_TOKEN', index: 0, token: 'X' } });
    });

    it('rechaza un 7 en un blanco de campo', () => {
      const r = validateTargetScore('campo', 3, ['6', '7', '5']);
      expect(r).toEqual({ ok: false, error: { code: 'INVALID_TOKEN', index: 1, token: '7' } });
    });

    it('rechaza un 9 en un blanco 3D', () => {
      const r = validateTargetScore('3d', 2, ['11', '9']);
      expect(r).toEqual({ ok: false, error: { code: 'INVALID_TOKEN', index: 1, token: '9' } });
    });

    it('reporta el primer token inválido', () => {
      const r = validateTargetScore('sala', 3, ['X', '11', '99']);
      expect(r.ok).toBe(false);
      if (!r.ok && r.error.code === 'INVALID_TOKEN') {
        expect(r.error.index).toBe(1);
      }
    });

    it('la cantidad de flechas se valida antes que los tokens', () => {
      const r = validateTargetScore('sala', 3, ['11', '11']);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('ARROW_COUNT');
    });

    it('no se deja engañar por propiedades heredadas del prototipo', () => {
      const r = validateTargetScore('sala', 1, ['toString']);
      expect(r).toEqual({
        ok: false,
        error: { code: 'INVALID_TOKEN', index: 0, token: 'toString' },
      });
    });
  });
});

describe('sortArrowsDescending', () => {
  it('ordena de mayor a menor', () => {
    expect(sortArrowsDescending('sala', ['3', '9', 'M', '7'])).toEqual(['9', '7', '3', 'M']);
  });

  it('pone el token inner primero a igual valor', () => {
    expect(sortArrowsDescending('sala', ['10', 'X', '10'])).toEqual(['X', '10', '10']);
    expect(sortArrowsDescending('campo', ['6', 'X6'])).toEqual(['X6', '6']);
  });

  it('ordena un blanco 3D', () => {
    expect(sortArrowsDescending('3d', ['5', '11'])).toEqual(['11', '5']);
  });

  it('no muta el array original', () => {
    const original = ['3', '9', 'M'];
    sortArrowsDescending('sala', original);
    expect(original).toEqual(['3', '9', 'M']);
  });

  it('es estable ante un array ya ordenado', () => {
    const ordenado = ['X', '10', '9', 'M'];
    expect(sortArrowsDescending('sala', ordenado)).toEqual(ordenado);
  });

  it('deja los tokens desconocidos al final en vez de romper', () => {
    // Defensa: la UI nunca debería mandar esto, pero ordenar no es validar.
    expect(sortArrowsDescending('sala', ['9', 'basura', 'X'])).toEqual(['X', '9', 'basura']);
  });
});
