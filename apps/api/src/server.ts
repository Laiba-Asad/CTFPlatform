import { createApp } from './app';
import { ChallengeSupervisor } from './challenges/supervisor';
import { ConfigError, loadConfig } from './config';
import { backupSqlite } from './lib/backup';
import { createDb, initDb } from './lib/db';
import { createLogger } from './lib/logger';
import { assertProductionSafe } from './services/production-guards';
import { purgeExpiredSessions } from './services/sessions';

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const logger = createLogger(config);
  if (config.usingDevSecrets) {
    logger.warn('Using built-in development secrets. Set SESSION_SECRET and FLAG_PEPPER before any real event.');
  }

  const db = createDb(config.databaseUrl);
  void initDb(db, config.databaseUrl).catch((err) => logger.error({ err }, 'database init (pragmas) failed'));

  // In production, refuse to start on any unsafe configuration (dev secrets,
  // weak admin password, AUTO_UNLOCK_ALL, dev admin seed, ...). Dev/test skip this.
  try {
    await assertProductionSafe(db, config);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    await db.$disconnect().catch(() => undefined);
    process.exit(1);
  }

  const supervisor = new ChallengeSupervisor(db, config, logger);
  const app = createApp(config, { db, logger, supervisor });
  const server = app.listen(config.port, config.host, () => {
    logger.info(`API listening on http://${config.host}:${config.port} (${config.env})`);
  });

  // Start every released challenge service after the platform comes up.
  void supervisor.startReleased().then(() => {
    const running = supervisor.runningIds();
    if (running.length) logger.info({ running }, `started ${running.length} challenge service(s)`);
  });

  // Back up the database on start, then automatically during the event. In
  // production: every 10 minutes keeping the last 20 (section 6.2); in dev: daily.
  const backupKeep = config.isProd ? 20 : 10;
  const backupEveryMs = config.isProd ? 10 * 60_000 : 24 * 60 * 60_000;
  void backupSqlite(config.databaseUrl, backupKeep, logger, config.backupDir).catch(() => undefined);
  const backupTimer = setInterval(
    () => void backupSqlite(config.databaseUrl, backupKeep, logger, config.backupDir).catch(() => undefined),
    backupEveryMs,
  );
  backupTimer.unref();

  const purge = () => purgeExpiredSessions(db).catch((err) => logger.error({ err }, 'session purge failed'));
  const purgeTimer = setInterval(purge, 60 * 60_000);
  purgeTimer.unref();

  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void supervisor
        .stopAll()
        .catch(() => undefined)
        .finally(() => db.$disconnect().finally(() => process.exit(0)));
    });
    setTimeout(() => process.exit(1), 12_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
