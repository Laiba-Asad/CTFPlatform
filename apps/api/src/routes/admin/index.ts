import { Router } from 'express';
import type { AppConfig } from '../../config';
import type { Db } from '../../lib/db';
import { requireAdminAuth } from '../../middleware/admin-auth';
import { eventAdminRouter } from './event';
import { missionsAdminRouter } from './missions';
import { playersAdminRouter } from './players';
import { teamsAdminRouter } from './teams';
import { submissionsAdminRouter } from './submissions';
import { leaderboardAdminRouter } from './leaderboard';
import { announcementsAdminRouter } from './announcements';
import { settingsAdminRouter } from './settings';
import { auditAdminRouter } from './audit';
import { exportAdminRouter } from './export';
import { overviewAdminRouter } from './overview';

/** What the admin API needs from the challenge supervisor (optional in tests). */
export interface AdminSupervisor {
  start(cid: string, port: number): Promise<void> | void;
  stop(cid: string): Promise<void> | void;
  restart(cid: string, port: number): Promise<void> | void;
  isRunning(cid: string): boolean;
  serviceStatus(cid: string): 'up' | 'starting' | 'down';
  restartsOf(cid: string): number;
  supervising: boolean;
}

export interface AdminDeps {
  db: Db;
  config: AppConfig;
  supervisor?: AdminSupervisor;
}

/**
 * Everything under /api/admin. The caller mounts this AFTER the admin subnet
 * guard, admin session loader and admin CSRF, so every route here already
 * requires those. Each route additionally requires an admin session
 * (requireAdminAuth, read) or a full admin (requireAdminRole, mutations).
 */
export function adminApiRouter(deps: AdminDeps) {
  const router = Router();

  // Everything requires at least a signed-in admin or viewer.
  router.use(requireAdminAuth);

  router.get('/ping', (req, res) => res.json({ ok: true, admin: req.admin!.username, role: req.admin!.role }));

  router.use('/overview', overviewAdminRouter(deps));
  router.use('/event', eventAdminRouter(deps));
  router.use('/missions', missionsAdminRouter(deps));
  router.use('/players', playersAdminRouter(deps));
  router.use('/teams', teamsAdminRouter(deps));
  router.use('/submissions', submissionsAdminRouter(deps));
  router.use('/leaderboard', leaderboardAdminRouter(deps));
  router.use('/announcements', announcementsAdminRouter(deps));
  router.use('/settings', settingsAdminRouter(deps));
  router.use('/audit', auditAdminRouter(deps));
  router.use('/export', exportAdminRouter(deps));

  return router;
}
