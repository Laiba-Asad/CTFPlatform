import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { AppConfig } from './config';
import { API_ROOT } from './db-url';
import type { Db } from './lib/db';
import { createLogger } from './lib/logger';
import { loadSession } from './middleware/auth';
import { loadAdminSession, adminSubnetGuard, adminIpAllowed } from './middleware/admin-auth';
import { csrfProtection } from './middleware/csrf';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { maintenanceGuard } from './middleware/maintenance';
import { subnetGuard } from './middleware/subnet';
import { adminApiRouter, type AdminSupervisor } from './routes/admin/index';
import { adminAuthRouter } from './routes/admin-auth';
import { authRouter } from './routes/auth';
import { challengesRouter } from './routes/challenges';
import { healthRouter } from './routes/health';
import { leaderboardRouter } from './routes/leaderboard';
import { meRouter } from './routes/me';
import { publicRouter } from './routes/public';
import type { ServiceHealth } from './services/challenges';

/** Everything the app needs from the supervisor; the real one implements all of it. */
export interface AppSupervisor extends AdminSupervisor, ServiceHealth {
  healthSummary(): Promise<{ supervising: boolean; services: Array<{ id: string; status: 'up' | 'starting' | 'down' }> }>;
}

interface AppDeps {
  db: Db;
  logger?: Logger;
  supervisor?: AppSupervisor;
  /** Override the built-web directory (tests). Defaults to apps/web/dist. */
  webDist?: string;
}

export function createApp(config: AppConfig, { db, logger = createLogger(config), supervisor, webDist }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // CSP: a pure API locks everything down to 'none'. When this process also
  // serves the built web app (single-port LAN deploy), the SPA's own same-origin
  // scripts, styles, fonts and images must be allowed — everything is self-hosted,
  // so 'self' (plus data: images and inline styles) is the tightest policy that works.
  const cspDirectives: Record<string, string[]> = config.serveWeb
    ? {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      }
    : { defaultSrc: ["'none'"], frameAncestors: ["'none'"] };
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: cspDirectives },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

  app.use(
    cors({
      origin: (origin, cb) => {
        // Same-origin and non-browser requests send no Origin header.
        cb(null, !origin || config.allowedOrigins.includes(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      maxAge: 600,
    }),
  );

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/api/health' },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());

  // Health endpoints are mounted outside the subnet/CSRF guards so local probes
  // and `npm run doctor` always work. They never expose secrets.
  const health = healthRouter(db, config, supervisor);
  app.use('/healthz', health);
  app.use('/api/health', health);

  // Admin API: its own subnet guard (localhost by default), session cookie and
  // CSRF, mounted before the player API so admin traffic never touches the
  // player guards. The maintenance switch never affects the admin area.
  const adminApi = Router();
  adminApi.use(adminSubnetGuard(config));
  adminApi.use(loadAdminSession(db, config));
  adminApi.use(csrfProtection(config, 'admin'));
  adminApi.use('/auth', adminAuthRouter(db, config));
  adminApi.use(adminApiRouter({ db, config, supervisor }));
  adminApi.use(notFoundHandler);
  app.use('/api/admin', adminApi);

  const api = Router();
  api.use(subnetGuard(config));
  api.use(loadSession(db, config));
  api.use(csrfProtection(config));
  api.use('/auth', authRouter(db, config));
  api.use('/me', maintenanceGuard(db, config), meRouter(db));
  api.use('/challenges', maintenanceGuard(db, config), challengesRouter(db, config, supervisor));
  api.use('/leaderboard', maintenanceGuard(db, config), leaderboardRouter(db, config));
  api.use(publicRouter(db, config));
  api.use(notFoundHandler);
  app.use('/api', api);

  // Single-port LAN deploy: serve the built web app from the API.
  if (config.serveWeb) {
    const dist = webDist ?? resolve(API_ROOT, '..', 'web', 'dist');
    if (existsSync(dist)) {
      // Hide the /admin SPA route from non-allowed addresses in production, so a
      // player loading /admin gets a plain 404 and never sees the organizer login.
      app.use((req, res, next) => {
        if (config.isProd && /^\/admin(\/|$)/.test(req.path) && !adminIpAllowed(config, req.ip ?? '')) {
          return res.status(404).type('txt').send('Not found');
        }
        next();
      });
      // Hard block for any dotfile / dot-directory (/.env, /.git/config, ...) and
      // any traversal, before static or the SPA shell can answer.
      app.use((req, res, next) => {
        const decoded = (() => {
          try {
            return decodeURIComponent(req.path);
          } catch {
            return req.path;
          }
        })();
        if (/(^|[\\/])\.\.?([\\/]|$)/.test(decoded) || /[\\/]\./.test(decoded)) {
          return res.status(404).type('txt').send('Not found');
        }
        next();
      });
      // Static files only from the built web output. index:false so the catch-all
      // owns HTML; redirect:false so /seed does not 301 to /seed/.
      app.use(express.static(dist, { index: false, maxAge: '1h', dotfiles: 'deny', redirect: false }));
      // SPA fallback: serve the shell only for real client routes. Everything
      // else (e.g. /node_modules/, /backups/, /seed/challenges.json) is a 404,
      // so unknown paths never return the app and never leak the tree.
      const SPA_ROUTES = new Set(['missions', 'leaderboard', 'toolkit', 'profile', 'intel', 'achievements', 'admin', 'design']);
      app.get(/^(?!\/api\/).*/, (req, res, next) => {
        const first = req.path.split('/')[1] ?? '';
        if (req.path === '/' || SPA_ROUTES.has(first)) return res.sendFile(resolve(dist, 'index.html'));
        next();
      });
      logger.info(`Serving web app from ${dist}`);
    } else {
      logger.warn(`SERVE_WEB is set but ${dist} does not exist. Run "npm run build" first.`);
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler(config.isProd));

  return app;
}
