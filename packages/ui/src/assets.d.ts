/**
 * Importar una imagen devuelve su URL.
 *
 * Las aplicaciones tienen esto de `vite/client`; este paquete compila con
 * `tsc` a secas y necesita decirlo por su cuenta. El bundler de quien lo
 * consume es el que resuelve la ruta final con su hash.
 */
declare module '*.webp' {
  const url: string;
  export default url;
}

declare module '*.svg' {
  const url: string;
  export default url;
}

declare module '*.png' {
  const url: string;
  export default url;
}
