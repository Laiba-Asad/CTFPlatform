import { describe, expect, it } from 'vitest';
import { TEAMS } from './teams';

describe('TEAMS', () => {
  it('has the six expected team ids in order', () => {
    expect(TEAMS.map((t) => t.id)).toEqual(['z3r0d4y', 'n0-tr4c3', 'sh3llsh0ck', 'kr4ck-t3am', '0xdeadc0de', 'gh0st-pr0t0']);
  });

  it('every team has a name and an /avatars/<id>.png badge path', () => {
    for (const t of TEAMS) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.avatar).toBe(`/avatars/${t.id}.png`);
    }
  });
});
