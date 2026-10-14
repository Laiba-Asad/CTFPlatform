import type { AdminEventState } from '@cydemic/shared';
import { formatCountdown } from '@cydemic/shared';
import { useState } from 'react';
import { Button, Input, Kicker, Notice, Panel, Pill } from '../../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdminPageTitle, useActionToast } from '../components/parts';
import { adminApi } from '../lib/adminApi';
import { adminKeys, useAdminEvent, useAdminMutation } from '../lib/hooks';

const STATUS_LABEL: Record<AdminEventState['status'], string> = {
  waiting: 'Waiting to start',
  live: 'Live',
  paused: 'Paused',
  ended: 'Ended',
};

export function EventPage({ role }: { role: 'admin' | 'viewer' }) {
  const { data, isPending } = useAdminEvent();
  const { ok, fail } = useActionToast();
  const readonly = role !== 'admin';
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const inval = [adminKeys.event, adminKeys.overview];
  const start = useAdminMutation(() => adminApi<AdminEventState>('/event/start', { method: 'POST' }), inval);
  const pause = useAdminMutation(() => adminApi<AdminEventState>('/event/pause', { method: 'POST' }), inval);
  const resume = useAdminMutation(() => adminApi<AdminEventState>('/event/resume', { method: 'POST' }), inval);
  const end = useAdminMutation(() => adminApi<AdminEventState>('/event/end', { method: 'POST' }), inval);
  const extend = useAdminMutation((minutes: number) => adminApi('/event/extend', { method: 'POST', body: { minutes } }), inval);
  const freeze = useAdminMutation((body: Record<string, unknown>) => adminApi('/event/freeze', { method: 'POST', body }), inval);
  const maintenance = useAdminMutation((on: boolean) => adminApi('/event/maintenance', { method: 'POST', body: { maintenance: on } }), inval);

  if (isPending || !data) return <div><AdminPageTitle title="Event" /><Panel><p className="text-ink/60">Loading…</p></Panel></div>;

  const run = (p: Promise<unknown>, msg: string) => p.then(() => ok(msg)).catch(fail);
  const clock = data.status === 'ended' ? '00:00:00' : formatCountdown(data.remainingMs, data.remainingMs >= 86_400_000);

  return (
    <div className="space-y-5">
      <AdminPageTitle title="Event">
        <Pill>{STATUS_LABEL[data.status]}</Pill>
      </AdminPageTitle>

      {readonly && <Notice tone="info">You have viewer access. Event controls are disabled.</Notice>}

      {/* Shared clock */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Kicker className="mb-1">Shared clock ({data.durationMinutes} min)</Kicker>
            <p className="font-mono text-stat tabular-nums text-ink">{clock}</p>
            <p className="mt-1 text-sm text-ink/60">
              {data.status === 'waiting' && 'Everyone sees the same countdown once you start.'}
              {data.status === 'live' && 'Live — the same countdown for every player.'}
              {data.status === 'paused' && 'Paused — remaining time is frozen for everyone.'}
              {data.status === 'ended' && 'The event has ended. Submissions are closed.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.status === 'waiting' && (
              <Button variant="primary" disabled={readonly || start.isPending} onClick={() => setConfirmStart(true)}>Start event now</Button>
            )}
            {data.status === 'live' && (
              <Button variant="secondary" disabled={readonly || pause.isPending} onClick={() => run(pause.mutateAsync(), 'Event paused.')}>Pause</Button>
            )}
            {data.status === 'paused' && (
              <Button variant="primary" disabled={readonly || resume.isPending} onClick={() => run(resume.mutateAsync(), 'Event resumed.')}>Resume</Button>
            )}
            {(data.status === 'live' || data.status === 'paused') && (
              <Button variant="secondary" disabled={readonly || end.isPending} onClick={() => setConfirmEnd(true)}>End now</Button>
            )}
          </div>
        </div>

        {(data.status === 'live' || data.status === 'paused') && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <span className="font-label text-micro font-bold uppercase tracking-label text-ink/55">Extend</span>
            {[5, 15, 30, -5, -15, -30].map((m) => (
              <Button key={m} variant="secondary" size="sm" disabled={readonly || extend.isPending} onClick={() => run(extend.mutateAsync(m), `Clock ${m > 0 ? 'extended' : 'trimmed'} by ${Math.abs(m)}m.`)}>
                {m > 0 ? `+${m}` : m}m
              </Button>
            ))}
          </div>
        )}
      </Panel>

      {/* Freeze */}
      <Panel>
        <Kicker className="mb-3">Leaderboard freeze</Kicker>
        <p className="mb-3 text-base text-ink/70">
          Freezing shows players a snapshot; you always see live scores. {data.leaderboardFrozen ? 'Currently FROZEN.' : 'Currently live.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={data.leaderboardFrozen ? 'secondary' : 'primary'} size="sm" disabled={readonly || freeze.isPending} onClick={() => run(freeze.mutateAsync({ frozen: !data.leaderboardFrozen }), data.leaderboardFrozen ? 'Leaderboard unfrozen.' : 'Leaderboard frozen.')}>
            {data.leaderboardFrozen ? 'Unfreeze now' : 'Freeze now'}
          </Button>
          <AutoFreeze current={data.freezeMinutesBeforeEnd} disabled={readonly} onSave={(m) => run(freeze.mutateAsync({ minutesBeforeEnd: m }), m == null ? 'Auto-freeze disabled.' : `Auto-freeze set to ${m}m before end.`)} />
        </div>
      </Panel>

      {/* Maintenance */}
      <Panel>
        <Kicker className="mb-3">Maintenance mode</Kicker>
        <p className="mb-3 text-base text-ink/70">
          When on, the player site shows a calm “back soon” page. The admin area stays available. {data.maintenance ? 'Currently ON.' : 'Currently off.'}
        </p>
        <Button variant={data.maintenance ? 'secondary' : 'primary'} size="sm" disabled={readonly || maintenance.isPending} onClick={() => run(maintenance.mutateAsync(!data.maintenance), data.maintenance ? 'Maintenance turned off.' : 'Maintenance turned on.')}>
          {data.maintenance ? 'Turn maintenance off' : 'Turn maintenance on'}
        </Button>
      </Panel>

      <ConfirmDialog
        open={confirmStart}
        onClose={() => setConfirmStart(false)}
        title="Start the event now?"
        confirmLabel="Start event"
        loading={start.isPending}
        onConfirm={() => run(start.mutateAsync(), 'Event started.').then(() => setConfirmStart(false))}
      >
        This starts the shared {data.durationMinutes}-minute clock for every player at once. Players waiting now flip to their missions within a few seconds.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        tone="danger"
        title="End the event now?"
        confirmLabel="End event"
        loading={end.isPending}
        onConfirm={() => run(end.mutateAsync(), 'Event ended.').then(() => setConfirmEnd(false))}
      >
        Submissions close immediately for everyone. Scores and the leaderboard stay visible, read-only.
      </ConfirmDialog>
    </div>
  );
}

function AutoFreeze({ current, disabled, onSave }: { current: number | null; disabled: boolean; onSave: (m: number | null) => void }) {
  const [minutes, setMinutes] = useState(String(current ?? ''));
  return (
    <div className="flex items-end gap-2">
      <Input label="Auto-freeze minutes before end" type="number" min={1} value={minutes} disabled={disabled} className="w-56" onChange={(e) => setMinutes(e.target.value)} />
      <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onSave(minutes.trim() === '' ? null : Number(minutes))}>
        Save
      </Button>
    </div>
  );
}
