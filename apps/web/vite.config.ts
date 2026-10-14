import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// One .env at the repo root serves both apps. Only VITE_* vars reach the browser.
const envDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const apiTarget = `http://127.0.0.1:${env.API_PORT || '4000'}`;

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    server: {
      // 0.0.0.0 so other devices on the LAN can reach the dev server.
      host: env.HOST || '0.0.0.0',
      port: Number(env.WEB_PORT || 5173),
      strictPort: true,
      // Same-origin in dev too, so session cookies behave exactly like production.
      proxy: {
        '/api': { target: apiTarget },
        '/healthz': { target: apiTarget },
      },
    },
    build: {
      sourcemap: false,
    },
  };
});
