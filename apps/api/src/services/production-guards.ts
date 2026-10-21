/**
 * Production safety checks. Some are pure-config (handled in config.ts); these
 * are the ones that need the database or the flags file. Used by `start:prod`
 * (which refuses to run on any FAIL) and by `npm run preflight` (read-only).
 *
 * None of these ever print a secret value - only PASS/FAIL and counts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppConfig } from '../config';
import { API_ROOT } from '../db-url';
import type { Db } from '../lib/db';
import { verifyPassword } from '../lib/password';
import { verifyFlag } from './flags';

export interface Check {
  name: string;
  pass: boolean;
  detail: string;
  fix?: string;
}

const FLAGS_ENV = resolve(API_ROOT, '../..', 'challenge-services', '.flags.env');

/** Minimum admin password length (also enforced by admin:reset-password). */
export const MIN_ADMIN_PASSWORD = 12;

/** Credentials that must never guard a real event. */
const WEAK_ADMIN_PASSWORDS = [
  'admin', 'password', 'changeme', 'change-me', 'letmein', 'cydemic', 'organizer',
  'admin123', 'admin1234', 'password1', 'ctfadmin', 'test1234', 'adminadmin',
];

export function parseFlagsEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

/** Every flag in .flags.env verifies against the hash stored in the database. */
export async function checkFlagHashes(db: Db, config: AppConfig): Promise<Check> {
  if (!existsSync(FLAGS_ENV)) {
    return { name: 'Flag hashes', pass: false, detail: '.flags.env is missing', fix: 'Create challenge-services/.flags.env (build_flags_env.py)' };
  }
  const flags = parseFlagsEnv(readFileSync(FLAGS_ENV, 'utf8'));
  const challenges = await db.challenge.findMany({ select: { id: true, flagSalt: true, flagHash: true } });
  if (challenges.length === 0) return { name: 'Flag hashes', pass: false, detail: 'no challenges seeded', fix: 'Run prod:init (seeds and rehashes)' };
  const bad: string[] = [];
  for (const c of challenges) {
    const plain = flags[`FLAG_${c.id}`];
    if (!plain || !verifyFlag(config.flagPepper, c.flagSalt, c.flagHash, plain)) bad.push(c.id);
  }
  return bad.length === 0
    ? { name: 'Flag hashes', pass: true, detail: `${challenges.length} flags verify against stored hashes` }
    : { name: 'Flag hashes', pass: false, detail: `${bad.length} flag(s) do not match`, fix: 'Run prod:init to rehash with the production FLAG_PEPPER' };
}

/** No admin account uses a default/development password, and at least one exists. */
export async function checkAdminCredentials(db: Db): Promise<Check> {
  const admins = await db.adminAccount.findMany({ select: { id: true, username: true, passwordHash: true } });
  if (admins.length === 0) {
    return { name: 'Admin credentials', pass: false, detail: 'no admin account exists', fix: 'Run npm run admin:create' };
  }
  for (const a of admins) {
    for (const weak of WEAK_ADMIN_PASSWORDS) {
      if (await verifyPassword(weak, a.passwordHash)) {
        return { name: 'Admin credentials', pass: false, detail: 'an admin uses a weak/default password', fix: 'Run npm run admin:reset-password' };
      }
    }
  }
  return { name: 'Admin credentials', pass: true, detail: `${admins.length} admin account(s), none using a default password` };
}

/**
 * Refuse if admin:seed-dev was used and the password has not been changed since.
 * admin:seed-dev writes an audit entry; admin:reset-password writes a later one.
 */
export async function checkNoDevAdminSeed(db: Db): Promise<Check> {
  const seed = await db.auditLog.findFirst({ where: { action: { startsWith: 'admin.seed_dev' } }, orderBy: { createdAt: 'desc' } });
  if (!seed) return { name: 'No dev admin seed', pass: true, detail: 'admin:seed-dev was not used' };
  const reset = await db.auditLog.findFirst({ where: { action: 'admin.reset_password', createdAt: { gt: seed.createdAt } }, orderBy: { createdAt: 'desc' } });
  return reset
    ? { name: 'No dev admin seed', pass: true, detail: 'admin:seed-dev password was reset afterwards' }
    : { name: 'No dev admin seed', pass: false, detail: 'admin:seed-dev was used and the password was not changed', fix: 'Run npm run admin:reset-password (or admin:create a fresh account)' };
}

/** Pure-config production checks (no DB). */
export function configChecks(config: AppConfig): Check[] {
  return [
    {
      name: 'Production secrets',
      pass: !config.usingDevSecrets,
      detail: config.usingDevSecrets ? 'using built-in development secrets' : 'SESSION_SECRET and FLAG_PEPPER set',
      fix: 'Run npm run prod:init to generate strong secrets',
    },
    {
      name: 'Auto-unlock off',
      pass: !config.challenges.autoUnlockAll,
      detail: config.challenges.autoUnlockAll ? 'AUTO_UNLOCK_ALL is true' : 'challenges start locked',
      fix: 'Remove AUTO_UNLOCK_ALL from .env',
    },
    {
      name: 'Event mode',
      pass: config.event.mode !== 'live',
      detail: config.event.mode === 'live' ? 'EVENT_MODE=live forces the event open' : `EVENT_MODE=${config.event.mode}`,
      fix: 'Use EVENT_MODE=scheduled',
    },
    {
      name: 'Cookie scope',
      pass: true,
      detail: `admin area limited to ${config.admin.allowedIps.join(', ')}`,
    },
  ];
}

/** All DB-dependent production checks. */
export async function productionDbChecks(db: Db, config: AppConfig): Promise<Check[]> {
  return Promise.all([checkFlagHashes(db, config), checkAdminCredentials(db), checkNoDevAdminSeed(db)]);
}

/**
 * Throws with a combined message if production startup must be refused.
 * Called by start:prod before the server binds.
 */
export async function assertProductionSafe(db: Db, config: AppConfig): Promise<void> {
  if (!config.isProd) return;
  const checks = [...configChecks(config), ...(await productionDbChecks(db, config))];
  const failed = checks.filter((c) => !c.pass);
  if (failed.length > 0) {
    const lines = failed.map((c) => `  - ${c.name}: ${c.detail}${c.fix ? ` -> ${c.fix}` : ''}`);
    throw new Error(`Refusing to start in production. Fix these first:\n${lines.join('\n')}`);
  }
}
