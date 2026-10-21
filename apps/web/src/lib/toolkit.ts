/**
 * Client-side decoders for the in-site Toolkit. Pure functions, no network, no
 * storage. Each returns a decoded string, or throws on clearly invalid input so
 * the UI can show a friendly message.
 */

export function base64Encode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64Decode(input: string): string {
  const cleaned = input.trim();
  if (!/^[A-Za-z0-9+/=\s]*$/.test(cleaned)) throw new Error('Not valid Base64.');
  let binary: string;
  try {
    binary = atob(cleaned.replace(/\s+/g, ''));
  } catch {
    throw new Error('Not valid Base64.');
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function hexToText(input: string): string {
  const hex = input.trim().replace(/0x/gi, '').replace(/[\s:,-]+/g, '');
  if (hex.length === 0) return '';
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) throw new Error('Not valid hex.');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return new TextDecoder().decode(bytes);
}

export function rot13(input: string): string {
  return input.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

export function urlDecode(input: string): string {
  try {
    return decodeURIComponent(input.trim().replace(/\+/g, ' '));
  } catch {
    throw new Error('Not valid URL encoding.');
  }
}

export function binaryToText(input: string): string {
  const groups = input.trim().split(/\s+/).filter(Boolean);
  if (groups.length === 0) return '';
  if (!groups.every((g) => /^[01]{1,8}$/.test(g))) throw new Error('Use groups of 1-8 bits, e.g. 01001000 01101001.');
  return groups.map((g) => String.fromCharCode(parseInt(g, 2))).join('');
}

export interface Converter {
  key: string;
  label: string;
  hint: string;
  run: (input: string) => string;
}

export const CONVERTERS: Converter[] = [
  { key: 'base64-decode', label: 'Base64 decode', hint: 'e.g. aGVsbG8=', run: base64Decode },
  { key: 'base64-encode', label: 'Base64 encode', hint: 'any text', run: base64Encode },
  { key: 'hex', label: 'Hex to text', hint: 'e.g. 48 69', run: hexToText },
  { key: 'rot13', label: 'ROT13', hint: 'letters are rotated by 13', run: rot13 },
  { key: 'url', label: 'URL decode', hint: 'e.g. hello%20world', run: urlDecode },
  { key: 'binary', label: 'Binary to text', hint: 'e.g. 01001000 01101001', run: binaryToText },
];
