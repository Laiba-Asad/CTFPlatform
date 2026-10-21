import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashFlag } from '../services/flags';
import { addAdmin, addUser, adminClient, client, resetDb, seedEvent, seedTeams, testApp, testConfig, testDb } from '../test-utils';

const db = testDb();
const PEPPER = testConfig().flagPepper;

/** An admin client signed in with a real AdminAccount. */
async function adminAgent(app: ReturnType<typeof testApp>['app']) {
  await addAdmin(db, 'organizer', 'correct horse battery');
  const admin = await adminClient(app);
  await admin.login('organizer', 'correct horse battery');
  return admin;
}

beforeEach(async () => {
  await resetDb(db);
  await seedTeams(db);
  await seedEvent(db, 'live');
  const { salt, hash } = hashFlag(PEPPER, 'CYFLAG-win');
  await db.challenge.create({ data: { id: 'web1', title: 'web1', description: 'd', category: 'WEB', points: 100, flagHash: hash, flagSalt: salt, port: 5001, released: true } });
  await addUser(db, 'Ava Stone', 'z3r0d4y');
});

describe('GET /api/event', () => {
  it('returns mode, phase and the server clock', async () => {
    const res = await request(testApp().app).get('/api/event');
    expect(res.body).toMatchObject({ mode: 'live', phase: 'live', status: 'live' });
    expect(res.body.remainingMs).toBeGreaterThan(0);
    expect(Math.abs(res.body.serverNow - Date.now())).toBeLessThan(5000);
  });
});

describe('admin event control', () => {
  it('requires an admin and changes the mode (the event state machine in one source)', async () => {
    const { app } = testApp();
    // no admin session (even with a valid admin CSRF token) is rejected
    const anon = await adminClient(app);
    expect((await anon.put('/api/admin/event', { mode: 'paused' })).status).toBe(401);

    const admin = await adminAgent(app);
    const res = await admin.put('/api/admin/event', { mode: 'paused' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mode: 'paused', phase: 'paused' });
    expect((await db.event.findUniqueOrThrow({ where: { id: 'main' } })).mode).toBe('paused');
  });

  it('closes submissions when paused or ended, and reopens when live', async () => {
    const { app } = testApp();
    const admin = await adminAgent(app);
    const setMode = (mode: string) => admin.put('/api/admin/event', { mode });

    const player = await client(app);
    await player.login('Ava Stone', 'z3r0d4y');

    await setMode('paused');
    let r = await player.post('/api/challenges/web1/submit', { flag: 'CYFLAG-win' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('SUBMISSION_CLOSED');

    await setMode('ended');
    r = await player.post('/api/challenges/web1/submit', { flag: 'CYFLAG-win' });
    expect(r.status).toBe(403);

    await setMode('live');
    r = await player.post('/api/challenges/web1/submit', { flag: 'CYFLAG-win' });
    expect(r.body.outcome).toBe('correct');
  });
});

describe('GET /api/health', () => {
  it('reports database, event state and released challenges', async () => {
    const res = await request(testApp().app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
    expect(res.body.event).toMatchObject({ mode: 'live', phase: 'live' });
    expect(res.body.challenges).toEqual({ released: 1, total: 1, withService: 1, retiredInDatabase: [] });
    expect(res.body.services.supervising).toBe(false);
  });
});
