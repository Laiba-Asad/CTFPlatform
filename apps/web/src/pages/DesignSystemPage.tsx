import type { EventPhase, MissionSummary } from '@cydemic/shared';
import { FINAL_STRETCH_MS } from '@cydemic/shared';
import { ArrowRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LeaderboardPreview, type LeaderboardRow } from '../components/LeaderboardPreview';
import { MissionCard } from '../components/MissionCard';
import { AppShell } from '../components/layout/AppShell';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import {
  Avatar,
  Button,
  CategoryPill,
  Chip,
  DifficultyDots,
  HeroName,
  Input,
  Kicker,
  Modal,
  Notice,
  PageTitle,
  Panel,
  ProgressBar,
  StatTile,
  StatusLabel,
  Timer,
  useToast,
} from '../components/ui';

/**
 * Development-only gallery. The top half recreates the dashboard concept; the
 * bottom half shows every component state. All data here is fake display data.
 */

const desc = 'Short description of the mission goes here in two lines at most.';
const m = (number: number, category: string, difficulty: number, points: number, state: MissionSummary['state'], solves: number): MissionSummary => ({
  id: `demo-${number}`,
  number,
  title: 'Mission placeholder',
  description: desc,
  category,
  difficulty,
  points,
  state,
  solves,
});

const missions: MissionSummary[] = [
  m(1, 'Web', 3, 100, 'solved', 12),
  m(2, 'Web', 4, 200, 'available', 7),
  m(3, 'Network', 3, 300, 'available', 9),
  m(4, 'Web', 2, 400, 'available', 15),
  m(5, 'Network', 5, 500, 'locked', 0),
  m(6, 'Web', 4, 250, 'locked', 0),
  m(7, 'Network', 2, 150, 'available', 11),
  m(8, 'Web', 3, 350, 'available', 6),
  m(9, 'Network', 5, 450, 'locked', 0),
];

const leaderboard: LeaderboardRow[] = [
  { rank: 1, name: 'player_14', score: 1200 },
  { rank: 2, name: 'player_07', score: 1050 },
  { rank: 3, name: 'player_22', score: 900 },
  { rank: 5, name: 'PLAYER_01', score: 300, isYou: true },
];

const timerDemos: Array<{ key: string; phase: EventPhase; label: string; remaining: number }> = [
  { key: 'upcoming', phase: 'upcoming', label: 'Starts in', remaining: 26 * 3_600_000 + 754_000 },
  { key: 'live', phase: 'live', label: 'Live', remaining: 2 * 3_600_000 + 876_000 },
  { key: 'final', phase: 'live', label: 'Final 10 min', remaining: FINAL_STRETCH_MS - 1000 },
  { key: 'paused', phase: 'paused', label: 'Paused', remaining: 3_600_000 },
  { key: 'ended', phase: 'ended', label: 'Ended', remaining: 0 },
];

function useDemoCountdown(initialMs: number, running: boolean) {
  const [ms, setMs] = useState(initialMs);
  useEffect(() => setMs(initialMs), [initialMs]);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setMs((v) => Math.max(0, v - 1000)), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return ms;
}

export default function DesignSystemPage() {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [timerKey, setTimerKey] = useState('live');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const demo = timerDemos.find((t) => t.key === timerKey)!;
  const remaining = useDemoCountdown(demo.remaining, demo.phase === 'live' || demo.phase === 'upcoming');

  return (
    <AppShell
      topBar={<TopBar right={<Timer phase={demo.phase} remainingMs={remaining} finalStretch={demo.key === 'final'} />} />}
      sidebar={<Sidebar player={{ username: 'PLAYER_01', teamName: 'Z3R0D4Y' }} activeKey="missions" />}
    >
      {/* Top row: hero, next objective, leaderboard preview */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Panel className="md:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-5">
            <Avatar name="Z3R0D4Y" size="xl" decorative />
            <div className="min-w-0">
              <Kicker>Welcome back</Kicker>
              <HeroName className="mt-1 truncate">PLAYER_01</HeroName>
              <p className="mt-1 font-mono text-xs uppercase tracking-label text-ink/65">Team Z3R0D4Y</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <StatTile label="Rank" value="#5" />
            <StatTile label="Score" value="300" />
            <StatTile label="Flags" value="3" suffix="/ 15" />
          </div>
          <ProgressBar className="mt-5" label="Capture progress" value={3} max={15} />
        </Panel>

        <Panel className="flex flex-col">
          <Kicker>Next objective</Kicker>
          <p className="mt-3 font-label text-card font-bold text-ink">Mission placeholder</p>
          <p className="mt-1 font-mono text-xs uppercase tracking-label text-ink/65">Web · 200 XP</p>
          <div className="mt-auto pt-6">
            <Button iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>Access mission</Button>
          </div>
        </Panel>

        <LeaderboardPreview rows={leaderboard} />
      </div>

      {/* Missions */}
      <section className="mt-8" aria-labelledby="missions-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <PageTitle as="h2">
              <span id="missions-title">Missions</span>
            </PageTitle>
            <p className="mt-1 text-sm text-ink/65">Showing 9 of 15 missions</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
              {['All', 'Web', 'Network'].map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c}
                </Chip>
              ))}
            </div>
            <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
            <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
              {['All', 'Solved', 'Unsolved', 'Locked'].map((s) => (
                <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                  {s}
                </Chip>
              ))}
            </div>
            <Input label="Search missions" hideLabel shape="pill" placeholder="Search missions..." iconLeft={<Search />} className="w-full sm:w-48" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {missions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} onOpen={() => setModalOpen(true)} />
          ))}
        </div>
      </section>

      {/* Component states */}
      <section className="mt-12 border-t-[1.5px] border-line pt-8" aria-labelledby="components-title">
        <PageTitle as="h2">
          <span id="components-title">Components</span>
        </PageTitle>
        <p className="mt-1 text-sm text-ink/65">Development only. Not included in production builds.</p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Panel>
            <Kicker as="h3">Timer states</Kicker>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Timer demo state">
              {timerDemos.map((t) => (
                <Chip key={t.key} active={t.key === timerKey} onClick={() => setTimerKey(t.key)}>
                  {t.label}
                </Chip>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 rounded-control bg-black p-4">
              {timerDemos.map((t) => (
                <Timer key={t.key} phase={t.phase} remainingMs={t.remaining} finalStretch={t.key === 'final'} />
              ))}
            </div>
          </Panel>

          <Panel>
            <Kicker as="h3">Buttons and chips</Kicker>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button>Start</Button>
              <Button variant="secondary">View</Button>
              <Button variant="locked">Locked</Button>
              <Button variant="ghost">Ghost</Button>
              <Button loading>Submitting</Button>
              <Button size="lg" iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>
                Enter the arena
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip active>Active</Chip>
              <Chip>Inactive</Chip>
            </div>
          </Panel>

          <Panel>
            <Kicker as="h3">Categories, states, difficulty</Kicker>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Web', 'Network', 'Crypto', 'Forensics', 'Pwn', 'Reversing', 'OSINT', 'Misc', 'New category'].map((c) => (
                <CategoryPill key={c} category={c} />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-5">
              <StatusLabel state="available" />
              <StatusLabel state="solved" />
              <StatusLabel state="locked" />
            </div>
            <div className="mt-4 flex flex-wrap gap-5">
              {[1, 3, 5].map((d) => (
                <DifficultyDots key={d} value={d} />
              ))}
            </div>
          </Panel>

          <Panel>
            <Kicker as="h3">Avatar slots</Kicker>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <Avatar name="Team" size="xs" />
              <Avatar name="Team" size="sm" />
              <Avatar name="Team" size="md" />
              <Avatar name="Team" size="lg" />
              <Avatar name="Team" size="xl" />
              <span className="rounded-control bg-black p-2">
                <Avatar name="Team" size="md" tone="dark" />
              </span>
              <Avatar name="Broken image" src="/avatars/does-not-exist.png" size="lg" />
            </div>
            <p className="mt-3 text-sm text-ink/65">
              Missing or broken images fall back to this placeholder. Real art in public/avatars/&lt;team-id&gt;.png appears automatically.
            </p>
          </Panel>

          <Panel>
            <Kicker as="h3">Feedback</Kicker>
            <div className="mt-3 space-y-3">
              <Notice tone="success" title="Flag captured">+200 XP added to your score.</Notice>
              <Notice tone="error" title="Incorrect flag">That is not it. Attempt 2 of 5 this minute.</Notice>
              <Notice tone="warning" title="Cooling down">Too many attempts. Try again in 01:45.</Notice>
              <Notice tone="info">Submissions open when the event goes live.</Notice>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => toast({ tone: 'success', title: 'Flag captured', description: '+100 XP' })}>
                Success toast
              </Button>
              <Button size="sm" variant="secondary" onClick={() => toast({ tone: 'error', title: 'Incorrect flag', description: 'Check the format and try again.' })}>
                Error toast
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
                Open modal
              </Button>
            </div>
          </Panel>

          <Panel>
            <Kicker as="h3">Inputs</Kicker>
            <div className="mt-3 space-y-4">
              <Input label="Username" placeholder="player_01" hint="3-24 characters: letters, numbers, _ and -" />
              <Input label="Flag" placeholder="Enter flag" error="This flag is not in the expected format" defaultValue="cydemic" />
            </div>
          </Panel>
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        kicker="Mission 01 · Web"
        title="Mission placeholder"
        size="lg"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input label="Flag" placeholder="Enter flag" className="flex-1" autoComplete="off" spellCheck={false} />
            <Button size="lg">Submit</Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <CategoryPill category="Web" />
          <span className="font-mono text-base font-semibold">+100 XP</span>
          <DifficultyDots value={3} />
        </div>
        <p className="text-body text-ink/80">
          Placeholder mission briefing. The detail view, hints, attachments and flag submission are wired up in Phase 4.
        </p>
      </Modal>
    </AppShell>
  );
}
