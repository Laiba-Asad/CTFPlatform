import { formatCountdown, type EventPhase, type EventStatus } from '@cydemic/shared';
import { cn } from '../../lib/cn';

interface TimerProps {
  phase: EventPhase;
  remainingMs: number;
  /** Shared-clock status, for an accurate label (waiting vs scheduled). */
  status?: EventStatus;
  /** Last 10 minutes of a live event: teal fill, gentle 1s blink (static under reduced motion) */
  finalStretch?: boolean;
  className?: string;
}

const labels: Record<EventPhase, string> = {
  upcoming: 'Starts in',
  live: 'Time left',
  paused: 'Paused',
  ended: 'Ended',
};

/** Presentational event timer for the black top bar. Pass server-corrected values only. */
export function Timer({ phase, remainingMs, status, finalStretch = false, className }: TimerProps) {
  const label = status === 'waiting' ? 'Not started' : labels[phase];
  // Show days only for a far-off scheduled start; the shared hour clock stays HH:MM:SS.
  const display =
    phase === 'ended' ? '00:00:00' : formatCountdown(remainingMs, remainingMs >= 86_400_000);
  const emphasized = phase === 'live' && finalStretch;

  return (
    <div role="timer" aria-label={`${label} ${display}`} className={cn('flex items-center gap-3', className)}>
      <span aria-hidden="true" className="font-label text-xs font-bold uppercase tracking-label text-white/60">
        {label}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'rounded-control border-[1.5px] px-3 py-1 font-mono text-timer font-medium tabular-nums',
          (phase === 'upcoming' || (phase === 'live' && !emphasized)) && 'border-teal bg-black text-teal',
          emphasized && 'border-teal bg-teal text-black motion-safe:animate-blink',
          phase === 'paused' && 'border-dashed border-white/70 bg-black text-white/85',
          phase === 'ended' && 'border-white/20 bg-black text-white/55',
        )}
      >
        {display}
      </span>
    </div>
  );
}
