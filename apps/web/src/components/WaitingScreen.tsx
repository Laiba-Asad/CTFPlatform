import { Hourglass, Users } from 'lucide-react';
import { Avatar, PageTitle } from './ui';

/**
 * Shown to signed-in players before the organizers start the event. It flips to
 * the live missions screen by itself (the clock polls every ~2s) with no reload.
 */
export function WaitingScreen({ teamName, teamAvatar, playersPresent }: { teamName: string; teamAvatar?: string | null; playersPresent: number }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-md rounded-card border-[1.5px] border-line bg-white p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full border-[1.5px] border-teal text-teal-dark">
          <Hourglass className="size-5 motion-safe:animate-pulse" aria-hidden="true" />
        </div>
        <PageTitle className="mt-5">Waiting to start</PageTitle>
        <p className="mt-2 text-body text-ink/70">Waiting for the organizers to start the event. This screen will switch to your missions automatically.</p>

        <div className="mt-6 flex items-center justify-center gap-3 rounded-control border border-line px-4 py-3">
          <Avatar src={teamAvatar} name={teamName} size="sm" decorative />
          <div className="text-left">
            <p className="font-label text-micro font-bold uppercase tracking-label text-ink/55">Your team</p>
            <p className="font-label font-bold text-ink">{teamName}</p>
          </div>
        </div>

        <p className="mt-4 inline-flex items-center gap-1.5 font-label text-xs font-bold uppercase tracking-label text-ink/60">
          <Users className="size-3.5" aria-hidden="true" />
          {playersPresent} {playersPresent === 1 ? 'player' : 'players'} present
        </p>
      </div>
    </main>
  );
}
