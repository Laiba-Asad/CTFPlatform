import { cn } from '../../lib/cn';

/** The real Cydemic logo lives at public/brand/cydemic-logo.svg. No text wordmark. */
export function Logo({ className }: { className?: string }) {
  return <img src="/brand/cydemic-logo.svg" alt="Cydemic" className={cn('h-8 w-auto', className)} draggable={false} />;
}
