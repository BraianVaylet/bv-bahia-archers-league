/**
 * El enganche entre el service worker y el aviso de versión.
 *
 * Vive separado de `AvisoDeVersion` porque importa `virtual:pwa-register/react`,
 * un módulo que **sólo existe dentro de Vite**: lo genera `vite-plugin-pwa` al
 * construir. En los tests se resuelve contra un doble, declarado en
 * `vitest.config.ts`.
 *
 * Ese alias no es una comodidad: es lo que permite probar que el cableado
 * **existe**. Un aviso perfecto que nadie conecta al service worker es
 * exactamente el defecto que esta tanda vino a corregir.
 */

import { useRegisterSW } from 'virtual:pwa-register/react';
import { useState } from 'react';
import { AvisoDeVersion } from './AvisoDeVersion.js';

export function RegistroDeVersion() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW();

  /**
   * «Ahora no» no vuelve a preguntar mientras la app siga abierta.
   *
   * `needRefresh` se mantiene en `true` mientras el service worker siga
   * esperando, así que sin esto la barra reaparecería en cada re-render y
   * volvería a tapar la acción de abajo. Preguntar una vez es informar;
   * preguntar cada vez es insistir.
   */
  const [pospuesto, setPospuesto] = useState(false);

  return (
    <AvisoDeVersion
      visible={hayVersionNueva && !pospuesto}
      onActualizar={() => {
        // `true` recarga la página en cuanto el service worker nuevo toma el
        // control. Es lo que el usuario acaba de pedir explícitamente.
        void updateServiceWorker(true);
      }}
      onDespues={() => {
        setPospuesto(true);
        setHayVersionNueva(false);
      }}
    />
  );
}
