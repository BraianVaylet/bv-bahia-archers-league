/**
 * Al cambiar de pantalla: el scroll vuelve arriba y el foco va al título (`REF6-12` / `U-5`).
 *
 * Va **dentro del router** y no renderiza nada. Ver `useAlCambiarDeRuta` en `@bal/ui` para el detalle y sus límites.
 */

import { useAlCambiarDeRuta } from '@bal/ui';
import { useLocation } from 'react-router-dom';

export function NavegacionAccesible() {
  useAlCambiarDeRuta(useLocation().pathname);
  return null;
}
