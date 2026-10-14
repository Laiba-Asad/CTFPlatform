import type { AdminMissionRow } from '@cydemic/shared';
import { useState } from 'react';
import { Button, Input, Kicker, Modal, Notice, Panel } from '../../components/ui';
import { AdminPageTitle, EmptyRow, StatusDot, Table, Td, Th, useActionToast } from '../components/parts';
import { adminApi } from '../lib/adminApi';
import { adminKeys, useAdminMutation, useMissions } from '../lib/hooks';

export function MissionsPage({ role }: { role: 'admin' | 'viewer' }) {
  const { data, isPending } = useMissions();
  const { ok, fail } = useActionToast();
  const readonly = role !== 'admin';
  const [editing, setEditing] = useState<AdminMissionRow | null>(null);

  const inval = [adminKeys.missions, adminKeys.overview, adminKeys.leaderboard];
  const release = useAdminMutation((v: { id: string; released: boolean }) => adminApi(`/missions/${v.id}/release`, { method: 'POST', body: { released: v.released } }), inval);
  const bulk = useAdminMutation((path: 'release-all' | 'lock-all') => adminApi(`/missions/${path}`, { method: 'POST' }), inval);
  const service = useAdminMutation((v: { id: string; action: string }) => adminApi(`/missions/${v.id}/service/${v.action}`, { method: 'POST' }), inval);

  const act = (p: Promise<unknown>, msg: string) => p.then(() => ok(msg)).catch(fail);

  return (
    <div>
      <AdminPageTitle title="Missions">
        {!readonly && (
          <>
            <Button variant="secondary" size="sm" disabled={bulk.isPending} onClick={() => act(bulk.mutateAsync('release-all'), 'All missions released.')}>
              Release all
            </Button>
            <Button variant="secondary" size="sm" disabled={bulk.isPending} onClick={() => act(bulk.mutateAsync('lock-all'), 'All missions locked.')}>
              Lock all
            </Button>
          </>
        )}
      </AdminPageTitle>

      {readonly && <Notice tone="info" className="mb-4">Viewer access — mission controls are disabled.</Notice>}

      {isPending || !data ? (
        <Panel><p className="text-ink/60">Loading…</p></Panel>
      ) : (
        <Table
          head={
            <>
              <Th>#</Th>
              <Th>Mission</Th>
              <Th>Pts</Th>
              <Th>Solves</Th>
              <Th>Wrong</Th>
              <Th>Service</Th>
              <Th>Released</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {data.missions.length === 0 && <EmptyRow colSpan={8}>No missions seeded.</EmptyRow>}
          {data.missions.map((m) => (
            <tr key={m.id}>
              <Td className="font-mono text-ink/70">{m.number}</Td>
              <Td>
                <span className="font-label font-bold text-ink">{m.title}</span>
                <span className="ml-2 font-mono text-xs uppercase text-ink/50">{m.category}</span>
              </Td>
              <Td className="font-mono">{m.points}</Td>
              <Td className="font-mono">{m.solves}</Td>
              <Td className="font-mono">{m.wrong}</Td>
              <Td>
                {m.port ? (
                  <span className="flex items-center gap-1.5 font-label text-micro font-bold uppercase tracking-label text-ink/65">
                    <StatusDot tone={m.serviceStatus === 'up' ? 'up' : m.serviceStatus === 'n/a' ? 'neutral' : 'down'} />
                    {m.serviceStatus}
                    {m.restarts > 0 && <span className="text-ink">· {m.restarts}×</span>}
                  </span>
                ) : (
                  <span className="text-ink/40">—</span>
                )}
              </Td>
              <Td>
                <span className={m.released ? 'font-label text-micro font-bold uppercase tracking-label text-teal-dark' : 'font-label text-micro font-bold uppercase tracking-label text-ink/55'}>
                  {m.released ? 'Released' : 'Locked'}
                </span>
              </Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1.5">
                  {!readonly && (
                    <Button variant={m.released ? 'secondary' : 'primary'} size="sm" disabled={release.isPending} onClick={() => act(release.mutateAsync({ id: m.id, released: !m.released }), m.released ? `#${m.number} locked.` : `#${m.number} released.`)}>
                      {m.released ? 'Lock' : 'Release'}
                    </Button>
                  )}
                  {!readonly && m.port && (
                    <Button variant="ghost" size="sm" disabled={service.isPending} onClick={() => act(service.mutateAsync({ id: m.id, action: 'restart' }), `Restarted ${m.id}.`)}>
                      Restart
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
                    {readonly ? 'View' : 'Edit'}
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {editing && <EditMissionModal mission={editing} readonly={readonly} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditMissionModal({ mission, readonly, onClose }: { mission: AdminMissionRow; readonly: boolean; onClose: () => void }) {
  const { ok, fail } = useActionToast();
  const [title, setTitle] = useState(mission.title);
  const [points, setPoints] = useState(String(mission.points));
  const [difficulty, setDifficulty] = useState(String(mission.difficulty));
  const save = useAdminMutation(
    (body: Record<string, unknown>) => adminApi(`/missions/${mission.id}`, { method: 'PATCH', body }),
    [adminKeys.missions, adminKeys.overview, adminKeys.leaderboard],
  );

  return (
    <Modal
      open
      onClose={onClose}
      kicker={`Mission #${mission.number}`}
      title={mission.title}
      footer={
        !readonly && (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              loading={save.isPending}
              onClick={() =>
                save
                  .mutateAsync({ title, points: Number(points), difficulty: Number(difficulty) })
                  .then(() => { ok('Mission updated. Scores recomputed from solves.'); onClose(); })
                  .catch(fail)
              }
            >
              Save
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        <Input label="Title" value={title} disabled={readonly} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Points" type="number" min={0} value={points} disabled={readonly} onChange={(e) => setPoints(e.target.value)} hint="Changing points recomputes every solver's score." />
          <Input label="Difficulty (1–5)" type="number" min={1} max={5} value={difficulty} disabled={readonly} onChange={(e) => setDifficulty(e.target.value)} />
        </div>
        <Kicker>First solve</Kicker>
        <p className="text-base text-ink/70">{mission.firstSolveAt ? new Date(mission.firstSolveAt).toLocaleString() : 'Not solved yet.'}</p>
      </div>
    </Modal>
  );
}
