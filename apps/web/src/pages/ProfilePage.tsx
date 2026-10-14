import { Flag } from 'lucide-react';
import { Avatar, CategoryPill, Kicker, Notice, PageTitle, Panel, StatTile } from '../components/ui';
import { useMe } from '../lib/auth';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** The player's team badge (large), identity, stats and solved missions. */
export function ProfilePage() {
  const me = useMe();

  if (me.isError) return <Notice tone="error" title="Could not load your profile">Reload the page to try again.</Notice>;
  if (!me.data) return <div aria-busy="true" />;
  const { user, stats, solved } = me.data;

  return (
    <>
      <PageTitle>Profile</PageTitle>

      <Panel padding="lg" className="mt-4">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar src={user.team.avatar} name={`${user.team.name} team badge`} size="2xl" />
          <div className="min-w-0 flex-1">
            <Kicker>Operator</Kicker>
            <p className="mt-1 truncate font-label text-stat font-bold text-ink">{user.name}</p>
            <p className="mt-1 font-mono text-sm uppercase tracking-label text-ink/65">
              Team <span className="font-semibold text-teal-dark">{user.team.name}</span>
            </p>
            {user.team.tagline && <p className="mt-2 text-base text-ink/65">{user.team.tagline}</p>}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatTile label="Rank" value={stats.rank ? `#${stats.rank}` : '—'} />
          <StatTile label="Score" value={stats.score} suffix="XP" />
          <StatTile label="Flags captured" value={stats.flagsCaptured} suffix={`/ ${stats.totalChallenges}`} />
        </div>
      </Panel>

      <Panel className="mt-4" aria-labelledby="solved-title">
        <Kicker as="h2">
          <span id="solved-title">Solved missions</span>
        </Kicker>
        {solved.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 text-ink/65">
            <span className="grid size-9 place-items-center rounded-control border-[1.5px] border-dashed border-ink/25">
              <Flag className="size-4" aria-hidden="true" />
            </span>
            <p className="text-base">No flags captured yet. Solved missions will be listed here.</p>
          </div>
        ) : (
          <table className="mt-3 w-full text-left text-base">
            <thead>
              <tr className="border-b-[1.5px] border-line font-label text-micro uppercase tracking-label text-ink/65">
                <th className="py-2 pr-3 font-bold">Mission</th>
                <th className="py-2 pr-3 font-bold">Category</th>
                <th className="py-2 pr-3 text-right font-bold">Points</th>
                <th className="py-2 text-right font-bold">Solved</th>
              </tr>
            </thead>
            <tbody>
              {solved.map((s) => (
                <tr key={s.challengeId} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="mr-2 font-mono text-sm text-ink/65">{String(s.number).padStart(2, '0')}</span>
                    {s.title}
                  </td>
                  <td className="py-2.5 pr-3">
                    <CategoryPill category={s.category} />
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono font-semibold">+{s.points}</td>
                  <td className="py-2.5 text-right font-mono text-sm text-ink/65">{dateFormat.format(new Date(s.solvedAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
