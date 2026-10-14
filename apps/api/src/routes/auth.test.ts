import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { sha256 } from '../lib/crypto';
import { addAdmin, addUser, adminClient, client, resetDb, seedTeams, testApp, testDb } from '../test-utils';

const db = testDb();

beforeEach(async () => {
  await resetDb(db);
  await seedTeams(db);
});

describe('POST /api/auth/login (open join)', () => {
  it('creates a player on first login and sets a hardened session cookie', async () => {
    const { app } = testApp();
    const c = await client(app);
    const res = await c.login('Ava Stone', 'z3r0d4y');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Ava Stone', role: 'player', team: { id: 'z3r0d4y', name: 'Z3R0D4Y' } });
    expect(await db.user.count()).toBe(1);

    const setCookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const cookie = setCookies.find((c) => c.startsWith('cydemic_ctf_sid='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    // Only the hash of the token is stored.
    const token = decodeURIComponent(cookie.split(';')[0]!.split('=')[1]!);
    expect(await db.session.findUnique({ where: { id: token } })).toBeNull();
    expect(await db.session.findUnique({ where: { id: sha256(token) } })).not.toBeNull();
  });

  it('records the creating IP for later admin monitoring', async () => {
    const { app } = testApp();
    await (await client(app)).login('Ava Stone', 'z3r0d4y');
    const user = await db.user.findFirstOrThrow();
    expect(user.createdIp).toBeTruthy();
  });

  it('signs the same name back into the same account (same team)', async () => {
    const { app } = testApp();
    const first = await (await client(app)).login('Ava Stone', 'z3r0d4y');
    const second = await (await client(app)).login('ava  STONE', 'z3r0d4y');
    expect(second.status).toBe(200);
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(await db.user.count()).toBe(1);
  });

  it('treats case, spacing and accents as the same name', async () => {
    const { app } = testApp();
    await (await client(app)).login('Zoe Laurent', 'z3r0d4y');
    const again = await (await client(app)).login('  zoë   laurent ', 'z3r0d4y');
    expect(again.status).toBe(200);
    expect(await db.user.count()).toBe(1);
  });

  it('rejects the same name on a different team with a clear message', async () => {
    const { app } = testApp();
    await (await client(app)).login('Ava Stone', 'z3r0d4y');
    const res = await (await client(app)).login('ava stone', 'n0-tr4c3');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DIFFERENT_TEAM');
    expect(res.body.error.message).toMatch(/already registered with another team/i);
    expect(await db.user.count()).toBe(1);
  });

  it('does not let an admin name be used to sign in here', async () => {
    await addUser(db, 'Admin Person', 'z3r0d4y', 'admin');
    const { app } = testApp();
    const res = await (await client(app)).login('admin person', 'z3r0d4y');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_UNAVAILABLE');
    // No player account was created for the admin name.
    expect(await db.user.count({ where: { role: 'player' } })).toBe(0);
  });

  it('rejects invalid name characters before creating anything', async () => {
    const { app } = testApp();
    const res = await (await client(app)).login('player_01', 'z3r0d4y');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(await db.user.count()).toBe(0);
  });

  it('rejects an unknown team', async () => {
    const { app } = testApp();
    const res = await (await client(app)).login('Ava Stone', 'no-such-team');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNKNOWN_TEAM');
  });

  it('has no sign-up or registration endpoints', async () => {
    const { app } = testApp();
    for (const path of ['/api/auth/register', '/api/auth/signup', '/api/users', '/api/players']) {
      expect((await (await client(app)).post(path, { name: 'X Y', teamId: 'z3r0d4y' })).status).toBe(404);
    }
  });
});

describe('team capacity and new-player limits', () => {
  it('enforces MAX_PLAYERS_PER_TEAM when set', async () => {
    const { app } = testApp({ MAX_PLAYERS_PER_TEAM: '1' });
    expect((await (await client(app)).login('First Player', 'z3r0d4y')).status).toBe(200);
    const res = await (await client(app)).login('Second Player', 'z3r0d4y');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEAM_FULL');
    // A different team is still open.
    expect((await (await client(app)).login('Second Player', 'n0-tr4c3')).status).toBe(200);
  });

  it('rate-limits new accounts per IP but still lets existing players return', async () => {
    const { app } = testApp({ NEW_PLAYERS_PER_IP: '2' });
    const c1 = await client(app);
    expect((await c1.login('Alpha One', 'z3r0d4y')).status).toBe(200);
    expect((await (await client(app)).login('Beta Two', 'z3r0d4y')).status).toBe(200);
    const third = await (await client(app)).login('Gamma Three', 'z3r0d4y');
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('TOO_MANY_NEW_PLAYERS');
    // An already-created player can still sign in.
    expect((await c1.login('Alpha One', 'z3r0d4y')).status).toBe(200);
  });

  it('can disable the new-player IP limit', async () => {
    const { app } = testApp({ NEW_PLAYERS_PER_IP: '1', NEW_PLAYER_IP_LIMIT: 'false' });
    const c = await client(app);
    expect((await c.login('One Name', 'z3r0d4y')).status).toBe(200);
    expect((await c.login('Two Name', 'z3r0d4y')).status).toBe(200);
    expect((await c.login('Three Name', 'z3r0d4y')).status).toBe(200);
  });
});

describe('login cooldown', () => {
  it('locks for at most COOLDOWN_SECONDS after repeated rejected attempts', async () => {
    await addUser(db, 'Ava Stone', 'z3r0d4y'); // exists on z3r0d4y
    const { app } = testApp({ LOGIN_MAX_FAILURES: '3', COOLDOWN_SECONDS: '30' });
    const c = await client(app);
    // Repeatedly try the wrong team.
    expect((await c.login('Ava Stone', 'n0-tr4c3')).status).toBe(409);
    expect((await c.login('Ava Stone', 'n0-tr4c3')).status).toBe(409);
    const locked = await c.login('Ava Stone', 'n0-tr4c3');
    expect(locked.status).toBe(429);
    expect(locked.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(locked.body.error.details.retryAfterSeconds).toBeLessThanOrEqual(30);
  });
});

describe('CSRF protection', () => {
  it('rejects state-changing requests without a valid token', async () => {
    const { app } = testApp();
    const agent = request.agent(app);
    await agent.get('/api/auth/session');
    const missing = await agent.post('/api/auth/login').send({ name: 'Ava Stone', teamId: 'z3r0d4y' });
    const forged = await agent.post('/api/auth/login').set('X-CSRF-Token', 'forged').send({ name: 'Ava Stone', teamId: 'z3r0d4y' });
    expect(missing.status).toBe(403);
    expect(forged.status).toBe(403);
    expect(missing.body.error.code).toBe('CSRF_FAILED');
  });

  it('rejects a cross-origin state-changing request even with a token', async () => {
    const { app } = testApp();
    const c = await client(app);
    const res = await c.agent
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', c.csrf)
      .send({ name: 'Ava Stone', teamId: 'z3r0d4y' });
    expect(res.status).toBe(403);
  });
});

describe('session lifecycle', () => {
  it('reflects login and logout', async () => {
    const { app } = testApp();
    const c = await client(app);
    expect((await c.agent.get('/api/auth/session')).body.user).toBeNull();
    await c.login('Ava Stone', 'z3r0d4y');
    expect((await c.agent.get('/api/auth/session')).body.user.name).toBe('Ava Stone');
    expect((await c.post('/api/auth/logout')).status).toBe(200);
    expect((await c.agent.get('/api/auth/session')).body.user).toBeNull();
    expect(await db.session.count()).toBe(0);
  });

  it('ignores expired sessions', async () => {
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await c.agent.get('/api/me')).status).toBe(401);
  });
});

describe('GET /api/me', () => {
  it('requires a session', async () => {
    const { app } = testApp();
    expect((await request(app).get('/api/me')).status).toBe(401);
  });

  it('returns the player, team badge path and empty stats', async () => {
    const { app } = testApp();
    const c = await client(app);
    await c.login('Ava Stone', 'z3r0d4y');
    const res = await c.agent.get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body.user.team.avatar).toBe('/avatars/z3r0d4y.png');
    expect(res.body.stats).toEqual({ rank: null, score: 0, flagsCaptured: 0, totalChallenges: 0 });
  });
});

describe('admin guard', () => {
  it('rejects anonymous users and players, allows signed-in admins', async () => {
    const { app } = testApp();
    // No admin session.
    expect((await request(app).get('/api/admin/ping')).status).toBe(401);

    // A player session is not an admin session.
    const player = await client(app);
    await player.login('Ava Stone', 'z3r0d4y');
    expect((await player.agent.get('/api/admin/ping')).status).toBe(401);

    // A real admin account signs in and is allowed.
    await addAdmin(db, 'organizer', 'correct horse battery');
    const admin = await adminClient(app);
    await admin.login('organizer', 'correct horse battery');
    const res = await admin.get('/api/admin/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, admin: 'organizer', role: 'admin' });
  });
});

describe('public data', () => {
  it('lists teams with badge paths', async () => {
    const { app } = testApp();
    const res = await request(app).get('/api/teams');
    expect(res.body.map((t: { name: string }) => t.name)).toEqual(['N0_TR4C3', 'Z3R0D4Y']);
    expect(res.body[0]).toEqual({ id: 'n0-tr4c3', name: 'N0_TR4C3', avatar: '/avatars/n0-tr4c3.png', tagline: '' });
  });
});
