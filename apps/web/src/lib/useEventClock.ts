import {
  estimateClockOffset,
  isFinalStretch,
  statusToPhase,
  type EventPhase,
  type EventResponse,
  type EventStatus,
  type EventWindow,
} from '@cydemic/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from './api';
import { queryKeys } from './auth';

interface EventSnapshot {
  name: string;
  status: EventStatus;
  /** Server-time end instant for a live clock (serverNow + remainingMs at fetch). */
  liveEndsAtServer: number;
  /** Frozen remaining for non-live states (waiting = duration, paused = held, ended = 0). */
  frozenRemainingMs: number;
  window: EventWindow;
  playersPresent: number;
  /** Add to Date.now() to approximate server time. */
  offsetMs: number;
}

async function fetchEvent(): Promise<EventSnapshot> {
  const sentAt = Date.now();
  const data = await api<EventResponse>('/event');
  const receivedAt = Date.now();
  return {
    name: data.name,
    status: data.status,
    liveEndsAtServer: data.serverNow + data.remainingMs,
    frozenRemainingMs: data.remainingMs,
    window: { startsAt: Date.parse(data.startsAt), endsAt: Date.parse(data.endsAt), mode: data.mode },
    playersPresent: data.playersPresent,
    offsetMs: estimateClockOffset(data.serverNow, sentAt, receivedAt),
  };
}

export interface EventClock {
  name: string;
  status: EventStatus;
  phase: EventPhase;
  remainingMs: number;
  finalStretch: boolean;
  playersPresent: number;
  /** True once the first fetch has resolved. */
  loaded: boolean;
}

/**
 * Shared event clock on a server-corrected timeline. The countdown is anchored
 * to the server's end instant (live) or the server's frozen remaining (paused /
 * waiting / ended), so every player sees the same time regardless of when they
 * logged in or how wrong their device clock is. The server still enforces rules.
 */
export function useEventClock(): EventClock | null {
  const { data } = useQuery({
    queryKey: queryKeys.event,
    queryFn: fetchEvent,
    // Poll fast while waiting/paused so the switch to live lands within ~3s; relax once live.
    refetchInterval: (query) => (query.state.data?.status === 'waiting' || query.state.data?.status === 'paused' ? 2_000 : 15_000),
  });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!data) return null;

  const correctedNow = now + data.offsetMs;
  // Live ticks down to the shared end instant; other states stay frozen.
  const liveRemaining = Math.max(0, data.liveEndsAtServer - correctedNow);
  const remainingMs = data.status === 'live' ? liveRemaining : data.frozenRemainingMs;
  // A live clock that has reached zero reads as ended locally until the next poll.
  const status: EventStatus = data.status === 'live' && liveRemaining <= 0 ? 'ended' : data.status;

  return {
    name: data.name,
    status,
    phase: statusToPhase(status),
    remainingMs,
    finalStretch: status === 'live' && isFinalStretch(data.window, correctedNow),
    playersPresent: data.playersPresent,
    loaded: true,
  };
}
