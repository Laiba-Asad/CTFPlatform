import { useState } from 'react';
import { Button, Chip, Panel } from '../../components/ui';
import { AdminPageTitle, EmptyRow, Table, Td, Th } from '../components/parts';
import { adminDownload } from '../lib/adminApi';
import { useSubmissions } from '../lib/hooks';

export function SubmissionsPage() {
  const [result, setResult] = useState<'' | 'correct' | 'wrong'>('');
  const [page, setPage] = useState(1);
  const query = `?page=${page}&pageSize=100${result ? `&result=${result}` : ''}`;
  const { data, isPending } = useSubmissions(query);

  return (
    <div>
      <AdminPageTitle title="Submissions">
        <Button variant="secondary" size="sm" onClick={() => adminDownload(`/submissions/export.csv${result ? `?result=${result}` : ''}`)}>Export CSV</Button>
      </AdminPageTitle>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['', 'correct', 'wrong'] as const).map((r) => (
          <Chip key={r || 'all'} active={result === r} onClick={() => { setResult(r); setPage(1); }}>{r === '' ? 'All' : r}</Chip>
        ))}
      </div>

      {isPending || !data ? (
        <Panel><p className="text-ink/60">Loading…</p></Panel>
      ) : (
        <>
          <Table
            head={
              <>
                <Th>Time</Th>
                <Th>Player</Th>
                <Th>Team</Th>
                <Th>Mission</Th>
                <Th>Result</Th>
                <Th>Submitted text</Th>
                <Th>IP</Th>
              </>
            }
          >
            {data.items.length === 0 && <EmptyRow colSpan={7}>No submissions.</EmptyRow>}
            {data.items.map((s) => (
              <tr key={s.id} className={s.matchesMissionId ? 'bg-teal/10' : undefined}>
                <Td className="whitespace-nowrap font-mono text-xs text-ink/60">{new Date(s.at).toLocaleTimeString()}</Td>
                <Td className="text-ink">{s.playerName}</Td>
                <Td className="text-ink/70">{s.teamName}</Td>
                <Td className="whitespace-nowrap">#{s.missionNumber} {s.missionTitle}</Td>
                <Td>
                  <span className={s.correct ? 'font-label text-micro font-bold uppercase tracking-label text-teal-dark' : 'font-label text-micro font-bold uppercase tracking-label text-ink/55'}>
                    {s.correct ? 'Correct' : 'Wrong'}
                  </span>
                </Td>
                <Td className="max-w-xs truncate font-mono text-xs text-ink/70" title={s.text ?? ''}>
                  {s.text ?? <span className="text-ink/30">—</span>}
                  {s.matchesMissionId && <span className="ml-1.5 font-label text-micro font-bold uppercase tracking-label text-teal-dark">matches a flag</span>}
                </Td>
                <Td className="font-mono text-xs text-ink/55">{s.ip}</Td>
              </tr>
            ))}
          </Table>

          <div className="mt-3 flex items-center justify-between text-base text-ink/60">
            <span>{data.total} submissions</span>
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
