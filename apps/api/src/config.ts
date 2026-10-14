import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const boolean = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0', 'yes', 'no'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1' || v === 'yes'));

const optionalDate = z
  .string()
  .optional()
  .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), 'must be an ISO 8601 date')
  .transform((v) => (v === undefined ? undefined : new Date(v)));

/** Product rule: no cooldown may ever exceed 30 seconds. */
export const MAX_COOLDOWN_SECONDS = 30;

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // Interface the server binds to. 0.0.0.0 to be reachable from the LAN.
  HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),

  // Public address players use to reach the platform, e.g. http://192.168.1.50 or http://ctf.local.
  PUBLIC_URL: z.string().default(''),
  // Browser origins allowed to call the API with cookies (comma-separated).
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  // Optional CIDR allowlist for client IPs, e.g. "192.168.1.0/24,10.0.0.0/8". Empty = allow all.
  ALLOWED_SUBNETS: z.string().default(''),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
  FLAG_PEPPER: z.string().min(32, 'must be at least 32 characters').optional(),
  SESSION_TTL_HOURS: z.coerce.number().positive().max(24 * 14).default(24),
  // auto = secure only when PUBLIC_URL is https. Plain-HTTP LAN deploys stay non-secure.
  COOKIE_SECURE: z.enum(['auto', 'true', 'false']).default('auto'),

  DATABASE_URL: z.string().default('file:./dev.db'),

  // Cooldown after repeated failures (login and flag submission). Hard maximum 30s.
  COOLDOWN_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_COOLDOWN_SECONDS, `must be at most ${MAX_COOLDOWN_SECONDS} seconds`)
    .default(MAX_COOLDOWN_SECONDS),
  LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(5),
  LOGIN_MAX_FAILURES_PER_IP: z.coerce.number().int().positive().default(30),

  // Max players per team (0 = unlimited).
  MAX_PLAYERS_PER_TEAM: z.coerce.number().int().min(0).default(0),
  // New-account creation rate per client IP (many players may share one IP on a LAN).
  NEW_PLAYER_IP_LIMIT: boolean(true),
  NEW_PLAYERS_PER_IP: z.coerce.number().int().positive().default(20),
  NEW_PLAYERS_PER_IP_WINDOW_MIN: z.coerce.number().int().positive().default(10),

  TEAM_SCORING: z.enum(['sum', 'unique']).default('sum'),
  FIRST_BLOOD_BONUS: z.coerce.number().int().min(0).default(0),
  HINTS_ENABLED: boolean(true),
  HINT_COSTS_ENABLED: boolean(false),
  DECAY_SCORING: boolean(false),
  DECAY_MIN_PERCENT: z.coerce.number().int().min(1).max(100).default(30),
  DECAY_SOLVES_TO_MIN: z.coerce.number().int().min(1).default(20),

  SUBMIT_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(5),
  SUBMIT_LOCKOUT_FAILURES: z.coerce.number().int().positive().default(10),

  // Event window + mode for seeding. EVENT_START/END are ISO 8601 with offset.
  EVENT_START: optionalDate,
  EVENT_END: optionalDate,
  // scheduled | live | paused | ended. EVENT_MODE=live is refused in production.
  EVENT_MODE: z.enum(['scheduled', 'live', 'paused', 'ended']).optional(),
  // Timing model. `event` = one shared clock the admin starts (production default):
  // everyone sees the same countdown from a single start. `scheduled` = follow
  // EVENT_START/END dates (legacy).
  TIMER_MODE: z.enum(['event', 'scheduled']).default('event'),
  // Length of the shared event once started (minutes). Default 60.
  EVENT_DURATION_MINUTES: z.coerce.number().int().positive().max(24 * 60).default(60),
  // Optionally close new sign-ups this many minutes after the event starts (0/empty = never).
  CLOSE_SIGNUPS_AFTER_MINUTES: z.coerce.number().int().min(0).default(0),

  // Development-only admin seed (git-ignored .env). Used solely by `admin:seed-dev`,
  // which is refused in production. Never logged or printed.
  DEV_ADMIN_USERNAME: z.string().optional(),
  DEV_ADMIN_PASSWORD: z.string().optional(),

  // --- Feature flags (hide unfinished sections instead of showing empty pages) ---
  FEATURE_INTEL: boolean(false),
  FEATURE_ACHIEVEMENTS: boolean(false),

  // Serve the built web app from the API on one port (for the LAN single-URL deploy).
  SERVE_WEB: boolean(false),

  // --- Admin dashboard ---------------------------------------------------------
  // CIDR allowlist for the admin area (/admin and /api/admin). Default: localhost only.
  ADMIN_ALLOWED_SUBNETS: z.string().default(''),
  ADMIN_IDLE_TIMEOUT_MIN: z.coerce.number().int().positive().default(60),
  ADMIN_MAX_SESSION_HOURS: z.coerce.number().int().positive().default(8),
  ADMIN_LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(5),
  ADMIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

  // --- Challenge services (Python supervisor) ---
  // Run the supervisor that starts/stops the Python challenge processes.
  CHALLENGES_ENABLED: boolean(true),
  // Dev convenience: release (unlock) every challenge automatically.
  AUTO_UNLOCK_ALL: boolean(false),
  // Per-service in-flight request cap passed to each child.
  CHALLENGE_MAX_CONCURRENCY: z.coerce.number().int().positive().max(128).default(8),
  // Path to the challenge-services venv Python. Empty = auto-detect.
  CHALLENGE_PYTHON: z.string().default(''),
});

// Clearly-labelled development fallbacks. Production refuses to use them.
const DEV_SESSION_SECRET = 'dev-only-insecure-session-secret-change-me-0000';
const DEV_FLAG_PEPPER = 'dev-only-insecure-flag-pepper-change-me-000000';

export type AppConfig = ReturnType<typeof buildConfig>;

function buildConfig(env: z.infer<typeof EnvSchema>) {
  const isProd = env.NODE_ENV === 'production';
  const publicUrl = env.PUBLIC_URL.trim().replace(/\/$/, '');
  const publicIsHttps = publicUrl.startsWith('https://');
  // The public origin is always allowed to call the API with credentials.
  const allowedOrigins = [
    ...env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    ...(publicUrl ? [publicUrl] : []),
  ].filter(Boolean);
  return {
    env: env.NODE_ENV,
    isProd,
    logLevel: env.LOG_LEVEL,
    host: env.HOST,
    port: env.API_PORT,
    publicUrl,
    allowedOrigins: [...new Set(allowedOrigins)],
    allowedSubnets: env.ALLOWED_SUBNETS.split(',').map((s) => s.trim()).filter(Boolean),
    trustProxy: env.TRUST_PROXY,
    sessionSecret: env.SESSION_SECRET ?? DEV_SESSION_SECRET,
    flagPepper: env.FLAG_PEPPER ?? DEV_FLAG_PEPPER,
    usingDevSecrets: !env.SESSION_SECRET || !env.FLAG_PEPPER,
    sessionTtlMs: env.SESSION_TTL_HOURS * 3_600_000,
    // Plain-HTTP LAN deploys must not set Secure (browsers drop Secure cookies over http).
    cookieSecure: env.COOKIE_SECURE === 'auto' ? publicIsHttps : env.COOKIE_SECURE === 'true',
    databaseUrl: env.DATABASE_URL,
    login: {
      maxPlayersPerTeam: env.MAX_PLAYERS_PER_TEAM,
      newPlayersPerIp: {
        enabled: env.NEW_PLAYER_IP_LIMIT,
        max: env.NEW_PLAYERS_PER_IP,
        windowMs: env.NEW_PLAYERS_PER_IP_WINDOW_MIN * 60_000,
      },
    },
    scoring: {
      team: env.TEAM_SCORING,
      firstBloodBonus: env.FIRST_BLOOD_BONUS,
      hintsEnabled: env.HINTS_ENABLED,
      hintCostsEnabled: env.HINT_COSTS_ENABLED,
      decay: {
        enabled: env.DECAY_SCORING,
        minPercent: env.DECAY_MIN_PERCENT,
        solvesToMin: env.DECAY_SOLVES_TO_MIN,
      },
    },
    rateLimits: {
      cooldownMs: env.COOLDOWN_SECONDS * 1000,
      loginMaxFailures: env.LOGIN_MAX_FAILURES,
      loginMaxFailuresPerIp: env.LOGIN_MAX_FAILURES_PER_IP,
      submitPerMinute: env.SUBMIT_RATE_LIMIT_PER_MIN,
      submitLockoutFailures: env.SUBMIT_LOCKOUT_FAILURES,
    },
    event: {
      startsAt: env.EVENT_START,
      endsAt: env.EVENT_END,
      // Default mode: live in dev (so the organizer can always test), scheduled in production.
      mode: env.EVENT_MODE ?? (isProd ? 'scheduled' : 'live'),
      timerMode: env.TIMER_MODE,
      durationMs: env.EVENT_DURATION_MINUTES * 60_000,
      closeSignupsAfterMs: env.CLOSE_SIGNUPS_AFTER_MINUTES > 0 ? env.CLOSE_SIGNUPS_AFTER_MINUTES * 60_000 : null,
    },
    // Development-only admin seed. Never used in production (the seed script refuses).
    devAdmin: {
      username: env.DEV_ADMIN_USERNAME?.trim() ?? '',
      password: env.DEV_ADMIN_PASSWORD ?? '',
    },
    features: {
      intel: env.FEATURE_INTEL,
      achievements: env.FEATURE_ACHIEVEMENTS,
    },
    serveWeb: env.SERVE_WEB,
    admin: {
      // Default: localhost only, so the admin area isn't reachable from the LAN unless opened.
      allowedSubnets: env.ADMIN_ALLOWED_SUBNETS.split(',').map((s) => s.trim()).filter(Boolean),
      idleTimeoutMs: env.ADMIN_IDLE_TIMEOUT_MIN * 60_000,
      maxSessionMs: env.ADMIN_MAX_SESSION_HOURS * 3_600_000,
      loginMaxFailures: env.ADMIN_LOGIN_MAX_FAILURES,
      lockoutMs: env.ADMIN_LOCKOUT_MINUTES * 60_000,
    },
    challenges: {
      // Never auto-run the Python supervisor during tests.
      enabled: env.NODE_ENV === 'test' ? false : env.CHALLENGES_ENABLED,
      autoUnlockAll: env.AUTO_UNLOCK_ALL,
      maxConcurrency: env.CHALLENGE_MAX_CONCURRENCY,
      python: env.CHALLENGE_PYTHON,
    },
  };
}

export class ConfigError extends Error {}

/** Parse and validate configuration. Throws ConfigError with readable messages. */
export function parseConfig(raw: NodeJS.ProcessEnv): AppConfig {
  // Treat empty values (e.g. `FLAG_PEPPER=` in .env) as unset.
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v.trim() !== ''),
  );
  const result = EnvSchema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new ConfigError(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const env = result.data;
  if (env.NODE_ENV === 'production') {
    const missing = (['SESSION_SECRET', 'FLAG_PEPPER'] as const).filter((k) => !env[k]);
    if (missing.length > 0) {
      throw new ConfigError(`Missing required production secrets: ${missing.join(', ')}`);
    }
    if (env.EVENT_MODE === 'live') {
      throw new ConfigError(
        'EVENT_MODE=live is not allowed in production (it would force the event open regardless of the schedule). Use EVENT_MODE=scheduled and set EVENT_START/EVENT_END.',
      );
    }
  }
  if (env.EVENT_START && env.EVENT_END && env.EVENT_END <= env.EVENT_START) {
    throw new ConfigError('EVENT_END must be after EVENT_START');
  }
  return buildConfig(env);
}

/** Load `.env` from the working directory or the repo root (dev), then parse. */
export function loadConfig(): AppConfig {
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(candidate)) {
      // Does not override variables already set in the real environment.
      process.loadEnvFile(candidate);
      break;
    }
  }
  return parseConfig(process.env);
}
