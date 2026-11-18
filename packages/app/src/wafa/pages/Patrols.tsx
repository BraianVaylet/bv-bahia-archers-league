/**
 * Patrullas y credenciales de un torneo.
 *
 * Mientras el torneo está `sin_iniciar` el admin puede reacomodar arqueros. El validador **avisa pero
 * no bloquea**: el admin conoce el terreno y puede tener motivos para una excepción, y la decisión
 * queda en el audit log.
 *
 * Es sólo la composición (`REF6-11` / `C-1`): los datos y la edición salen de `usePatrullas`, y cada
 * pieza vive en `wafa/distribucion/`.
 *
 * Ver `docs/FUNCTIONAL.md` §6.6.
 */

import { useTituloDePagina } from '@bal/ui';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Cargando } from '../../components/Cargando.js';
import { Button, clasesDeTarjeta, cn, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { BarraDeAcciones } from '../distribucion/BarraDeAcciones.js';
import { TarjetaDePatrulla } from '../distribucion/TarjetaDePatrulla.js';
import { usePatrullas } from '../distribucion/usePatrullas.js';
import { agregarPatrulla, textoDeViolacion } from '../patrullas.js';

export function PatrolsPage({ onVolver }: { readonly onVolver: () => void }) {
  useTituloDePagina('Patrullas');
  const { id = '' } = useParams();
  const p = usePatrullas(id);
  const [moviendo, setMoviendo] = useState<string>();
  const [confirmandoRearmado, setConfirmandoRearmado] = useState(false);

  const editable = p.torneo?.status === 'sin_iniciar';

  return (
    <Pantalla>
      <Encabezado contexto="Administración" titulo="Patrullas" onVolver={onVolver} />

      <Screen>
        <h1 className="pt-2 font-display text-display font-bold">
          {p.torneo?.name ?? 'Patrullas'}
        </h1>

        {p.torneo && !editable && (
          <p className="text-sm text-[var(--ink-muted)]">
            El torneo ya arrancó: las patrullas quedaron congeladas. Los líderes tienen el recorrido
            descargado en el celular.
          </p>
        )}

        {p.error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {p.error}
          </p>
        )}

        {/* Avisa pero no bloquea: el admin decide, y queda registrado. */}
        {p.violaciones.length > 0 && (
          <section
            className={cn(clasesDeTarjeta(), 'flex flex-col gap-1.5 text-[var(--warn)]')}
            data-testid="violaciones"
          >
            <p className="font-semibold text-sm">
              Estas patrullas no cumplen el reglamento. Podés guardarlas igual; queda registrado.
            </p>
            <ul className="text-sm flex flex-col gap-1">
              {/* El texto como clave: no todas las violaciones tienen una sola patrulla, y
                  `DUPLICATE_START` puede aparecer varias veces. */}
              {p.violaciones.map((v) => {
                const texto = textoDeViolacion(v);
                return <li key={texto}>{texto}</li>;
              })}
            </ul>
          </section>
        )}

        {p.patrullas === undefined && !p.error && <Cargando texto="Cargando las patrullas…" />}

        <div className="flex flex-col gap-3">
          {p.borrador.map((patrulla) => (
            <TarjetaDePatrulla
              key={patrulla.numero}
              patrulla={patrulla}
              // Por id, no por número: al eliminar una, las demás se renumeran y la tarjeta
              // mostraba la credencial de otra patrulla. Una nueva no tiene id ni credencial
              // hasta que se guarda (`FE-47`).
              original={
                patrulla.id === undefined
                  ? undefined
                  : p.patrullas?.find((x) => x.id === patrulla.id)
              }
              borrador={p.borrador}
              torneo={p.torneo}
              editable={editable}
              moviendo={moviendo}
              onMoviendo={setMoviendo}
              onEditar={p.editar}
              onRegenerado={() => void p.recargar()}
            />
          ))}
        </div>

        {/* `FE-47`: si se eliminó una, o hace falta otra, se crea. Vacía no se guarda. */}
        {editable && p.borrador.length > 0 && (
          <Button
            variante="secundario"
            onClick={() => p.editar(agregarPatrulla(p.borrador, p.torneo?.targets.length ?? 1))}
          >
            Agregar patrulla
          </Button>
        )}

        {/*
          `FE-48`: rearmar todo desde cero es explícito desde que editar participantes no rearma
          (`BE-31`). Dos toques, como borrar un torneo: sin `confirm()` ni modal.
        */}
        {editable && p.borrador.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 print:hidden">
            {confirmandoRearmado && (
              <p role="alert" className="text-sm text-[var(--warn)]">
                Se arman todas las patrullas de nuevo y cambian los PIN: si ya imprimiste las
                planillas, hay que reimprimirlas. Los cambios sin guardar se pierden.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variante="secundario"
                disabled={p.guardando}
                onClick={() => {
                  if (!confirmandoRearmado) {
                    setConfirmandoRearmado(true);
                    return;
                  }
                  setConfirmandoRearmado(false);
                  void p.rearmar();
                }}
              >
                {confirmandoRearmado ? 'Confirmar: rearmar' : 'Rearmar patrullas'}
              </Button>
              {confirmandoRearmado && (
                <Button variante="secundario" onClick={() => setConfirmandoRearmado(false)}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}
      </Screen>

      {editable && (
        <BarraDeAcciones
          problema={p.problema}
          guardado={p.guardado}
          error={p.error}
          sinGuardar={p.sinGuardar}
          guardando={p.guardando}
          onGuardar={() => void p.guardar()}
          onVolver={onVolver}
        />
      )}
    </Pantalla>
  );
}
