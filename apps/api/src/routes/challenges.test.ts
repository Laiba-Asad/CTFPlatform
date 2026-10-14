import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../lib/db';
import { hashFlag } from '../services/flags';
import { addAdmin, addUser, adminClient, client, resetDb, seedEvent, seedTeams, testApp, testConfig, testDb } from '../test-utils';

const db = testDb();
const PEPPER = testConfig().flagPepper;

/** Shared-clock status; 'upcoming' maps to the waiting (not-yet-started) state. */
async function setEvent(mode: 'live' | 'upcoming' | 'paused' | 'ended') {
  await seedEvent(db, mode === 'upcoming' ? 'waiting' : mode);
}

async function addChallenge(d: Db, over: Partial<{ id: string; number: number; flag: string; released: boolean; port: number | null; points: number }> = {}) {
  const id = over.id ?? 'web1';
  const { salt, hash } = hashFlag(PEPPER, over.flag ?? `CYFLAG-${id}`);
  return d.challenge.create({
    data: {
      id,
      number: over.number ?? 1,
      title: `Title ${id}`,
      description: `Describe ${id}`,
      category: 'WEB',
      difficulty: 2,
      points: over.points ?? 100,
      flagHash: hash,
      flagSalt: salt,
      port: over.port === undefined ? 5001 : over.port,
      released: over.released ?? true,
    },
  });
}

beforeEach(async () => {
  await resetDb(db);
  await seedTeams(db);
  await addUser(db, 'Ava Stone', 'z3r0d4y');
});

describe('GET /api/challenges', () => {
  it('requires a session', async () => {
    const { app } = testApp();
    expect((await (await client(app)).agent.get('/api/challenges')).status).toBe(401);
  });

  it('hides description and shows locked before the challenge is released', async () => {
    await setEvent('live');
    await addChallenge(db, { released: false });
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    const res = await c.agent.get('/api/challenges');
    expect(res.body.challenges[0]).toMatchObject({ state: 'locked', description: null, port: 5001 });
  });

  it('shows available with content when released and live', async () => {
    await setEvent('live');
    await addChallenge(db, { released: true });
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    const res = await c.agent.get('/api/challenges');
    expect(res.body.acceptingSubmissions).toBe(true);
    expect(res.body.challenges[0]).toMatchObject({ state: 'available', description: 'Describe web1' });
  });

  it('shows "opens at start" and hides content before the event starts', async () => {
    await setEvent('upcoming');
    await addChallenge(db, { released: true });
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    const res = await c.agent.get('/api/challenges');
    expect(res.body.acceptingSubmissions).toBe(false);
    expect(res.body.challenges[0].state).toBe('opens_at_start');
    expect(res.body.challenges[0].description).toBeNull();
  });

  it('shows "event ended" when the event has ended (read-only)', async () => {
    await setEvent('ended');
    await addChallenge(db, { released: true });
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    const res = await c.agent.get('/api/challenges');
    expect(res.body.acceptingSubmissions).toBe(false);
    expect(res.body.challenges[0].state).toBe('event_ended');
  });

  it('shows "paused" when the event is paused', async () => {
    await setEvent('paused');
    await addChallenge(db, { released: true });
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    const res = await c.agent.get('/api/challenges');
    expect(res.body.challenges[0].state).toBe('paused');
  });
});

describe('POST /api/challenges/:id/submit', () => {
  it('awards points for the correct flag once, then reports already solved', async () => {
    await setEvent('live');
    await addChallenge(db, { flag: 'CYFLAG-win', points: 250 });
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');

    const ok = await c.post('/api/challenges/web1/submit', { flag: 'CYFLAG-win' });
    expect(ok.body).toEqual({ outcome: 'correct', pointsAwarded: 250 });

    const again = await c.post('/api/challenges/web1/submit', { flag: 'CYFLAG-win' });
    expect(again.body.outcome).toBe('already_solved');

    expect(await db.solve.count({ where: { challengeId: 'web1' } })).toBe(1);
    const me = await c.agent.get('/api/me');
    expect(me.body.stats.score).toBe(250);
  });

  it('rejects a wrong flag and counts the attempt', async () => {
    await setEvent('live');
    await addChallenge(db, { flag: 'CYFLAG-win' });
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    const res = await c.post('/api/challenges/web1/submit', { flag: 'CYFLAG-nope' });
    expect(res.body).toMatchObject({ outcome: 'incorrect', attempts: 1 });
    expect(await db.solve.count()).toBe(0);
  });

  it('stores wrong-guess text for admin review but never the correct flag', async () => {
    await setEvent('live');
    await addChallenge(db, { flag: 'CYFLAG-win' });
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');

    // A wrong guess is kept (admins review these and detect flag reuse)...
    await c.post('/api/challenges/web1/submit', { flag: 'CYFLAG-secret-guess' });
    const wrong = await db.submission.findMany({ where: { correct: false } });
    expect(wrong).toHaveLength(1);
    expect(wrong[0]!.text).toBe('CYFLAG-secret-guess');

    // ...but a correct submission never persists the real flag value.
    await c.post('/api/challenges/web1/submit', { flag: 'CYFLAG-win' });
    const correct = await db.submission.findMany({ where: { correct: true } });
    expect(correct).toHaveLength(1);
    expect(correct[0]!.text).toBeNull();
    expect(JSON.stringify(correct)).not.toContain('CYFLAG-win');
  });

  it('refuses submissions when the event is not live', async () => {
    await setEvent('upcoming');
    await addChallenge(db, { released: true });
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    const res = await c.post('/api/challenges/web1/submit', { flag: 'CYFLAG-web1' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBMISSION_CLOSED');
  });

  it('cools down after too many wrong attempts, at most 30 seconds', async () => {
    await setEvent('live');
    await addChallenge(db, { flag: 'CYFLAG-win' });
    const { app } = testApp({ SUBMIT_LOCKOUT_FAILURES: '3', COOLDOWN_SECONDS: '30', SUBMIT_RATE_LIMIT_PER_MIN: '20' });
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    await c.post('/api/challenges/web1/submit', { flag: 'x' });
    await c.post('/api/challenges/web1/submit', { flag: 'x' });
    const locked = await c.post('/api/challenges/web1/submit', { flag: 'x' });
    expect(locked.status).toBe(429);
    expect(locked.body.error.details.retryAfterSeconds).toBeLessThanOrEqual(30);
  });

  it('rate-limits submissions per minute', async () => {
    await setEvent('live');
    await addChallenge(db, { flag: 'CYFLAG-win' });
    const { app } = testApp({ SUBMIT_RATE_LIMIT_PER_MIN: '3', SUBMIT_LOCKOUT_FAILURES: '99' });
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    for (let i = 0; i < 3; i++) await c.post('/api/challenges/web1/submit', { flag: 'x' });
    const limited = await c.post('/api/challenges/web1/submit', { flag: 'x' });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('GET /api/challenges/:id/attachment', () => {
  it('404s when the challenge has no capture and is blocked when not live', async () => {
    await setEvent('live');
    await addChallenge(db, { id: 'web1', released: true });
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    expect((await c.agent.get('/api/challenges/web1/attachment')).status).toBe(404);
  });
});

describe('admin challenge release', () => {
  it('toggles release and drives the supervisor; players cannot', async () => {
    await setEvent('live');
    await addChallenge(db, { id: 'web1', released: false, port: 5001 });
    const calls: string[] = [];
    const supervisor = {
      start: (cid: string) => void calls.push(`start:${cid}`),
      stop: (cid: string) => void calls.push(`stop:${cid}`),
      restart: (cid: string) => void calls.push(`restart:${cid}`),
      restartsOf: () => 0,
      isRunning: (cid: string) => calls.includes(`start:${cid}`) && !calls.includes(`stop:${cid}`),
      supervising: false,
      serviceStatus: () => 'down' as const,
      healthSummary: async () => ({ supervising: false, services: [] }),
    };
    const { config } = testApp();
    const { createApp } = await import('../app');
    const adminApp = createApp(config, { db, supervisor });

    // no admin session (even with a valid admin CSRF token) is rejected
    const anon = await adminClient(adminApp);
    expect((await anon.post('/api/admin/missions/web1/release', { released: true })).status).toBe(401);

    // real admin account
    await addAdmin(db, 'organizer', 'correct horse battery');
    const admin = await adminClient(adminApp);
    await admin.login('organizer', 'correct horse battery');

    const rel = await admin.post('/api/admin/missions/web1/release', { released: true });
    expect(rel.status).toBe(200);
    expect(rel.body).toMatchObject({ released: true });
    expect(calls).toContain('start:web1');
    expect((await db.challenge.findUnique({ where: { id: 'web1' } }))!.released).toBe(true);
  });
});
