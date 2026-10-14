import { MAX_COOLDOWN_SECONDS } from '../config';

export interface CooldownStatus {
  locked: boolean;
  /** 0 when not locked */
  retryAfterMs: number;
}

interface Entry {
  failures: number;
  lockedUntil: number;
  lastFailureAt: number;
}

interface FailureCooldownOptions {
  /** Failures that trigger a cooldown */
  maxFailures: number;
  /** Cooldown length. Never more than 30 seconds. */
  cooldownMs: number;
  /** Failures older than this are forgotten */
  forgetAfterMs?: number;
  now?: () => number;
}

/**
 * Counts consecutive failures per key and imposes a short cooldown once a
 * threshold is reached. Used for login and flag-submission lockouts.
 *
 * State is in memory: correct for a single API instance (our deployment).
 * Running several API replicas would need a shared store such as Redis.
 */
export class FailureCooldown {
  private readonly entries = new Map<string, Entry>();
  private readonly maxFailures: number;
  private readonly cooldownMs: number;
  private readonly forgetAfterMs: number;
  private readonly now: () => number;

  constructor(options: FailureCooldownOptions) {
    if (options.cooldownMs > MAX_COOLDOWN_SECONDS * 1000) {
      throw new Error(`Cooldown must be at most ${MAX_COOLDOWN_SECONDS} seconds`);
    }
    this.maxFailures = options.maxFailures;
    this.cooldownMs = options.cooldownMs;
    this.forgetAfterMs = options.forgetAfterMs ?? 15 * 60_000;
    this.now = options.now ?? Date.now;
  }

  check(key: string): CooldownStatus {
    const entry = this.current(key);
    if (!entry) return { locked: false, retryAfterMs: 0 };
    const remaining = entry.lockedUntil - this.now();
    return remaining > 0 ? { locked: true, retryAfterMs: remaining } : { locked: false, retryAfterMs: 0 };
  }

  /** Record a failure and return the status afterwards (locked if this failure hit the threshold). */
  recordFailure(key: string): CooldownStatus {
    const now = this.now();
    const entry = this.current(key) ?? { failures: 0, lockedUntil: 0, lastFailureAt: now };
    entry.failures += 1;
    entry.lastFailureAt = now;
    if (entry.failures >= this.maxFailures) {
      entry.lockedUntil = now + this.cooldownMs;
    }
    this.entries.set(key, entry);
    if (this.entries.size > 10_000) this.sweep();
    return this.check(key);
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  /** Returns the live entry, dropping it once its cooldown has passed or it went stale. */
  private current(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    const now = this.now();
    const cooldownOver = entry.lockedUntil !== 0 && entry.lockedUntil <= now;
    const stale = now - entry.lastFailureAt > this.forgetAfterMs;
    if (cooldownOver || (stale && entry.lockedUntil <= now)) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  private sweep(): void {
    for (const key of [...this.entries.keys()]) this.current(key);
  }
}

export const toRetrySeconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000));
