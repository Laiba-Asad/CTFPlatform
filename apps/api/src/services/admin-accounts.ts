import type { AppConfig } from '../config';
import type { Db } from '../lib/db';
import { hashPassword } from '../lib/password';

export type SeedResult = 'created' | 'updated' | 'skipped';

/**
 * Orchestrate the dev-admin seed from config: refuse in production, require the
 * DEV_ADMIN_* credentials, then create/update the account. Throws a readable
 * error on misuse. Returns the result and the resolved username.
 */
export async function devAdminSeed(db: Db, config: AppConfig, opts: { ifNone?: boolean } = {}) {
  if (config.isProd) {
    throw new Error('admin:seed-dev is for development only. In production use `npm run admin:create`.');
  }
  const { username, password } = config.devAdmin;
  if (!username || !password) {
    throw new Error('Set DEV_ADMIN_USERNAME and DEV_ADMIN_PASSWORD in your .env (git-ignored) first.');
  }
  return seedDevAdmin(db, { username, password, ifNone: opts.ifNone });
}

/**
 * Create or update a development admin from DEV_ADMIN_* credentials. Username
 * matching is case-insensitive and trimmed; the password bypasses the normal
 * length policy on purpose (dev only). With `ifNone`, does nothing when any
 * admin already exists (so it never overwrites a real account). The password is
 * only ever stored as a slow scrypt hash.
 */
export async function seedDevAdmin(
  db: Db,
  opts: { username: string; password: string; ifNone?: boolean },
): Promise<{ result: SeedResult; username: string }> {
  const username = opts.username.trim();
  if (opts.ifNone && (await db.adminAccount.count()) > 0) {
    return { result: 'skipped', username };
  }
  const usernameKey = username.toLowerCase();
  const passwordHash = await hashPassword(opts.password);
  const existing = await db.adminAccount.findUnique({ where: { usernameKey } });
  if (existing) {
    await db.adminAccount.update({ where: { id: existing.id }, data: { username, passwordHash, role: 'admin', disabled: false } });
    return { result: 'updated', username };
  }
  await db.adminAccount.create({ data: { username, usernameKey, passwordHash, role: 'admin' } });
  return { result: 'created', username };
}
