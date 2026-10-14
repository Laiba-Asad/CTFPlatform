import { BANNED_MESSAGE, NAME_RULES_HINT, TEAMS, describeNameProblem, nameKey, validateName } from '@cydemic/shared';
import { ArrowRight, RefreshCw, Timer as TimerIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { TeamSelect } from '../components/TeamSelect';
import { Button, Input, Logo, Notice, Panel } from '../components/ui';
import { ApiError } from '../lib/api';
import { useLogin, useSession } from '../lib/auth';
import { useCountdown } from '../lib/useCountdown';

/**
 * Open-join sign in: enter a name and choose a team. The form renders instantly
 * from the fixed TEAMS list, so it never waits on, or breaks with, the API.
 * The API is only contacted on submit (and to detect an existing session).
 */
export function LoginPage() {
  const session = useSession();
  const login = useLogin();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // The server locks a name (from this network) for a short time; mirror that for the same name only.
  const [cooldownFor, setCooldownFor] = useState<{ key: string; until: number } | null>(null);
  const countdown = useCountdown(cooldownFor?.until ?? null);
  const cooldown = cooldownFor && cooldownFor.key === nameKey(name) ? countdown : 0;

  // Already signed in: go to the dashboard.
  if (session.data?.user) return <Navigate to="/missions" replace />;

  // Show the notice as soon as a request fails, while retries continue in the background.
  const apiUnreachable = !session.data && session.failureCount > 0;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const problem = validateName(name);
    setNameError(problem ? describeNameProblem(problem) : null);
    setTeamError(teamId ? null : 'Select your team.');
    if (problem || !teamId || cooldown > 0) return;

    setFormError(null);
    login.mutate(
      { name, teamId },
      {
        onSuccess: () => navigate('/missions', { replace: true }),
        onError: (err) => {
          if (err instanceof ApiError) {
            const field = err.fieldError('name');
            if (field) return setNameError(field);
            setFormError(err.message);
            if (err.retryAfterSeconds) setCooldownFor({ key: nameKey(name), until: Date.now() + err.retryAfterSeconds * 1000 });
          } else {
            setFormError('Could not reach the server. Check your connection and try again.');
          }
        },
      },
    );
  };

  const coolingDown = cooldown > 0;

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-4 sm:p-6">
      <Panel padding="lg" className="w-full max-w-[420px]">
        <div className="text-center">
          <Logo className="mx-auto h-12" />
          <h1 className="mt-5 font-label text-xs font-bold uppercase tracking-wordmark text-ink">CTF // Arena</h1>
          <p className="mt-2 text-body text-ink/65">Enter your name and choose your team.</p>
        </div>

        {session.data?.banned && (
          <Notice tone="error" className="mt-5" title="Access removed">
            {BANNED_MESSAGE}
          </Notice>
        )}

        {apiUnreachable && (
          <Notice tone="warning" className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="size-3.5 motion-safe:animate-spin" aria-hidden="true" /> Can't reach the server. Retrying…
              </span>
              <button
                type="button"
                onClick={() => session.refetch()}
                className="font-label text-micro font-bold uppercase tracking-label text-ink underline"
              >
                Retry
              </button>
            </div>
          </Notice>
        )}

        <form className="mt-7 space-y-5" onSubmit={onSubmit} noValidate>
          <Input
            label="Your name"
            placeholder="e.g. Ava Stone"
            autoComplete="name"
            spellCheck={false}
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint={NAME_RULES_HINT}
            error={nameError}
          />

          <TeamSelect
            label="Select your team"
            teams={TEAMS}
            value={teamId}
            onChange={(id) => {
              setTeamId(id);
              setTeamError(null);
            }}
            error={teamError}
          />

          {(formError || coolingDown) && (
            <Notice tone="error">
              {formError && <p className="text-ink">{formError}</p>}
              {coolingDown && (
                <p className="mt-1 flex items-center gap-1.5 font-mono text-sm text-ink" aria-live="polite">
                  <TimerIcon className="size-3.5" aria-hidden="true" />
                  Try again in {cooldown}s
                </p>
              )}
            </Notice>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={login.isPending}
            disabled={coolingDown}
            iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
          >
            Enter the arena
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink/65">Having trouble? Ask an event organizer.</p>
      </Panel>
    </main>
  );
}
