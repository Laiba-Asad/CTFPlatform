import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// promisify() resolves scrypt to its 3-argument overload and drops the options
// parameter, so wrap the options overload by hand.
function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => (err ? reject(err) : resolve(derivedKey as Buffer)));
  });
}

// scrypt cost parameters (slow on purpose). N must be a power of two.
const N = 16_384;
const r = 8;
const p = 1;
const KEYLEN = 64;

/**
 * Hash an admin password with scrypt and a random salt. Format:
 * `scrypt$N$r$p$<saltB64>$<hashB64>`. Never log or return the plaintext.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 })) as Buffer;
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** Constant-time verify against a stored scrypt string. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64!, 'base64');
  const expected = Buffer.from(hashB64!, 'base64');
  const got = (await scrypt(password.normalize('NFKC'), salt, expected.length, {
    N: Number(nStr),
    r: Number(rStr),
    p: Number(pStr),
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  return got.length === expected.length && timingSafeEqual(got, expected);
}
