import { beforeEach, describe, expect, it } from 'vitest';
import { hashFlag } from '../../services/flags';
import { addAdmin, addUser, adminClient, client, resetDb, seedEvent, seedTeams, testApp, testConfig, testDb } from '../../test-utils';

const db = testDb();
const PEPPER = testConfig().flagPepper;

async function admin(app: ReturnType<typeof testApp>['app'], role: 'admin' | 'viewer' = 'admin') {
  const username = role === 'admin' ? 'organizer' : 'observer';
  await addAdmin(db, username, 'correct horse battery', role);
  const c = await adminClient(app);
  await c.login(username, 'correct horse battery');
  return c;
}

async function addChallenge(id: string, flag: string, points = 100) {
  const { salt, hash } = hashFlag(PEPPER, flag);
  return db.challenge.create({
    data: { id, title: id, description: 'd', category: 'WEB', points, flagHash: hash, flagSalt: salt, released: true },
  });
}

beforeEach(async () => {
  await resetDb(db);
  await seedTeams(db);
  await seedEvent(db, 'live');
});

describe('admin auth & lockout', () => {
  it('locks out after too many failed logins', async () => {
    const { app } = testApp();
    await addAdmin(db, 'organizer', 'correct horse battery');
    const c = await adminClient(app);
    for (let i = 0; i < 5; i++) {
      const r = await c.login('organizer', 'wrong');
      expect(r.status).toBe(401);
    }
    const locked = await c.login('organizer', 'correct horse battery');
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('LOCKED_OUT');
  });

  it('a disabled account cannot sign in', async () => {
    const { app } = testApp();
    const acct = await addAdmin(db, 'organizer', 'correct horse battery');
    await db.adminAccount.update({ where: { id: acct.id }, data: { disabled: true } });
    const c = await adminClient(app);
    expect((await c.login('organizer', 'correct horse battery')).status).toBe(401);
  });

  it('matches the username case-insensitively and trims spaces', async () => {
    const { app } = testApp();
    await addAdmin(db, 'Laiba Asad', 'CTF@cydemic');
    for (const typed of ['Laiba Asad', 'LAIBA ASAD', '  laiba asad  ']) {
      const c = await adminClient(app);
      const r = await c.login(typed, 'CTF@cydemic');
      expect(r.status, `login with "${typed}"`).toBe(200);
      expect(r.body.admin).toMatchObject({ username: 'Laiba Asad', role: 'admin' });
    }
  });

  it('a wrong password returns a specific LOGIN_FAILED code', async () => {
    const { app } = testApp();
    await addAdmin(db, 'organizer', 'correct horse battery');
    const c = await adminClient(app);
    const r = await c.login('organizer', 'nope');
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('LOGIN_FAILED');
  });

  it('recovers after the lockout window (a fresh process clears the in-memory lockout)', async () => {
    const first = testApp();
    await addAdmin(db, 'organizer', 'correct horse battery');
    const c1 = await adminClient(first.app);
    for (let i = 0; i < 5; i++) await c1.login('organizer', 'wrong');
    expect((await c1.login('organizer', 'correct horse battery')).status).toBe(429);
    // Restarting the API resets the lockout; a new app instance models that.
    const second = testApp();
    const c2 = await adminClient(second.app);
    expect((await c2.login('organizer', 'correct horse battery')).status).toBe(200);
  });
});

describe('shared event clock', () => {
  it('starts once (idempotent, concurrency-safe) and a repeat start does not move the clock', async () => {
    const { app } = testApp();
    await seedEvent(db, 'waiting');
    const a = await admin(app);
    const [r1, r2] = await Promise.all([a.post('/api/admin/event/start'), a.post('/api/admin/event/start')]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const ev = await db.event.findUniqueOrThrow({ where: { id: 'main' } });
    expect(ev.status).toBe('live');
    expect(ev.startedAt).not.toBeNull();
    const startedAt = ev.startedAt!.getTime();
    await a.post('/api/admin/event/start');
    const ev2 = await db.event.findUniqueOrThrow({ where: { id: 'main' } });
    expect(ev2.startedAt!.getTime()).toBe(startedAt);
  });

  it('pause freezes remaining; resume continues; extend adds time', async () => {
    const { app } = testApp();
    await seedEvent(db, 'waiting');
    const a = await admin(app);
    await a.post('/api/admin/event/start');
    const paused = await a.post('/api/admin/event/pause');
    expect(paused.body.status).toBe('paused');
    const frozen = paused.body.remainingMs as number;
    await new Promise((r) => setTimeout(r, 1100));
    const still = await a.get('/api/admin/event');
    expect(still.body.remainingMs).toBe(frozen); // did not tick down while paused
    const resumed = await a.post('/api/admin/event/resume');
    expect(resumed.body.status).toBe('live');
    const extended = await a.post('/api/admin/event/extend', { minutes: 5 });
    expect(extended.body.remainingMs).toBeGreaterThan(frozen);
  });

  it('shows the same shared remaining time regardless of when a player joins or re-logs in', async () => {
    const { app } = testApp();
    await seedEvent(db, 'waiting');
    const a = await admin(app);
    await a.post('/api/admin/event/start');

    const p1 = await client(app);
    await p1.login('Early Bird', 'z3r0d4y');
    const e1 = await p1.agent.get('/api/event');
    expect(e1.body.remainingMs).toBeLessThanOrEqual(60 * 60_000);
    expect(e1.body.remainingMs).toBeGreaterThan(60 * 60_000 - 15_000);

    await p1.post('/api/auth/logout');
    const p2 = await client(app);
    await p2.login('Early Bird', 'z3r0d4y');
    const e2 = await p2.agent.get('/api/event');
    expect(Math.abs((e1.body.remainingMs as number) - (e2.body.remainingMs as number))).toBeLessThan(3_000);
  });

  it('rejects submissions after the clock runs out (checked on the server)', async () => {
    const { app } = testApp();
    await addChallenge('web1', 'CYFLAG-win');
    const player = await client(app);
    await player.login('Late Player', 'z3r0d4y');
    // Force the live clock to be already over.
    await db.event.update({ where: { id: 'main' }, data: { status: 'live', startedAt: new Date(Date.now() - 3_600_000), endsAt: new Date(Date.now() - 1_000) } });
    const r = await player.post('/api/challenges/web1/submit', { flag: 'CYFLAG-win' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('SUBMISSION_CLOSED');
  });

  it('waiting players are told the event has not started', async () => {
    const { app } = testApp();
    await seedEvent(db, 'waiting');
    const anon = await client(app);
    const ev = await anon.agent.get('/api/event');
    expect(ev.body.status).toBe('waiting');
    expect(ev.body.phase).toBe('upcoming');
  });
});

describe('authorization matrix', () => {
  it('viewers can read but not mutate; admins can do both', async () => {
    const { app } = testApp();
    const viewer = await admin(app, 'viewer');
    expect((await viewer.get('/api/admin/overview')).status).toBe(200);
    // viewer mutation rejected with 403 (role), not 401
    expect((await viewer.put('/api/admin/event', { mode: 'paused' })).status).toBe(403);

    const organizer = await admin(app, 'admin');
    expect((await organizer.put('/api/admin/event', { mode: 'paused' })).status).toBe(200);
  });
});

describe('players: ban / rename / move', () => {
  it('bans a player, ending their session and blocking re-login', async () => {
    const { app } = testApp();
    const player = await client(app);
    await player.login('Ava Stone', 'z3r0d4y');
    const user = await db.user.findFirstOrThrow({ where: { role: 'player' } });

    const organizer = await admin(app);
    expect((await organizer.post(`/api/admin/players/${user.id}/ban`, { reason: 'cheating' })).status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe('banned');
    // session was deleted
    expect((await player.agent.get('/api/me')).status).toBe(401);
    // re-login is refused with the banned message
    const relog = await player.login('Ava Stone', 'z3r0d4y');
    expect(relog.status).toBe(403);
    expect(relog.body.error.code).toBe('BANNED');
  });

  it('renames a player and rejects a name clash', async () => {
    const { app } = testApp();
    const a = await addUser(db, 'Alpha', 'z3r0d4y');
    const b = await addUser(db, 'Bravo', 'z3r0d4y');
    const organizer = await admin(app);
    expect((await organizer.post(`/api/admin/players/${a.id}/rename`, { name: 'Alpha Prime' })).status).toBe(200);
    const clash = await organizer.post(`/api/admin/players/${b.id}/rename`, { name: 'Alpha Prime' });
    expect(clash.status).toBe(409);
  });

  it('moves a player to another team', async () => {
    const { app } = testApp();
    const p = await addUser(db, 'Alpha', 'z3r0d4y');
    const organizer = await admin(app);
    expect((await organizer.post(`/api/admin/players/${p.id}/move`, { teamId: 'n0-tr4c3' })).status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: p.id } })).teamId).toBe('n0-tr4c3');
  });

  it('deletes a player only when the typed name matches', async () => {
    const { app } = testApp();
    const p = await addUser(db, 'Alpha', 'z3r0d4y');
    const organizer = await admin(app);
    expect((await organizer.del(`/api/admin/players/${p.id}`, { confirmName: 'Wrong' })).status).toBe(400);
    expect((await organizer.del(`/api/admin/players/${p.id}`, { confirmName: 'Alpha' })).status).toBe(200);
    expect(await db.user.findUnique({ where: { id: p.id } })).toBeNull();
  });
});

describe('leaderboard adjustments & recompute', () => {
  it('applies an adjustment that moves the derived score', async () => {
    const { app } = testApp();
    await addChallenge('web1', 'CYFLAG-win', 100);
    const p = await addUser(db, 'Alpha', 'z3r0d4y');
    await db.solve.create({ data: { userId: p.id, challengeId: 'web1', points: 100 } });

    const organizer = await admin(app);
    expect((await organizer.post('/api/admin/leaderboard/adjustments', { userId: p.id, points: 50, reason: 'bonus' })).status).toBe(200);
    const board = await organizer.get('/api/admin/leaderboard');
    expect(board.body.players[0]).toMatchObject({ name: 'Alpha', score: 150, solvePoints: 100, adjustmentPoints: 50 });

    const recompute = await organizer.get('/api/admin/leaderboard/recompute');
    expect(recompute.status).toBe(200);
    expect(recompute.body.diff).toEqual([]);
  });
});

describe('freeze', () => {
  it('freezes the player leaderboard to a snapshot', async () => {
    const { app } = testApp();
    const organizer = await admin(app);
    expect((await organizer.post('/api/admin/event/freeze', { frozen: true })).status).toBe(200);
    const player = await client(app);
    await player.login('Ava Stone', 'z3r0d4y');
    const board = await player.agent.get('/api/leaderboard');
    expect(board.status).toBe(200);
    expect(board.body.frozen).toBe(true);
  });
});

describe('signup lock', () => {
  it('blocks new players but still admits existing ones', async () => {
    const { app } = testApp();
    const organizer = await admin(app);
    expect((await organizer.put('/api/admin/settings', { signupLocked: true })).status).toBe(200);

    // a brand-new name is refused
    const fresh = await client(app);
    const blocked = await fresh.login('New Person', 'z3r0d4y');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('SIGNUP_LOCKED');

    // an existing player can still sign in
    await addUser(db, 'Existing One', 'z3r0d4y');
    const back = await client(app);
    expect((await back.login('Existing One', 'z3r0d4y')).status).toBe(200);
  });
});

describe('maintenance', () => {
  it('503s player data routes while leaving the admin area up', async () => {
    const { app } = testApp();
    const organizer = await admin(app);
    expect((await organizer.post('/api/admin/event/maintenance', { maintenance: true })).status).toBe(200);

    const player = await client(app);
    await player.login('Ava Stone', 'z3r0d4y');
    const me = await player.agent.get('/api/me');
    expect(me.status).toBe(503);
    expect(me.body.error.code).toBe('MAINTENANCE');

    // admin still works
    expect((await organizer.get('/api/admin/overview')).status).toBe(200);
  });
});

describe('announcements', () => {
  it('shows the newest active announcement on the player state endpoint', async () => {
    const { app } = testApp();
    const organizer = await admin(app);
    const created = await organizer.post('/api/admin/announcements', { title: 'Hint drop', body: 'Check mission 3.' });
    expect(created.status).toBe(200);

    const player = await client(app);
    const state = await player.agent.get('/api/state');
    expect(state.status).toBe(200);
    expect(state.body.announcement).toMatchObject({ title: 'Hint drop', body: 'Check mission 3.' });

    // hiding it removes the banner
    const list = await organizer.get('/api/admin/announcements');
    const id = list.body.announcements[0].id;
    await organizer.patch(`/api/admin/announcements/${id}`, { active: false });
    const after = await player.agent.get('/api/state');
    expect(after.body.announcement).toBeNull();
  });
});

describe('CSV export', () => {
  it('exports submissions as CSV with a header row', async () => {
    const { app } = testApp();
    await addChallenge('web1', 'CYFLAG-win', 100);
    const p = await addUser(db, 'Alpha', 'z3r0d4y');
    await db.submission.create({ data: { userId: p.id, challengeId: 'web1', correct: false, ip: '127.0.0.1', text: 'guess' } });

    const organizer = await admin(app);
    const res = await organizer.get('/api/admin/submissions/export.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\r\n')[0]).toContain('time,player,team,mission,result,ip,wrong_text,matches_mission');
    expect(res.text).toContain('Alpha');
  });
});

describe('audit log', () => {
  it('records admin actions and lists them', async () => {
    const { app } = testApp();
    const organizer = await admin(app);
    await organizer.put('/api/admin/event', { mode: 'paused' });
    const audit = await organizer.get('/api/admin/audit');
    const actions = audit.body.items.map((a: { action: string }) => a.action);
    expect(actions).toContain('event.update');
    expect(actions).toContain('admin.login');
  });
});
