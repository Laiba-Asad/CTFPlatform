import { nameKey } from '@cydemic/shared';
import request from 'supertest';
import { inject } from 'vitest';
import { createApp } from './app';
import { parseConfig, type AppConfig } from './config';
import { createDb, type Db } from './lib/db';
import { hashPassword } from './lib/password';

/** A config for tests: deterministic, silent, never reads the developer's .env. */
export function testConfig(overrides: NodeJS.ProcessEnv = {}): AppConfig {
  return parseConfig({
    NODE_ENV: 'test',
    SESSION_SECRET: 'test-session-secret-0123456789abcdef',
    FLAG_PEPPER: 'test-flag-pepper-0123456789abcdef0000',
    ALLOWED_ORIGINS: 'http://localhost:5173',
    ...overrides,
  });
}

let sharedDb: Db | undefined;
export function testDb(): Db {
  sharedDb ??= createDb(inject('databaseUrl'));
  return sharedDb;
}

export function testApp(overrides: NodeJS.ProcessEnv = {}) {
  const config = testConfig(overrides);
  const db = testDb();
  return { app: createApp(config, { db }), db, config };
}

/** Empty every table (children first). */
export async function resetDb(db: Db) {
  await db.$transaction([
    db.userAchievement.deleteMany(),
    db.achievement.deleteMany(),
    db.hintUnlock.deleteMany(),
    db.hint.deleteMany(),
    db.attachment.deleteMany(),
    db.submission.deleteMany(),
    db.solve.deleteMany(),
    db.scoreAdjustment.deleteMany(),
    db.challenge.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
    db.team.deleteMany(),
    db.event.deleteMany(),
    db.announcement.deleteMany(),
    db.adminSession.deleteMany(),
    db.adminAccount.deleteMany(),
    db.auditLog.deleteMany(),
    db.settings.deleteMany(),
  ]);
}

/** Seed the singleton event row in a given shared-clock status (default live). */
export async function seedEvent(db: Db, status: 'waiting' | 'live' | 'paused' | 'ended' = 'live') {
  const now = Date.now();
  const fields = {
    waiting: { status: 'waiting', startedAt: null, startsAt: new Date(now), endsAt: new Date(now + 3_600_000), pausedRemainingMs: null },
    live: { status: 'live', startedAt: new Date(now - 60_000), startsAt: new Date(now - 60_000), endsAt: new Date(now + 3_600_000), pausedRemainingMs: null },
    paused: { status: 'paused', startedAt: new Date(now - 60_000), startsAt: new Date(now - 60_000), endsAt: new Date(now + 3_600_000), pausedRemainingMs: 3_600_000 },
    ended: { status: 'ended', startedAt: new Date(now - 3_600_000), startsAt: new Date(now - 3_600_000), endsAt: new Date(now - 1_000), pausedRemainingMs: null },
  }[status];
  const mode = status === 'waiting' ? 'scheduled' : status;
  await db.event.upsert({
    where: { id: 'main' },
    create: { id: 'main', name: 'Test', mode, durationMinutes: 60, ...fields },
    update: { mode, durationMinutes: 60, ...fields },
  });
}

export async function seedTeams(db: Db) {
  await db.team.createMany({
    data: [
      { id: 'z3r0d4y', name: 'Z3R0D4Y', avatar: '/avatars/z3r0d4y.png' },
      { id: 'n0-tr4c3', name: 'N0_TR4C3', avatar: '/avatars/n0-tr4c3.png' },
    ],
  });
}

export async function addUser(db: Db, name: string, teamId: string, role: 'player' | 'admin' = 'player') {
  return db.user.create({ data: { name, nameKey: nameKey(name), teamId, role } });
}

/** A cookie-keeping client that has fetched a CSRF token. */
export async function client(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  const res = await agent.get('/api/auth/session');
  let csrf: string = res.body.csrfToken;
  return {
    agent,
    get csrf() {
      return csrf;
    },
    async login(name: string, teamId: string) {
      const r = await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ name, teamId });
      if (r.body?.csrfToken) csrf = r.body.csrfToken;
      return r;
    },
    post(path: string, body: object = {}) {
      return agent.post(path).set('X-CSRF-Token', csrf).send(body);
    },
  };
}

/** Create an AdminAccount directly (bypasses the create script's prompts). */
export async function addAdmin(db: Db, username: string, password: string, role: 'admin' | 'viewer' = 'admin') {
  return db.adminAccount.create({
    data: { username, usernameKey: username.toLowerCase(), role, passwordHash: await hashPassword(password) },
  });
}

/**
 * A cookie-keeping client for the admin area. Fetches the admin CSRF token and
 * exposes helpers that mirror `client` but talk to /api/admin.
 */
export async function adminClient(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  const res = await agent.get('/api/admin/auth/session');
  let csrf: string = res.body.csrfToken;
  return {
    agent,
    get csrf() {
      return csrf;
    },
    async login(username: string, password: string) {
      const r = await agent.post('/api/admin/auth/login').set('X-CSRF-Token', csrf).send({ username, password });
      if (r.body?.csrfToken) csrf = r.body.csrfToken;
      return r;
    },
    get(path: string) {
      return agent.get(path);
    },
    post(path: string, body: object = {}) {
      return agent.post(path).set('X-CSRF-Token', csrf).send(body);
    },
    put(path: string, body: object = {}) {
      return agent.put(path).set('X-CSRF-Token', csrf).send(body);
    },
    patch(path: string, body: object = {}) {
      return agent.patch(path).set('X-CSRF-Token', csrf).send(body);
    },
    del(path: string, body: object = {}) {
      return agent.delete(path).set('X-CSRF-Token', csrf).send(body);
    },
  };
}
