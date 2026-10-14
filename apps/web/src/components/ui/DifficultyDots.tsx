import { DIFFICULTY_MAX, clampDifficulty, difficultyLabel } from '@cydemic/shared';
import { cn } from '../../lib/cn';

interface DifficultyDotsProps {
  value: number;
  showLabel?: boolean;
  className?: string;
}

/** Ink-filled vs empty outlined dots + EASY / MEDIUM / HARD. */
export function DifficultyDots({ value, showLabel = true, className }: DifficultyDotsProps) {
  const level = clampDifficulty(value);
  const label = difficultyLabel(level);
  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      role="img"
      aria-label={`Difficulty ${level} of ${DIFFICULTY_MAX}, ${label.toLowerCase()}`}
    >
      <span className="flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: DIFFICULTY_MAX }, (_, i) => (
          <span
            key={i}
            className={cn('size-2.5 rounded-full border-[1.5px] border-ink', i < level ? 'bg-ink' : 'bg-white')}
          />
        ))}
      </span>
      {showLabel && (
        <span className="font-mono text-micro uppercase tracking-label text-ink/65" aria-hidden="true">
          {label}
        </span>
      )}
    </span>
  );
}
