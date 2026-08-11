/**
 * `@bal/shared` — dominio de la Liga Bahiense de Arquería.
 *
 * Reglas puras, sin I/O y sin dependencias de Node ni del navegador.
 * Scoring, armado de patrullas, rankings y estadísticas viven acá, y las
 * consumen tanto el backend como los frontends. Es la única fuente de verdad
 * de las reglas del deporte y de la liga.
 *
 * Ver `docs/DOMAIN_WA.md`.
 */

export * from './constants.js';
export * from './domain.js';
export * from './patrolling.js';
export * from './scoring.js';

// Los módulos restantes se agregan a medida que se implementan:
//   SH-4  ranking
//   SH-5  league
//   SH-6  stats
//   SH-7  schemas
