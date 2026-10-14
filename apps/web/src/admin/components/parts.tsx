import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { ApiError } from '../../lib/api';
import { PageTitle, useToast } from '../../components/ui';

/** Standard success/failure toasts for admin actions. */
export function useActionToast() {
  const push = useToast();
  return {
    ok: (title: string) => push({ tone: 'success', title }),
    fail: (e: unknown) => push({ tone: 'error', title: e instanceof ApiError ? e.message : 'Action failed.' }),
  };
}

/** Page title for an admin screen (Anton display face, like the player site). */
export function AdminPageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <PageTitle>{title}</PageTitle>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

/** A thin scrollable table shell with the house border. */
export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border-[1.5px] border-line bg-white">
      <table className="w-full border-collapse text-base">
        <thead>
          <tr className="border-b-[1.5px] border-line text-left">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('px-3 py-2.5 font-label text-micro font-bold uppercase tracking-label text-ink/65', className)}>{children}</th>;
}

export function Td({ children, className, colSpan, title }: { children?: ReactNode; className?: string; colSpan?: number; title?: string }) {
  return (
    <td colSpan={colSpan} title={title} className={cn('border-t border-line px-3 py-2.5 align-middle text-ink', className)}>
      {children}
    </td>
  );
}

/** A small status dot: teal = up/good, hollow ink = neutral, dashed = down. */
export function StatusDot({ tone }: { tone: 'up' | 'neutral' | 'down' }) {
  return (
    <span
      className={cn(
        'inline-block size-2.5 rounded-full border-[1.5px]',
        tone === 'up' && 'border-teal bg-teal',
        tone === 'neutral' && 'border-ink/40 bg-transparent',
        tone === 'down' && 'border-dashed border-ink bg-transparent',
      )}
      aria-hidden="true"
    />
  );
}

/** Empty / loading state inside a card. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <Td colSpan={colSpan} className="py-8 text-center text-ink/60">
        {children}
      </Td>
    </tr>
  );
}
