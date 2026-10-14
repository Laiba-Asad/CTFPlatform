import { User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const sizes: Record<AvatarSize, { box: string; icon: string }> = {
  xs: { box: 'size-[22px] rounded-[6px]', icon: 'size-3' }, // leaderboard rows
  sm: { box: 'size-8 rounded-[8px]', icon: 'size-4' }, // lists, team members
  md: { box: 'size-12 rounded-[12px]', icon: 'size-5' }, // sidebar
  lg: { box: 'size-16 rounded-[14px]', icon: 'size-6' }, // profile, team cards
  xl: { box: 'size-[88px] rounded-[16px]', icon: 'size-8' }, // hero card
  '2xl': { box: 'size-32 rounded-[20px]', icon: 'size-10' }, // profile page
};

interface AvatarProps {
  /** Team avatar path, e.g. /avatars/<team-id>.png. Missing or broken images fall back to the placeholder. */
  src?: string | null;
  /** Used for alt text */
  name: string;
  size?: AvatarSize;
  /** `dark` for the black sidebar / top bar */
  tone?: 'light' | 'dark';
  /** Set true when a visible name sits next to the avatar */
  decorative?: boolean;
  className?: string;
}

/**
 * One avatar for every player and team slot. Shows the team badge when the
 * image loads; otherwise a neutral dashed placeholder with a person icon.
 * Dropping real art into public/avatars/ makes it appear with no code change.
 */
export function Avatar({ src, name, size = 'md', tone = 'light', decorative = false, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const { box, icon } = sizes[size];
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `${name} avatar` };

  if (src && !failed) {
    return (
      <span
        className={cn(
          'inline-grid shrink-0 place-items-center overflow-hidden border-[1.5px]',
          // Portrait (~3:4) badges sit on the panel/black with their full shape visible.
          tone === 'dark' ? 'border-white/15 bg-black' : 'border-line bg-bg',
          box,
          className,
        )}
        {...a11y}
      >
        <img src={src} alt="" className="size-full object-contain" onError={() => setFailed(true)} draggable={false} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 flex-col items-center justify-center gap-1 border-[1.5px] border-dashed',
        tone === 'dark' ? 'border-white/35 text-white/70' : 'border-ink/30 bg-bg text-ink/50',
        box,
        className,
      )}
      {...a11y}
    >
      <User className={icon} strokeWidth={1.75} aria-hidden="true" />
      {(size === 'xl' || size === '2xl') && <span className="font-label text-[9px] font-bold uppercase tracking-label" aria-hidden="true">Avatar</span>}
    </span>
  );
}
