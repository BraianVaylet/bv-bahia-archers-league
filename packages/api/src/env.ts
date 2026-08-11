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

  RATE_LIMIT_LOGIN: entero(10),
  RATE_LIMIT_LOGIN_WINDOW_MIN: entero(15),
  RATE_LIMIT_SYNC: entero(300),
  RATE_LIMIT_PUBLIC: entero(120),

  WEB_DIST_APP: z.string().min(1).default('public/app'),
  WEB_DIST_LANDING: z.string().min(1).default('public/landing'),
});

export type Env = z.infer<typeof EnvSchema> & {
  readonly isProduction: boolean;
  readonly cookieSecure: boolean;
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
