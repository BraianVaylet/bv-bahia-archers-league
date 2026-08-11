/**
 * Primitivas criptográficas.
 *
 * Ver `docs/SECURITY.md` §3, §8 y §9.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

/**
 * Parámetros argon2id. Mínimos recomendados por OWASP: 19 MiB de memoria,
 * 2 iteraciones, paralelismo 1.
 */
const ARGON2ID = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Hash argon2id de un secreto (password de admin, PIN de patrulla). */
export function hashSecret(plain: string): Promise<string> {
  return argonHash(plain, ARGON2ID);
}

/**
 * Verifica un secreto contra su hash. Nunca lanza: un hash corrupto o de otro
 * algoritmo devuelve `false`, no rompe el login.
 */
export async function verifySecret(hash: string, plain: string): Promise<boolean> {
  try {
    return await argonVerify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Hash de referencia para comparar cuando el usuario no existe.
 *
 * Sin esto, un login contra un usuario inexistente responde mucho más rápido
 * que uno contra un usuario real, y eso permite enumerar cuentas midiendo el
 * tiempo. Se computa una sola vez, en el arranque.
 */
let dummyHash: string | undefined;

export async function getDummyHash(): Promise<string> {
  dummyHash ??= await hashSecret(randomBytes(32).toString('hex'));
  return dummyHash;
}

/** Token de sesión de alta entropía. En la cookie va esto; en la base, su sha256. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** `sha256` en hexadecimal. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * PIN numérico de la longitud pedida, con RNG criptográfico.
 * Nunca secuencial ni derivado del número de patrulla.
 */
export function generatePin(digits = 6): string {
  let pin = '';
  for (let i = 0; i < digits; i++) pin += String(randomInt(0, 10));
  return pin;
}

// ── Cifrado del PIN en reposo ────────────────────────────────────────────────
//
// El admin necesita volver a ver el PIN días después de crear el torneo, para
// dictarlo en el campo. Un hash argon2id no lo permite por definición, así que
// se guarda además cifrado. El tradeoff está documentado en SECURITY.md §9:
// quien obtenga a la vez un volcado de la base Y la variable de entorno puede
// leer los PIN. Se acepta porque el activo es un PIN de un día, de alcance
// acotado a una patrulla, y la alternativa —que el admin no pueda recuperarlo—
// termina con los PIN anotados en un papel o en un chat.

const IV_BYTES = 12;
const TAG_BYTES = 16;

function claveDesdeHex(hexKey: string): Buffer {
  const clave = Buffer.from(hexKey, 'hex');
  if (clave.length !== 32) {
    throw new Error('PIN_ENC_KEY debe ser de 32 bytes (64 caracteres hexadecimales).');
  }
  return clave;
}

/** Cifra con AES-256-GCM. Devuelve `base64(iv | ciphertext | tag)`. */
export function encryptPin(plain: string, hexKey: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', claveDesdeHex(hexKey), iv);
  const cifrado = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cifrado, cipher.getAuthTag()]).toString('base64');
}

/**
 * Descifra lo producido por `encryptPin`.
 *
 * @throws si el dato fue alterado: GCM autentica, así que un ciphertext
 *   manipulado falla en vez de devolver basura.
 */
export function decryptPin(encoded: string, hexKey: string): string {
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length <= IV_BYTES + TAG_BYTES) {
    throw new Error('Dato cifrado inválido.');
  }

  const iv = bytes.subarray(0, IV_BYTES);
  const tag = bytes.subarray(bytes.length - TAG_BYTES);
  const cifrado = bytes.subarray(IV_BYTES, bytes.length - TAG_BYTES);

  const decipher = createDecipheriv('aes-256-gcm', claveDesdeHex(hexKey), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
}

/** Normaliza texto para buscar: sin acentos, en minúscula. */
export function searchKey(...partes: string[]): string {
  return partes.join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
