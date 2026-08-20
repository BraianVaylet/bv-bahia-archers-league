/**
 * Tipos de los módulos que genera Vite y que no existen como archivo.
 *
 * `virtual:pwa-register/react` lo produce `vite-plugin-pwa` al construir. Sin
 * esta referencia, `tsc` no lo encuentra y falla el typecheck aunque el build
 * y los tests pasen — que es exactamente lo que ocurrió al escribir `REF4-3`.
 */

/// <reference types="vite-plugin-pwa/react" />
