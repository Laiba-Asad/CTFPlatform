import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * primary   = black pill (START, ACCESS MISSION, ENTER THE ARENA)
 * secondary = white pill with ink outline (VIEW)
 * ghost     = text only
 * locked    = dashed, disabled-looking pill for unavailable actions
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'locked';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-[1.5px] font-label font-bold uppercase tracking-label transition-colors duration-150 disabled:cursor-not-allowed';

const variants: Record<ButtonVariant, string> = {
  primary: 'border-ink bg-ink text-white hover:bg-ink/85 disabled:opacity-40',
  secondary: 'border-ink bg-white text-ink hover:bg-bg disabled:opacity-40',
  ghost: 'border-transparent bg-transparent text-ink/70 hover:bg-ink/5 hover:text-ink disabled:opacity-40',
  locked: 'border-dashed border-ink/30 bg-transparent text-ink/60',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-4 text-xs',
  md: 'h-9 px-5 text-xs',
  lg: 'h-11 px-6 text-sm',
};

/** Shared classes so links (e.g. react-router <Link>) can look like buttons. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconLeft,
  iconRight,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading || variant === 'locked'}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
}
