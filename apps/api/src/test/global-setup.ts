import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { prismaCli } from '../scripts/cli';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Creates a throwaway SQLite database with all migrations applied. */
export default function setup(project: TestProject) {
  const dir = mkdtempSync(join(tmpdir(), 'cydemic-ctf-test-'));
  const databaseUrl = `file:${join(dir, 'test.db')}`;
  prismaCli(['migrate', 'deploy'], { ...process.env, DATABASE_URL: databaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: '1' });
  project.provide('databaseUrl', databaseUrl);
  return () => rmSync(dir, { recursive: true, force: true });
}
