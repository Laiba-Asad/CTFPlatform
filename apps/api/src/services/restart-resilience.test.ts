import { inject } from 'vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../lib/db';
import { hashFlag } from './flags';
import { getEventState } from './event';
import { aggregatePlayers } from './scoring';
import { addUser, resetDb, seedEvent, seedTeams, testConfig, testDb } from '../test-utils';

/**
 * Production resilience: the platform must survive a crash/restart mid-event.
 * State lives in the database, so a fresh client (modelling a restart) sees the
 * same shared clock, scores, solves and released missions. (The supervisor then
 * restarts every released service - covered by the supervisor integration test.)
 */
const db = testDb();
const config = testConfig();
beforeEach(() => resetDb(db));

describe('state survives a restart', () => {
  it('keeps the shared clock, released missions, solves and scores', async () => {
    await seedTeams(db);
    await seedEvent(db, 'live'); // started, counting down
    const user = await addUser(db, 'Ava Stone', 'z3r0d4y');

    const { salt, hash } = hashFlag(config.flagPepper, 'CYFLAG{demo}');
    await db.challenge.create({ data: { id: 'web1', title: 'Warmup', description: 'd', category: 'WEB', points: 100, flagHash: hash, flagSalt: salt, port: 5001, released: true } });
    await db.challenge.create({ data: { id: 'web2', title: 'Locked one', description: 'd', category: 'WEB', points: 200, flagHash: hash, flagSalt: salt, port: 5002, released: false } });
    await db.solve.create({ data: { userId: user.id, challengeId: 'web1', points: 100 } });

    const before = await getEventState(db);
    const scoreBefore = (await aggregatePlayers(db)).find((p) => p.id === user.id)?.score;
    expect(before.status).toBe('live');
    expect(scoreBefore).toBe(100);

    // --- Restart: a brand-new client against the same database file ---
    const fresh = createDb(inject('databaseUrl'));
    try {
      const after = await getEventState(fresh);
      expect(after.status).toBe('live');
      // The clock kept counting from the stored start, not reset to a full hour.
      expect(after.remainingMs).toBeLessThanOrEqual(before.remainingMs);
      expect(after.endsAt.getTime()).toBe(before.endsAt.getTime());

      const released = await fresh.challenge.findMany({ where: { released: true }, select: { id: true } });
      expect(released.map((c) => c.id)).toEqual(['web1']);

      expect(await fresh.solve.count()).toBe(1);
      const scoreAfter = (await aggregatePlayers(fresh)).find((p) => p.id === user.id)?.score;
      expect(scoreAfter).toBe(100);
    } finally {
      await fresh.$disconnect();
    }
  });

  it('a paused clock stays paused with the same remaining time after restart', async () => {
    await seedTeams(db);
    await seedEvent(db, 'paused');
    const before = await getEventState(db);
    expect(before.status).toBe('paused');

    const fresh = createDb(inject('databaseUrl'));
    try {
      const after = await getEventState(fresh);
      expect(after.status).toBe('paused');
      expect(after.remainingMs).toBe(before.remainingMs);
    } finally {
      await fresh.$disconnect();
    }
  });
});
