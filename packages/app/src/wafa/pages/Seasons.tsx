/**
 * Temporadas de la liga.
 *
 * Una temporada agrupa torneos para el ranking. Puede haber varias en paralelo y pueden cruzar
 * años. Ver `docs/FUNCTIONAL.md` §6.5.
 *
 * Es sólo la composición (`REF6-11` / `C-1`): el formulario y la recaudación viven en
 * `wafa/temporadas/`.
 */

import { useCarga } from '@bal/cliente';
import { formatearRango } from '@bal/shared';
import { useState } from 'react';
import { Button, clasesDeTarjeta, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { ApiError, conSenal, cuerpo, rpc } from '../../lib/rpc.js';
import { FormularioDeTemporada } from '../temporadas/FormularioDeTemporada.js';
import { Recaudacion } from '../temporadas/Recaudacion.js';
import type { SeasonRow } from '../temporadas/tipos.js';

// La pantalla es donde vivían; otros módulos los importan de acá.
export type { SeasonRow } from '../temporadas/tipos.js';
export { validarTemporada } from '../temporadas/validar.js';

export function SeasonsPage({ onVolver }: { readonly onVolver: () => void }) {
  const carga = useCarga(
    async (signal): Promise<SeasonRow[]> =>
      (await cuerpo(rpc.admin.seasons.$get(undefined, conSenal(signal)))).seasons,
    [],
    { mensajeDeError: 'No se pudieron cargar las temporadas. Revisá la conexión.' },
  );
  const temporadas = carga.datos;

  const [errorDeAccion, setErrorDeAccion] = useState<string>();
  const error = errorDeAccion ?? carga.error;

  const cambiarEstado = async (t: SeasonRow, reabrir: boolean) => {
    try {
      const ruta = rpc.admin.seasons[':id'];
      await (reabrir ? ruta.restore : ruta.archive).$post({ param: { id: t.id } });
      setErrorDeAccion(undefined);
      await carga.recargar();
    } catch (err) {
      setErrorDeAccion(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.');
    }
  };

  return (
    <Pantalla>
      <Encabezado titulo="Temporadas" onVolver={onVolver} />

      <Screen>
        <FormularioDeTemporada
          onCreada={() => {
            setErrorDeAccion(undefined);
            return carga.recargar();
          }}
          onError={setErrorDeAccion}
        />

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {temporadas?.length === 0 && (
          <p className="text-[var(--ink-muted)]">Todavía no hay temporadas.</p>
        )}

        <ul className="flex flex-col gap-2">
          {temporadas?.map((t) => (
            <li key={t.id} className={clasesDeTarjeta()} data-testid={`temporada-${t.id}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold">{t.name}</p>
                {/* El estado va escrito, no sólo en el color del botón. */}
                <span className="text-sm px-2 py-0.5 rounded-full bg-[var(--surface-2)] shrink-0">
                  {t.status === 'cerrada' ? 'Cerrada' : 'Activa'}
                </span>
              </div>

              <p className="text-sm text-[var(--ink-muted)]">
                {formatearRango(t.startsAt, t.endsAt)}
              </p>

              {/*
                Lo recaudado, torneo por torneo y el total.

                Va acá y no en una pantalla propia: la recaudación es de la
                temporada, y una pantalla nueva obligaría a elegir la temporada
                otra vez para ver un número que cabe en tres renglones.

                Se despliega: la mayoría de las veces se entra a Temporadas para
                cerrar una, no para mirar la caja.
              */}
              <Recaudacion seasonId={t.id} />

              {/* Cerrar no borra ni congela nada: es una marca para saber cuál
                  está en curso cuando hay varias, que es el caso a fin de año. */}
              <div className="flex gap-2 pt-2">
                <Button
                  variante="secundario"
                  onClick={() => void cambiarEstado(t, t.status === 'cerrada')}
                >
                  {t.status === 'cerrada' ? 'Reabrir' : 'Cerrar'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Screen>
    </Pantalla>
  );
}
