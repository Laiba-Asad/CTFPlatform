import { Megaphone } from 'lucide-react';
import { usePlayerState } from '../lib/playerState';

/** Thin teal-edged banner carrying the newest active organizer announcement. */
export function AnnouncementBanner() {
  const { data } = usePlayerState();
  const a = data?.announcement;
  if (!a) return null;
  return (
    <div role="status" className="mb-5 flex gap-3 rounded-card border-[1.5px] border-teal bg-white px-4 py-3">
      <Megaphone className="mt-0.5 size-4 shrink-0 text-teal-dark" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-label text-sm font-bold uppercase tracking-label text-ink">{a.title}</p>
        <p className="mt-0.5 text-base text-ink/75">{a.body}</p>
      </div>
    </div>
  );
}
