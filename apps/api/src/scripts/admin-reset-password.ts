/**
 * npm run admin:reset-password [-- --username <name>]
 *
 * Sets a new password for an existing admin account. The password is typed
 * interactively (never echoed, never logged, never passed on the command line)
 * and stored only as a slow scrypt hash. All of that admin's sessions are
 * invalidated so a stolen session cannot outlive the reset.
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
    const account = await db.adminAccount.findUnique({ where: { usernameKey: username.toLowerCase() } });
    if (!account) throw new Error(`No admin named "${username}". Use admin:create to make one.`);

    const password = await promptSecret('New password (min 8 chars, not shown): ');
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    const again = await promptSecret('Confirm new password: ');
    if (password !== again) throw new Error('Passwords did not match. Nothing was changed.');

    await db.adminAccount.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(password) } });
    const { count } = await db.adminSession.deleteMany({ where: { adminId: account.id } });
    await audit(db, { admin: '(cli)', action: 'admin.reset_password', target: account.username });
    console.log(`Password updated for "${account.username}". ${count} active session(s) were signed out.`);
  } finally {
    await db.$disconnect();
  }
});
