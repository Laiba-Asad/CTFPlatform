import { Router } from 'express';
import type { AppConfig } from '../config';
import type { Db } from '../lib/db';
import { getEventState } from '../services/event';

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptime: number;
  database: 'ok' | 'unavailable';
  event: { mode: string; phase: string; startsAt: string; endsAt: string } | null;
  challenges: { released: number; total: number };
  services: { supervising: boolean; up: number; starting: number; down: number; detail: Array<{ id: string; status: string }> };
}

interface HealthSupervisor {
  healthSummary(): Promise<{ supervising: boolean; services: Array<{ id: string; status: string }> }>;
}

export async function buildHealthReport(db: Db, _config: AppConfig, supervisor?: HealthSupervisor): Promise<HealthReport> {
  let database: 'ok' | 'unavailable' = 'ok';
  try {
    await db.$queryRawUnsafe('SELECT 1');
  } catch {
    database = 'unavailable';
  }

  let event: HealthReport['event'] = null;
  let released = 0;
  let total = 0;
  if (database === 'ok') {
    try {
      const state = await getEventState(db);
      event = { mode: state.mode, phase: state.phase, startsAt: state.startsAt.toISOString(), endsAt: state.endsAt.toISOString() };
      [released, total] = await Promise.all([
        db.challenge.count({ where: { released: true } }),
        db.challenge.count(),
      ]);
    } catch {
      database = 'unavailable';
    }
  }

  const summary = supervisor ? await supervisor.healthSummary().catch(() => ({ supervising: false, services: [] })) : { supervising: false, services: [] };
  const count = (s: string) => summary.services.filter((x) => x.status === s).length;

  return {
    status: database === 'ok' ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime()),
    database,
    event,
    challenges: { released, total },
    services: {
      supervising: summary.supervising,
      up: count('up'),
      starting: count('starting'),
      down: count('down'),
      detail: summary.services,
    },
  };
}

/** Health endpoint: DB status, event state, released challenges, per-service health. */
export function healthRouter(db: Db, config: AppConfig, supervisor?: HealthSupervisor) {
  const router = Router();
  router.get('/', async (_req, res) => {
    const report = await buildHealthReport(db, config, supervisor);
    res.status(report.status === 'ok' ? 200 : 503).set('Cache-Control', 'no-store').json(report);
  });
  return router;
}
