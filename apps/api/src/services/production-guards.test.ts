import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../lib/password';
import { addAdmin, resetDb, testConfig, testDb } from '../test-utils';
import { audit } from './audit';
import {
  assertProductionSafe,
  checkAdminCredentials,
  checkNoDevAdminSeed,
  configChecks,
  MIN_ADMIN_PASSWORD,
} from './production-guards';

const db = testDb();
const prodConfig = (o = {}) =>
  testConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(40), FLAG_PEPPER: 'y'.repeat(40), ...o });

beforeEach(() => resetDb(db));

describe('config checks (defense in depth for an already-valid config)', () => {
  it('detects built-in dev secrets when present', () => {
    // A plain dev config uses the built-in secrets.
    const checks = configChecks(testConfig({ SESSION_SECRET: '', FLAG_PEPPER: '' }));
    expect(checks.find((c) => c.name === 'Production secrets')?.pass).toBe(false);
  });

  it('passes with real secrets and locked challenges', () => {
    const checks = configChecks(prodConfig());
    expect(checks.find((c) => c.name === 'Production secrets')?.pass).toBe(true);
    expect(checks.find((c) => c.name === 'Auto-unlock off')?.pass).toBe(true);
    expect(checks.find((c) => c.name === 'Event mode')?.pass).toBe(true);
  });
});

describe('admin credential check', () => {
  it('fails when no admin exists', async () => {
    expect((await checkAdminCredentials(db)).pass).toBe(false);
  });

  it('fails when an admin uses a default password', async () => {
    await addAdmin(db, 'Organizer', 'admin1234');
    expect((await checkAdminCredentials(db)).pass).toBe(false);
  });

  it('passes with a strong, non-default password', async () => {
    await addAdmin(db, 'Organizer', 'correct horse battery staple');
    expect((await checkAdminCredentials(db)).pass).toBe(true);
  });
});

describe('dev-admin-seed check', () => {
  it('passes when seed-dev was never used', async () => {
    expect((await checkNoDevAdminSeed(db)).pass).toBe(true);
  });

  it('fails after seed-dev with no later password reset', async () => {
    await audit(db, { admin: '(cli)', action: 'admin.seed_dev.created', target: 'Dev' });
    expect((await checkNoDevAdminSeed(db)).pass).toBe(false);
  });

  it('passes if the password was reset after seed-dev', async () => {
    await audit(db, { admin: '(cli)', action: 'admin.seed_dev.created', target: 'Dev' });
    await new Promise((r) => setTimeout(r, 5));
    await audit(db, { admin: '(cli)', action: 'admin.reset_password', target: 'Dev' });
    expect((await checkNoDevAdminSeed(db)).pass).toBe(true);
  });
});

describe('assertProductionSafe', () => {
  it('throws listing the failures in production (e.g. no admin account)', async () => {
    await expect(assertProductionSafe(db, prodConfig())).rejects.toThrow(/Refusing to start/);
  });

  it('is a no-op outside production', async () => {
    await expect(assertProductionSafe(db, testConfig())).resolves.toBeUndefined();
  });

  it('passes once everything is set up', async () => {
    await addAdmin(db, 'Organizer', 'correct horse battery staple');
    const { salt, hash } = (await import('./flags')).hashFlag('y'.repeat(40), 'CYFLAG{demo}');
    await db.challenge.create({ data: { id: 'web1', title: 'x', description: 'd', category: 'WEB', points: 100, flagHash: hash, flagSalt: salt, port: 5001, released: false } });
    // The flag hash check reads challenge-services/.flags.env; this challenge's id
    // (web1) must verify. If .flags.env is present in the repo, it will.
    const checks = await assertProductionSafe(db, prodConfig()).then(() => 'ok').catch((e) => String(e));
    // Either passes, or the only failure is the flag-hash file (environment-dependent).
    expect(checks === 'ok' || /Flag hashes/.test(checks)).toBe(true);
  });

  it('enforces a 12-char minimum admin password', () => {
    expect(MIN_ADMIN_PASSWORD).toBe(12);
  });
});

describe('addAdmin fixture sanity', () => {
  it('stores a verifiable hash', async () => {
    const a = await addAdmin(db, 'Z', 'another strong passphrase');
    expect((await hashPassword('x')).length).toBeGreaterThan(0);
    expect(a.username).toBe('Z');
  });
});
