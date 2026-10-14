import { Link } from 'react-router';
import { cn } from '../lib/cn';
import { Avatar } from './ui/Avatar';
import { Kicker, Panel } from './ui/Panel';

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  avatarUrl?: string | null;
  isYou?: boolean;
}

/** Top players plus the current player's row (light teal tint). */
export function LeaderboardPreview({ rows, viewAllTo = '/leaderboard', className }: { rows: LeaderboardRow[]; viewAllTo?: string; className?: string }) {
  return (
    <Panel className={className}>
      <div className="mb-3 flex items-center justify-between">
        <Kicker as="h2">Leaderboard</Kicker>
        <Link to={viewAllTo} className="font-label text-micro font-bold uppercase tracking-label text-ink/65 hover:text-ink">
          View all
        </Link>
      </div>
      <ol className="space-y-0.5">
        {rows.map((row) => (
          <li
            key={`${row.rank}-${row.name}`}
            aria-current={row.isYou ? 'true' : undefined}
            className={cn('flex h-8 items-center gap-3 rounded-[8px] px-2.5', row.isYou && 'bg-teal/15')}
          >
            <span className="w-5 font-mono text-sm text-ink/65 tabular-nums">{row.rank}</span>
            <Avatar src={row.avatarUrl} name={row.name} size="xs" decorative />
            <span className={cn('min-w-0 flex-1 truncate text-base text-ink', row.isYou && 'font-label font-bold uppercase')}>
              {row.name}
              {row.isYou && <span className="sr-only"> (you)</span>}
            </span>
            <span className="font-mono text-base font-semibold text-ink tabular-nums">{row.score}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
