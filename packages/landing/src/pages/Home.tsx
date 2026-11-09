/**
 * La portada del sitio público (`REF7-6`, `docs/post/ref-7/DISENO.md` §5.1).
 *
 * Hasta `REF7-6` era una foto, un título de 16px, un botón verde gigante y tres tarjetas que sólo
 * enlazaban (`L-1`): lo que el público viene a ver —el torneo en curso, los resultados, quién va
 * primero— quedaba a dos toques. Ahora está en la portada: el hero con el torneo que importa ahora,
 * cómo se juega, las últimas fechas, el ranking, las modalidades y el alta al padrón.
 *
 * **El acceso a la PWA no está acá** (`REF7-5` / `L-4`): vive en el encabezado. Sigue siendo una
 * sola puerta —quién sos lo pregunta la app, `FUNCTIONAL.md` §5.1—.
 *
 * **Hasta cuatro pedidos, en dos tandas y ninguno bloquea nada.** Torneos y temporadas salen
 * juntos; el detalle del torneo en curso y el ranking esperan sólo al pedido que los necesita, y
 * salen en paralelo entre sí. El hero se dibuja de entrada, y cada sección tiene su carga y su
 * error: si el ranking falla, el resto se ve igual.
 */

import { type ResumenDeTorneo, useTituloDePagina } from '@bal/ui';
import portada from '@bal/ui/assets/portada.webp';
import { type DetalleEnCurso, Hero } from '../components/portada/Hero.js';
import {
  RankingDeLaPortada,
  type RankingDeTemporada,
} from '../components/portada/RankingDeLaPortada.js';
import {
  ComoSeJuega,
  Modalidades,
  SeccionTorneos,
  Sumate,
} from '../components/portada/Secciones.js';
import { torneoDestacado } from '../lib/portada.js';
import { temporadaActiva, useTemporadas } from '../lib/temporada.js';
import { type Recurso, useRecurso } from '../lib/useRecurso.js';

export function HomePage({
  foto = portada,
}: {
  /**
   * La foto del hero. `portada.webp` no es el predio del CBA (decisión 1 de `INFORME.md`): se
   * mantiene hasta que haya una real, y con `null` el hero queda en una columna.
   */
  readonly foto?: string | null;
}) {
  useTituloDePagina('Resultados y ranking');

  const torneos = useRecurso<{ tournaments: ResumenDeTorneo[] }>('/tournaments');
  const temporadas = useTemporadas();

  const destacado = torneos.estado === 'listo' ? torneoDestacado(torneos.datos.tournaments) : null;
  const activa = temporadas.estado === 'listo' ? temporadaActiva(temporadas.datos.seasons) : null;

  // El detalle público viene envuelto en `tournament`, como lo lee la página del torneo.
  const detalleCrudo = useRecurso<{ tournament: DetalleEnCurso }>(
    destacado?.status === 'en_proceso' ? `/tournaments/${destacado.id}` : null,
  );
  const detalle: Recurso<DetalleEnCurso> =
    detalleCrudo.estado === 'listo'
      ? { estado: 'listo', datos: detalleCrudo.datos.tournament }
      : detalleCrudo;
  const ranking = useRecurso<RankingDeTemporada>(activa ? `/rankings?seasonId=${activa.id}` : null);

  return (
    <>
      <Hero foto={foto} temporada={activa} destacado={destacado} detalle={detalle} />
      <ComoSeJuega />
      <SeccionTorneos torneos={torneos} />
      <RankingDeLaPortada
        ranking={
          temporadas.estado === 'error' ? { estado: 'error', mensaje: temporadas.mensaje } : ranking
        }
        sinTemporada={temporadas.estado === 'listo' && activa === null}
      />
      <Modalidades />
      <Sumate />
    </>
  );
}
