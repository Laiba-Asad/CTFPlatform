import { randomBytes } from 'node:crypto';
import { hmac, safeEqual } from '../lib/crypto';

/**
 * Flags are never stored or transmitted in plaintext. We keep a per-challenge
 * random salt and the HMAC-SHA256(FLAG_PEPPER, salt + normalizedFlag). The
 * pepper is a server secret, so a stolen database alone cannot reveal flags.
 *
 * Changing FLAG_PEPPER invalidates every stored hash (re-run `npm run flag:hash`).
 */

/** Trim surrounding whitespace only; flags are otherwise case- and content-exact. */
export function normalizeFlag(flag: string): string {
  return flag.trim();
}

export function hashFlag(pepper: string, flag: string, salt = randomBytes(16).toString('base64url')) {
  return { salt, hash: hmac(pepper, `${salt}:${normalizeFlag(flag)}`) };
}

export function verifyFlag(pepper: string, salt: string, expectedHash: string, submitted: string): boolean {
  return safeEqual(hmac(pepper, `${salt}:${normalizeFlag(submitted)}`), expectedHash);
}
