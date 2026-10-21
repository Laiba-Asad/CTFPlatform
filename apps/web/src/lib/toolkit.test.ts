import { describe, expect, it } from 'vitest';
import { base64Decode, base64Encode, binaryToText, hexToText, rot13, urlDecode } from './toolkit';

describe('toolkit converters', () => {
  it('base64 round-trips, including UTF-8', () => {
    expect(base64Decode('aGVsbG8=')).toBe('hello');
    expect(base64Encode('hello')).toBe('aGVsbG8=');
    expect(base64Decode(base64Encode('café ☕'))).toBe('café ☕');
  });

  it('base64 rejects invalid input', () => {
    expect(() => base64Decode('not valid!!')).toThrow(/Base64/);
  });

  it('hex to text, tolerant of spaces, colons and 0x', () => {
    expect(hexToText('48 69')).toBe('Hi');
    expect(hexToText('48:69')).toBe('Hi');
    expect(hexToText('0x480x69')).toBe('Hi');
    expect(hexToText('')).toBe('');
    expect(() => hexToText('xyz')).toThrow(/hex/);
    expect(() => hexToText('abc')).toThrow(/hex/);
  });

  it('rot13 is its own inverse', () => {
    expect(rot13('Hello, World!')).toBe('Uryyb, Jbeyq!');
    expect(rot13(rot13('Flag Text 123'))).toBe('Flag Text 123');
  });

  it('url decode handles percent and plus', () => {
    expect(urlDecode('hello%20world')).toBe('hello world');
    expect(urlDecode('a+b')).toBe('a b');
    expect(() => urlDecode('%zz')).toThrow(/URL/);
  });

  it('binary to text', () => {
    expect(binaryToText('01001000 01101001')).toBe('Hi');
    expect(binaryToText('')).toBe('');
    expect(() => binaryToText('012 2')).toThrow(/bits/);
  });
});
