import { useState } from 'react';
import { ApiError } from '../lib/api';
import { Button, Input, Notice, PageTitle, Panel } from '../components/ui';
import { Logo } from '../components/ui/Logo';
import { useAdminLogin } from './lib/hooks';

export function AdminLogin() {
  const login = useAdminLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Always resolve a clear, specific message — never a silent failure.
  const errorMessage = ((): string | null => {
    if (!login.isError) return null;
    const err = login.error;
    if (!(err instanceof ApiError)) return "Can't reach the server. Check your connection and try again.";
    switch (err.code) {
      case 'LOGIN_FAILED':
        return 'Wrong username or password.';
      case 'LOCKED_OUT': {
        const mins = Math.max(1, Math.ceil((err.retryAfterSeconds ?? 60) / 60));
        return `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
      }
      case 'FORBIDDEN':
        return 'Not allowed from this address.';
      default:
        return err.message || 'Could not sign in. Try again.';
    }
  })();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.isPending) login.mutate({ username: username.trim(), password });
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo className="h-8" />
          <p className="font-label text-xs font-bold uppercase tracking-wordmark text-white/70">Arena Control</p>
        </div>
        <Panel padding="lg">
          <PageTitle>Organizer sign in</PageTitle>
          <p className="mt-1 text-body text-ink/70">Restricted area. Access is logged.</p>
          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {errorMessage && <Notice tone="error">{errorMessage}</Notice>}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={login.isPending}>
              Sign in
            </Button>
          </form>
        </Panel>
        <p className="mt-4 text-center text-xs text-white/40">No account? Run npm run admin:create on the server.</p>
      </div>
    </div>
  );
}
