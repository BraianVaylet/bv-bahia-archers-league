import type { Context } from 'hono';
import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { AppError } from '../src/lib/errors.js';
import { currentAdminId, currentSubject } from '../src/middleware/auth.js';

/**
 * Las dos guardas de `middleware/auth.ts` que ningún camino normal recorre
 * (`REF6-9` / `T-1`).
 *
 * `TESTING.md` §8 pide 100 % de líneas y de ramas en este archivo: es la capa que
 * decide quién es cada request. Estaba en 88 % de ramas, y las dos que faltaban eran
 * justamente las defensivas —las que se escriben para el día en que alguien monte una
 * ruta sin `requireAdmin()` o llame a un getter de admin desde una de patrulla—. Que
 * ningún request legítimo las recorra es lo que hace falta probar a mano.
 */

/** Un contexto de Hono con lo mínimo para estos getters: el sujeto que se le puso. */
const contextoCon = (subject: unknown): Context =>
  ({ get: (clave: string) => (clave === 'subject' ? subject : undefined) }) as unknown as Context;

const codigoDelError = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (error) {
    return error instanceof AppError ? error.code : `no es AppError: ${String(error)}`;
  }
  return undefined;
};

describe('currentSubject', () => {
  it('devuelve el sujeto que dejó el middleware', () => {
    const subject = { type: 'admin', id: new ObjectId() };

    expect(currentSubject(contextoCon(subject))).toBe(subject);
  });

  // Una ruta montada sin `requireAdmin()` ni `requirePatrol()` no tiene sujeto. Que
  // falle como «no autenticado» y no con un `undefined` más adelante.
  it('sin sujeto en el contexto es UNAUTHORIZED, no un undefined más adelante', () => {
    expect(codigoDelError(() => currentSubject(contextoCon(undefined)))).toBe('UNAUTHORIZED');
  });
});

describe('currentAdminId', () => {
  it('devuelve el id de la sesión de administrador', () => {
    const id = new ObjectId();

    expect(currentAdminId(contextoCon({ type: 'admin', id }))).toBe(id);
  });

  // Defensa en profundidad: aunque una ruta de admin quedara abierta a una sesión de
  // patrulla, nada que pida el id del admin —auditar, firmar, regenerar un PIN— puede
  // atribuirle la acción a una patrulla.
  it('una sesión de patrulla pidiendo el id de admin es FORBIDDEN', () => {
    const subject = { type: 'patrol', id: new ObjectId(), tournamentId: new ObjectId() };

    expect(codigoDelError(() => currentAdminId(contextoCon(subject)))).toBe('FORBIDDEN');
  });

  it('sin sesión es UNAUTHORIZED, no FORBIDDEN', () => {
    expect(codigoDelError(() => currentAdminId(contextoCon(undefined)))).toBe('UNAUTHORIZED');
  });
});
