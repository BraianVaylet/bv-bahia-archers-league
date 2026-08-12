/**
 * Baja el binario de MongoDB una sola vez, antes de correr los tests.
 *
 * Vitest corre los archivos de `@bal/api` en paralelo y cada worker levanta su
 * propio replica set. En una máquina limpia todos intentan **descargar el mismo
 * binario a la vez** y se pisan en el lockfile:
 *
 *     Cannot unlock file ".../mongodb-binaries/7.0.14.lock",
 *     because it is not locked by this process
 *
 * En local no se nota porque el binario ya está en la caché. Este script lo deja
 * cacheado de entrada, y a partir de ahí los workers sólo lo leen.
 */

import { MongoMemoryReplSet } from 'mongodb-memory-server';

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await replSet.stop();

console.info('Binario de MongoDB en caché.');
