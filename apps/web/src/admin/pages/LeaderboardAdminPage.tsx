import { useState } from 'react';
import { Button, Input, Modal, Notice, Panel } from '../../components/ui';
import { AdminPageTitle, EmptyRow, Table, Td, Th, useActionToast } from '../components/parts';
import { adminApi } from '../lib/adminApi';
import { adminKeys, useAdminLeaderboard, useAdminMutation } from '../lib/hooks';

export function LeaderboardAdminPage({ role }: { role: 'admin' | 'viewer' }) {
  const { data, isPending } = useAdminLeaderboard();
  const { ok, fail } = useActionToast();
  const readonly = role !== 'admin';
  const [adjustFor, setAdjustFor] = useState<{ id: string; name: string } | null>(null);

  const recompute = useAdminMutation(() => adminApi<{ note: string }>('/leaderboard/recompute'), []);

  return (
    <div>
      <AdminPageTitle title="Leaderboard">
        {!readonly && (
          <Button variant="secondary" size="sm" disabled={recompute.isPending} onClick={() => recompute.mutateAsync().then((r) => ok(r.note)).catch(fail)}>
            Recompute
          </Button>
        )}
      </AdminPageTitle>

      <Notice tone="info" className="mb-4">Admins always see live, unfrozen scores. Scores are derived from solves plus adjustments.</Notice>

      {isPending || !data ? (
        <Panel><p className="text-ink/60">Loading…</p></Panel>
      ) : (
        <Table
          head={
            <>
              <Th>#</Th>
              <Th>Player</Th>
              <Th>Team</Th>
              <Th>Score</Th>
              <Th>Solves</Th>
              <Th>Adjust</Th>
              <Th className="text-right" />
            </>
          }
        >
          {data.players.length === 0 && <EmptyRow colSpan={7}>No players yet.</EmptyRow>}
          {data.players.map((r) => (
            <tr key={r.userId}>
              <Td className="font-mono text-ink/70">{r.rank}</Td>
              <Td><span className="font-label font-bold text-ink">{r.name}</span></Td>
              <Td className="text-ink/70">{r.teamName}</Td>
              <Td className="font-mono">
                {r.score}
                {r.adjustmentPoints !== 0 && <span className="ml-1 text-xs text-ink/50">({r.solvePoints}{r.adjustmentPoints > 0 ? '+' : ''}{r.adjustmentPoints})</span>}
              </Td>
              <Td className="font-mono">{r.flags}</Td>
              <Td className="font-mono">{r.adjustmentPoints > 0 ? `+${r.adjustmentPoints}` : r.adjustmentPoints}</Td>
              <Td className="text-right">
                {!readonly && <Button variant="ghost" size="sm" onClick={() => setAdjustFor({ id: r.userId, name: r.name })}>Adjust</Button>}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {adjustFor && <AdjustDialog player={adjustFor} onClose={() => setAdjustFor(null)} />}
    </div>
  );
}

function AdjustDialog({ player, onClose }: { player: { id: string; name: string }; onClose: () => void }) {
  const { ok, fail } = useActionToast();
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const adjust = useAdminMutation(
    (body: { userId: string; points: number; reason: string }) => adminApi('/leaderboard/adjustments', { method: 'POST', body }),
    [adminKeys.leaderboard, adminKeys.overview, adminKeys.player(player.id)],
  );

  const valid = Number.isInteger(Number(points)) && Number(points) !== 0 && reason.trim().length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      kicker="Score adjustment"
      title={`Adjust ${player.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={adjust.isPending}
            disabled={!valid}
            onClick={() => adjust.mutateAsync({ userId: player.id, points: Number(points), reason: reason.trim() }).then(() => { ok('Adjustment applied.'); onClose(); }).catch(fail)}
          >
            Apply
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Points (+/−, non-zero)" type="number" value={points} onChange={(e) => setPoints(e.target.value)} hint="Positive adds, negative deducts. Recorded in the audit log." />
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. first-blood bonus / penalty for sharing" />
      </div>
    </Modal>
  );
}
