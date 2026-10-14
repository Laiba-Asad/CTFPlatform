import type { ReactNode } from 'react';
import { Logo } from '../ui/Logo';

/** 60px black bar: logo, divider, small wordmark text; timer slot on the right. */
export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between gap-4 bg-black px-4 sm:px-7">
      <div className="flex items-center gap-4">
        <Logo className="h-7" />
        <span className="h-6 w-px bg-white/15" aria-hidden="true" />
        <span className="font-label text-xs font-bold uppercase tracking-wordmark text-white">CTF // Arena</span>
      </div>
      {right}
    </header>
  );
}
