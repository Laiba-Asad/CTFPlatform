import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type PanelElement = 'section' | 'div' | 'article' | 'aside';

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: PanelElement;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddings = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };

/** Flat white card with a thin border. The basic surface of the app. */
export function Panel({ as: Tag = 'section', padding = 'md', className, children, ...rest }: PanelProps) {
  return (
    <Tag className={cn('rounded-card border-[1.5px] border-line bg-white', paddings[padding], className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Small letter-spaced label above a title, e.g. "NEXT OBJECTIVE". */
export function Kicker({ children, className, as: Tag = 'p' }: { children: ReactNode; className?: string; as?: 'p' | 'h2' | 'h3' | 'span' }) {
  return (
    <Tag className={cn('font-label text-xs font-bold uppercase tracking-kicker text-teal-dark', className)}>
      {children}
    </Tag>
  );
}

/** Uppercase small label for stats and fields. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-label text-micro font-bold uppercase tracking-label text-ink/65', className)}>{children}</span>;
}
