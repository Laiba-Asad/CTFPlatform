import type { AdminPlayerRow } from '@cydemic/shared';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Button, Chip, Input, Kicker, Modal, Notice, Panel } from '../../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdminPageTitle, EmptyRow, Table, Td, Th, useActionToast } from '../components/parts';
import { adminApi } from '../lib/adminApi';
import { adminKeys, useAdminMutation, usePlayer, usePlayers, useTeams } from '../lib/hooks';

type SortKey = 'score' | 'name' | 'joined' | 'lastSeen' | 'wrong';

export function PlayersPage({ role }: { role: 'admin' | 'viewer' }) {
  const readonly = role !== 'admin';
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | 'active' | 'banned'>('');
  const [sort, setSort] = useState<SortKey>('score');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const query = `?page=${page}&pageSize=50&sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ''}${status ? `&status=${status}` : ''}`;
  const { data, isPending } = usePlayers(query);

  return (
    <div>
      <AdminPageTitle title="Players" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          label="Search players"
          hideLabel
          shape="pill"
          placeholder="Search by name…"
          iconLeft={<Search />}
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="w-64"
        />
        {(['', 'active', 'banned'] as const).map((s) => (
          <Chip key={s || 'all'} active={status === s} onClick={() => { setStatus(s); setPage(1); }}>
            {s === '' ? 'All' : s}
          </Chip>
        ))}
        <span className="ml-auto font-label text-micro font-bold uppercase tracking-label text-ink/55">Sort</span>
        {(['score', 'name', 'joined', 'lastSeen', 'wrong'] as SortKey[]).map((s) => (
          <Chip key={s} active={sort === s} onClick={() => setSort(s)}>{s}</Chip>
        ))}
      </div>

      {isPending || !data ? (
        <Panel><p className="text-ink/60">Loading…</p></Panel>
      ) : (
        <>
          <Table
            head={
              <>
                <Th>Name</Th>
                <Th>Team</Th>
                <Th>Score</Th>
                <Th>Solves</Th>
                <Th>Wrong</Th>
                <Th>Status</Th>
                <Th className="text-right">Joined</Th>
              </>
            }
          >
            {data.items.length === 0 && <EmptyRow colSpan={7}>No players match.</EmptyRow>}
            {data.items.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-bg" onClick={() => setOpenId(p.id)}>
                <Td><span className="font-label font-bold text-ink">{p.name}</span></Td>
                <Td className="text-ink/70">{p.teamName}</Td>
                <Td className="font-mono">{p.score}</Td>
                <Td className="font-mono">{p.solves}</Td>
                <Td className="font-mono">{p.wrong}</Td>
                <Td>
                  <span className={p.status === 'banned' ? 'font-label text-micro font-bold uppercase tracking-label text-ink' : 'font-label text-micro font-bold uppercase tracking-label text-ink/55'}>
                    {p.status === 'banned' ? 'Banned' : 'Active'}
                  </span>
                </Td>
                <Td className="text-right font-mono text-xs text-ink/55">{new Date(p.joinedAt).toLocaleDateString()}</Td>
              </tr>
            ))}
          </Table>

          <div className="mt-3 flex items-center justify-between text-base text-ink/60">
            <span>{data.total} players</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span className="font-mono text-sm">Page {data.page}</span>
              <Button variant="secondary" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      {openId && <PlayerDrawer id={openId} readonly={readonly} players={data?.items ?? []} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function PlayerDrawer({ id, readonly, players, onClose }: { id: string; readonly: boolean; players: AdminPlayerRow[]; onClose: () => void }) {
  const { data: p, isPending } = usePlayer(id);
  const { data: teams } = useTeams();
  const { ok, fail } = useActionToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rename, setRename] = useState('');
  const [mergeInto, setMergeInto] = useState('');

  const inval = [adminKeys.players(''), adminKeys.player(id), adminKeys.leaderboard, adminKeys.overview, adminKeys.teams];
  const mut = (fn: () => Promise<unknown>, msg: string, close = false) => () => fn().then(() => { ok(msg); if (close) onClose(); }).catch(fail);

  const ban = useAdminMutation((reason: string) => adminApi(`/players/${id}/ban`, { method: 'POST', body: { reason } }), inval);
  const unban = useAdminMutation(() => adminApi(`/players/${id}/unban`, { method: 'POST' }), inval);
  const logout = useAdminMutation(() => adminApi(`/players/${id}/force-logout`, { method: 'POST' }), inval);
  const renameMut = useAdminMutation((name: string) => adminApi(`/players/${id}/rename`, { method: 'POST', body: { name } }), inval);
  const move = useAdminMutation((teamId: string) => adminApi(`/players/${id}/move`, { method: 'POST', body: { teamId } }), inval);
  const reset = useAdminMutation(() => adminApi(`/players/${id}/reset`, { method: 'POST' }), inval);
  const del = useAdminMutation((confirmName: string) => adminApi(`/players/${id}`, { method: 'DELETE', body: { confirmName } }), inval);
  const merge = useAdminMutation((toId: string) => adminApi('/players/merge', { method: 'POST', body: { fromId: id, toId } }), inval);

  return (
    <Modal open onClose={onClose} kicker="Player" title={p?.name ?? 'Player'} size="lg">
      {isPending || !p ? (
        <p className="text-ink/60">Loading…</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-base sm:grid-cols-4">
            <Stat label="Team" value={p.teamName} />
            <Stat label="Score" value={String(p.score)} />
            <Stat label="Solves" value={String(p.solves)} />
            <Stat label="Wrong" value={String(p.wrong)} />
          </div>
          <div className="text-sm text-ink/60">
            Joined {new Date(p.joinedAt).toLocaleString()} · IP {p.ip ?? '—'} · Last seen {p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleString() : '—'}
          </div>
          {p.status === 'banned' && <Notice tone="warning" title="Banned">{p.bannedReason || 'No reason recorded.'}</Notice>}

          {!readonly && (
            <section className="space-y-4 rounded-control border border-line p-4">
              <Kicker>Moderation</Kicker>
              <div className="flex flex-wrap gap-2">
                {p.status === 'banned' ? (
                  <Button variant="primary" size="sm" disabled={unban.isPending} onClick={mut(() => unban.mutateAsync(), 'Player unbanned.')}>Unban</Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled={ban.isPending} onClick={mut(() => ban.mutateAsync(window.prompt('Ban reason (optional, shown to no one):') ?? ''), 'Player banned.')}>Ban</Button>
                )}
                <Button variant="secondary" size="sm" disabled={logout.isPending} onClick={mut(() => logout.mutateAsync(), 'Player signed out.')}>Force sign-out</Button>
                <Button variant="secondary" size="sm" disabled={reset.isPending} onClick={mut(() => reset.mutateAsync(), 'Player progress reset.')}>Reset progress</Button>
                <Button variant="secondary" size="sm" disabled={del.isPending} onClick={() => setConfirmDelete(true)}>Delete…</Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-end gap-2">
                  <Input label="Rename" value={rename} placeholder={p.name} onChange={(e) => setRename(e.target.value)} className="flex-1" />
                  <Button variant="secondary" size="sm" disabled={renameMut.isPending || rename.trim().length < 2} onClick={mut(() => renameMut.mutateAsync(rename.trim()), 'Player renamed.')}>Save</Button>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex-1">
                    <span className="mb-1.5 block font-label text-micro font-bold uppercase tracking-label text-ink/70">Move to team</span>
                    <select className="h-10 w-full rounded-control border-[1.5px] border-line bg-white px-3 text-base text-ink" defaultValue={p.teamId} onChange={(e) => move.mutateAsync(e.target.value).then(() => ok('Player moved.')).catch(fail)}>
                      {teams?.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="mb-1.5 block font-label text-micro font-bold uppercase tracking-label text-ink/70">Merge this player into…</span>
                  <select className="h-10 w-full rounded-control border-[1.5px] border-line bg-white px-3 text-base text-ink" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
                    <option value="">Select a player…</option>
                    {players.filter((o) => o.id !== id).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.teamName})</option>)}
                  </select>
                </label>
                <Button variant="secondary" size="sm" disabled={!mergeInto || merge.isPending} onClick={mut(() => merge.mutateAsync(mergeInto), 'Players merged.', true)}>Merge</Button>
              </div>
            </section>
          )}

          <section>
            <Kicker className="mb-2">Score adjustments</Kicker>
            {p.adjustments.length === 0 ? (
              <p className="text-base text-ink/60">None.</p>
            ) : (
              <ul className="space-y-1.5 text-base">
                {p.adjustments.map((a) => (
                  <li key={a.id} className={a.reversed ? 'text-ink/40 line-through' : 'text-ink'}>
                    <span className="font-mono">{a.points > 0 ? `+${a.points}` : a.points}</span> — {a.reason} <span className="text-ink/50">({a.admin})</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <Kicker className="mb-2">Timeline</Kicker>
            <ul className="space-y-1.5 text-base">
              {p.timeline.slice().reverse().map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 font-mono text-xs text-ink/50">{new Date(t.at).toLocaleString()}</span>
                  <span className="text-ink">{t.text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        tone="danger"
        title={`Delete ${p?.name ?? 'player'}?`}
        confirmLabel="Delete player"
        requireText={p?.name}
        loading={del.isPending}
        onConfirm={() => del.mutateAsync(p!.name).then(() => { ok('Player deleted.'); setConfirmDelete(false); onClose(); }).catch(fail)}
      >
        This permanently removes the player and all of their solves, submissions and adjustments.
      </ConfirmDialog>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-line px-3 py-2">
      <p className="font-label text-micro font-bold uppercase tracking-label text-ink/55">{label}</p>
      <p className="mt-0.5 truncate font-mono text-ink">{value}</p>
    </div>
  );
}
