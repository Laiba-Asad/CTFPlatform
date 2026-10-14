import { estimateClockOffset } from '@cydemic/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb } from '../test-utils';
import { getEventState } from './event';

const db = testDb();

async function setEvent(data: Record<string, unknown>) {
  const now = Date.now();
  await db.event.upsert({
    where: { id: 'main' },
    create: { id: 'main', name: 'Test', mode: 'scheduled', durationMinutes: 60, startsAt: new Date(now), endsAt: new Date(now + 3_600_000), ...data },
    update: data,
  });
}

beforeEach(async () => {
  await resetDb(db);
});

describe('getEventState state machine', () => {
  it('waiting: full duration remains, phase upcoming', async () => {
    await setEvent({ status: 'waiting', startedAt: null });
    const s = await getEventState(db);
    expect(s.status).toBe('waiting');
    expect(s.phase).toBe('upcoming');
    expect(s.remainingMs).toBe(60 * 60_000);
  });

  it('live: remaining counts down toward endsAt', async () => {
    const now = Date.now();
    await setEvent({ status: 'live', startedAt: new Date(now - 60_000), startsAt: new Date(now - 60_000), endsAt: new Date(now + 1_800_000) });
    const s = await getEventState(db);
    expect(s.status).toBe('live');
    expect(s.remainingMs).toBeGreaterThan(1_790_000);
    expect(s.remainingMs).toBeLessThanOrEqual(1_800_000);
  });

  it('paused: remaining is frozen at pausedRemainingMs', async () => {
    const now = Date.now();
    await setEvent({ status: 'paused', startedAt: new Date(now - 600_000), endsAt: new Date(now + 1_200_000), pausedRemainingMs: 1_234_000 });
    const s = await getEventState(db);
    expect(s.phase).toBe('paused');
    expect(s.remainingMs).toBe(1_234_000);
  });

  it('a live clock past its end reads as ended (server-authoritative)', async () => {
    const now = Date.now();
    await setEvent({ status: 'live', startedAt: new Date(now - 3_600_000), endsAt: new Date(now - 1_000) });
    const s = await getEventState(db);
    expect(s.status).toBe('ended');
    expect(s.phase).toBe('ended');
    expect(s.remainingMs).toBe(0);
  });
});

describe('server-corrected clock', () => {
  it('ignores a player clock that is 5 minutes wrong', () => {
    // Server is at T; the player's device clock is 5 minutes fast.
    const serverNow = 1_000_000_000_000;
    const skew = 5 * 60_000;
    const sentAt = serverNow + skew; // player clock when the request left
    const receivedAt = sentAt + 40; // 40ms round trip on the player clock
    const offset = estimateClockOffset(serverNow, sentAt, receivedAt);
    // Applying the offset to the (wrong) local clock recovers server time within the round trip.
    const corrected = receivedAt + offset;
    expect(Math.abs(corrected - serverNow)).toBeLessThan(50);
  });
});
