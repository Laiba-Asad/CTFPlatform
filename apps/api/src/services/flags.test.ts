import { describe, expect, it } from 'vitest';
import { hashFlag, normalizeFlag, verifyFlag } from './flags';

const PEPPER = 'test-pepper-aaaaaaaaaaaaaaaaaaaaaaaa';

describe('flag hashing', () => {
  it('verifies the exact flag and rejects wrong ones', () => {
    const { salt, hash } = hashFlag(PEPPER, 'CYFLAG-correct_horse');
    expect(verifyFlag(PEPPER, salt, hash, 'CYFLAG-correct_horse')).toBe(true);
    expect(verifyFlag(PEPPER, salt, hash, 'CYFLAG-wrong')).toBe(false);
    expect(verifyFlag(PEPPER, salt, hash, '')).toBe(false);
  });

  it('is case-sensitive but trims surrounding whitespace', () => {
    const { salt, hash } = hashFlag(PEPPER, 'CYFLAG-AbC');
    expect(verifyFlag(PEPPER, salt, hash, '  CYFLAG-AbC\n')).toBe(true);
    expect(verifyFlag(PEPPER, salt, hash, 'CYFLAG-abc')).toBe(false);
    expect(normalizeFlag('  x ')).toBe('x');
  });

  it('uses a random salt each time and never stores the plaintext', () => {
    const a = hashFlag(PEPPER, 'CYFLAG-x');
    const b = hashFlag(PEPPER, 'CYFLAG-x');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(a.hash).not.toContain('CYFLAG-x');
  });

  it('fails verification under a different pepper (server secret matters)', () => {
    const { salt, hash } = hashFlag(PEPPER, 'CYFLAG-x');
    expect(verifyFlag('another-pepper-bbbbbbbbbbbbbbbbbbbb', salt, hash, 'CYFLAG-x')).toBe(false);
  });
});
