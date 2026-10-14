import { defineConfig } from 'tsup';

export default defineConfig({
  // All entries land flat in dist/ so API_ROOT (dist/..) resolves to apps/api.
  entry: {
    server: 'src/server.ts',
    seed: 'src/scripts/seed.ts',
    reset: 'src/scripts/reset.ts',
    'clean-players': 'src/scripts/clean-players.ts',
    'admin-create': 'src/scripts/admin-create.ts',
    'admin-reset-password': 'src/scripts/admin-reset-password.ts',
    'admin-seed-dev': 'src/scripts/admin-seed-dev.ts',
    'event-reset': 'src/scripts/event-reset.ts',
    'flag-hash': 'src/scripts/flag-hash.ts',
    'join-link': 'src/scripts/join-link.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // The shared workspace package ships TypeScript source; bundle it in.
  noExternal: ['@cydemic/shared'],
});
