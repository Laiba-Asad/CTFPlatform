import { CircleDot, Flag, TriangleAlert, UserPlus, Wrench } from 'lucide-react';
import type { FeedItem } from '@cydemic/shared';
import { Kicker, Panel, StatTile } from '../../components/ui';
import { AdminPageTitle, StatusDot } from '../components/parts';
import { useOverview } from '../lib/hooks';

const FEED_ICON = { solve: Flag, wrong: CircleDot, join: UserPlus, admin: Wrench } as const;

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export function OverviewPage() {
  const { data, isPending } = useOverview();

  return (
    <div>
      <AdminPageTitle title="Overview" />
      {isPending || !data ? (
        <Panel><p className="text-ink/60">Loading live stats…</p></Panel>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Players" value={data.totals.players} />
            <StatTile label="Active now" value={data.totals.activePlayers} />
            <StatTile label="Solves" value={data.totals.solves} />
            <StatTile label="Wrong" value={data.totals.wrong} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Attention */}
            <Panel className="lg:col-span-1">
              <Kicker className="mb-3">Needs attention</Kicker>
              {data.attention.length === 0 ? (
                <p className="text-base text-ink/60">Nothing flagged. All quiet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.attention.map((a, i) => (
                    <li key={i} className="flex gap-2 text-base text-ink">
                      <TriangleAlert className={a.level === 'warn' ? 'mt-0.5 size-4 shrink-0 text-ink' : 'mt-0.5 size-4 shrink-0 text-ink/50'} aria-hidden="true" />
                      <span>{a.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* Services */}
            <Panel className="lg:col-span-2">
              <Kicker className="mb-3">Challenge services</Kicker>
              {data.services.length === 0 ? (
                <p className="text-base text-ink/60">No web services are being supervised.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {data.services.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2">
                      <span className="truncate font-mono text-sm text-ink">{s.id} · {s.title}</span>
                      <span className="flex shrink-0 items-center gap-1.5 font-label text-micro font-bold uppercase tracking-label text-ink/65">
                        <StatusDot tone={s.status === 'up' ? 'up' : s.status === 'n/a' ? 'neutral' : 'down'} />
                        {s.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Feed */}
            <Panel>
              <Kicker className="mb-3">Live activity</Kicker>
              <ul className="space-y-2">
                {data.feed.slice(0, 14).map((f: FeedItem) => {
                  const Icon = FEED_ICON[f.kind];
                  return (
                    <li key={f.id} className="flex items-center gap-2.5 text-base">
                      <Icon className="size-3.5 shrink-0 text-ink/55" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-ink">{f.text}</span>
                      <span className="shrink-0 font-mono text-xs text-ink/50">{timeAgo(f.at)}</span>
                    </li>
                  );
                })}
                {data.feed.length === 0 && <li className="text-base text-ink/60">No activity yet.</li>}
              </ul>
            </Panel>

            {/* Per team */}
            <Panel>
              <Kicker className="mb-3">Team standings</Kicker>
              <ul className="space-y-1.5">
                {data.perTeam.map((t) => (
                  <li key={t.teamId} className="flex items-center justify-between gap-2 text-base">
                    <span className="truncate text-ink">{t.teamName}</span>
                    <span className="shrink-0 font-mono text-ink/70">
                      {t.score} pts · {t.players} players
                    </span>
                  </li>
                ))}
                {data.perTeam.length === 0 && <li className="text-base text-ink/60">No teams with players yet.</li>}
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
