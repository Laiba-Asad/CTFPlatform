import { Snowflake } from 'lucide-react';
import { useState } from 'react';
import { ScoreChart } from '../components/ScoreChart';
import { Avatar, Chip, Kicker, Notice, PageTitle, Panel } from '../components/ui';
import { cn } from '../lib/cn';
import { useLeaderboard } from '../lib/leaderboard';

export function LeaderboardPage() {
  const board = useLeaderboard();
  const [tab, setTab] = useState<'players' | 'teams'>('players');

  return (
    <>
      <PageTitle>Leaderboard</PageTitle>

      <div className="mt-4 flex items-center gap-2">
        <Chip active={tab === 'players'} onClick={() => setTab('players')}>Players</Chip>
        <Chip active={tab === 'teams'} onClick={() => setTab('teams')}>Teams</Chip>
        {board.data?.frozen && (
          <span className="ml-1 inline-flex items-center gap-1.5 font-label text-micro font-bold uppercase tracking-label text-teal-dark">
            <Snowflake className="size-3.5" aria-hidden="true" />
            Frozen — snapshot
          </span>
        )}
      </div>

      {board.isError ? (
        <Notice tone="error" className="mt-4" title="Could not load the leaderboard">Reload the page to try again.</Notice>
      ) : !board.data ? (
        <Panel className="mt-4"><p className="text-base text-ink/65" aria-busy="true">Loading…</p></Panel>
      ) : (
        <>
          <Panel className="mt-4" padding="none">
            {tab === 'players' ? <PlayersTable rows={board.data.players} /> : <TeamsTable rows={board.data.teams} />}
          </Panel>

          <Panel className="mt-4" aria-labelledby="chart-title">
            <Kicker as="h2"><span id="chart-title">Score over time</span></Kicker>
            <ScoreChart className="mt-3" series={board.data.series} />
          </Panel>
        </>
      )}
    </>
  );
}

function HeadRow({ cols }: { cols: string[] }) {
  return (
    <tr className="border-b-[1.5px] border-line font-label text-micro uppercase tracking-label text-ink/65">
      {cols.map((c, i) => (
        <th key={c} className={cn('px-4 py-2.5 font-bold', i >= 2 && 'text-right')}>{c}</th>
      ))}
    </tr>
  );
}

function PlayersTable({ rows }: { rows: import('@cydemic/shared').LeaderboardEntry[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full text-left text-base">
      <thead><HeadRow cols={['#', 'Player', 'Flags', 'Score']} /></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.rank}-${r.name}`} className={cn('border-b border-line last:border-0', r.isYou && 'bg-teal/15')}>
            <td className="px-4 py-2.5 font-mono text-sm text-ink/65 tabular-nums">{r.rank}</td>
            <td className="px-4 py-2.5">
              <span className="flex items-center gap-2.5">
                <Avatar src={r.avatar} name={r.teamName} size="xs" decorative />
                <span className={cn('truncate', r.isYou && 'font-label font-bold uppercase')}>{r.name}</span>
                <span className="font-mono text-xs uppercase tracking-label text-ink/50">{r.teamName}</span>
              </span>
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-sm text-ink/65 tabular-nums">{r.flags}</td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{r.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TeamsTable({ rows }: { rows: import('@cydemic/shared').TeamLeaderboardEntry[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full text-left text-base">
      <thead><HeadRow cols={['#', 'Team', 'Members', 'Score']} /></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.teamId} className={cn('border-b border-line last:border-0', r.isYours && 'bg-teal/15')}>
            <td className="px-4 py-2.5 font-mono text-sm text-ink/65 tabular-nums">{r.rank}</td>
            <td className="px-4 py-2.5">
              <span className="flex items-center gap-2.5">
                <Avatar src={r.avatar} name={r.teamName} size="xs" decorative />
                <span className={cn('font-label font-bold uppercase', r.isYours ? 'text-ink' : 'text-ink/90')}>{r.teamName}</span>
              </span>
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-sm text-ink/65 tabular-nums">{r.members}</td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{r.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty() {
  return <p className="px-4 py-5 text-base text-ink/65">No scores yet. Rankings appear once the first flag is captured.</p>;
}
