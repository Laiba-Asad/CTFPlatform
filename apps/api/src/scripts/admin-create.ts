/**
 * npm run admin:create [-- --username <name>] [-- --role admin|viewer]
 *
 * Creates an admin account for the organizer dashboard. The password is typed
 * interactively (never echoed, never logged, never passed on the command line)
 * and stored only as a slow scrypt hash. There is no default password.
 */
import { loadConfig } from '../config';
import { normalizeDatabaseUrl } from '../db-url';
import { createDb } from '../lib/db';
import { hashPassword } from '../lib/password';
import { audit } from '../services/audit';
import { promptLine, promptSecret, runScript } from './cli';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

runScript(async () => {
  const config = loadConfig();
  const db = createDb(normalizeDatabaseUrl(config.databaseUrl));
  try {
    const username = (argValue('--username') ?? (await promptLine('Admin username: '))).trim();
    if (username.length < 1 || username.length > 64) throw new Error('Username must be 1-64 characters.');

    const roleArg = (argValue('--role') ?? 'admin').toLowerCase();
    if (roleArg !== 'admin' && roleArg !== 'viewer') throw new Error('Role must be "admin" or "viewer".');

    const usernameKey = username.toLowerCase();
    if (await db.adminAccount.findUnique({ where: { usernameKey } })) {
      throw new Error(`An admin named "${username}" already exists. Use admin:reset-password to change its password.`);
    }

    const password = await promptSecret('Password (min 8 chars, not shown): ');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    const again = await promptSecret('Confirm password: ');
    if (password !== again) throw new Error('Passwords did not match. Nothing was created.');

    const account = await db.adminAccount.create({
      data: { username, usernameKey, role: roleArg, passwordHash: await hashPassword(password) },
    });
    await audit(db, { admin: '(cli)', action: 'admin.create', target: account.username, after: { role: roleArg } });
    console.log(`Created ${roleArg} account "${account.username}". It can now sign in at /admin.`);
  } finally {
    await db.$disconnect();
  }
});
