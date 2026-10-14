import { describe, expect, it } from 'vitest';
import { cleanName, nameKey, validateName } from './names';

describe('cleanName', () => {
  it('trims and collapses whitespace but keeps case and accents', () => {
    expect(cleanName('  Laiba   Asad ')).toBe('Laiba Asad');
    expect(cleanName('Zoë\tLaurent')).toBe('Zoë Laurent');
  });
});

describe('nameKey', () => {
  it('matches regardless of case, extra spaces and accents', () => {
    expect(nameKey('laiba  asad')).toBe(nameKey('Laiba Asad'));
    expect(nameKey('ZOE LAURENT')).toBe(nameKey('Zoë Laurent'));
    expect(nameKey('José Núñez')).toBe('jose nunez');
  });

  it('treats decomposed and composed accents the same', () => {
    expect(nameKey('Zoë')).toBe(nameKey('Zoë'));
  });

  it('folds typographic apostrophes', () => {
    expect(nameKey('Liam O’Brien')).toBe(nameKey("liam o'brien"));
  });

  it('keeps different names different', () => {
    expect(nameKey('Ana Lee')).not.toBe(nameKey('Anna Lee'));
  });
});

describe('validateName', () => {
  it('accepts letters, spaces, hyphens, apostrophes and dots', () => {
    for (const ok of ['Laiba Asad', 'Mary-Jane Watts', "Liam O'Brien", 'J. R. Smith', 'Zoë', 'Al']) {
      expect(validateName(ok), ok).toBeNull();
    }
  });

  it('enforces length after cleaning', () => {
    expect(validateName(' A ')).toBe('too_short');
    expect(validateName('A'.repeat(41))).toBe('too_long');
    expect(validateName('A'.repeat(40))).toBeNull();
  });

  it('rejects digits, symbols and a leading non-letter', () => {
    for (const bad of ['player_01', 'Anna2', 'Bob <script>', '-Ann', '.Ann', 'Ann@corp']) {
      expect(validateName(bad), bad).toBe('invalid_characters');
    }
  });
});
