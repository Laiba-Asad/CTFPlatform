import { cn } from '../../lib/cn';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  /** Show "x / y" before the percentage */
  showCounts?: boolean;
  className?: string;
}

/** Thin flat bar: 8px, teal fill on a light grey track. */
export function ProgressBar({ value, max, label, showCounts = false, className }: ProgressBarProps) {
  const safeMax = Math.max(0, max);
  const clamped = Math.min(Math.max(0, value), safeMax);
  const percent = safeMax === 0 ? 0 : Math.round((clamped / safeMax) * 100);

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        {label && <span className="font-label text-micro font-bold uppercase tracking-label text-ink/65">{label}</span>}
        <span className="ml-auto font-mono text-xs text-ink/65 tabular-nums">
          {showCounts && `${clamped} / ${safeMax} · `}
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label ?? 'Progress'}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={`${clamped} of ${safeMax}, ${percent} percent`}
        className="h-2 w-full overflow-hidden rounded-full bg-ink/10"
      >
        <div className="h-full rounded-full bg-teal transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
