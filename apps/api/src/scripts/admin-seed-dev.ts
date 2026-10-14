/**
 * npm run admin:seed-dev   [-- --if-none]
 *
 * Development convenience: create or update the organizer account defined by
 * DEV_ADMIN_USERNAME / DEV_ADMIN_PASSWORD in the git-ignored .env, so you can
 * sign in to /admin without the interactive prompt. The password is read only
 * from the environment, stored only as a slow scrypt hash, and NEVER printed.
 *
 * - Refuses to run when NODE_ENV=production (use admin:create there).
 * - Username matching is case-insensitive and space-trimmed.
 * - The dev password bypasses the normal length policy on purpose (dev only).
 * - Idempotent: safe to run repeatedly.
 * - With --if-none it only seeds when no admin account exists yet (used by
 *   `npm run dev` so it never overwrites a real account you created).
 */
import { loadConfig } from '../config';
import { normalizeDatabaseUrl } from '../db-url';
import { createDb } from '../lib/db';
import { devAdminSeed } from '../services/admin-accounts';
import { audit } from '../services/audit';
import { hasFlag, runScript } from './cli';

runScript(async () => {
  const config = loadConfig();
  const db = createDb(normalizeDatabaseUrl(config.databaseUrl));
  try {
    const { result, username: name } = await devAdminSeed(db, config, { ifNone: hasFlag('--if-none') });
    if (result === 'skipped') {
      console.log('An admin account already exists; leaving it unchanged.');
      return;
    }
    await audit(db, { admin: '(cli)', action: `admin.seed_dev.${result}`, target: name });
    // Note: login lockout is in-memory per server process; it resets when the API restarts.
    console.log(`Admin '${name}' ready`);
  } finally {
    await db.$disconnect();
  }
});
