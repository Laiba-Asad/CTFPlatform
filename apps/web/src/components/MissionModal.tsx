import type { ChallengeCard } from '@cydemic/shared';
import { Check, Download, ExternalLink, Flag, Timer as TimerIcon } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import { attachmentUrl, targetUrl, useSubmitFlag } from '../lib/challenges';
import { useCountdown } from '../lib/useCountdown';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { Notice } from './ui/Notice';
import { CategoryPill, Pill } from './ui/Pill';

interface MissionModalProps {
  mission: ChallengeCard | null;
  acceptingSubmissions: boolean;
  onClose: () => void;
}

export function MissionModal({ mission, acceptingSubmissions, onClose }: MissionModalProps) {
  return (
    <Modal
      open={mission !== null}
      onClose={onClose}
      kicker={mission ? `Mission ${String(mission.number).padStart(2, '0')} · ${mission.category}` : ''}
      title={mission?.title ?? ''}
      size="lg"
    >
      {mission && <MissionBody mission={mission} acceptingSubmissions={acceptingSubmissions} />}
    </Modal>
  );
}

function MissionBody({ mission, acceptingSubmissions }: { mission: ChallengeCard; acceptingSubmissions: boolean }) {
  const submit = useSubmitFlag(mission.id);
  const [flag, setFlag] = useState('');
  const [solved, setSolved] = useState(mission.state === 'solved');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const cooldown = useCountdown(cooldownUntil);

  useEffect(() => {
    setSolved(mission.state === 'solved');
    setFlag('');
    setError(null);
    setAttempts(null);
  }, [mission.id, mission.state]);

  const target = targetUrl(mission.port);
  // Submission is possible only for openable states; the server is the real gate.
  const canPlay = mission.state === 'available' || mission.state === 'starting';
  const reasonNotice = stateNotice(mission.state);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!flag.trim() || cooldown > 0) return;
    setError(null);
    submit.mutate(flag.trim(), {
      onSuccess: (res) => {
        if (res.outcome === 'correct' || res.outcome === 'already_solved') {
          setSolved(true);
          setFlag('');
        } else {
          setError('That flag is not correct.');
          setAttempts(res.attempts ?? null);
        }
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          setError(err.message);
          if (err.retryAfterSeconds) setCooldownUntil(Date.now() + err.retryAfterSeconds * 1000);
        } else {
          setError('Could not reach the server. Try again.');
        }
      },
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <CategoryPill category={mission.category} />
        <Pill>+{mission.points} XP</Pill>
      </div>

      {mission.description ? (
        <p className="text-body text-ink/80">{mission.description}</p>
      ) : (
        <Notice tone="info">This mission's briefing unlocks when it is released and the event is live.</Notice>
      )}

      {reasonNotice && (
        <Notice tone={mission.state === 'unavailable' ? 'warning' : 'info'} className="mt-4">
          {reasonNotice}
        </Notice>
      )}

      {/* Target / attachment */}
      {(canPlay || mission.state === 'solved') && (target || mission.hasFile) && (
        <div className="mt-4 flex flex-wrap gap-3">
          {target && (
            <a
              href={target}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-9 items-center gap-2 rounded-full border-[1.5px] border-ink bg-white px-4 font-label text-xs font-bold uppercase tracking-label text-ink hover:bg-bg"
            >
              <ExternalLink className="size-4" aria-hidden="true" /> Open target
            </a>
          )}
          {mission.hasFile && (
            <a
              href={attachmentUrl(mission.id)}
              className="inline-flex h-9 items-center gap-2 rounded-full border-[1.5px] border-ink bg-white px-4 font-label text-xs font-bold uppercase tracking-label text-ink hover:bg-bg"
            >
              <Download className="size-4" aria-hidden="true" /> Download capture
            </a>
          )}
        </div>
      )}

      {/* Submission */}
      <div className="mt-6 border-t-[1.5px] border-line pt-5">
        {solved ? (
          <Notice tone="success" title="Captured">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-4" aria-hidden="true" /> You solved this mission.
            </span>
          </Notice>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              label="Flag"
              placeholder={canPlay ? 'Enter flag' : 'Not open'}
              className="flex-1"
              autoComplete="off"
              spellCheck={false}
              value={flag}
              disabled={!canPlay || !acceptingSubmissions || cooldown > 0}
              onChange={(e) => setFlag(e.target.value)}
              iconLeft={<Flag />}
            />
            <Button
              type="submit"
              size="lg"
              loading={submit.isPending}
              disabled={!canPlay || !acceptingSubmissions || cooldown > 0}
            >
              Submit
            </Button>
          </form>
        )}

        {!acceptingSubmissions && !solved && !reasonNotice && (
          <p className="mt-3 text-sm text-ink/65">Submissions open while the event is live.</p>
        )}
        {error && (
          <Notice tone="error" className="mt-3">
            <p>{error}</p>
            {attempts !== null && <p className="mt-0.5 font-mono text-sm">Wrong attempts this minute: {attempts}</p>}
            {cooldown > 0 && (
              <p className="mt-0.5 flex items-center gap-1.5 font-mono text-sm" aria-live="polite">
                <TimerIcon className="size-3.5" aria-hidden="true" /> Try again in {cooldown}s
              </p>
            )}
          </Notice>
        )}
      </div>
    </div>
  );
}

function stateNotice(state: ChallengeCard['state']): string | null {
  switch (state) {
    case 'opens_at_start':
      return 'This mission opens when the event starts.';
    case 'paused':
      return 'The event is paused. Submissions are closed for now.';
    case 'event_ended':
      return 'The event has ended. This mission is read-only.';
    case 'locked':
      return 'This mission has not been released yet.';
    case 'starting':
      return 'The target is starting up. It will be ready in a moment.';
    case 'unavailable':
      return 'The target is temporarily unavailable. The platform is restarting it automatically.';
    default:
      return null;
  }
}
