import { LoaderCircle } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router';
import { AdminLayout } from './components/AdminLayout';
import { AdminLogin } from './AdminLogin';
import { useAdminSession } from './lib/hooks';
import { OverviewPage } from './pages/OverviewPage';
import { EventPage } from './pages/EventPage';
import { MissionsPage } from './pages/MissionsPage';
import { PlayersPage } from './pages/PlayersPage';
import { TeamsPage } from './pages/TeamsPage';
import { SubmissionsPage } from './pages/SubmissionsPage';
import { LeaderboardAdminPage } from './pages/LeaderboardAdminPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditPage } from './pages/AuditPage';
import { ExportPage } from './pages/ExportPage';

/**
 * The organizer dashboard. Rendered at /admin/*. It has its own session, CSRF
 * and polling, entirely separate from the player site.
 */
export function AdminApp() {
  const session = useAdminSession();

  if (session.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-black">
        <LoaderCircle className="size-6 animate-spin text-teal" aria-label="Loading" />
      </div>
    );
  }

  const admin = session.data?.admin ?? null;
  if (!admin) return <AdminLogin />;

  const role = admin.role;
  return (
    <Routes>
      <Route element={<AdminLayout username={admin.username} role={role} />}>
        <Route index element={<OverviewPage />} />
        <Route path="event" element={<EventPage role={role} />} />
        <Route path="missions" element={<MissionsPage role={role} />} />
        <Route path="players" element={<PlayersPage role={role} />} />
        <Route path="teams" element={<TeamsPage role={role} />} />
        <Route path="submissions" element={<SubmissionsPage />} />
        <Route path="leaderboard" element={<LeaderboardAdminPage role={role} />} />
        <Route path="announcements" element={<AnnouncementsPage role={role} />} />
        <Route path="settings" element={<SettingsPage role={role} />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="export" element={<ExportPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
