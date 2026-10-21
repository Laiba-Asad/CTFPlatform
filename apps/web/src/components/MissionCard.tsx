import type { MissionState, MissionSummary } from '@cydemic/shared';
import { User } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from './ui/Button';
import { CategoryPill, StatusLabel } from './ui/Pill';

interface MissionCardProps {
  mission: MissionSummary;
  onOpen?: (mission: MissionSummary) => void;
}

// States where the card is dimmed and the action is not a normal "Start".
const DIMMED: MissionState[] = ['locked', 'opens_at_start', 'paused', 'event_ended', 'unavailable'];

const PLACEHOLDER: Partial<Record<MissionState, string>> = {
  opens_at_start: 'Briefing unlocks when the event starts.',
  locked: 'Not released yet. Check back soon.',
  paused: 'The event is paused.',
  event_ended: 'The event has ended.',
  unavailable: 'This target is temporarily unavailable. Retrying…',
  starting: 'This target is starting up…',
};

/**
 * Available  = plain white card + black START/VIEW.
 * Solved     = teal border + SOLVED + outlined VIEW.
 * Starting   = openable (you can read it) but the action shows "Starting…".
 * Otherwise  = dashed, dimmed, with the explicit reason; the action is disabled.
 */
export function MissionCard({ mission, onOpen }: MissionCardProps) {
  const { state } = mission;
  const solved = state === 'solved';
  const dimmed = DIMMED.includes(state);
  const openable = state === 'available' || solved || state === 'starting';
  const number = String(mission.number).padStart(2, '0');

  return (
    <article
      aria-labelledby={`mission-${mission.id}-title`}
      className={cn(
        'flex flex-col rounded-card border-[1.5px] bg-white px-[18px] py-4',
        solved && 'border-teal',
        dimmed && 'border-dashed border-line opacity-55',
        !solved && !dimmed && 'border-line',
      )}
    >
      <div className="flex items-center justify-between font-mono">
        <span className="text-xs uppercase tracking-label text-ink/65">Mission {number}</span>
        <span className="text-base font-semibold text-ink">+{mission.points} XP</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <CategoryPill category={mission.category} />
        <StatusLabel state={state} />
      </div>

      <h3 id={`mission-${mission.id}-title`} className="mt-2.5 font-label text-card font-bold text-ink">
        {mission.title}
      </h3>

      <p className="mt-1 line-clamp-2 min-h-10 text-base text-ink/65">
        {mission.description ?? PLACEHOLDER[state] ?? 'Briefing unlocks when this mission becomes available.'}
      </p>

      <div className="mt-3.5 flex items-center justify-end gap-3">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1 font-mono text-sm text-ink/65" title="Solvers">
            <User className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Solvers:</span>
            {mission.solves}
          </span>
          {openable ? (
            <Button
              size="sm"
              variant={solved ? 'secondary' : 'primary'}
              onClick={() => onOpen?.(mission)}
              aria-label={`${solved ? 'View' : 'Open'} mission ${number}: ${mission.title}`}
            >
              {solved ? 'View' : 'Start'}
            </Button>
          ) : (
            <Button size="sm" variant="locked" aria-label={`Mission ${number}: ${statusActionLabel(state)}`}>
              {statusActionLabel(state)}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function statusActionLabel(state: MissionState): string {
  switch (state) {
    case 'opens_at_start':
      return 'Soon';
    case 'paused':
      return 'Paused';
    case 'event_ended':
      return 'Ended';
    case 'unavailable':
      return 'Down';
    default:
      return 'Locked';
  }
}
