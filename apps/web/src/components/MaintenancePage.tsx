import { MAINTENANCE_MESSAGE } from '@cydemic/shared';
import { Wrench } from 'lucide-react';
import { Logo, PageTitle } from './ui';

/** Calm full-screen page shown to players while maintenance mode is on. */
export function MaintenancePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-4">
      <div className="w-full max-w-[420px] rounded-card border-[1.5px] border-line bg-white p-8 text-center">
        <Logo className="mx-auto h-10" />
        <div className="mx-auto mt-6 grid size-12 place-items-center rounded-full border-[1.5px] border-line text-ink/60">
          <Wrench className="size-5" aria-hidden="true" />
        </div>
        <PageTitle className="mt-4">Back soon</PageTitle>
        <p className="mt-2 text-body text-ink/65">{MAINTENANCE_MESSAGE}</p>
      </div>
    </main>
  );
}
