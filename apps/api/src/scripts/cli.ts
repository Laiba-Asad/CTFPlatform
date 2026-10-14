import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { API_ROOT } from '../db-url';

export const SEED_DIR = process.env.SEED_DIR ? resolve(process.env.SEED_DIR) : resolve(API_ROOT, '../../seed');

/** Run the Prisma CLI from apps/api so prisma.config.ts is used. */
export function prismaCli(args: string[], env: NodeJS.ProcessEnv = process.env): void {
  const bin = createRequire(import.meta.url).resolve('prisma/build/index.js');
  execFileSync(process.execPath, [bin, ...args], { cwd: API_ROOT, stdio: 'inherit', env });
}

export function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

/**
 * Require the operator to type a confirmation word before a destructive action.
 * With --yes it proceeds without prompting. Without a TTY and without --yes it
 * refuses, so nothing destructive can run unattended by accident.
 */
export async function confirmDestructive(warning: string, word = 'DELETE'): Promise<boolean> {
  console.log(`\n!!!  ${warning}\n`);
  if (hasFlag('--yes')) {
    console.log('(--yes supplied; proceeding)');
    return true;
  }
  if (!process.stdin.isTTY) {
    console.error(`Refusing to run unattended. Re-run in a terminal and type "${word}", or pass --yes.`);
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Type "${word}" to proceed: `);
  rl.close();
  return answer.trim() === word;
}

/**
 * Read a line from the terminal without echoing it (for passwords). The typed
 * characters are never shown and never logged. Requires an interactive TTY.
 */
export function promptSecret(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('A terminal is required to enter a password (no TTY detected).'));
      return;
    }
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let input = '';
    const finish = (err?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      if (err) reject(err);
      else resolve(input);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') return finish();
        if (ch === '\u0003') return finish(new Error('Cancelled.')); // Ctrl-C
        if (ch === '\u007f' || ch === '\b') input = input.slice(0, -1); // backspace
        else if (ch >= ' ') input += ch;
      }
    };
    stdin.on('data', onData);
  });
}

/** Read a visible line of input (for non-secret prompts like a username). */
export async function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

/** Entry point wrapper for scripts: readable errors, non-zero exit on failure. */
export function runScript(main: () => Promise<void>): void {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
