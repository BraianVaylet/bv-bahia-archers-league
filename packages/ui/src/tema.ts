/**
 * Decisión del tema claro/oscuro.
 *
 * Puro y sin DOM: acá se decide **cuál** es el tema, no se aplica. Aplicarlo es
 * de cada app, que tiene su propio `document`.
 *
 * Vive en `@bal/shared` porque hay tres lugares que tienen que coincidir: el
 * script anti-FOUC de los dos `index.html` y el control que lo conmuta. Los
 * scripts no pueden importar —corren antes de cualquier bundle— así que
 * repiten la lógica a mano; tenerla escrita y probada acá es lo que permite
 * verificar que digan lo mismo.
 *
 * Ver `docs/DESIGN_SYSTEM.md` §9.
 */

export type Tema = 'light' | 'dark';

/** Clave de `localStorage`. La misma que leen los scripts anti-FOUC. */
export const TEMA_KEY = 'bal_tema';

/**
 * Qué tema corresponde, dados lo guardado y la preferencia del sistema.
 *
 * Un valor guardado que no se reconoce **no cuenta como elección**: se sigue la
 * preferencia del sistema. Forzar claro ignoraría a alguien que tiene el
 * sistema en oscuro por una entrada corrupta que nunca eligió.
 */
export function resolverTema(guardado: string | null, prefiereOscuro: boolean): Tema {
  if (guardado === 'dark' || guardado === 'light') return guardado;
  return prefiereOscuro ? 'dark' : 'light';
}

export function alternarTema(actual: Tema): Tema {
  return actual === 'dark' ? 'light' : 'dark';
}

/**
 * Color de la barra del navegador, por tema.
 *
 * Es `--bg` de `tokens.css`. Están repetidos como literales en los dos
 * `index.html`, que corren antes de cualquier import: hay un test que compara
 * los cuatro lugares para que no se separen.
 */
export const COLOR_DE_BARRA: Record<Tema, string> = {
  light: '#fbfaf5',
  dark: '#16170f',
};
