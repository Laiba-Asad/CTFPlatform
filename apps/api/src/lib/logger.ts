import { pino, type Logger } from 'pino';
import type { AppConfig } from '../config';

/**
 * Paths that must never reach the logs: cookies, CSRF tokens and any field
 * that could carry a submitted flag.
 */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'flag',
  '*.flag',
  'body.flag',
  'req.body',
];

export function createLogger(config: Pick<AppConfig, 'logLevel' | 'isProd' | 'env'>): Logger {
  const pretty = !config.isProd && config.env !== 'test';
  return pino({
    level: config.env === 'test' ? 'silent' : config.logLevel,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    ...(pretty
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
      : {}),
  });
}
