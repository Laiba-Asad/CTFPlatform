import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { request as httpRequest } from 'node:http';
import { join, resolve } from 'node:path';
import type { Logger } from 'pino';
import type { AppConfig } from '../config';
import { API_ROOT } from '../db-url';
import type { Db } from '../lib/db';

const SERVICES_DIR = resolve(API_ROOT, '../..', 'challenge-services');
const FLAGS_ENV = join(SERVICES_DIR, '.flags.env');
const RUNTIME_DIR = join(SERVICES_DIR, 'runtime');

export type ServiceStatus = 'up' | 'starting' | 'down';

interface Managed {
  child: ChildProcess;
  port: number;
  restarts: number;
  stopping: boolean;
  status: 'up' | 'starting';
}

/**
 * Starts and stops the Python challenge services as child processes, one per
 * released web challenge. Each waitress process is a single OS process (no
 * grandchildren), so killing the child stops it cleanly with no orphans.
 *
 * State lives in the database (Challenge.released); on platform start we launch
 * every released service, and on shutdown we stop them all.
 */
export class ChallengeSupervisor {
  private readonly managed = new Map<string, Managed>();
  /** Released web challenges that have exhausted restarts (shown as unavailable). */
  private readonly failed = new Set<string>();
  private readonly flags: Record<string, string>;
  private readonly python: string;
  private shuttingDown = false;
  private readonly maxRestarts = 5;

  constructor(
    private readonly db: Db,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {
    this.flags = existsSync(FLAGS_ENV) ? parseEnv(readFileSync(FLAGS_ENV, 'utf8')) : {};
    this.python = resolvePython(config.challenges.python);
  }

  get available(): boolean {
    return Object.keys(this.flags).length > 0 && existsSync(this.python);
  }

  /** True when the supervisor is actually managing services (enabled + able to run). */
  get supervising(): boolean {
    return this.config.challenges.enabled && this.available;
  }

  /**
   * Health of a released web challenge's service. When the supervisor is not
   * managing services (disabled or no venv), callers should treat challenges as
   * available rather than down.
   */
  serviceStatus(cid: string): ServiceStatus {
    const m = this.managed.get(cid);
    if (m) return m.status;
    return 'down';
  }

  /** Launch every released web challenge. Called once at startup. */
  async startReleased(): Promise<void> {
    if (!this.config.challenges.enabled) return;
    if (!this.available) {
      this.logger.warn('Challenge supervisor disabled: missing .flags.env or Python venv (run npm run challenges:setup).');
      return;
    }
    const released = await this.db.challenge.findMany({
      where: { released: true, port: { not: null } },
      select: { id: true, port: true },
    });
    for (const c of released) await this.start(c.id, c.port!);
  }

  async start(cid: string, port: number): Promise<void> {
    if (!this.available || this.managed.has(cid)) return;
    if (!/^web\d+$/.test(cid)) return; // net challenges are files, not services
    if (await inUse(port)) {
      this.logger.error({ cid, port }, 'port already in use; not starting challenge');
      return;
    }
    this.failed.delete(cid);
    this.spawn(cid, port);
    await waitForHealth(port, 8000)
      .then(() => {
        const m = this.managed.get(cid);
        if (m) m.status = 'up';
      })
      .catch(() => this.logger.error({ cid, port }, 'challenge did not become healthy in time'));
  }

  private spawn(cid: string, port: number): void {
    const child = spawn(this.python, ['serve.py'], {
      cwd: SERVICES_DIR,
      env: this.childEnv(cid, port),
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    const managed: Managed = { child, port, restarts: 0, stopping: false, status: 'starting' };
    this.managed.set(cid, managed);

    child.stderr?.on('data', (buf: Buffer) => {
      // Service stderr may carry diagnostics but never flags (we don't log bodies).
      this.logger.debug({ cid }, buf.toString().trim().slice(0, 500));
    });
    child.on('exit', (code) => {
      const current = this.managed.get(cid);
      if (!current || current.child !== child) return;
      this.managed.delete(cid);
      if (this.shuttingDown || managed.stopping) return;
      if (managed.restarts >= this.maxRestarts) {
        this.failed.add(cid); // shown to players as "temporarily unavailable"
        this.logger.error({ cid, code }, 'challenge crashed too many times; giving up');
        return;
      }
      this.logger.warn({ cid, code }, 'challenge exited unexpectedly; restarting');
      setTimeout(() => {
        if (this.shuttingDown) return;
        this.spawn(cid, port);
        const m = this.managed.get(cid);
        if (m) m.restarts = managed.restarts + 1;
        waitForHealth(port, 8000)
          .then(() => {
            const up = this.managed.get(cid);
            if (up) up.status = 'up';
          })
          .catch(() => undefined);
      }, 500).unref();
    });
  }

  private childEnv(cid: string, port: number): NodeJS.ProcessEnv {
    const flag = this.flags[`FLAG_${cid}`];
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      CHALLENGE_ID: cid,
      CHALLENGE_FLAG: flag,
      PORT: String(port),
      RUNTIME_DIR: join(RUNTIME_DIR, cid),
      MAX_CONCURRENCY: String(this.config.challenges.maxConcurrency),
      CHALLENGE_SECRET_VISITOR_KEY: this.flags.VISITOR_KEY ?? '',
    };
    if (cid === 'web5') env.CHALLENGE_SECRET_JWT_SECRET = this.flags.WEB5_JWT_SECRET ?? '';
    if (cid === 'web9') {
      env.CHALLENGE_SECRET_OTP = this.flags.WEB9_OTP ?? '';
      env.CHALLENGE_SECRET_PHONE = this.flags.WEB9_PHONE ?? '';
    }
    return env;
  }

  async stop(cid: string): Promise<void> {
    this.failed.delete(cid);
    const managed = this.managed.get(cid);
    if (!managed) return;
    managed.stopping = true;
    this.managed.delete(cid);
    await killChild(managed.child);
  }

  isRunning(cid: string): boolean {
    return this.managed.has(cid);
  }

  runningIds(): string[] {
    return [...this.managed.keys()];
  }

  /** OS pid of a running service (for health/diagnostics and tests). */
  pid(cid: string): number | undefined {
    return this.managed.get(cid)?.child.pid;
  }

  /** How many times this service has been restarted since it was last started. */
  restartsOf(cid: string): number {
    return this.managed.get(cid)?.restarts ?? 0;
  }

  /** Stop then start a service (admin "restart" action). */
  async restart(cid: string, port: number): Promise<void> {
    await this.stop(cid);
    await this.start(cid, port);
  }

  async stopAll(): Promise<void> {
    this.shuttingDown = true;
    await Promise.all([...this.managed.values()].map((m) => killChild(m.child)));
    this.managed.clear();
  }

  /** Per-service health of released web challenges, for /api/health and doctor. */
  async healthSummary(): Promise<{ supervising: boolean; services: Array<{ id: string; status: ServiceStatus }> }> {
    if (!this.supervising) return { supervising: false, services: [] };
    const released = await this.db.challenge.findMany({
      where: { released: true, port: { not: null } },
      select: { id: true },
      orderBy: { number: 'asc' },
    });
    return { supervising: true, services: released.map((c) => ({ id: c.id, status: this.serviceStatus(c.id) })) };
  }
}

function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

function resolvePython(configured: string): string {
  if (configured) return configured;
  const sub = process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python'];
  return join(SERVICES_DIR, '.venv', ...sub);
}

function inUse(port: number): Promise<boolean> {
  return new Promise((res) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.setTimeout(500);
    socket.on('connect', () => (socket.destroy(), res(true)));
    socket.on('timeout', () => (socket.destroy(), res(false)));
    socket.on('error', () => res(false));
  });
}

function waitForHealth(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const attempt = (resolveFn: () => void, rejectFn: (e: Error) => void) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: '/', method: 'GET', timeout: 1000 }, (res) => {
      res.resume();
      resolveFn();
    });
    req.on('error', () => (Date.now() > deadline ? rejectFn(new Error('unhealthy')) : setTimeout(() => attempt(resolveFn, rejectFn), 250)));
    req.on('timeout', () => req.destroy());
    req.end();
  };
  return new Promise(attempt);
}

function killChild(child: ChildProcess): Promise<void> {
  return new Promise((res) => {
    if (child.exitCode !== null || child.signalCode !== null) return res();
    const done = () => res();
    child.once('exit', done);
    child.kill();
    // Windows ignores SIGTERM for some processes; force-kill shortly after.
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try {
          child.kill('SIGKILL');
        } catch {
          /* already gone */
        }
      }
    }, 2000).unref();
  });
}
