import { describe, expect, it } from 'vitest';
import { clampDifficulty, difficultyLabel } from './difficulty';

describe('difficultyLabel', () => {
  it('maps the 1-5 scale to three labels', () => {
    expect([1, 2, 3, 4, 5].map(difficultyLabel)).toEqual([
      'EASY',
      'EASY',
      'MEDIUM',
      'HARD',
      'HARD',
    ]);
  });

  it('clamps out-of-range values', () => {
    expect(clampDifficulty(0)).toBe(1);
    expect(clampDifficulty(9)).toBe(5);
    expect(difficultyLabel(-3)).toBe('EASY');
  });
});
