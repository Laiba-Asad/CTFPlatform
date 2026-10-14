import { LogOut } from 'lucide-react';
import { Navigate, Outlet, useNavigate } from 'react-router';
import { useFeatures, useLogout, useSession } from '../../lib/auth';
import { useEventClock } from '../../lib/useEventClock';
import { AnnouncementBanner } from '../AnnouncementBanner';
import { WaitingScreen } from '../WaitingScreen';
import { Timer } from '../ui/Timer';
import { AppShell } from './AppShell';
import { PLAYER_NAV, Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

function EventTimer() {
  const clock = useEventClock();
  if (!clock) return null;
  return <Timer phase={clock.phase} status={clock.status} remainingMs={clock.remainingMs} finalStretch={clock.finalStretch} />;
}

/** Signed-in frame: top bar with the server-corrected timer, sidebar with the player's identity. */
export function PlayerLayout() {
  const session = useSession();
  const features = useFeatures();
  const logout = useLogout();
  const navigate = useNavigate();

  const clock = useEventClock();

  if (session.isPending) return <div className="min-h-dvh bg-bg" aria-busy="true" />;
  const user = session.data?.user;
  if (!user) return <Navigate to="/" replace />;

  // Before the organizers start, show a calm waiting screen that flips to live by itself.
  if (clock?.status === 'waiting') {
    return <WaitingScreen teamName={user.team.name} teamAvatar={user.team.avatar} playersPresent={clock.playersPresent} />;
  }

  // Hide optional sections that have no content yet.
  const navItems = PLAYER_NAV.filter((item) => {
    if (item.key === 'intel') return features.data?.intel;
    if (item.key === 'achievements') return features.data?.achievements;
    return true;
  });

  return (
    <AppShell
      topBar={<TopBar right={<EventTimer />} />}
      sidebar={
        <Sidebar
          items={navItems}
          player={{ username: user.name, teamName: user.team.name, avatarUrl: user.team.avatar }}
          footer={
            <button
              type="button"
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })}
              className="flex h-10 w-full items-center gap-3 rounded-control px-4 font-label text-xs font-bold uppercase tracking-label text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          }
        />
      }
    >
      <AnnouncementBanner />
      <Outlet />
    </AppShell>
  );
}
