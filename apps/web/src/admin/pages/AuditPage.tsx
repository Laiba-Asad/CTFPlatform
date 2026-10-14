import { useState } from 'react';
import { Button, Input, Panel } from '../../components/ui';
import { AdminPageTitle, EmptyRow, Table, Td, Th } from '../components/parts';
import { useAudit } from '../lib/hooks';

export function AuditPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const query = `?page=${page}&pageSize=50${action ? `&action=${encodeURIComponent(action)}` : ''}`;
  const { data, isPending } = useAudit(query);

  return (
    <div>
      <AdminPageTitle title="Audit log" />
      <div className="mb-4 max-w-xs">
        <Input label="Filter by action" shape="pill" hideLabel placeholder="e.g. player.ban" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
      </div>

      {isPending || !data ? (
        <Panel><p className="text-ink/60">Loading…</p></Panel>
      ) : (
        <>
          <Table
            head={
              <>
                <Th>Time</Th>
                <Th>Admin</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>IP</Th>
              </>
            }
          >
            {data.items.length === 0 && <EmptyRow colSpan={5}>No audit entries.</EmptyRow>}
            {data.items.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap font-mono text-xs text-ink/60">{new Date(a.at).toLocaleString()}</Td>
                <Td className="text-ink">{a.admin}</Td>
                <Td className="font-mono text-sm text-ink">{a.action}</Td>
                <Td className="text-ink/70">{a.target ?? <span className="text-ink/30">—</span>}</Td>
                <Td className="font-mono text-xs text-ink/55">{a.ip ?? '—'}</Td>
              </tr>
            ))}
          </Table>

          <div className="mt-3 flex items-center justify-between text-base text-ink/60">
            <span>{data.total} entries (append-only)</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span className="font-mono text-sm">Page {data.page}</span>
              <Button variant="secondary" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
