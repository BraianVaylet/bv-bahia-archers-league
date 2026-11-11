/**
 * Revisar y publicar un torneo.
 *
 * **Publicar es lo que aplica los resultados a la liga.** Por eso la pantalla
 * muestra primero qué va a pasar —los podios— y recién después ofrece el
 * botón, con una confirmación aparte.
 *
 * Es sólo la composición (`REF6-11` / `C-1`): `Despublicar` y el podio de cada categoría viven en
 * `wafa/publicacion/`.
 *
 * Ver `docs/FUNCTIONAL.md` §6.7.
 */

import { useCarga } from '@bal/cliente';
import type { TournamentStatus } from '@bal/shared';
import { useTituloDePagina } from '@bal/ui';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, cn, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { ApiError, conSenal, cuerpo, rpc } from '../../lib/rpc.js';
import { Archivar } from '../publicacion/Archivar.js';
import { Despublicar } from '../publicacion/Despublicar.js';
import { PodioDeCategoria } from '../publicacion/PodioDeCategoria.js';
import {
  avisosDePublicacion,
  podios,
  type ResultadoParticipante,
  sePuedePublicar,
} from '../torneo.js';

interface Torneo {
  readonly id: string;
  readonly name: string;
  readonly status: TournamentStatus;
  /** Archivado (`BE-26`): sigue publicado, pero no suma ni se ve en la landing. */
  readonly archived?: boolean;
}

const SIN_PARTICIPANTES: ResultadoParticipante[] = [];

export function PublishPage({ onVolver }: { readonly onVolver: () => void }) {
  const { id = '' } = useParams();

  const carga = useCarga(
    async (signal): Promise<{ torneo: Torneo; participantes: ResultadoParticipante[] }> => {
      const param = { id };
      const [t, r] = await Promise.all([
        cuerpo(rpc.admin.tournaments[':id'].$get({ param }, conSenal(signal))),
        cuerpo(rpc.admin.tournaments[':id'].results.$get({ param }, conSenal(signal))),
      ]);
      return { torneo: t.tournament, participantes: r.participants };
    },
    [id],
    { mensajeDeError: 'No se pudieron cargar los resultados. Revisá la conexión.' },
  );
  const torneo = carga.datos?.torneo;
  const participantes = carga.datos?.participantes ?? SIN_PARTICIPANTES;

  const [confirmando, setConfirmando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [errorDePublicar, setErrorDePublicar] = useState<string>();
  const error = errorDePublicar ?? carga.error;

  const publicar = async () => {
    setPublicando(true);
    try {
      await rpc.admin.tournaments[':id'].publish.$post({ param: { id } });
      setConfirmando(false);
      setErrorDePublicar(undefined);
      await carga.recargar();
    } catch (err) {
      setErrorDePublicar(
        err instanceof ApiError ? err.message : 'No se pudo publicar. Revisá la conexión.',
      );
    } finally {
      setPublicando(false);
    }
  };

  const losPodios = podios(participantes);
  const avisos = torneo ? avisosDePublicacion(torneo.status, participantes) : [];
  const publicado = torneo?.status === 'publicado';
  const archivado = torneo?.archived === true;
  useTituloDePagina(publicado ? 'Resultados' : 'Publicar');

  return (
    <Pantalla>
      <Encabezado
        contexto="Administración"
        titulo={publicado ? 'Resultados' : 'Publicar'}
        onVolver={onVolver}
      />

      <Screen>
        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {torneo && (
          <div className="pt-2">
            <h1 className="font-display text-display font-bold">{torneo.name}</h1>
            {publicado && !archivado && (
              <p className="text-[var(--ok)]">
                Publicado. Los resultados ya están en la página pública y aplicados a la liga.
              </p>
            )}
            {/* `FE-35`. Con texto, no sólo un color: «Archivado» dice qué le pasa al torneo. */}
            {publicado && archivado && (
              <p className="text-[var(--ink-muted)]" role="status">
                Archivado. Sigue publicado, pero no suma al ranking ni se ve en la página pública.
              </p>
            )}
          </div>
        )}

        {avisos.map((a) => (
          <p
            key={a.mensaje}
            role={a.nivel === 'error' ? 'alert' : 'status'}
            className={cn(
              'text-sm rounded-[var(--radius-md)] border p-3',
              a.nivel === 'error' ? 'text-[var(--danger)]' : 'text-[var(--warn)]',
            )}
          >
            {a.mensaje}
          </p>
        ))}

        {/* Los podios primero: es lo que el admin tiene que revisar. */}
        {losPodios.map((p) => (
          <PodioDeCategoria key={p.category} p={p} />
        ))}

        {losPodios.length === 0 && !error && (
          <p className="text-[var(--ink-muted)]">Todavía no hay resultados para mostrar.</p>
        )}
      </Screen>

      <div className="shrink-0 px-4 py-4 bg-[var(--bg)] border-t flex flex-col gap-2">
        {publicado ? (
          <>
            <Archivar id={id} archivado={archivado} onHecho={() => void carga.recargar()} />
            <Despublicar id={id} onHecho={() => void carga.recargar()} />
          </>
        ) : confirmando ? (
          <>
            <p className="text-sm text-center">
              Se aplican los resultados a la liga y quedan visibles en la página pública. Se puede
              deshacer despublicando.
            </p>
            <div className="flex gap-2">
              <Button variante="secundario" onClick={() => setConfirmando(false)}>
                Cancelar
              </Button>
              <Button ancho disabled={publicando} onClick={() => void publicar()}>
                {publicando ? 'Publicando…' : 'Sí, publicar'}
              </Button>
            </div>
          </>
        ) : (
          <Button
            ancho
            disabled={!sePuedePublicar(avisos) || participantes.length === 0}
            onClick={() => setConfirmando(true)}
          >
            Publicar
          </Button>
        )}
      </div>
    </Pantalla>
  );
}
