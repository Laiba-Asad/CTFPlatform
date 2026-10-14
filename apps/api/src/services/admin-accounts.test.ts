import { beforeEach, describe, expect, it } from 'vitest';
import { verifyPassword } from '../lib/password';
import { resetDb, testConfig, testDb } from '../test-utils';
import { devAdminSeed, seedDevAdmin } from './admin-accounts';

const db = testDb();

beforeEach(async () => {
  await resetDb(db);
});

describe('seedDevAdmin', () => {
  it('creates then updates the same account (idempotent), hashing the password', async () => {
    const first = await seedDevAdmin(db, { username: 'Laiba Asad', password: 'CTF@cydemic' });
    expect(first.result).toBe('created');
    const again = await seedDevAdmin(db, { username: '  laiba asad ', password: 'newpass12' });
    expect(again.result).toBe('updated');
    expect(await db.adminAccount.count()).toBe(1);

    const acct = await db.adminAccount.findUniqueOrThrow({ where: { usernameKey: 'laiba asad' } });
    expect(acct.username).toBe('laiba asad'); // trimmed
    expect(acct.passwordHash).not.toContain('newpass12'); // stored as a hash
    expect(await verifyPassword('newpass12', acct.passwordHash)).toBe(true);
  });

  it('with ifNone, does nothing once any admin exists', async () => {
    await seedDevAdmin(db, { username: 'First', password: 'password1' });
    const skipped = await seedDevAdmin(db, { username: 'Second', password: 'password2', ifNone: true });
    expect(skipped.result).toBe('skipped');
    expect(await db.adminAccount.count()).toBe(1);
  });
});

describe('devAdminSeed (orchestration)', () => {
  it('refuses to run in production', async () => {
    const prod = testConfig({ NODE_ENV: 'production', DEV_ADMIN_USERNAME: 'x', DEV_ADMIN_PASSWORD: 'secret123' });
    await expect(devAdminSeed(db, prod)).rejects.toThrow(/development only/i);
    expect(await db.adminAccount.count()).toBe(0);
  });

  it('requires DEV_ADMIN_USERNAME and DEV_ADMIN_PASSWORD', async () => {
    const config = testConfig(); // no dev admin configured
    await expect(devAdminSeed(db, config)).rejects.toThrow(/DEV_ADMIN_USERNAME/);
  });

  it('seeds from config when the vars are present', async () => {
    const config = testConfig({ DEV_ADMIN_USERNAME: 'Laiba Asad', DEV_ADMIN_PASSWORD: 'CTF@cydemic' });
    const { result } = await devAdminSeed(db, config);
    expect(result).toBe('created');
    expect(await db.adminAccount.findUnique({ where: { usernameKey: 'laiba asad' } })).not.toBeNull();
  });
});
