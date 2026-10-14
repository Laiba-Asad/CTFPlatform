export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 5;

export type DifficultyLabel = 'EASY' | 'MEDIUM' | 'HARD';

export function clampDifficulty(value: number): number {
  return Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, Math.round(value)));
}

/** 1-2 EASY, 3 MEDIUM, 4-5 HARD. */
export function difficultyLabel(value: number): DifficultyLabel {
  const d = clampDifficulty(value);
  if (d <= 2) return 'EASY';
  if (d === 3) return 'MEDIUM';
  return 'HARD';
}
