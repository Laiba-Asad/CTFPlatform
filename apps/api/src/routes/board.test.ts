import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { RETIRED_CHALLENGE_IDS } from '../challenges/retired';
import { SEED_DIR } from '../scripts/cli';
import { seed } from '../seeding/seed';
import { hashFlag } from '../services/flags';
import { retireChallenges } from '../services/retire';
import { aggregatePlayers } from '../services/scoring';
import { addAdmin, addUser, adminClient, client, resetDb, seedEvent, testApp, testConfig, testDb } from '../test-utils';
import { buildHealthReport } from './health';

const db = testDb();

// The 15 active challenges in board order: points ascending, then id.
const BOARD = ['web1', 'web14', 'web15', 'web19', 'web20', 'web16', 'web17', 'web18', 'web21', 'web22', 'web23', 'web2', 'web24', 'web25', 'net5'];

async function seededBoard() {
  await seed(db, testConfig({ AUTO_UNLOCK_ALL: 'true' }));
  await seedEvent(db, 'live');
  await addUser(db, 'Ava Stone', 'z3r0d4y');
}

async function playerAndAdmin() {
  const { app } = testApp();
  const player = await client(app);
  await player.login('Ava Stone', 'z3r0d4y');
  await addAdmin(db, 'organizer', 'correct horse battery');
  const admin = await adminClient(app);
  await admin.login('organizer', 'correct horse battery');
  return { app, player, admin };
}

beforeEach(() => resetDb(db));

describe('mission board', () => {
  it('lists the 15 active challenges in board order, numbered by position', async () => {
    await seededBoard();
    const { player } = await playerAndAdmin();
    const { challenges } = (await player.agent.get('/api/challenges')).body as { challenges: Array<{ id: string; number: number; points: number }> };
    expect(challenges.map((c) => c.id)).toEqual(BOARD);
    expect(challenges.map((c) => c.number)).toEqual(BOARD.map((_, i) => i + 1));
    expect(challenges.reduce((s, c) => s + c.points, 0)).toBe(2250);
  });

  it('sends every challenge its service port as the target link', async () => {
    await seededBoard();
    const { player, admin } = await playerAndAdmin();
    const cards = (await player.agent.get('/api/challenges')).body.challenges as Array<{ id: string; port: number | null }>;
    const byId = Object.fromEntries(cards.map((c) => [c.id, c.port]));
    expect(byId.web14).toBe(5014);
    expect(byId.web25).toBe(5025);
    expect(byId.net5).toBe(5026); // the in-site Capture Viewer is openable too
    expect(cards.every((c) => typeof c.port === 'number')).toBe(true);
    const missions = (await admin.get('/api/admin/missions')).body.missions as Array<{ id: string; port: number | null }>;
    expect(missions.map((m) => m.id)).toEqual(BOARD);
    expect(missions.every((m) => typeof m.port === 'number')).toBe(true);
  });

  it('has no difficulty key in any player, admin or health response', async () => {
    await seededBoard();
    const { app, player, admin } = await playerAndAdmin();
    const flagged = (await player.agent.get('/api/challenges')).body.challenges[0];
    await player.post(`/api/challenges/${flagged.id}/submit`, { flag: 'not-the-flag' });
    const anonymous = await client(app);
    const paths = {
      player: ['/api/challenges', '/api/me', '/api/leaderboard'],
      admin: ['/api/admin/missions', '/api/admin/overview', '/api/admin/submissions', '/api/admin/export/results.json', '/api/admin/export/solves.csv'],
      anonymous: ['/api/health'],
    };
    const requests = [
      ...paths.player.map((p) => [p, () => player.agent.get(p)] as const),
      ...paths.admin.map((p) => [p, () => admin.get(p)] as const),
      ...paths.anonymous.map((p) => [p, () => anonymous.agent.get(p)] as const),
    ];
    for (const [path, send] of requests) {
      const res = await send();
      expect(res.status, path).toBeLessThan(400);
      expect(res.text.toLowerCase(), path).not.toContain('difficult');
    }
  });
});

describe('health and retired challenges', () => {
  it('expects 15 services and reports no retired challenge on a clean seed', async () => {
    await seededBoard();
    const report = await buildHealthReport(db, testConfig());
    expect(report.challenges).toEqual({ released: 15, total: 15, withService: 15, retiredInDatabase: [] });
  });

  it('never counts a retired challenge and names it if one is still in the database', async () => {
    await seededBoard();
    const { salt, hash } = hashFlag(testConfig().flagPepper, 'x');
    await db.challenge.create({ data: { id: 'web8', title: 'old', description: 'd', category: 'WEB', points: 600, flagHash: hash, flagSalt: salt, port: 5008, released: true } });
    const report = await buildHealthReport(db, testConfig());
    expect(report.challenges).toMatchObject({ total: 15, withService: 15, retiredInDatabase: ['web8'] });
  });

  it('refuses to seed a retired challenge id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cydemic-seed-'));
    for (const f of ['teams.json', 'event.json']) copyFileSync(join(SEED_DIR, f), join(dir, f));
    const file = JSON.parse(readFileSync(join(SEED_DIR, 'challenges.json'), 'utf8'));
    file.challenges.push({ ...file.challenges[0], id: 'web3' });
    writeFileSync(join(dir, 'challenges.json'), JSON.stringify(file));
    await expect(seed(db, testConfig(), { seedDir: dir })).rejects.toThrow(/retired/);
  });

  it('retires challenges with every referencing row, leaving no dangling reference', async () => {
    await seededBoard();
    const pepper = testConfig().flagPepper;
    const mk = (id: string, points: number, extra: object = {}) => {
      const { salt, hash } = hashFlag(pepper, `CYFLAG-${id}`);
      return db.challenge.create({ data: { id, title: id, description: 'd', category: 'WEB', points, flagHash: hash, flagSalt: salt, released: true, ...extra } });
    };
    await mk('web3', 400);
    await mk('web12', 450);
    await db.challenge.update({ where: { id: 'web2' }, data: { unlockAfterId: 'web3' } });
    const user = await db.user.findFirstOrThrow();
    await db.solve.createMany({ data: [{ userId: user.id, challengeId: 'web3', points: 400 }, { userId: user.id, challengeId: 'web1', points: 100 }] });
    await db.submission.createMany({ data: [{ userId: user.id, challengeId: 'web3', correct: true, ip: '1.1.1.1' }, { userId: user.id, challengeId: 'web12', correct: false, text: 'nope', ip: '1.1.1.1' }] });
    const hint = await db.hint.create({ data: { challengeId: 'web12', order: 1, content: 'h' } });
    await db.hintUnlock.create({ data: { userId: user.id, hintId: hint.id } });
    await db.attachment.create({ data: { challengeId: 'web12', kind: 'file', name: 'x', location: 'x' } });
    await db.scoreAdjustment.create({ data: { userId: user.id, points: 5, reason: 'bonus', admin: 'organizer' } });

    expect((await aggregatePlayers(db))[0]?.score).toBe(505);
    const counts = await retireChallenges(db);
    expect(counts).toEqual({ challenges: 2, solves: 1, submissions: 2, hintUnlocks: 1, hints: 1, attachments: 1, unlockLinksCleared: 1, scoreAdjustments: 0 });

    // Scores recompute from the remaining solves + the (player-owned) adjustment.
    expect((await aggregatePlayers(db))[0]?.score).toBe(105);
    const ids = [...RETIRED_CHALLENGE_IDS];
    expect(await db.challenge.count({ where: { id: { in: ids } } })).toBe(0);
    expect(await db.solve.count({ where: { challengeId: { in: ids } } })).toBe(0);
    expect(await db.submission.count({ where: { challengeId: { in: ids } } })).toBe(0);
    expect(await db.challenge.count({ where: { unlockAfterId: { in: ids } } })).toBe(0);
    expect(await db.challenge.count()).toBe(15);
    // Idempotent.
    expect((await retireChallenges(db)).challenges).toBe(0);
  });
});
