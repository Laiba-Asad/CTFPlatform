import { CircleDot, Medal, Newspaper, Trophy, User, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from '../../lib/cn';
import { Avatar } from '../ui/Avatar';

export interface NavItem {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
}

export const PLAYER_NAV: NavItem[] = [
  { key: 'missions', label: 'Missions', to: '/missions', icon: CircleDot },
  { key: 'leaderboard', label: 'Leaderboard', to: '/leaderboard', icon: Trophy },
  { key: 'intel', label: 'Intel', to: '/intel', icon: Newspaper },
  { key: 'achievements', label: 'Achievements', to: '/achievements', icon: Medal },
  { key: 'profile', label: 'Profile', to: '/profile', icon: User },
];

interface SidebarProps {
  player: { username: string; teamName: string; avatarUrl?: string | null };
  items?: NavItem[];
  /** Force an item active (used by the design preview, where no route matches) */
  activeKey?: string;
  /** Bottom slot, e.g. sign out */
  footer?: ReactNode;
}

/**
 * 240px black sidebar: player identity on top, then navigation.
 * Active item = solid teal pill with black text; others white at ~70%.
 * Below the lg breakpoint it collapses into a horizontal strip.
 */
export function Sidebar({ player, items = PLAYER_NAV, activeKey, footer }: SidebarProps) {
  return (
    <aside className="flex flex-col bg-black lg:fixed lg:bottom-0 lg:left-0 lg:top-[60px] lg:w-60">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4 lg:mx-4 lg:px-1 lg:py-6">
        <Avatar src={player.avatarUrl} name={player.teamName} size="md" tone="dark" decorative />
        <div className="min-w-0">
          <p className="truncate font-label text-md font-bold text-white">{player.username}</p>
          <p className="truncate font-mono text-xs uppercase tracking-label text-teal">{player.teamName}</p>
        </div>
      </div>
      <nav aria-label="Main" className="scrollbar-thin overflow-x-auto px-3 py-3 lg:px-4 lg:py-5">
        <ul className="flex gap-1 lg:flex-col">
          {items.map(({ key, label, to, icon: Icon }) => (
            <li key={key}>
              <NavLink
                to={to}
                aria-current={key === activeKey ? 'page' : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex h-10 items-center gap-3 whitespace-nowrap rounded-control px-4 font-label text-xs font-bold uppercase tracking-label transition-colors',
                    isActive || key === activeKey ? 'bg-teal text-black' : 'text-white/70 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {footer && <div className="hidden px-4 pb-5 lg:mt-auto lg:block">{footer}</div>}
    </aside>
  );
}
