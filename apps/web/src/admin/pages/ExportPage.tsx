import { Download } from 'lucide-react';
import { Button, Kicker, Panel } from '../../components/ui';
import { AdminPageTitle } from '../components/parts';
import { adminDownload } from '../lib/adminApi';

const EXPORTS: { label: string; desc: string; path: string }[] = [
  { label: 'Results (CSV)', desc: 'Final standings: rank, name, team, score, solves, wrong.', path: '/export/results.csv' },
  { label: 'Results (JSON)', desc: 'Players and teams as structured JSON.', path: '/export/results.json' },
  { label: 'Certificates (CSV)', desc: 'Name, team, rank, score, solved — ready for batch certificate generation.', path: '/export/certificates.csv' },
  { label: 'Solves (CSV)', desc: 'Every solve with time, player, team, mission and points.', path: '/export/solves.csv' },
  { label: 'Submissions (CSV)', desc: 'Every submission including wrong-guess text and flag matches.', path: '/submissions/export.csv' },
];

export function ExportPage() {
  return (
    <div>
      <AdminPageTitle title="Export" />
      <Panel>
        <Kicker className="mb-3">Downloads</Kicker>
        <ul className="divide-y divide-line">
          {EXPORTS.map((e) => (
            <li key={e.path} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="font-label font-bold text-ink">{e.label}</p>
                <p className="text-base text-ink/65">{e.desc}</p>
              </div>
              <Button variant="secondary" size="sm" iconLeft={<Download className="size-4" />} onClick={() => adminDownload(e.path)}>
                Download
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
