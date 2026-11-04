/**
 * Los contratos de la API que ve la PWA (`REF6-11` / `C-3`), comprobados **en tiempo de compilación**.
 *
 * No se ejecuta: lo corre `tsc` (`pnpm typecheck`, y el `build` de la app). Cada `@ts-expect-error`
 * es una promesa de que algo **no compila**, y TypeScript falla si deja de ser cierta (TS2578). Eso
 * es lo que cuida acá: que el tipo no degenere en `any` sin que nadie lo note. Si `rpc` perdiera su
 * tipado, todas estas líneas «dejarían de fallar» y el typecheck se pondría rojo.
 *
 * Qué prueba que el contrato esté vivo: renombrar un campo en una ruta del backend rompe la
 * pantalla que lo lee. La prueba real de eso es una mutación (ver `docs/BITACORA.md`), porque es
 * cruzar paquetes; esto es lo que impide que el cruce se afloje.
 */

import type { InferRequestType, InferResponseType } from 'hono/client';
import type { rpc } from './rpc.js';

/** Igualdad exacta de tipos: `any` no es igual a nada que no sea `any`. */
type Igual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Afirmar<T extends true> = T;

type DetalleDeTorneo = InferResponseType<(typeof rpc.admin.tournaments)[':id']['$get']>;
type ListadoDeArqueros = InferResponseType<typeof rpc.admin.archers.$get>;
type Pagos = InferResponseType<(typeof rpc.admin.tournaments)[':id']['payments']['$get']>;
type Ranking = InferResponseType<typeof rpc.publico.rankings.$get>;
type LoginDeAdmin = InferResponseType<(typeof rpc.auth.admin.login)['$post']>;

// ── Las respuestas tienen forma, no `any` ────────────────────────────────────

type _DetalleTieneNombre = Afirmar<Igual<DetalleDeTorneo['tournament']['name'], string>>;
type _EstadoEsUnaUnion = Afirmar<
  Igual<
    DetalleDeTorneo['tournament']['status'],
    'sin_iniciar' | 'en_proceso' | 'completado' | 'publicado'
  >
>;
type _ArquerosEsUnaLista = Afirmar<Igual<ListadoDeArqueros['archers'][number]['id'], string>>;
type _PagosTieneRecaudacion = Afirmar<Igual<Pagos['collected'], number>>;
type _RankingTieneCategorias = Afirmar<Igual<Ranking['bestN'], number>>;
type _LoginDevuelveElAdmin = Afirmar<Igual<LoginDeAdmin['admin']['username'], string>>;

declare const detalle: DetalleDeTorneo;
declare const arqueros: ListadoDeArqueros;

// Un campo que el servidor no devuelve no se puede leer.
// @ts-expect-error — `titulo` no existe: el campo es `name`
export const _titulo: string = detalle.tournament.titulo;
// @ts-expect-error — la respuesta es `{ tournament }`, no `{ torneo }`
export const _torneo = detalle.torneo;
// @ts-expect-error — `fullName` no existe: son `firstName` y `lastName`
export const _nombre: string = arqueros.archers[0]?.fullName;

// Y el tipo de lo que sí existe es el real.
// @ts-expect-error — `name` es un string, no un número
export const _nombreNumerico: number = detalle.tournament.name;

// ── Lo que se manda también está tipado ──────────────────────────────────────

type CuerpoDeTemporada = InferRequestType<typeof rpc.admin.seasons.$post>['json'];
type _TemporadaTieneFechas = Afirmar<Igual<CuerpoDeTemporada['name'], string>>;

// @ts-expect-error — falta `startsAt` y `endsAt`
export const _temporadaIncompleta: CuerpoDeTemporada = { name: 'Temporada 2027' };

type ConsultaDePadron = InferRequestType<typeof rpc.admin.archers.$get>['query'];
// @ts-expect-error — `archived` es 'true' | 'false', no un booleano
export const _archivadosBooleano: ConsultaDePadron = { archived: true };
// @ts-expect-error — `texto` no es un parámetro de la ruta: es `q`
export const _consultaDesconocida: ConsultaDePadron = { texto: 'ana' };

// ── Las rutas existen ────────────────────────────────────────────────────────

// @ts-expect-error — no hay una ruta `/admin/torneos`
export const _rutaInexistente = rpc.admin.torneos;
// @ts-expect-error — `/admin/seasons` no tiene `$put`
export const _metodoInexistente = rpc.admin.seasons.$put;

export type {
  _ArquerosEsUnaLista,
  _DetalleTieneNombre,
  _EstadoEsUnaUnion,
  _LoginDevuelveElAdmin,
  _PagosTieneRecaudacion,
  _RankingTieneCategorias,
  _TemporadaTieneFechas,
};
