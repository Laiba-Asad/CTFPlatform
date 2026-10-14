import { MAINTENANCE_MESSAGE } from '@cydemic/shared';
import type { RequestHandler } from 'express';
import type { AppConfig } from '../config';
import type { Db } from '../lib/db';
import { HttpError } from '../lib/http-error';
import { getEffectiveSettings } from '../services/settings';

/**
 * While maintenance is on, player data routes return 503 so the web shows the
 * calm "Back soon" page. The admin area is unaffected (it is mounted separately).
 */
export function maintenanceGuard(db: Db, config: AppConfig): RequestHandler {
  return async (_req, _res, next) => {
    const settings = await getEffectiveSettings(db, config);
    next(settings.maintenance ? new HttpError(503, 'MAINTENANCE', MAINTENANCE_MESSAGE) : undefined);
  };
}
