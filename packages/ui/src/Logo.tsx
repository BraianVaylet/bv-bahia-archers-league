/**
 * Marca de la Liga Bahiense de Arquería.
 *
 * Un blanco de tres anillos sobre una placa oscura, con el arte de
 * `bv-easy-archery-battle` y **el verde de acento de esta app**.
 *
 * **Reemplaza al logo anterior, que usaba los tres colores de estaca** —roja,
 * azul, amarilla— como identidad. Aquella decisión (`REF-4`) tenía su lógica:
 * los colores salen del dominio. Pero era el único lugar de la interfaz donde
 * un color de estaca significaba otra cosa, y con `REF2-1` agregando once
 * colores nuevos, dejar esa excepción en la marca era pedir confusión. El logo
 * nuevo **saca** una excepción a la regla 8 en vez de agregarla.
 *
 * **Colores fijos en los dos temas.** Una marca que cambia de color no es una
 * marca. La placa oscura le da su propio fondo, así que no depende del que
 * tenga detrás — que es lo que hace que funcione igual en el header claro, en
 * el oscuro y en el ícono de la pantalla de inicio.
 *
 * Sin degradados ni filtros: tiene que verse a 24px en un header y a 200px en
 * una planilla impresa en blanco y negro.
 */

export interface LogoProps {
  readonly size?: number;
  readonly className?: string;
  /**
   * Por defecto es **decorativo**: el nombre de la liga está escrito al lado.
   * Un lector de pantalla que anuncie los dos dice dos veces lo mismo.
   */
  readonly titulo?: string;
}

export function Logo({ size = 32, className, titulo }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...(titulo ? { role: 'img', 'aria-label': titulo } : { 'aria-hidden': true })}
    >
      {titulo && <title>{titulo}</title>}
      <rect width="64" height="64" rx="14" fill="#16170f" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="#c6f000" strokeWidth="6" />
      <circle cx="32" cy="32" r="12.5" fill="none" stroke="#f4f3ec" strokeWidth="6" />
      <circle cx="32" cy="32" r="4.5" fill="#c6f000" />
    </svg>
  );
}
