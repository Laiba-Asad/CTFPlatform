import {
  Activity,
  CalendarClock,
  Download,
  Flag,
  Megaphone,
  ScrollText,
  Settings as SettingsIcon,
  Send,
  Trophy,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { cn } from '../../lib/cn';
import { Button } from '../../components/ui';
import { Logo } from '../../components/ui/Logo';
import { useAdminLogout } from '../lib/hooks';

interface AdminNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Overview', to: '/admin', icon: Activity, end: true },
  { label: 'Event', to: '/admin/event', icon: CalendarClock },
  { label: 'Missions', to: '/admin/missions', icon: Flag },
  { label: 'Players', to: '/admin/players', icon: Users },
  { label: 'Teams', to: '/admin/teams', icon: UsersRound },
  { label: 'Submissions', to: '/admin/submissions', icon: Send },
  { label: 'Leaderboard', to: '/admin/leaderboard', icon: Trophy },
  { label: 'Announcements', to: '/admin/announcements', icon: Megaphone },
  { label: 'Settings', to: '/admin/settings', icon: SettingsIcon },
  { label: 'Audit log', to: '/admin/audit', icon: ScrollText },
  { label: 'Export', to: '/admin/export', icon: Download },
];

export function AdminLayout({ username, role }: { username: string; role: 'admin' | 'viewer' }) {
  const logout = useAdminLogout();
  return (
    <div className="min-h-dvh bg-bg text-ink">
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-[60px] items-center justify-between bg-black px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Logo className="h-6 w-auto" />
          <span className="font-label text-xs font-bold uppercase tracking-wordmark text-white/70">Arena Control</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-label text-sm font-bold text-white">{username}</p>
            <p className="font-mono text-micro uppercase tracking-label text-teal">{role === 'admin' ? 'Organizer' : 'Viewer'}</p>
          </div>
          <Button variant="secondary" size="sm" loading={logout.isPending} onClick={() => logout.mutate()}>
            Sign out
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="flex flex-col bg-black lg:fixed lg:bottom-0 lg:left-0 lg:top-[60px] lg:w-60">
        <nav aria-label="Admin" className="scrollbar-thin overflow-x-auto px-3 py-3 lg:px-4 lg:py-5">
          <ul className="flex gap-1 lg:flex-col">
            {ADMIN_NAV.map(({ label, to, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 items-center gap-3 whitespace-nowrap rounded-control px-4 font-label text-xs font-bold uppercase tracking-label transition-colors',
                      isActive ? 'bg-teal text-black' : 'text-white/70 hover:bg-white/5 hover:text-white',
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
        {role === 'viewer' && (
          <p className="hidden px-5 pb-5 text-xs text-white/50 lg:mt-auto lg:block">
            Read-only access. Changes are disabled for viewer accounts.
          </p>
        )}
      </aside>

      {/* Content */}
      <main className="px-4 pb-16 pt-[76px] lg:ml-60 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
