/**
 * Configuración por variables de entorno.
 *
 * Se valida al arrancar y **falla ruidosamente**: un servidor de producción que
 * levanta con un secreto de desarrollo es peor que uno que no levanta.
 *
 * Ver `docs/CONFIG.md` §2 y `docs/SECURITY.md` §3.
 */

import { z } from 'zod';

/** Valores que sólo son aceptables en desarrollo local. */
const DEFAULTS_DE_DESARROLLO = {
  sessionSecret: 'dev-only-inseguro-cambiar-en-produccion-0000',
  pinEncKey: '0'.repeat(64),
  adminPassword: 'CBA2026',
} as const;

const booleano = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const entero = (def: number) => z.coerce.number().int().positive().default(def);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: entero(8787),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatoria'),
  MONGODB_DB: z.string().min(1).default('bal'),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),
  PIN_ENC_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'PIN_ENC_KEY debe ser 64 caracteres hexadecimales (32 bytes)'),

  ADMIN_USERNAME: z.string().min(3).default('admin'),
  ADMIN_INITIAL_PASSWORD: z.string().min(1, 'ADMIN_INITIAL_PASSWORD es obligatoria'),

  SESSION_COOKIE_NAME: z.string().min(1).default('bal_session'),
  CSRF_COOKIE_NAME: z.string().min(1).default('bal_csrf'),
  COOKIE_SECURE: booleano.optional(),
  SESSION_TTL_HOURS_ADMIN: entero(12),
  SESSION_TTL_HOURS_PATROL: entero(24),

  /**
   * Intentos **fallidos** por IP en el login (admin y patrulla), no requests.
   * Lo que frena la fuerza bruta contra una cuenta es su bloqueo propio; esto es
   * contra quien rocía intentos por muchas cuentas. Generoso a propósito: el
   * wifi del club es una sola IP para todas las patrullas.
   */
  RATE_LIMIT_LOGIN: entero(60),
  RATE_LIMIT_LOGIN_WINDOW_MIN: entero(15),
  /**
   * Altas públicas por hora y por IP. El alta escribe, y cada una es una fila que
   * el admin tiene que revisar. Generoso a propósito: el día de la inscripción
   * varios arqueros se anotan a la vez desde el wifi del club, que es una sola IP.
   */
  RATE_LIMIT_REGISTER: entero(20),
  /**
   * Intentos fallidos por IP al recuperar el password. Más corto que el login:
   * es la única ruta sin sesión que cambia una credencial y no tiene bloqueo por
   * cuenta, así que el cupo de la IP es lo único que frena adivinar el código.
   */
  RATE_LIMIT_RECOVER: entero(5),
  RATE_LIMIT_SYNC: entero(300),
  RATE_LIMIT_PUBLIC: entero(120),

  /**
   * Cuántos de los mejores porcentajes de la temporada entran en el promedio
   * de «mejor de N» — y el mínimo de torneos para figurar en el ranking, que
   * es el mismo número. Ver docs/DOMAIN_WA.md §9.
   */
  LEAGUE_BEST_N: entero(2),

  /**
   * Header donde el proxy de adelante deja la IP real del cliente. Por defecto,
   * `x-real-ip` en producción (Railway) y ninguno en desarrollo, donde no hay
   * proxy. Poné otro si el servicio queda detrás de otra cosa (p. ej. Cloudflare:
   * `cf-connecting-ip`). Ver `lib/ip.ts`.
   */
  TRUSTED_IP_HEADER: z
    .string()
    .min(1)
    .transform((v) => v.toLowerCase())
    .optional(),
});

export type Env = z.infer<typeof EnvSchema> & {
  readonly isProduction: boolean;
  readonly cookieSecure: boolean;
  /** `TRUSTED_IP_HEADER` ya resuelto, con el default de producción aplicado. */
  readonly trustedIpHeader: string | undefined;
};

export class EnvError extends Error {
  readonly code = 'ENV_INVALID';
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Configuración inválida:\n  - ${problems.join('\n  - ')}`);
    this.name = 'EnvError';
    this.problems = problems;
  }
}

/**
 * En producción, los valores de desarrollo dejan de ser aceptables.
 * Es lo que impide desplegar con `CBA2026` o con un secreto de ejemplo.
 */
function problemasDeProduccion(env: z.infer<typeof EnvSchema>): string[] {
  const problemas: string[] = [];

  if (env.SESSION_SECRET === DEFAULTS_DE_DESARROLLO.sessionSecret) {
    problemas.push(
      'SESSION_SECRET tiene el valor de desarrollo. Generá uno con `openssl rand -hex 32`.',
    );
  }
  if (env.PIN_ENC_KEY.toLowerCase() === DEFAULTS_DE_DESARROLLO.pinEncKey) {
    problemas.push(
      'PIN_ENC_KEY tiene el valor de desarrollo. Generá una con `openssl rand -hex 32`.',
    );
  }
  if (env.SESSION_SECRET === env.PIN_ENC_KEY) {
    problemas.push('SESSION_SECRET y PIN_ENC_KEY deben ser distintas.');
  }
  if (env.ADMIN_INITIAL_PASSWORD === DEFAULTS_DE_DESARROLLO.adminPassword) {
    problemas.push('ADMIN_INITIAL_PASSWORD tiene el valor de desarrollo. Elegí otra.');
  }
  if (env.ADMIN_INITIAL_PASSWORD.length < 12) {
    problemas.push('ADMIN_INITIAL_PASSWORD debe tener al menos 12 caracteres en producción.');
  }

  return problemas;
}

/**
 * Valida y normaliza la configuración.
 *
 * @throws {EnvError} con **todos** los problemas juntos, no sólo el primero:
 *   quien está configurando el deploy no debería descubrirlos de a uno.
 */
export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(raw);

  if (!parsed.success) {
    throw new EnvError(
      parsed.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`),
    );
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction) {
    const problemas = problemasDeProduccion(env);
    if (problemas.length > 0) throw new EnvError(problemas);
  }

  return {
    ...env,
    isProduction,
    // En producción las cookies van Secure salvo que se desactive a propósito.
    cookieSecure: env.COOKIE_SECURE ?? isProduction,
    // Igual que las cookies: en producción hay un proxy adelante (Railway) y su
    // header es el confiable; en desarrollo no hay proxy y no hay nada que creer.
    trustedIpHeader: env.TRUSTED_IP_HEADER ?? (isProduction ? 'x-real-ip' : undefined),
  };
}

let cache: Env | undefined;

/** Configuración del proceso. Se valida una sola vez. */
export function env(): Env {
  cache ??= loadEnv();
  return cache;
}

/** Sólo para tests: olvida la configuración cacheada. */
export function resetEnvCache(): void {
  cache = undefined;
}
