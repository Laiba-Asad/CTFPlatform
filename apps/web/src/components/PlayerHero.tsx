import type { MeResponse } from '@cydemic/shared';
import { Avatar } from './ui/Avatar';
import { HeroName } from './ui/Display';
import { Kicker, Panel } from './ui/Panel';
import { ProgressBar } from './ui/ProgressBar';
import { StatTile } from './ui/StatTile';

/** "Welcome back" card: team badge, name, team, rank / score / flags and capture progress. */
export function PlayerHero({ me, className }: { me: MeResponse; className?: string }) {
  const { user, stats } = me;
  return (
    <Panel className={className}>
      <div className="flex items-center gap-5">
        <Avatar src={user.team.avatar} name={user.team.name} size="xl" decorative />
        <div className="min-w-0">
          <Kicker>Welcome back</Kicker>
          <HeroName className="mt-1 truncate">{user.name}</HeroName>
          <p className="mt-1 font-mono text-xs uppercase tracking-label text-ink/65">Team {user.team.name}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <StatTile label="Rank" value={stats.rank ? `#${stats.rank}` : '—'} />
        <StatTile label="Score" value={stats.score} />
        <StatTile label="Flags" value={stats.flagsCaptured} suffix={`/ ${stats.totalChallenges}`} />
      </div>
      <ProgressBar className="mt-5" label="Capture progress" value={stats.flagsCaptured} max={stats.totalChallenges} />
    </Panel>
  );
}
