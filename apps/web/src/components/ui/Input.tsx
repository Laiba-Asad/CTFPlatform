import { OctagonAlert } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Visually hide the label but keep it for screen readers */
  hideLabel?: boolean;
  iconLeft?: ReactNode;
  /** `pill` for search boxes */
  shape?: 'default' | 'pill';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, hideLabel = false, iconLeft, shape = 'default', id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={cn('mb-1.5 block font-label text-micro font-bold uppercase tracking-label text-ink/70', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink/50 [&>svg]:size-4" aria-hidden="true">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full border-[1.5px] bg-white text-base text-ink placeholder:text-ink/60 transition-colors focus:border-ink',
            shape === 'pill' ? 'h-9 rounded-full px-4' : 'h-10 rounded-control px-3',
            error ? 'border-dashed border-ink' : 'border-line hover:border-ink/40',
            iconLeft && 'pl-9',
          )}
          {...rest}
        />
      </div>
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm text-ink/65">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-center gap-1.5 text-sm text-ink">
          <OctagonAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
});
