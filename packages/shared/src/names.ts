/**
 * Player names are matched when signing in, so the browser and the server must
 * agree on what a valid name is and how two spellings compare.
 */

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 40;

/** Letters (any script, with accents), spaces, hyphens, apostrophes and dots. Must start with a letter. */
const NAME_PATTERN = /^\p{L}[\p{L}\p{M} .'’-]*$/u;

/** Trim and collapse runs of whitespace. This is how a name is stored ("as registered"). */
export function cleanName(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export type NameProblem = 'too_short' | 'too_long' | 'invalid_characters';

export function validateName(raw: string): NameProblem | null {
  const name = cleanName(raw);
  if (name.length < NAME_MIN_LENGTH) return 'too_short';
  if (name.length > NAME_MAX_LENGTH) return 'too_long';
  if (!NAME_PATTERN.test(name)) return 'invalid_characters';
  return null;
}

export const NAME_RULES_HINT = `${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters: letters, spaces, hyphens, apostrophes and dots.`;

export function describeNameProblem(problem: NameProblem): string {
  switch (problem) {
    case 'too_short':
      return `Enter at least ${NAME_MIN_LENGTH} characters.`;
    case 'too_long':
      return `Use at most ${NAME_MAX_LENGTH} characters.`;
    case 'invalid_characters':
      return 'Use letters, spaces, hyphens, apostrophes and dots only.';
  }
}

/**
 * Comparison key: case-insensitive, accent-insensitive, whitespace-collapsed,
 * with typographic apostrophes folded to ASCII. "Zoë  O’Brien" -> "zoe o'brien".
 * Player names are unique by this key.
 */
export function nameKey(raw: string): string {
  return cleanName(raw)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/’/g, "'")
    .toLocaleLowerCase('en-US');
}
