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
export * from './fechas.js';
export * from './league.js';
export * from './numeros.js';
export * from './patrolling.js';
export * from './podio.js';
export * from './ranking.js';
export * from './schemas.js';
export * from './scoring.js';
export * from './stats.js';
export * from './tema.js';
export * from './text.js';
