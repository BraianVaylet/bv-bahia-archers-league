/**
 * El pie del sitio público (`REF7-4`, `docs/post/ref-7/DISENO.md` §4.17).
 *
 * **Es estático y va al final del documento.** Hasta `REF7-4` quedaba fijo abajo de la pantalla
 * y se comía ~80px de alto útil (`L-2`). Una landing es un documento: el pie se ve al terminar de
 * leer. Y **es sólo de la landing**: la PWA no tiene pie (decisión 5 de `INFORME.md`), así que la
 * variante compacta desapareció.
 *
 * Tres columnas: quién es la liga, sus páginas, y el acceso a la PWA. Debajo, la línea legal.
 *
 * **El acceso es uno solo, «Ingresar a la app», y no uno por rol** (`FUNCTIONAL.md` §5.1: una
 * sola puerta). La referencia de `DISENO.md` traía «Líderes de patrulla · Administración»; el
 * autor eligió mantener la puerta única (2026-11-09): quién sos lo pregunta la app, y nombrar
 * los roles acá era tener dos lugares donde mantenerlos. `e2e/ingreso.spec.ts` lo cuida.
 *
 * **Los dos logos llevan su nombre.** Un logo es una imagen: si la red no lo trajo o si se lee con
 * un lector de pantalla, lo único que queda es el texto.
 *
 * **No se imprime.** El pie es navegación y crédito; una planilla de puntajes no lo necesita.
 *
 * **No trae margen propio.** Tenía `mt-8` y los consumidores lo cancelaban con `mt-0`: un valor que
 * todo el mundo anula no es un default, es una trampa. El espacio, si hace falta, lo pone quien lo
 * usa.
 */

import cba from '../assets/cba.webp';
import { cn } from './cn.js';
import { type ComponenteDeEnlace, EnlaceNativo } from './enlace.js';
import { Logo } from './Logo.js';

export interface FooterProps {
  readonly className?: string;
  /** Con qué se dibujan los enlaces a las páginas de la landing. Ver `enlace.tsx`. */
  readonly enlace?: ComponenteDeEnlace;
  /**
   * A dónde va «Acceso». La PWA es otro build: se entra con un `<a>` común, que recarga. Quien lo
   * monta lo calcula con `enlaceEntreApps`, porque en desarrollo vive en otro puerto.
   */
  readonly hrefApp?: string;
  /** El nombre de la temporada activa. Si no se sabe, la línea legal no lo inventa. */
  readonly temporada?: string | null;
}

const PAGINAS = [
  { texto: 'Ranking', href: '/ranking' },
  { texto: 'Torneos', href: '/torneos' },
  { texto: 'Sumate al padrón', href: '/alta' },
] as const;

const ENLACE =
  'inline-flex items-center min-h-[44px] text-[var(--ink)] hover:text-[var(--nock-text)]';
const ROTULO = 'mb-2 font-mono text-eyebrow uppercase text-[var(--ink-muted)]';

export function Footer({
  className,
  enlace: Enlace = EnlaceNativo,
  hrefApp = '/app/',
  temporada,
}: FooterProps) {
  return (
    <footer className={cn('border-t bg-[var(--surface)] print:hidden', className)}>
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-12 pb-8 grid grid-cols-2 gap-8 min-[720px]:grid-cols-[2fr_1fr_1fr]">
        <div className="col-span-2 min-[720px]:col-span-1 flex flex-col gap-3">
          <span data-escudos className="flex items-center gap-3">
            {/*
              **El del CBA sobre una placa blanca, fija en los dos temas.**

              Es un PNG con fondo transparente y tinta oscura: sobre el fondo claro se ve, sobre el
              oscuro desaparece. Es el único asset del proyecto que depende del fondo y no se puede
              recolorear sin reinterpretar un logo que es de un club, no del proyecto.

              La placa es blanca literal, no un token: si siguiera al tema volvería a desaparecer.
            */}
            <span className="shrink-0 rounded-[var(--radius-sm)] bg-white p-1 flex items-center">
              {/* El `alt` no es decorativo: el nombre del club no está escrito al lado. */}
              <img src={cba} alt="Círculo Bahiense de Arquería" width={36} height={36} />
            </span>
            <Logo size={44} className="shrink-0" />
          </span>

          <p className="max-w-[44ch] text-sm text-[var(--ink-muted)]">
            La Liga Bahiense de Arquería es organizada por el CBA (Circulo Bahiense de Arqueria de Bahia Blanca). Torneos multitarger en nuestro predio.  
          </p>
        </div>

        <nav aria-label="La liga">
          <h2 className={ROTULO}>La liga</h2>
          <ul>
            {PAGINAS.map((p) => (
              <li key={p.href}>
                <Enlace href={p.href} className={ENLACE}>
                  {p.texto}
                </Enlace>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Acceso">
          <h2 className={ROTULO}>Acceso</h2>
          <ul>
            <li>
              <a href={hrefApp} className={ENLACE}>
                Ingresar a la app
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mx-auto w-full max-w-[1200px] px-4 py-4 border-t flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] text-[var(--ink-muted)]">
        <span>Círculo Bahiense de Arquería · Bahía Blanca -- La Liga se reserva el derecho de admisión.</span>
        {temporada ? <span className="font-mono">{temporada}</span> : null}
      </div>
    </footer>
  );
}
