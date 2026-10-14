import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { noticeTone, type NoticeTone } from './Notice';

interface ToastInput {
  title: string;
  description?: string;
  tone?: NoticeTone;
  /** Milliseconds before auto-dismiss; 0 keeps it until closed */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastInput, 'description'>> {
  id: number;
  description?: string;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast must be used inside <ToastProvider>');
  return push;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback((input: ToastInput) => {
    const toast: ToastItem = { tone: 'info', duration: 5000, ...input, id: nextId.current++ };
    setToasts((all) => [...all.slice(-3), toast]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { className, iconClass, Icon } = noticeTone[toast.tone];

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div className={cn('pointer-events-auto flex w-full items-start gap-3 rounded-control bg-white px-4 py-3 text-ink motion-safe:animate-toast-in', className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-label text-sm font-bold uppercase tracking-label">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-base text-ink/70">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-mr-1 grid size-6 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
