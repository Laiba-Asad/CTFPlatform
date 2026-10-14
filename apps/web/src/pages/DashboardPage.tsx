import { ArrowRight, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { LeaderboardPreview } from '../components/LeaderboardPreview';
import { MissionCard } from '../components/MissionCard';
import { MissionModal } from '../components/MissionModal';
import { PlayerHero } from '../components/PlayerHero';
import { Button, Chip, Input, Kicker, Notice, PageTitle, Panel } from '../components/ui';
import { useMe } from '../lib/auth';
import { useChallenges } from '../lib/challenges';
import { useLeaderboard } from '../lib/leaderboard';
import { useEventClock } from '../lib/useEventClock';

type StatusFilter = 'All' | 'Solved' | 'Unsolved' | 'Locked';

const NEXT_OBJECTIVE_TEXT: Record<string, string> = {
  upcoming: 'Missions open when the event starts.',
  paused: 'The event is paused. Hang tight.',
  ended: 'The event has ended.',
};

export function DashboardPage() {
  const me = useMe();
  const challenges = useChallenges();
  const leaderboard = useLeaderboard();
  const clock = useEventClock();
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const all = challenges.data?.challenges ?? [];
  const accepting = challenges.data?.acceptingSubmissions ?? false;
  const categories = useMemo(() => ['All', ...[...new Set(all.map((c) => c.category))].sort()], [all]);

  const filtered = all.filter((c) => {
    if (category !== 'All' && c.category !== category) return false;
    if (status === 'Solved' && c.state !== 'solved') return false;
    if (status === 'Unsolved' && c.state === 'solved') return false;
    if (status === 'Locked' && c.state !== 'locked') return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Next objective: the lowest-points mission that is released and not solved.
  const nextObjective = all
    .filter((c) => c.state === 'available')
    .sort((a, b) => a.points - b.points)[0];
  const openMission = all.find((c) => c.id === openId) ?? null;

  // Top 5 plus the viewer's row for the dashboard leaderboard card.
  const lbRows = useMemo(() => {
    const players = leaderboard.data?.players ?? [];
    const top = players.slice(0, 5);
    const you = players.find((p) => p.isYou);
    if (you && !top.some((p) => p.isYou)) top.push(you);
    return top.map((p) => ({ rank: p.rank, name: p.name, score: p.score, avatarUrl: p.avatar, isYou: p.isYou }));
  }, [leaderboard.data]);

  if (me.isError) return <Notice tone="error" title="Could not load your profile">Reload the page to try again.</Notice>;
  if (!me.data) return <div aria-busy="true" />;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <PlayerHero me={me.data} className="md:col-span-2 xl:col-span-1" />

        <Panel className="flex flex-col">
          <Kicker>Next objective</Kicker>
          {nextObjective ? (
            <>
              <p className="mt-3 font-label text-card font-bold text-ink">{nextObjective.title}</p>
              <p className="mt-1 font-mono text-xs uppercase tracking-label text-ink/65">
                {nextObjective.category} · {nextObjective.points} XP
              </p>
              <div className="mt-auto pt-6">
                <Button onClick={() => setOpenId(nextObjective.id)} iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>
                  Access mission
                </Button>
              </div>
            </>
          ) : (
            <EmptyState
              text={
                accepting
                  ? 'All released missions solved. Nice work.'
                  : (clock && NEXT_OBJECTIVE_TEXT[clock.phase]) ?? 'Missions open when the event goes live.'
              }
            />
          )}
        </Panel>

        {lbRows.length > 0 ? (
          <LeaderboardPreview rows={lbRows} />
        ) : (
          <Panel className="flex flex-col">
            <Kicker as="h2">Leaderboard</Kicker>
            <EmptyState text="Rankings appear once the first flag is captured." />
          </Panel>
        )}
      </div>

      <section className="mt-8" aria-labelledby="missions-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <PageTitle as="h2"><span id="missions-title">Missions</span></PageTitle>
            <p className="mt-1 text-sm text-ink/65">
              Showing {filtered.length} of {all.length} missions
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
              ))}
            </div>
            <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
            <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
              {(['All', 'Solved', 'Unsolved', 'Locked'] as StatusFilter[]).map((s) => (
                <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s}</Chip>
              ))}
            </div>
            <Input
              label="Search missions"
              hideLabel
              shape="pill"
              placeholder="Search missions..."
              iconLeft={<Search />}
              className="w-full sm:w-48"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {all.length === 0 ? (
          <Panel className="mt-4">
            <EmptyState text={challenges.isLoading ? 'Loading missions...' : 'No missions are available yet.'} />
          </Panel>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((mission) => (
              <MissionCard key={mission.id} mission={mission} onOpen={() => setOpenId(mission.id)} />
            ))}
          </div>
        )}
      </section>

      <MissionModal mission={openMission} acceptingSubmissions={accepting} onClose={() => setOpenId(null)} />
    </>
  );
}

function EmptyState({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-2 py-4 text-ink/65">
      {icon && <span className="grid size-9 place-items-center rounded-control border-[1.5px] border-dashed border-ink/25">{icon}</span>}
      <p className="text-base">{text}</p>
    </div>
  );
}
