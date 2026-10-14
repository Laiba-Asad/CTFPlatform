import { describe, expect, it } from 'vitest';
import {
  FINAL_STRETCH_MS,
  estimateClockOffset,
  formatCountdown,
  getEventPhase,
  getRemainingMs,
  hasEventStarted,
  isEventLive,
  isFinalStretch,
  type EventWindow,
} from './event';

const HOUR = 3_600_000;
const scheduled: EventWindow = { startsAt: 10 * HOUR, endsAt: 14 * HOUR, mode: 'scheduled' };

describe('getEventPhase (scheduled follows the dates)', () => {
  it('is upcoming before the start', () => {
    expect(getEventPhase(scheduled, 10 * HOUR - 1)).toBe('upcoming');
  });

  it('is live from the exact start until just before the end', () => {
    expect(getEventPhase(scheduled, 10 * HOUR)).toBe('live');
    expect(getEventPhase(scheduled, 14 * HOUR - 1)).toBe('live');
  });

  it('is ended at the exact end and after', () => {
    expect(getEventPhase(scheduled, 14 * HOUR)).toBe('ended');
    expect(getEventPhase(scheduled, 99 * HOUR)).toBe('ended');
  });
});

describe('getEventPhase (forced modes ignore the dates)', () => {
  it('live forces live even with a past window', () => {
    expect(getEventPhase({ ...scheduled, mode: 'live' }, 0)).toBe('live');
    expect(getEventPhase({ ...scheduled, mode: 'live' }, 99 * HOUR)).toBe('live');
  });

  it('paused forces paused', () => {
    expect(getEventPhase({ ...scheduled, mode: 'paused' }, 12 * HOUR)).toBe('paused');
    expect(getEventPhase({ ...scheduled, mode: 'paused' }, 0)).toBe('paused');
  });

  it('ended forces ended', () => {
    expect(getEventPhase({ ...scheduled, mode: 'ended' }, 12 * HOUR)).toBe('ended');
    expect(getEventPhase({ ...scheduled, mode: 'ended' }, 0)).toBe('ended');
  });
});

describe('isEventLive and hasEventStarted', () => {
  it('only allows play while live', () => {
    expect(isEventLive(scheduled, 9 * HOUR)).toBe(false);
    expect(isEventLive(scheduled, 12 * HOUR)).toBe(true);
    expect(isEventLive({ ...scheduled, mode: 'paused' }, 12 * HOUR)).toBe(false);
    expect(isEventLive({ ...scheduled, mode: 'live' }, 99 * HOUR)).toBe(true);
    expect(isEventLive(scheduled, 14 * HOUR)).toBe(false);
  });

  it('reports whether the event has started', () => {
    expect(hasEventStarted(scheduled, 9 * HOUR)).toBe(false);
    expect(hasEventStarted(scheduled, 11 * HOUR)).toBe(true);
    expect(hasEventStarted({ ...scheduled, mode: 'paused' }, 0)).toBe(true);
    expect(hasEventStarted({ ...scheduled, mode: 'live' }, 0)).toBe(true);
  });
});

describe('getRemainingMs', () => {
  it('counts down to the start while upcoming', () => {
    expect(getRemainingMs(scheduled, 9 * HOUR)).toBe(HOUR);
  });

  it('counts down to the end while live or paused', () => {
    expect(getRemainingMs(scheduled, 13 * HOUR)).toBe(HOUR);
    expect(getRemainingMs({ ...scheduled, mode: 'paused' }, 13 * HOUR)).toBe(HOUR);
  });

  it('is zero once ended', () => {
    expect(getRemainingMs(scheduled, 20 * HOUR)).toBe(0);
    expect(getRemainingMs({ ...scheduled, mode: 'ended' }, 11 * HOUR)).toBe(0);
  });
});

describe('isFinalStretch', () => {
  it('turns on in the last 10 minutes of a live event only', () => {
    expect(isFinalStretch(scheduled, scheduled.endsAt - FINAL_STRETCH_MS - 1)).toBe(false);
    expect(isFinalStretch(scheduled, scheduled.endsAt - FINAL_STRETCH_MS)).toBe(true);
    expect(isFinalStretch(scheduled, scheduled.endsAt)).toBe(false);
    expect(isFinalStretch(scheduled, scheduled.startsAt - 1000)).toBe(false);
  });
});

describe('formatCountdown', () => {
  it('formats hours, minutes and seconds with padding', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(61_000)).toBe('00:01:01');
    expect(formatCountdown(10 * HOUR + 5_000)).toBe('10:00:05');
  });

  it('rounds partial seconds down', () => {
    expect(formatCountdown(1_999)).toBe('00:00:01');
  });

  it('shows DD:HH:MM:SS past a day, or when asked', () => {
    expect(formatCountdown(26 * HOUR + 61_000)).toBe('01:02:01:01');
    expect(formatCountdown(2 * HOUR, true)).toBe('00:02:00:00');
  });

  it('never shows negative time', () => {
    expect(formatCountdown(-5_000)).toBe('00:00:00');
  });
});

describe('estimateClockOffset', () => {
  it('returns zero when clocks agree', () => {
    expect(estimateClockOffset(1_050, 1_000, 1_100)).toBe(0);
  });

  it('detects a client clock that runs ahead or behind', () => {
    expect(estimateClockOffset(1_050, HOUR + 1_000, HOUR + 1_100)).toBe(-HOUR);
    expect(estimateClockOffset(HOUR + 1_050, 1_000, 1_100)).toBe(HOUR);
  });
});
