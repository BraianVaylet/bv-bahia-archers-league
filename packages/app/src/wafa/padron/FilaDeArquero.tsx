/**
 * Un arquero del padrón, con sus acciones: editar, archivar o restaurar, y eliminar.
 */

import {
  ChipCategoria,
  IconoArchivar,
  IconoAviso,
  IconoEditar,
  IconoEliminar,
  IconoRestaurar,
} from '@bal/ui';
import { useState } from 'react';
import { clasesDeTarjeta, cn } from '../../components/ui.js';
import { BotonIcono } from './BotonIcono.js';
import type { ArcherRow } from './tipos.js';

/**
 * Qué le falta, con nombre: «sexo o DNI» obligaba a abrir el formulario para saberlo.
 * El sexo es el que más pesa —sin él no entra al ranking Femenino ni al Masculino—, por
 * eso va primero.
 */
function queFalta(arquero: Pick<ArcherRow, 'sex' | 'dni'>): string {
  const faltan = [arquero.sex === null && 'sexo', arquero.dni === null && 'DNI'].filter(Boolean);
  return `Falta completar ${faltan.join(' y ')}`;
}

export function FilaDeArquero({
  arquero,
  onEditar,
  onArchivar,
  onRestaurar,
  onEliminar,
}: {
  readonly arquero: ArcherRow;
  readonly onEditar: () => void;
  readonly onArchivar: () => void;
  readonly onRestaurar: () => void;
  readonly onEliminar: () => void;
}) {
  /**
   * Eliminar pide un segundo toque, igual que borrar un torneo o rechazar un
   * alta pendiente: el mismo patrón en toda la app, sin `confirm()` ni modal.
   * Faltaba acá —era la única acción irreversible de la pantalla sin él—.
   */
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  const eliminar = () => {
    if (!confirmandoEliminar) {
      setConfirmandoEliminar(true);
      return;
    }
    onEliminar();
  };

  return (
    <li
      className={cn(clasesDeTarjeta(), 'flex flex-col gap-2')}
      data-testid={`arquero-${arquero.lastName}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">
          {arquero.lastName}, {arquero.firstName}
        </span>
        {/* La categoría resaltada: decide estaca y podio, y es lo que el admin
            busca de un vistazo al armar un torneo. Ahora con su color y su
            ícono, para encontrarla en una lista de cuarenta. */}
        <span className="shrink-0">
          <ChipCategoria category={arquero.category} compacto />
        </span>
      </div>

      <p className="text-sm text-[var(--ink-muted)]">
        {arquero.tournamentCount === 0
          ? 'Todavía no jugó ningún torneo'
          : `${arquero.tournamentCount} ${arquero.tournamentCount === 1 ? 'torneo jugado' : 'torneos jugados'}`}
      </p>

      {/*
        A la vista y no en un `<details>`: a diferencia del aviso de «por qué
        no se puede eliminar» (que se consulta sólo cuando hace falta), éste
        es para escanear el padrón de un vistazo y ver a quién le falta
        completar —decisión 6, nadie lo fuerza, pero alguien tiene que verlo.
      */}
      {arquero.profileIncomplete && (
        <p className="text-sm text-[var(--ink-muted)] flex items-center gap-1.5">
          <IconoAviso size={16} />
          {queFalta(arquero)}
        </p>
      )}

      {/* A iconos para que las tres acciones entren en un renglón sin empujar
          el nombre. El `aria-label` lleva el APELLIDO además del verbo: con
          quince arqueros en pantalla, quince botones «Editar» no se distinguen
          en un lector. Ver docs/DESIGN_SYSTEM.md §10. */}
      <div className="flex flex-wrap gap-2">
        <BotonIcono
          icono={IconoEditar}
          etiqueta={`Editar a ${arquero.lastName}`}
          onClick={onEditar}
        />

        {arquero.archived ? (
          <BotonIcono
            icono={IconoRestaurar}
            etiqueta={`Restaurar a ${arquero.lastName}`}
            onClick={onRestaurar}
          />
        ) : (
          <BotonIcono
            icono={IconoArchivar}
            etiqueta={`Archivar a ${arquero.lastName}`}
            onClick={onArchivar}
          />
        )}

        <BotonIcono
          icono={IconoEliminar}
          etiqueta={
            confirmandoEliminar
              ? `Confirmar eliminar a ${arquero.lastName}`
              : `Eliminar a ${arquero.lastName}`
          }
          onClick={eliminar}
          disabled={arquero.participated}
          peligro
        />
      </div>

      {confirmandoEliminar && (
        <p role="status" className="text-sm text-[var(--danger)]">
          Se borra del padrón, no se puede deshacer. Tocá de nuevo para confirmar.
        </p>
      )}

      {/*
        La explicación se despliega al tocarla.
        
        Antes estaba **siempre visible**, con este razonamiento: un botón gris
        sin motivo es una pared, no una respuesta. Sigue siendo cierto, y por
        eso el aviso está: lo que cambió es que en un padrón de cuarenta
        arqueros, treinta de los cuales participaron, el mismo párrafo repetido
        treinta veces tapa la lista y deja de leerse.
        
        Un `<details>` y no un estado propio: se abre con teclado, lo anuncia un
        lector de pantalla y no hace falta escribir nada de eso.
      */}
      {arquero.participated && (
        <details className="text-sm text-[var(--ink-muted)]">
          <summary className="min-h-[44px] flex items-center gap-1.5 cursor-pointer">
            <IconoAviso size={16} />
            Por qué no se puede eliminar
          </summary>
          <p className="pb-2">
            Ya participó de un torneo, así que no se puede eliminar sin romper su histórico y los
            rankings. Archivalo: deja de aparecer al armar torneos nuevos y conserva todo.
          </p>
        </details>
      )}
    </li>
  );
}
