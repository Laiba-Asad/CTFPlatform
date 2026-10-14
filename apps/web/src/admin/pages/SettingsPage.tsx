import type { AdminSettings } from '@cydemic/shared';
import { useState } from 'react';
import { Button, Input, Kicker, Notice, Panel } from '../../components/ui';
import { AdminPageTitle, EmptyRow, Table, Td, Th, useActionToast } from '../components/parts';
import { adminApi } from '../lib/adminApi';
import { adminKeys, useAdmins, useAdminMutation, useBackups, useSettings } from '../lib/hooks';

export function SettingsPage({ role }: { role: 'admin' | 'viewer' }) {
  const readonly = role !== 'admin';
  return (
    <div className="space-y-5">
      <AdminPageTitle title="Settings" />
      {readonly && <Notice tone="info">Viewer access — settings are read-only.</Notice>}
      <PlatformSettings readonly={readonly} />
      <AdminAccounts readonly={readonly} />
      <Backups readonly={readonly} />
    </div>
  );
}

function PlatformSettings({ readonly }: { readonly: boolean }) {
  const { data } = useSettings();
  const { ok, fail } = useActionToast();
  const save = useAdminMutation((body: Partial<AdminSettings>) => adminApi('/settings', { method: 'PUT', body }), [adminKeys.settings, adminKeys.overview]);
  const [form, setForm] = useState<Partial<AdminSettings>>({});

  if (!data) return <Panel><p className="text-ink/60">Loading…</p></Panel>;
  const v = { ...data, ...form };
  const set = (patch: Partial<AdminSettings>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Panel>
      <Kicker className="mb-3">Platform</Kicker>
      <div className="grid gap-4 sm:grid-cols-2">
        <Toggle label="Signup locked" desc="New players cannot create accounts (existing ones can still sign in)." value={v.signupLocked} disabled={readonly} onChange={(b) => set({ signupLocked: b })} />
        <Toggle label="Maintenance" desc="Shows the player site a 'back soon' page. Admin stays up." value={v.maintenance} disabled={readonly} onChange={(b) => set({ maintenance: b })} />
        <Input label="Submission cooldown (seconds, ≤30)" type="number" min={1} max={30} value={String(v.cooldownSeconds)} disabled={readonly} onChange={(e) => set({ cooldownSeconds: Number(e.target.value) })} />
        <Input label="New players per IP" type="number" min={1} value={String(v.newPlayersPerIp)} disabled={readonly} onChange={(e) => set({ newPlayersPerIp: Number(e.target.value) })} />
        <Input label="Max players per team (0 = unlimited)" type="number" min={0} value={String(v.maxPlayersPerTeam)} disabled={readonly} onChange={(e) => set({ maxPlayersPerTeam: Number(e.target.value) })} />
        <Input label="Timezone label (optional)" value={v.timezone ?? ''} disabled={readonly} onChange={(e) => set({ timezone: e.target.value || null })} />
      </div>
      {!readonly && (
        <div className="mt-4">
          <Button variant="primary" size="sm" loading={save.isPending} disabled={Object.keys(form).length === 0} onClick={() => save.mutateAsync(form).then(() => { ok('Settings saved.'); setForm({}); }).catch(fail)}>
            Save settings
          </Button>
        </div>
      )}
    </Panel>
  );
}

function Toggle({ label, desc, value, disabled, onChange }: { label: string; desc: string; value: boolean; disabled: boolean; onChange: (b: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-control border border-line px-3 py-2.5">
      <div>
        <p className="font-label text-micro font-bold uppercase tracking-label text-ink/70">{label}</p>
        <p className="mt-0.5 text-sm text-ink/60">{desc}</p>
      </div>
      <Button variant={value ? 'primary' : 'secondary'} size="sm" disabled={disabled} onClick={() => onChange(!value)}>
        {value ? 'On' : 'Off'}
      </Button>
    </div>
  );
}

function AdminAccounts({ readonly }: { readonly: boolean }) {
  const { data } = useAdmins();
  const { ok, fail } = useActionToast();
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'viewer'>('admin');

  const inval = [adminKeys.admins];
  const create = useAdminMutation(() => adminApi('/settings/admins', { method: 'POST', body: { username: newUser.trim(), password: newPass, role: newRole } }), inval);
  const disable = useAdminMutation((v: { id: string; disabled: boolean }) => adminApi(`/settings/admins/${v.id}/disable`, { method: 'POST', body: { disabled: v.disabled } }), inval);
  const setRole = useAdminMutation((v: { id: string; role: 'admin' | 'viewer' }) => adminApi(`/settings/admins/${v.id}/role`, { method: 'POST', body: { role: v.role } }), inval);
  const resetPw = useAdminMutation((v: { id: string; password: string }) => adminApi(`/settings/admins/${v.id}/reset-password`, { method: 'POST', body: { password: v.password } }), inval);

  return (
    <Panel>
      <Kicker className="mb-3">Organizer accounts</Kicker>
      <Table
        head={<><Th>Username</Th><Th>Role</Th><Th>Last login</Th><Th className="text-right">Actions</Th></>}
      >
        {!data && <EmptyRow colSpan={4}>Loading…</EmptyRow>}
        {data?.admins.length === 0 && <EmptyRow colSpan={4}>No accounts.</EmptyRow>}
        {data?.admins.map((a) => (
          <tr key={a.id} className={a.disabled ? 'opacity-50' : undefined}>
            <Td><span className="font-label font-bold text-ink">{a.username}</span>{a.disabled && <span className="ml-2 text-xs text-ink/50">(disabled)</span>}</Td>
            <Td className="font-mono text-sm">{a.role}</Td>
            <Td className="font-mono text-xs text-ink/55">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : 'never'}</Td>
            <Td className="text-right">
              {!readonly && (
                <div className="flex justify-end gap-1.5">
                  <Button variant="ghost" size="sm" disabled={setRole.isPending} onClick={() => setRole.mutateAsync({ id: a.id, role: a.role === 'admin' ? 'viewer' : 'admin' }).then(() => ok('Role changed.')).catch(fail)}>
                    Make {a.role === 'admin' ? 'viewer' : 'admin'}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={resetPw.isPending} onClick={() => { const pw = window.prompt(`New password for ${a.username} (min 8 chars):`); if (pw) resetPw.mutateAsync({ id: a.id, password: pw }).then(() => ok('Password reset; sessions ended.')).catch(fail); }}>
                    Reset password
                  </Button>
                  <Button variant="secondary" size="sm" disabled={disable.isPending} onClick={() => disable.mutateAsync({ id: a.id, disabled: !a.disabled }).then(() => ok(a.disabled ? 'Enabled.' : 'Disabled.')).catch(fail)}>
                    {a.disabled ? 'Enable' : 'Disable'}
                  </Button>
                </div>
              )}
            </Td>
          </tr>
        ))}
      </Table>

      {!readonly && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Input label="New username" value={newUser} onChange={(e) => setNewUser(e.target.value)} className="w-40" />
          <Input label="Password (min 8)" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-44" />
          <label>
            <span className="mb-1.5 block font-label text-micro font-bold uppercase tracking-label text-ink/70">Role</span>
            <select className="h-10 rounded-control border-[1.5px] border-line bg-white px-3 text-base text-ink" value={newRole} onChange={(e) => setNewRole(e.target.value as 'admin' | 'viewer')}>
              <option value="admin">admin</option>
              <option value="viewer">viewer</option>
            </select>
          </label>
          <Button variant="primary" size="sm" loading={create.isPending} disabled={!newUser.trim() || newPass.length < 8} onClick={() => create.mutateAsync().then(() => { ok('Account created.'); setNewUser(''); setNewPass(''); }).catch(fail)}>
            Create account
          </Button>
        </div>
      )}
    </Panel>
  );
}

function Backups({ readonly }: { readonly: boolean }) {
  const { data } = useBackups();
  const { ok, fail } = useActionToast();
  const create = useAdminMutation(() => adminApi('/settings/backups', { method: 'POST' }), [adminKeys.backups]);

  return (
    <Panel>
      <Kicker className="mb-3">Database backups</Kicker>
      {data && <p className="mb-3 text-sm text-ink/60">{data.restoreHint}</p>}
      {!readonly && (
        <Button variant="secondary" size="sm" loading={create.isPending} onClick={() => create.mutateAsync().then(() => ok('Backup created.')).catch(fail)} className="mb-3">
          Create backup now
        </Button>
      )}
      <ul className="space-y-1 font-mono text-sm text-ink/70">
        {data?.backups.length === 0 && <li className="text-ink/50">No backups yet.</li>}
        {data?.backups.map((b) => <li key={b}>{b}</li>)}
      </ul>
    </Panel>
  );
}
