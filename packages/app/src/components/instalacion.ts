/**
 * Qué ofrecerle al usuario respecto de instalar la app.
 *
 * **No todos los navegadores dejan instalar igual, y uno directamente no
 * avisa.** Chrome y los basados en Chromium disparan `beforeinstallprompt` y
 * dan un diálogo nativo. **iOS no existe ese evento**: instalar es «Compartir →
 * Agregar a inicio», a mano, y no hay API que lo haga.
 *
 * Ofrecer un botón donde no hay prompt es peor que no ofrecer nada: el usuario
 * lo toca, no pasa nada, y concluye que la app está rota. Por eso la decisión
 * es explícita y pura.
 */

export type EstadoDeInstalacion =
  /** Ya está instalada: no hay nada que ofrecer. */
  | 'instalada'
  /** Hay prompt nativo: un botón que lo dispara. */
  | 'puede-instalar'
  /** iOS: no hay API, se explican los pasos. */
  | 'instrucciones'
  /** Ni prompt ni pasos conocidos —Firefox de escritorio, por ejemplo—. */
  | 'nada';

export interface SenalesDeInstalacion {
  /** Corriendo como app instalada, no en una pestaña. */
  readonly instalada: boolean;
  /** Se capturó `beforeinstallprompt`. */
  readonly tieneEvento: boolean;
  readonly esIOS: boolean;
}

/**
 * **`instalada` gana sobre todo lo demás.** Recomendarle instalar a alguien que
 * ya la tiene instalada es la clase de detalle que hace desconfiar del resto.
 */
export function estadoDeInstalacion({
  instalada,
  tieneEvento,
  esIOS,
}: SenalesDeInstalacion): EstadoDeInstalacion {
  if (instalada) return 'instalada';
  if (tieneEvento) return 'puede-instalar';
  if (esIOS) return 'instrucciones';
  return 'nada';
}

/**
 * Si la app está corriendo instalada.
 *
 * Dos señales porque los dos mundos la reportan distinto: `display-mode` es el
 * estándar, y `navigator.standalone` es lo único que tiene iOS.
 *
 * **`matchMedia` puede no existir.** Es la lección de `REF-4`, donde una API
 * ausente dejó una pantalla entera en blanco: acá lo peor que puede pasar es
 * ofrecer instalar algo ya instalado, no romper la puerta de entrada.
 */
export function pareceInstalada(ventana: Window = window): boolean {
  const comoApp = ventana.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const enIOS = (ventana.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return comoApp || enIOS;
}

/**
 * Si el navegador es de iOS.
 *
 * Se mira el user agent porque no hay nada mejor: **la ausencia de
 * `beforeinstallprompt` no distingue** un iPhone —donde instalar se puede, a
 * mano— de un Firefox de escritorio, donde no hay nada que ofrecer.
 *
 * El iPad moderno se declara «Macintosh», así que se lo separa por tener
 * pantalla táctil; un Mac de escritorio no tiene `maxTouchPoints`.
 */
export function pareceIOS(navegador: Navigator = navigator): boolean {
  const ua = navegador.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && navegador.maxTouchPoints > 1;
}
