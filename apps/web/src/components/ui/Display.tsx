import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/*
 * Anton is used in exactly two places, both defined here:
 * the hero player name (32px) and page titles (26px).
 * The brand check fails if `font-display` appears in any other file.
 */

export function PageTitle({ children, className, as: H = 'h1' }: { children: ReactNode; className?: string; as?: 'h1' | 'h2' }) {
  return <H className={cn('font-display text-title uppercase tracking-wide text-ink', className)}>{children}</H>;
}

export function HeroName({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('font-display text-hero uppercase tracking-wide text-ink', className)}>{children}</p>;
}
