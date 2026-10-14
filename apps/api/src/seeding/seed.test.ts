import { TEAMS } from '@cydemic/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testConfig, testDb } from '../test-utils';
import { seed } from './seed';

const db = testDb();
beforeEach(() => resetDb(db));

describe('seed', () => {
  it('loads the 6 placeholder teams and a placeholder event, and creates no players', async () => {
    await seed(db, testConfig());
    const teams = await db.team.findMany({ orderBy: { name: 'asc' } });
    expect(teams.map((t) => t.name)).toEqual(['0xDEADC0DE', 'GH0ST.PR0T0', 'KR4CK_T3AM', 'N0_TR4C3', 'SH3LLSH0CK', 'Z3R0D4Y']);
    expect(teams.every((t) => t.avatar === `/avatars/${t.id}.png`)).toBe(true);
    // The shared TEAMS constant (used by the login screen) matches the seed exactly.
    expect(teams.map((t) => ({ id: t.id, name: t.name, avatar: t.avatar }))).toEqual(
      [...TEAMS].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ id: t.id, name: t.name, avatar: t.avatar })),
    );
    // Players join themselves on first login; seeding creates none.
    expect(await db.user.count()).toBe(0);

    const event = await db.event.findUniqueOrThrow({ where: { id: 'main' } });
    expect(event.endsAt.getTime()).toBeGreaterThan(event.startsAt.getTime());
  });

  it('is idempotent and keeps existing event dates unless asked', async () => {
    await seed(db, testConfig());
    const before = await db.event.findUniqueOrThrow({ where: { id: 'main' } });
    await seed(db, testConfig());
    expect(await db.team.count()).toBe(6);
    expect((await db.event.findUniqueOrThrow({ where: { id: 'main' } })).startsAt).toEqual(before.startsAt);
  });

  it('uses EVENT_START / EVENT_END and EVENT_MODE when set', async () => {
    await seed(db, testConfig({ EVENT_START: '2030-03-01T09:00:00Z', EVENT_END: '2030-03-01T17:00:00Z', EVENT_MODE: 'scheduled' }));
    const event = await db.event.findUniqueOrThrow({ where: { id: 'main' } });
    expect(event.startsAt.toISOString()).toBe('2030-03-01T09:00:00.000Z');
    expect(event.mode).toBe('scheduled');
  });

  it('seeds live mode by default in dev with a rolling window', async () => {
    await seed(db, testConfig({ NODE_ENV: 'development' }));
    const event = await db.event.findUniqueOrThrow({ where: { id: 'main' } });
    expect(event.mode).toBe('live');
    expect(event.endsAt.getTime()).toBeGreaterThan(Date.now());
  });
});
