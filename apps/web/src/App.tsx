import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { PlayerLayout } from './components/layout/PlayerLayout';
import { PlayerSiteGate } from './components/layout/PlayerSiteGate';
import { ToastProvider } from './components/ui';
import { ApiError } from './lib/api';
import { useFeatures } from './lib/auth';
import { DashboardPage } from './pages/DashboardPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { SectionPlaceholder } from './pages/SectionPlaceholder';

// The component gallery is a development aid and is not shipped in production builds.
const DesignSystemPage = import.meta.env.DEV ? lazy(() => import('./pages/DesignSystemPage')) : null;

// The organizer dashboard is a separate area, lazily loaded so it never weighs
// down the player bundle.
const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      // Do not hammer the API on auth or validation errors.
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

/** Only render a feature's page when the feature is on; otherwise go to missions. */
function FeatureGate({ feature, children }: { feature: 'intel' | 'achievements'; children: ReactNode }) {
  const features = useFeatures();
  if (features.isPending) return <div aria-busy="true" />;
  return features.data?.[feature] ? <>{children}</> : <Navigate to="/missions" replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={null}>
            <Routes>
              <Route element={<PlayerSiteGate />}>
                <Route path="/" element={<LoginPage />} />
                <Route element={<PlayerLayout />}>
                  <Route path="/missions" element={<DashboardPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/intel" element={<FeatureGate feature="intel"><SectionPlaceholder title="Intel" /></FeatureGate>} />
                  <Route
                    path="/achievements"
                    element={<FeatureGate feature="achievements"><SectionPlaceholder title="Achievements" /></FeatureGate>}
                  />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>
              </Route>
              {DesignSystemPage && <Route path="/design" element={<DesignSystemPage />} />}
              <Route path="/admin/*" element={<AdminApp />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
