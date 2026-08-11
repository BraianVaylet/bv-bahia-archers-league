/**
 * Comandos de base de datos: `db:indexes`, `db:seed`, `db:reset`, `db:reconcile`.
 *
 * Uso: `pnpm --filter @bal/api db:<comando>`. Ver `docs/CONFIG.md` §4.
 */

import { connect, disconnect } from './client.js';
import { ensureIndexes } from './indexes.js';
import { reconcile } from './reconcile.js';
import { reset } from './reset.js';
import { seed } from './seed.js';

const COMANDOS = ['indexes', 'seed', 'reset', 'reconcile'] as const;
type Comando = (typeof COMANDOS)[number];

function esComando(valor: string | undefined): valor is Comando {
  return COMANDOS.includes(valor as Comando);
}

async function main(): Promise<void> {
  const comando = process.argv[2];

  if (!esComando(comando)) {
    console.error(`Comando desconocido: ${comando ?? '(ninguno)'}`);
    console.error(`Disponibles: ${COMANDOS.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const db = await connect();

  try {
    switch (comando) {
      case 'indexes': {
        await ensureIndexes(db);
        console.info('Índices creados.');
        break;
      }
      case 'seed': {
        const resultado = await seed(db);
        console.info(
          resultado.adminCreated
            ? `Administrador "${resultado.adminUsername}" creado. Al primer login se le va a exigir cambiar el password.`
            : `El administrador "${resultado.adminUsername}" ya existía. Sin cambios.`,
        );
        break;
      }
      case 'reset': {
        await reset(db);
        console.info('Base vaciada.');
        break;
      }
      case 'reconcile': {
        const resultado = await reconcile(db);
        console.info(
          `Participantes revisados: ${resultado.participantsChecked}. Corregidos: ${resultado.participantsFixed}.`,
        );
        for (const d of resultado.details) {
          console.info(`  ${d.participantId} ${d.campo}: ${d.antes} → ${d.despues}`);
        }
        break;
      }
    }
  } finally {
    await disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
