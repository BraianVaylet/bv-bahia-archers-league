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
import { clasesDeTarjeta, cn, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { BarraDeAcciones } from '../distribucion/BarraDeAcciones.js';
import { TarjetaDePatrulla } from '../distribucion/TarjetaDePatrulla.js';
import { usePatrullas } from '../distribucion/usePatrullas.js';
import { textoDeViolacion } from '../patrullas.js';

export function PatrolsPage({ onVolver }: { readonly onVolver: () => void }) {
  useTituloDePagina('Patrullas');
  const { id = '' } = useParams();
  const p = usePatrullas(id);
  const [moviendo, setMoviendo] = useState<string>();

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
              original={p.patrullas?.find((x) => x.number === patrulla.numero)}
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
