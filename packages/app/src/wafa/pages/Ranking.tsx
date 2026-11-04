/**
 * Ranking de liga dentro de WAFA.
 *
 * **Los mismos datos y los mismos endpoints públicos que la landing.** El admin lo mira desde acá
 * para no cambiar de app en medio de la fecha; el JSX está duplicado a propósito, por la misma razón
 * que el resto de las primitivas de cada paquete: no comparten bundle, y arrastrar la biblioteca de
 * la landing a la PWA le sumaría peso a una app que tiene que abrir sin señal.
 *
 * Lo que **no** se duplica son las decisiones —qué medalla lleva cada puesto— que viven en
 * `@bal/shared`.
 *
 * Un solo modo desde el 2026-10-24: «mejor de N», con `bestN` que manda el servidor
 * (`LEAGUE_BEST_N`). El ranking por posición se retiró. Ver `docs/FUNCTIONAL.md` §5.2 ·
 * `docs/DOMAIN_WA.md` §9.
 *
 * Es sólo la composición (`REF6-11` / `C-1`): los datos salen de `useRanking` y cada pieza vive en
 * `wafa/ranking/`.
 */

import { textoDeRanking } from '@bal/shared';
import { IconoCompartir, useTituloDePagina } from '@bal/ui';
import { useState } from 'react';
import { Button, Encabezado, Pantalla, Screen } from '../../components/ui.js';
import { CategoriaDelRanking } from '../ranking/CategoriaDelRanking.js';
import { Pestañas } from '../ranking/Pestañas.js';
import { VISTAS, type Vista } from '../ranking/tipos.js';
import { useRanking } from '../ranking/useRanking.js';

export function RankingPage({ onVolver }: { readonly onVolver: () => void }) {
  useTituloDePagina('Ranking');
  const { temporadas, elegida, setElegida, bestN, categorias, error } = useRanking();
  const [copiado, setCopiado] = useState(false);
  const [vista, setVista] = useState<Vista>('general');

  /**
   * Manda el ranking como texto.
   *
   * El texto lo arma `@bal/shared`, que es donde está probado: lo que se comparte tiene que ser
   * exactamente lo publicado, no una lectura del DOM.
   *
   * **Comparte la pestaña que está mirando**, no siempre General: las pestañas no sirven de nada si
   * lo que se manda por WhatsApp es otra cosa que lo que se ve en pantalla. El nombre de la vista se
   * suma al de la temporada —`textoDeRanking` no sabe de sexo, es dominio puro de puntajes— así que
   * quien lo recibe sabe cuál de las tres está leyendo.
   */
  const compartir = async () => {
    const nombreTemporada =
      (temporadas ?? []).find((t) => t.id === elegida)?.name ?? 'Liga Bahiense';
    const etiquetaVista = VISTAS.find((v) => v.key === vista)?.label;
    const texto = textoDeRanking({
      temporada: vista === 'general' ? nombreTemporada : `${nombreTemporada} — ${etiquetaVista}`,
      bestN,
      categorias: (categorias ?? []).map((c) => ({
        category: c.category,
        ranked: c[vista].ranked.map((e, i) => ({
          position: e.position ?? i + 1,
          firstName: e.firstName,
          lastName: e.lastName,
          valor: e.bestNAvgPct,
        })),
      })),
    });

    try {
      if (navigator.share) {
        await navigator.share({ text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      // Cancelar el diálogo de compartir tira igual que un fallo. No es un error del que haya que
      // avisar: el usuario decidió no compartir.
    }
  };

  return (
    <Pantalla>
      <Encabezado titulo="Ranking" onVolver={onVolver} />

      <Screen>
        {temporadas?.length === 0 && (
          <p className="text-[var(--ink-muted)]">
            Todavía no hay temporadas cargadas. Creá una y publicá un torneo.
          </p>
        )}

        {temporadas !== undefined && temporadas.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="temporada-ranking" className="text-sm font-medium">
                Temporada
              </label>
              <select
                id="temporada-ranking"
                value={elegida}
                onChange={(e) => setElegida(e.target.value)}
                className="min-h-[52px] px-4 text-base rounded-[var(--radius-md)] bg-[var(--surface)] border"
              >
                {temporadas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {/*
          Compartir el ranking **del modo que está elegido**.

          `navigator.share` donde exista —en el celular abre WhatsApp, mail y lo que el sistema
          ofrezca—; donde no, se copia al portapapeles. Nada de SDKs: la CSP prohíbe pedidos a otros
          hosts, y un botón de WhatsApp que no carga es peor que uno que copia.
        */}
        {categorias !== undefined && categorias.length > 0 && (
          <>
            <Pestañas vista={vista} onElegir={setVista} />

            <Button variante="secundario" onClick={() => void compartir()}>
              <span className="flex items-center justify-center gap-2">
                <IconoCompartir />
                {copiado ? 'Copiado' : 'Compartir'}
              </span>
            </Button>
          </>
        )}

        {categorias?.map((c) => (
          <CategoriaDelRanking key={c.category} c={c} vista={vista} bestN={bestN} />
        ))}
      </Screen>
    </Pantalla>
  );
}
