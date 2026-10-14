import { Outlet } from 'react-router';
import { usePlayerState } from '../../lib/playerState';
import { MaintenancePage } from '../MaintenancePage';

/**
 * Wraps the whole player site. While maintenance mode is on, every player route
 * (login included) shows the calm "back soon" page. The admin area is mounted
 * on a separate route and is never gated here.
 */
export function PlayerSiteGate() {
  const { data } = usePlayerState();
  if (data?.maintenance) return <MaintenancePage />;
  return <Outlet />;
}
