import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256-bit URL-safe random token */
export const randomToken = () => randomBytes(32).toString('base64url');

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const hmac = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('base64url');

/** Constant-time string comparison */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
