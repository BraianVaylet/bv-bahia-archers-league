import { describe, expect, it } from 'vitest';
import {
  CAMPOS_DE_TORNEO,
  type CampoDeTorneo,
  CampoNoEditableError,
  camposEditables,
  DomainError,
  exigirEditables,
  puedeArchivar,
  puedeDesarchivar,
  puedeEliminar,
} from '../src/index';

/**
 * Qué se puede editar de un torneo en cada estado (`SH-11`).
 *
 * Una sola tabla, que leen el servicio que guarda y la pantalla que dibuja el formulario. Antes
 * estaba repartida: el servicio decidía por su cuenta y tres componentes de WAFA preguntaban
 * `status === 'sin_iniciar'` cada uno a su manera.
 *
 * Referencia: docs/FUNCTIONAL.md §6.7 y §8 · decisiones 1, 2 y 6 de la Fase 9 en ACTION_PLAN.md.
 */

const editables = (status: Parameters<typeof camposEditables>[0]) =>
  [...camposEditables(status)].sort();

const salvo = (...afuera: CampoDeTorneo[]) =>
  CAMPOS_DE_TORNEO.filter((c) => !afuera.includes(c)).sort();

describe('camposEditables', () => {
  it('sin iniciar se edita todo, menos los puntajes: todavía no hay ninguno', () => {
    expect(editables('sin_iniciar')).toEqual(salvo('scores'));
  });

  /**
   * Decisión 1: el pedido marcaba nombre y fecha como mínimo, y se conserva lo que el backend ya
   * aceptaba. Lo que no: quiénes participan, las estacas y las distancias, porque rearman patrullas
   * que ya están en el predio con su PIN.
   */
  it('en proceso: los datos del torneo y los blancos, nunca los participantes ni las estacas', () => {
    expect(editables('en_proceso')).toEqual(
      ['date', 'description', 'name', 'payment', 'registrationUrl', 'targets'].sort(),
    );
  });

  /**
   * `targets` se permite **como campo**. Que un blanco con puntajes no se pueda tocar lo decide el
   * servicio, que puede mirar la base; esta tabla no sabe qué blancos ya se tiraron.
   */
  it('en proceso, los blancos se ofrecen: cuáles están bloqueados lo dice el servicio', () => {
    expect(camposEditables('en_proceso').has('targets')).toBe(true);
  });

  /**
   * Decisiones 2 y 3: esperando publicación se corrige contra la planilla de papel, que es la
   * fuente de verdad. Además del nombre y la fecha, nada más: el recorrido ya se tiró entero.
   */
  it('esperando publicación: nombre, fecha y la corrección de puntajes', () => {
    expect(editables('completado')).toEqual(['date', 'name', 'scores']);
  });

  /** Para corregir un publicado se despublica primero: el ranking se recalcula entero al volver. */
  it('publicado no se edita', () => {
    expect(editables('publicado')).toEqual([]);
  });

  /**
   * Los puntajes los escribe el líder mientras el torneo está en proceso; el admin sólo los
   * corrige cuando ya nadie anota, para no competir con el outbox de WAFL (decisión 2).
   */
  it.each([
    ['sin_iniciar', false],
    ['en_proceso', false],
    ['completado', true],
    ['publicado', false],
  ] as const)('los puntajes del admin, en %s: %s', (status, permitido) => {
    expect(camposEditables(status).has('scores')).toBe(permitido);
  });

  /** La tabla es de todos: quien recibe el set no puede cambiarle la regla al siguiente. */
  it('modificar el set devuelto no cambia la tabla', () => {
    const recibido = camposEditables('publicado') as Set<CampoDeTorneo>;
    recibido.add('name');
    expect(camposEditables('publicado').has('name')).toBe(false);
  });
});

describe('exigirEditables', () => {
  it('no dice nada si todos los campos se pueden editar', () => {
    expect(() => exigirEditables('completado', ['name', 'date'])).not.toThrow();
  });

  /**
   * Se rechaza el pedido entero, **nombrando todos** los campos que sobran: aplicar los permitidos
   * y descartar el resto en silencio dejaría al admin creyendo que guardó algo que no guardó.
   */
  it('rechaza con FIELD_NOT_EDITABLE y dice qué campos no se pueden tocar', () => {
    const error = capturar(() => exigirEditables('completado', ['name', 'targets', 'archerIds']));

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(CampoNoEditableError);
    expect((error as CampoNoEditableError).code).toBe('FIELD_NOT_EDITABLE');
    expect((error as CampoNoEditableError).campos).toEqual(['targets', 'archerIds']);
  });

  it('un torneo publicado rechaza hasta el nombre', () => {
    const error = capturar(() => exigirEditables('publicado', ['name']));
    expect((error as CampoNoEditableError).campos).toEqual(['name']);
  });
});

/** Un torneo que arrancó ya tiene patrullas en el predio, y uno cerrado tiene resultados. */
describe('puedeEliminar', () => {
  it.each([
    ['sin_iniciar', true],
    ['en_proceso', false],
    ['completado', false],
    ['publicado', false],
  ] as const)('%s: %s', (status, permitido) => {
    expect(puedeEliminar(status)).toBe(permitido);
  });
});

/**
 * Archivar saca un torneo del ranking de la temporada y de la landing sin despublicarlo, y se
 * puede revertir (decisiones 4, 5 y 6). Sólo tiene sentido con un publicado: los demás todavía no
 * suman al ranking.
 */
describe('archivar y desarchivar', () => {
  it.each([
    ['sin_iniciar', false],
    ['en_proceso', false],
    ['completado', false],
    ['publicado', true],
  ] as const)('se archiva un torneo %s: %s', (status, permitido) => {
    expect(puedeArchivar(status, false)).toBe(permitido);
  });

  it('no se archiva dos veces', () => {
    expect(puedeArchivar('publicado', true)).toBe(false);
  });

  it('se desarchiva sólo lo que está archivado', () => {
    expect(puedeDesarchivar('publicado', true)).toBe(true);
    expect(puedeDesarchivar('publicado', false)).toBe(false);
  });

  /** Despublicar un archivado lo desarchiva en la misma operación (`BE-26`): no queda uno así. */
  it('un archivado que no está publicado no se desarchiva por esta vía', () => {
    expect(puedeDesarchivar('completado', true)).toBe(false);
  });
});

function capturar(fn: () => void): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('se esperaba un error');
}
