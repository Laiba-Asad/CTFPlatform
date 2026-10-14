import { useState } from 'react';
import { Button, Input, Notice, Panel } from '../../components/ui';
import { AdminPageTitle, EmptyRow, Table, Td, Th, useActionToast } from '../components/parts';
import { adminApi } from '../lib/adminApi';
import { adminKeys, useAdminMutation, useTeams, type AdminTeamRow } from '../lib/hooks';

export function TeamsPage({ role }: { role: 'admin' | 'viewer' }) {
  const { data, isPending } = useTeams();
  const readonly = role !== 'admin';

  return (
    <div>
      <AdminPageTitle title="Teams" />
      {readonly && <Notice tone="info" className="mb-4">Viewer access — team controls are disabled.</Notice>}
      {isPending || !data ? (
        <Panel><p className="text-ink/60">Loading…</p></Panel>
      ) : (
        <Table
          head={
            <>
              <Th>Team</Th>
              <Th>Members</Th>
              <Th>Score</Th>
              <Th>Solves</Th>
              <Th>Player cap</Th>
              <Th className="text-right">Joining</Th>
            </>
          }
        >
          {data.teams.length === 0 && <EmptyRow colSpan={6}>No teams.</EmptyRow>}
          {data.teams.map((t) => <TeamRow key={t.id} team={t} readonly={readonly} />)}
        </Table>
      )}
    </div>
  );
}

function TeamRow({ team, readonly }: { team: AdminTeamRow; readonly: boolean }) {
  const { ok, fail } = useActionToast();
  const [cap, setCap] = useState(team.playerCap == null ? '' : String(team.playerCap));
  const mut = useAdminMutation((body: Record<string, unknown>) => adminApi(`/teams/${team.id}`, { method: 'PATCH', body }), [adminKeys.teams, adminKeys.overview]);
  const run = (body: Record<string, unknown>, msg: string) => mut.mutateAsync(body).then(() => ok(msg)).catch(fail);

  return (
    <tr>
      <Td><span className="font-label font-bold text-ink">{team.name}</span></Td>
      <Td className="font-mono">{team.members}</Td>
      <Td className="font-mono">{team.score}</Td>
      <Td className="font-mono">{team.solves}</Td>
      <Td>
        <div className="flex items-center gap-1.5">
          <Input label="cap" hideLabel type="number" min={0} value={cap} disabled={readonly} className="w-20" placeholder="∞" onChange={(e) => setCap(e.target.value)} />
          {!readonly && (
            <Button variant="ghost" size="sm" disabled={mut.isPending} onClick={() => run({ playerCap: cap.trim() === '' ? null : Number(cap) }, 'Player cap updated.')}>Save</Button>
          )}
        </div>
      </Td>
      <Td className="text-right">
        {readonly ? (
          <span className="font-label text-micro font-bold uppercase tracking-label text-ink/55">{team.joinLocked ? 'Locked' : 'Open'}</span>
        ) : (
          <Button variant={team.joinLocked ? 'primary' : 'secondary'} size="sm" disabled={mut.isPending} onClick={() => run({ joinLocked: !team.joinLocked }, team.joinLocked ? 'Joining unlocked.' : 'Joining locked.')}>
            {team.joinLocked ? 'Unlock joining' : 'Lock joining'}
          </Button>
        )}
      </Td>
    </tr>
  );
}
