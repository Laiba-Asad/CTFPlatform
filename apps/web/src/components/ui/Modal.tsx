import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Kicker } from './Panel';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

/**
 * Built on the native <dialog>: focus trapping, Esc to close, inert background
 * and top-layer stacking come from the browser. Focus returns to the trigger.
 */
export function Modal({ open, onClose, title, kicker, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    returnFocus.current?.focus();
    if (open) onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={handleClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] rounded-card border-[1.5px] border-line bg-white p-0 text-ink',
        'backdrop:bg-ink/50',
        size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b-[1.5px] border-line px-6 py-4">
            <div>
              {kicker && <Kicker className="mb-1">{kicker}</Kicker>}
              <h2 id={titleId} className="font-label text-card font-bold text-ink">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 grid size-9 shrink-0 place-items-center rounded-full text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          <div className="scrollbar-thin overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="border-t-[1.5px] border-line px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
