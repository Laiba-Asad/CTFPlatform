import { Check, Clock, Lock, LoaderCircle, Pause, TriangleAlert } from 'lucide-react';
import type { MissionState } from '@cydemic/shared';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { categoryIcon } from './categoryIcon';

/** Small outlined pill. Used for categories and neutral tags. */
export function Pill({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border-[1.5px] border-line bg-white px-2.5 font-label text-xs font-bold uppercase tracking-label text-ink',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Category: same pill for every category; the icon tells them apart. */
export function CategoryPill({ category, className }: { category: string; className?: string }) {
  const Icon = categoryIcon(category);
  return (
    <Pill icon={<Icon className="size-3.5" aria-hidden="true" />} className={className}>
      {category}
    </Pill>
  );
}

/**
 * Mission state as a quiet label with an explicit reason, so an event reason
 * (opens at start / paused / event ended) is never confused with the admin
 * reason (locked) or a service issue (starting / temporarily unavailable).
 */
const STATUS_CONTENT: Record<MissionState, { text: string; icon?: ReactNode; tone: string }> = {
  available: { text: 'Available', tone: 'text-ink/65' },
  solved: { text: 'Solved', icon: <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />, tone: 'text-teal-dark' },
  locked: { text: 'Locked', icon: <Lock className="size-3.5" aria-hidden="true" />, tone: 'text-ink/65' },
  opens_at_start: { text: 'Opens at start', icon: <Clock className="size-3.5" aria-hidden="true" />, tone: 'text-ink/65' },
  paused: { text: 'Paused', icon: <Pause className="size-3.5" aria-hidden="true" />, tone: 'text-ink/65' },
  event_ended: { text: 'Event ended', icon: <Lock className="size-3.5" aria-hidden="true" />, tone: 'text-ink/65' },
  starting: { text: 'Starting…', icon: <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />, tone: 'text-ink/65' },
  unavailable: { text: 'Temporarily unavailable', icon: <TriangleAlert className="size-3.5" aria-hidden="true" />, tone: 'text-ink' },
};

export function statusLabelText(state: MissionState): string {
  return STATUS_CONTENT[state].text;
}

export function StatusLabel({ state, className }: { state: MissionState; className?: string }) {
  const { text, icon, tone } = STATUS_CONTENT[state];
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-label text-xs font-bold uppercase tracking-label', tone, className)}>
      {icon}
      {text}
    </span>
  );
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** Filter chip. Active = black fill, white text. */
export function Chip({ active = false, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center rounded-full border-[1.5px] px-3.5 font-label text-xs font-bold uppercase tracking-label transition-colors',
        active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
