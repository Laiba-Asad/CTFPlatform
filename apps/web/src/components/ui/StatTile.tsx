import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Small text after the value, e.g. "/ 15" */
  suffix?: ReactNode;
  className?: string;
}

/** Small outlined stat box: label on top, mono number below. */
export function StatTile({ label, value, suffix, className }: StatTileProps) {
  return (
    <dl className={cn('flex flex-col-reverse rounded-control border-[1.5px] border-line px-3.5 py-2.5', className)}>
      <dd className="font-mono text-stat font-medium text-ink tabular-nums">
        {value}
        {suffix && <span className="ml-1.5 text-md text-ink/65">{suffix}</span>}
      </dd>
      <dt className="font-label text-micro font-bold uppercase tracking-label text-ink/65">{label}</dt>
    </dl>
  );
}
