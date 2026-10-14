import type { AnnouncementRow } from '@cydemic/shared';
import { useState } from 'react';
import { Button, Input, Modal, Notice, Panel } from '../../components/ui';
import { AdminPageTitle, useActionToast } from '../components/parts';
import { adminApi } from '../lib/adminApi';
import { adminKeys, useAdminMutation, useAnnouncements } from '../lib/hooks';

export function AnnouncementsPage({ role }: { role: 'admin' | 'viewer' }) {
  const { data, isPending } = useAnnouncements();
  const { ok, fail } = useActionToast();
  const readonly = role !== 'admin';
  const [editing, setEditing] = useState<AnnouncementRow | 'new' | null>(null);

  const inval = [adminKeys.announcements];
  const toggle = useAdminMutation((v: { id: string; active: boolean }) => adminApi(`/announcements/${v.id}`, { method: 'PATCH', body: { active: v.active } }), inval);
  const del = useAdminMutation((id: string) => adminApi(`/announcements/${id}`, { method: 'DELETE' }), inval);

  return (
    <div>
      <AdminPageTitle title="Announcements">
        {!readonly && <Button variant="primary" size="sm" onClick={() => setEditing('new')}>New announcement</Button>}
      </AdminPageTitle>

      <Notice tone="info" className="mb-4">The newest active, unexpired announcement shows as a banner on the player site.</Notice>

      {isPending || !data ? (
        <Panel><p className="text-ink/60">Loading…</p></Panel>
      ) : data.announcements.length === 0 ? (
        <Panel><p className="text-ink/60">No announcements yet.</p></Panel>
      ) : (
        <ul className="space-y-3">
          {data.announcements.map((a) => (
            <li key={a.id}>
              <Panel>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-label text-card font-bold text-ink">{a.title}</h3>
                      <span className={a.active ? 'font-label text-micro font-bold uppercase tracking-label text-teal-dark' : 'font-label text-micro font-bold uppercase tracking-label text-ink/45'}>
                        {a.active ? 'Active' : 'Hidden'}
                      </span>
                    </div>
                    <p className="mt-1 text-body text-ink/75">{a.body}</p>
                    <p className="mt-2 font-mono text-xs text-ink/45">
                      {new Date(a.createdAt).toLocaleString()}{a.expiresAt ? ` · expires ${new Date(a.expiresAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                  {!readonly && (
                    <div className="flex shrink-0 gap-1.5">
                      <Button variant="secondary" size="sm" disabled={toggle.isPending} onClick={() => toggle.mutateAsync({ id: a.id, active: !a.active }).then(() => ok(a.active ? 'Hidden.' : 'Shown.')).catch(fail)}>
                        {a.active ? 'Hide' : 'Show'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>Edit</Button>
                      <Button variant="ghost" size="sm" disabled={del.isPending} onClick={() => del.mutateAsync(a.id).then(() => ok('Deleted.')).catch(fail)}>Delete</Button>
                    </div>
                  )}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      {editing && <EditAnnouncement item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditAnnouncement({ item, onClose }: { item: AnnouncementRow | null; onClose: () => void }) {
  const { ok, fail } = useActionToast();
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const save = useAdminMutation(
    (payload: { title: string; body: string }) =>
      item ? adminApi(`/announcements/${item.id}`, { method: 'PATCH', body: payload }) : adminApi('/announcements', { method: 'POST', body: { ...payload, active: true } }),
    [adminKeys.announcements],
  );

  return (
    <Modal
      open
      onClose={onClose}
      kicker={item ? 'Edit announcement' : 'New announcement'}
      title={item ? item.title : 'New announcement'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={!title.trim() || !body.trim()} onClick={() => save.mutateAsync({ title: title.trim(), body: body.trim() }).then(() => { ok('Saved.'); onClose(); }).catch(fail)}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="block">
          <span className="mb-1.5 block font-label text-micro font-bold uppercase tracking-label text-ink/70">Body</span>
          <textarea className="min-h-28 w-full rounded-control border-[1.5px] border-line bg-white px-3 py-2 text-base text-ink focus:border-ink" value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
