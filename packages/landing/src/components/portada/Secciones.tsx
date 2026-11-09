/**
 * Las secciones de la portada debajo del hero (`REF7-6`, `DISENO.md` §5.1-2 a §5.1-6).
 *
 * Cada una con sus propios estados de carga y error: si una falla, las demás se ven igual.
 */

import { type Modality, SCORING } from '@bal/shared';
import {
  botonClases,
  COLOR_DE_MODALIDAD,
  clasesDeTarjeta,
  cn,
  ICONO_DE_MODALIDAD,
  IconoFlecha,
  type ResumenDeTorneo,
  RotuloDeSeccion,
  TarjetaDeTorneo,
} from '@bal/ui';
import type { CSSProperties, ReactNode } from 'react';
import { fichasDelSet, torneosDeLaPortada } from '../../lib/portada.js';
import type { Recurso } from '../../lib/useRecurso.js';
import { Cargando, EnlaceInterno, Fallo } from '../ui.js';

/** Contenedor de cada sección: el ancho del encabezado y del pie. */
export const CONTENEDOR = 'mx-auto w-full max-w-[1200px] px-4';

/** El título grande de una sección de la portada: 32px, 26px en celular. */
export function TituloDeSeccion({
  id,
  children,
}: {
  readonly id: string;
  readonly children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="font-display mt-2 mb-6 text-[26px] leading-[1.1] font-bold min-[760px]:text-display"
    >
      {children}
    </h2>
  );
}

// ── Cómo se juega ────────────────────────────────────────────────────────────

const PASOS = [
  {
    n: '01',
    titulo: 'Un recorrido multitarget',
    texto: 'Cada fecha es una vuelta por el predio con blancos de sala, aire libre, campo y 3D.',
  },
  {
    n: '02',
    titulo: 'En patrullas',
    texto:
      'Grupos de 2 a 4 arqueros. El líder anota los puntajes desde el celular, con o sin señal.',
  },
  {
    n: '03',
    titulo: 'Ranking por categoría',
    texto:
      'Suman las mejores fechas de la temporada, normalizadas para comparar recorridos distintos.',
  },
] as const;

export function ComoSeJuega() {
  return (
    // `pt-`/`pb-` y no `py-`: el shorthand de padding pisaría el `px-4` del contenedor (pasó en la
    // referencia).
    <section aria-labelledby="como-se-juega" className={`${CONTENEDOR} pt-16 pb-12`}>
      <h2 id="como-se-juega" className="font-mono text-eyebrow uppercase text-[var(--ink-muted)]">
        Cómo se juega
      </h2>
      <ol className="mt-6 grid gap-6 min-[760px]:grid-cols-3">
        {PASOS.map((p) => (
          <li key={p.n} className="border-t-2 border-[var(--ink)] pt-4">
            <span className="font-mono text-xs text-[var(--ink-muted)]">{p.n}</span>
            <h3 className="mt-2 mb-1 text-h3">{p.titulo}</h3>
            <p className="text-[15px] text-[var(--ink-muted)]">{p.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Torneos ──────────────────────────────────────────────────────────────────

export function SeccionTorneos({
  torneos,
}: {
  readonly torneos: Recurso<{ tournaments: ResumenDeTorneo[] }>;
}) {
  const lista = torneos.estado === 'listo' ? torneos.datos.tournaments : [];

  return (
    <section
      data-testid="seccion-torneos"
      aria-labelledby="torneos"
      className={`${CONTENEDOR} pt-12 pb-12`}
    >
      <RotuloDeSeccion
        titulo="Fechas de la temporada"
        {...(torneos.estado === 'listo' ? { cantidad: lista.length } : {})}
        accion={{ texto: 'Ver todas', href: '/torneos' }}
        enlace={EnlaceInterno}
        nivel={false}
      />
      <TituloDeSeccion id="torneos">Torneos</TituloDeSeccion>

      {torneos.estado === 'cargando' ? <Cargando /> : null}
      {torneos.estado === 'error' ? <Fallo mensaje={torneos.mensaje} /> : null}

      {torneos.estado === 'listo' && lista.length === 0 ? (
        <p className="text-[var(--ink-muted)]">
          Todavía no hay fechas publicadas esta temporada.{' '}
          <EnlaceInterno
            href="/alta"
            className="inline-flex items-center gap-1 min-h-[44px] font-semibold text-[var(--nock-text)]"
          >
            Sumate al padrón
            <IconoFlecha size={16} />
          </EnlaceInterno>
        </p>
      ) : null}

      {lista.length > 0 ? (
        <ul className="grid gap-4 min-[760px]:grid-cols-3">
          {torneosDeLaPortada(lista).map((t) => (
            <li key={t.id} className="grid">
              <TarjetaDeTorneo
                torneo={t}
                href={`/torneos/${t.id}`}
                publico
                enlace={EnlaceInterno}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

// ── Modalidades ──────────────────────────────────────────────────────────────

const MODALIDADES: readonly { modality: Modality; nombre: string; texto: string }[] = [
  { modality: 'sala', nombre: 'Sala 18 m', texto: 'Bajo techo, cara de 10 zonas.' },
  { modality: 'aire_libre', nombre: 'Aire libre', texto: 'Distancia larga según la estaca.' },
  { modality: 'campo', nombre: 'Juego de campo', texto: 'Cara negra con centro amarillo.' },
  { modality: '3d', nombre: '3D', texto: 'Siluetas de animales en el monte.' },
];

export function Modalidades() {
  return (
    <section
      data-testid="seccion-modalidades"
      aria-labelledby="modalidades"
      className={`${CONTENEDOR} pt-12 pb-12`}
    >
      <RotuloDeSeccion titulo="Modalidades" nivel={false} />
      <TituloDeSeccion id="modalidades">Cuatro escenarios, un recorrido</TituloDeSeccion>

      <ul className="grid grid-cols-2 gap-4 min-[760px]:grid-cols-4">
        {MODALIDADES.map(({ modality, nombre, texto }) => {
          const Icono = ICONO_DE_MODALIDAD[modality];
          const color = COLOR_DE_MODALIDAD[modality];
          return (
            <li
              key={modality}
              data-testid={`modalidad-${modality}`}
              className={cn(clasesDeTarjeta({ densidad: 'ninguna' }), 'px-4 py-6')}
            >
              <span
                data-chip="modalidad"
                style={{ '--chip': color.claro, '--chip-oscuro': color.oscuro } as CSSProperties}
                className="size-12 grid place-items-center rounded-[var(--radius-md)] bg-[var(--surface-2)] text-[color:var(--chip-actual)]"
              >
                <Icono size={26} />
              </span>
              <h3 className="mt-4 mb-1 text-lg font-semibold">{nombre}</h3>
              <p className="text-sm text-[var(--ink-muted)]">{texto}</p>
              {/* Los valores salen del set de la modalidad, nunca escritos a mano. */}
              <ul
                aria-label={`Valores de flecha en ${nombre}`}
                className="mt-3 flex flex-wrap gap-1"
              >
                {fichasDelSet(SCORING[modality].scoringSet).map((ficha, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: el «…» puede repetirse con un valor; el orden es fijo.
                    key={`${ficha}-${i}`}
                    data-ficha
                    className="h-6 min-w-7 px-1.5 inline-flex items-center justify-center rounded-[var(--radius-sm)] border font-mono text-xs font-semibold"
                  >
                    {ficha}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Sumate al padrón ─────────────────────────────────────────────────────────

export function Sumate() {
  return (
    <section aria-labelledby="sumate" className={CONTENEDOR}>
      <div className="mt-12 mb-16 rounded-[var(--radius-lg)] bg-[var(--nock-soft)] px-6 py-8 flex flex-col items-start gap-6 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between min-[760px]:px-8 min-[760px]:py-12">
        <div>
          <h2
            id="sumate"
            className="font-display mb-2 text-[26px] leading-[1.1] font-bold min-[760px]:text-display"
          >
            Sumate al padrón
          </h2>
          <p className="max-w-[520px] text-[var(--ink)]">
            Dejá tus datos y el club revisa tu alta antes de habilitarla. Después ya podés competir
            en la próxima fecha.
          </p>
        </div>
        <EnlaceInterno
          href="/alta"
          className={botonClases({ tamaño: 'lg', className: 'w-full min-[760px]:w-auto shrink-0' })}
        >
          Sumarme al padrón
          <IconoFlecha />
        </EnlaceInterno>
      </div>
    </section>
  );
}
