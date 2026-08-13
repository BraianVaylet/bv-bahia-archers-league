/**
 * Concatena clases, salteando las falsas.
 *
 * Estaba escrita dos veces, idéntica, en `app` y en `landing`.
 */
export function cn(...clases: (string | false | undefined | null)[]): string {
  return clases.filter(Boolean).join(' ');
}
