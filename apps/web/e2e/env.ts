/** Shared constants for the end-to-end suite (separate DB and port from dev). */
export const API_PORT = 4010;
export const BASE_URL = `http://127.0.0.1:${API_PORT}`;

export const ADMIN_USER = 'E2E Organizer';
export const ADMIN_PASS = 'e2e-admin-pass-123';

/** Environment for the API server and the DB-prepare step. */
export const serverEnv: Record<string, string> = {
  DATABASE_URL: 'file:./e2e.db',
  API_PORT: String(API_PORT),
  HOST: '127.0.0.1',
  SERVE_WEB: 'true',
  NODE_ENV: 'development',
  CHALLENGES_ENABLED: 'false',
  SESSION_SECRET: 'e2e-session-secret-0123456789abcdef00',
  FLAG_PEPPER: 'e2e-flag-pepper-0123456789abcdef000000',
  ALLOWED_ORIGINS: BASE_URL,
  PUBLIC_URL: BASE_URL,
  EVENT_MODE: 'scheduled',
  TIMER_MODE: 'event',
  EVENT_DURATION_MINUTES: '60',
  E2E_ADMIN_USER: ADMIN_USER,
  E2E_ADMIN_PASS: ADMIN_PASS,
};
