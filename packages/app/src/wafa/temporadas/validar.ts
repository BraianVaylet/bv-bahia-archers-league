/** Motivo por el que la temporada no se puede guardar, o `undefined` si se puede. */
export function validarTemporada(nombre: string, desde: string, hasta: string): string | undefined {
  if (nombre.trim().length < 3) return 'El nombre necesita al menos 3 caracteres.';
  if (!desde || !hasta) return 'Faltan las fechas.';
  if (new Date(hasta) <= new Date(desde)) return 'La temporada no puede terminar antes de empezar.';
  return undefined;
}
