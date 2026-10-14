import { beforeEach, describe, expect, it } from 'vitest';
import { hashFlag } from './flags';
import { getLeaderboard } from './leaderboard';
import { addUser, resetDb, seedTeams, testConfig, testDb } from '../test-utils';

const db = testDb();

async function challenge(id: string, points: number, number: number) {
  const { salt, hash } = hashFlag(testConfig().flagPepper, `CYFLAG-${id}`);
  await db.challenge.create({
    data: { id, number, title: id, description: id, category: 'WEB', difficulty: 2, points, flagHash: hash, flagSalt: salt, port: null, released: true },
  });
}

async function solve(userId: string, challengeId: string, points: number, at: string) {
  await db.solve.create({ data: { userId, challengeId, points, createdAt: new Date(at) } });
}

beforeEach(async () => {
  await resetDb(db);
  await seedTeams(db);
});

describe('getLeaderboard ranking', () => {
  it('orders by score, then fewer wrong, then earlier last solve', async () => {
    const a = await addUser(db, 'Alpha', 'z3r0d4y');
    const b = await addUser(db, 'Bravo', 'z3r0d4y');
    const cUser = await addUser(db, 'Charlie', 'n0-tr4c3');
    await challenge('web1', 100, 1);
    await challenge('web2', 200, 2);

    // Alpha: 300 (both), last solve 10:02
    await solve(a.id, 'web1', 100, '2026-01-01T10:00:00Z');
    await solve(a.id, 'web2', 200, '2026-01-01T10:02:00Z');
    // Bravo: 300 (both), last solve 10:01 (reached 300 earlier -> ranks above Alpha)
    await solve(b.id, 'web1', 100, '2026-01-01T10:00:30Z');
    await solve(b.id, 'web2', 200, '2026-01-01T10:01:00Z');
    // Charlie: 100
    await solve(cUser.id, 'web1', 100, '2026-01-01T10:00:00Z');

    const board = await getLeaderboard(db, testConfig(), { viewerId: b.id });
    expect(board.players.map((p) => p.name)).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(board.players[0]).toMatchObject({ rank: 1, score: 300, isYou: true });
    expect(board.players[1]).toMatchObject({ rank: 2, score: 300 });
  });

  it('breaks a score tie by fewer wrong submissions', async () => {
    const a = await addUser(db, 'Alpha', 'z3r0d4y');
    const b = await addUser(db, 'Bravo', 'z3r0d4y');
    await challenge('web1', 100, 1);
    await solve(a.id, 'web1', 100, '2026-01-01T10:00:00Z');
    await solve(b.id, 'web1', 100, '2026-01-01T10:00:00Z');
    // Alpha has a wrong submission; Bravo does not -> Bravo ranks first.
    await db.submission.create({ data: { userId: a.id, challengeId: 'web1', correct: false, ip: '127.0.0.1' } });

    const board = await getLeaderboard(db, testConfig());
    expect(board.players.map((p) => p.name)).toEqual(['Bravo', 'Alpha']);
  });

  it('sums team scores (TEAM_SCORING=sum) and builds a score series', async () => {
    const a = await addUser(db, 'Alpha', 'z3r0d4y');
    const b = await addUser(db, 'Bravo', 'z3r0d4y');
    const cUser = await addUser(db, 'Charlie', 'n0-tr4c3');
    await challenge('web1', 100, 1);
    await challenge('web2', 200, 2);
    await solve(a.id, 'web1', 100, '2026-01-01T10:00:00Z');
    await solve(b.id, 'web2', 200, '2026-01-01T10:01:00Z');
    await solve(cUser.id, 'web1', 100, '2026-01-01T10:00:00Z');

    const board = await getLeaderboard(db, testConfig());
    const z = board.teams.find((t) => t.teamId === 'z3r0d4y')!;
    expect(z).toMatchObject({ rank: 1, score: 300, members: 2, flags: 2 });
    const series = board.series.find((s) => s.name === 'Bravo')!;
    expect(series.points.at(-1)).toMatchObject({ score: 200 });
  });

  it('counts each challenge once per team under TEAM_SCORING=unique', async () => {
    const a = await addUser(db, 'Alpha', 'z3r0d4y');
    const b = await addUser(db, 'Bravo', 'z3r0d4y');
    await challenge('web1', 100, 1);
    // both solved the same challenge -> sum would be 200, unique is 100
    await solve(a.id, 'web1', 100, '2026-01-01T10:00:00Z');
    await solve(b.id, 'web1', 100, '2026-01-01T10:01:00Z');

    const board = await getLeaderboard(db, testConfig({ TEAM_SCORING: 'unique' }));
    expect(board.teams.find((t) => t.teamId === 'z3r0d4y')!.score).toBe(100);
  });
});
