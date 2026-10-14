import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config';
import { FailureCooldown, toRetrySeconds } from './cooldown';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('FailureCooldown', () => {
  it('locks after the configured number of failures, for the cooldown length', () => {
    const c = clock();
    const limiter = new FailureCooldown({ maxFailures: 3, cooldownMs: 30_000, now: c.now });
    expect(limiter.recordFailure('k').locked).toBe(false);
    expect(limiter.recordFailure('k').locked).toBe(false);
    const third = limiter.recordFailure('k');
    expect(third).toEqual({ locked: true, retryAfterMs: 30_000 });

    c.advance(6_000);
    expect(limiter.check('k')).toEqual({ locked: true, retryAfterMs: 24_000 });
    expect(toRetrySeconds(limiter.check('k').retryAfterMs)).toBe(24);
  });

  it('unlocks exactly when the cooldown ends and starts counting from zero', () => {
    const c = clock();
    const limiter = new FailureCooldown({ maxFailures: 2, cooldownMs: 30_000, now: c.now });
    limiter.recordFailure('k');
    limiter.recordFailure('k');
    c.advance(29_999);
    expect(limiter.check('k').locked).toBe(true);
    c.advance(1);
    expect(limiter.check('k').locked).toBe(false);
    expect(limiter.recordFailure('k').locked).toBe(false);
  });

  it('a success resets the counter', () => {
    const limiter = new FailureCooldown({ maxFailures: 2, cooldownMs: 30_000 });
    limiter.recordFailure('k');
    limiter.reset('k');
    expect(limiter.recordFailure('k').locked).toBe(false);
  });

  it('keys are independent', () => {
    const limiter = new FailureCooldown({ maxFailures: 1, cooldownMs: 10_000 });
    limiter.recordFailure('a');
    expect(limiter.check('a').locked).toBe(true);
    expect(limiter.check('b').locked).toBe(false);
  });

  it('forgets old failures', () => {
    const c = clock();
    const limiter = new FailureCooldown({ maxFailures: 2, cooldownMs: 30_000, forgetAfterMs: 60_000, now: c.now });
    limiter.recordFailure('k');
    c.advance(60_001);
    expect(limiter.recordFailure('k').locked).toBe(false);
  });

  it('refuses a cooldown longer than 30 seconds', () => {
    expect(() => new FailureCooldown({ maxFailures: 1, cooldownMs: 30_001 })).toThrow(/30 seconds/);
  });
});

describe('COOLDOWN_SECONDS config', () => {
  it('defaults to 30 seconds', () => {
    expect(parseConfig({}).rateLimits.cooldownMs).toBe(30_000);
  });

  it('accepts shorter values', () => {
    expect(parseConfig({ COOLDOWN_SECONDS: '10' }).rateLimits.cooldownMs).toBe(10_000);
  });

  it('has a hard maximum of 30 seconds', () => {
    expect(() => parseConfig({ COOLDOWN_SECONDS: '31' })).toThrow(/COOLDOWN_SECONDS: must be at most 30 seconds/);
    expect(() => parseConfig({ COOLDOWN_SECONDS: '0' })).toThrow(/COOLDOWN_SECONDS/);
  });
});
