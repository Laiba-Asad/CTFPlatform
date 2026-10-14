import { CircleCheck, Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

/**
 * Feedback without extra hues: error = dashed ink border, warning = bold ink
 * border, success = thin teal border + teal-dark icon, info = thin grey border.
 */
export const noticeTone: Record<NoticeTone, { className: string; iconClass: string; Icon: typeof Info }> = {
  info: { className: 'border-[1.5px] border-line', iconClass: 'text-ink/65', Icon: Info },
  success: { className: 'border-[1.5px] border-teal', iconClass: 'text-teal-dark', Icon: CircleCheck },
  warning: { className: 'border-2 border-ink', iconClass: 'text-ink', Icon: TriangleAlert },
  error: { className: 'border-[1.5px] border-dashed border-ink', iconClass: 'text-ink', Icon: OctagonAlert },
};

interface NoticeProps {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Notice({ tone = 'info', title, children, className }: NoticeProps) {
  const { className: toneClass, iconClass, Icon } = noticeTone[tone];
  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-control bg-white px-4 py-3 text-base text-ink', toneClass, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-label text-sm font-bold uppercase tracking-label">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-ink/70')}>{children}</div>}
      </div>
    </div>
  );
}
