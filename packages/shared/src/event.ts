/**
 * Event timing rules shared by the API (enforcement) and the web app (display).
 * The server is always authoritative: the client only uses these helpers to
 * render what the server already decided, using a server-corrected clock.
 */

export type EventPhase = 'upcoming' | 'live' | 'paused' | 'ended';

/**
 * Shared-clock status (TIMER_MODE=event): the single event everyone shares.
 * - waiting: created but not started; players see a "waiting for organizers" screen
 * - live:    running; one countdown to a single end time for everyone
 * - paused:  frozen; remaining time held until resumed
 * - ended:   over; submissions closed, scores read-only
 */
export type EventStatus = 'waiting' | 'live' | 'paused' | 'ended';

/** Map the shared-clock status to the display phase used across the UI. */
export function statusToPhase(status: EventStatus): EventPhase {
  return status === 'waiting' ? 'upcoming' : status;
}

/**
 * Admin-controlled mode, the single source of truth for event state:
 * - scheduled: follow startsAt/endsAt
 * - live:      force live now (dev/testing; refused in production)
 * - paused:    force paused
 * - ended:     force ended
 */
export type EventMode = 'scheduled' | 'live' | 'paused' | 'ended';

export const EVENT_MODES: EventMode[] = ['scheduled', 'live', 'paused', 'ended'];

export interface EventWindow {
  /** Epoch milliseconds */
  startsAt: number;
  /** Epoch milliseconds */
  endsAt: number;
  mode: EventMode;
}

/** The timer switches to its emphasized state for the last 10 minutes. */
export const FINAL_STRETCH_MS = 10 * 60 * 1000;

export function getEventPhase(window: EventWindow, now: number): EventPhase {
  switch (window.mode) {
    case 'ended':
      return 'ended';
    case 'paused':
      return 'paused';
    case 'live':
      return 'live';
    case 'scheduled':
      if (now < window.startsAt) return 'upcoming';
      if (now >= window.endsAt) return 'ended';
      return 'live';
  }
}

/** Milliseconds until the next boundary that matters for the current phase. */
export function getRemainingMs(window: EventWindow, now: number): number {
  switch (getEventPhase(window, now)) {
    case 'upcoming':
      return Math.max(0, window.startsAt - now);
    case 'live':
    case 'paused':
      return Math.max(0, window.endsAt - now);
    case 'ended':
      return 0;
  }
}

export function isFinalStretch(window: EventWindow, now: number): boolean {
  return getEventPhase(window, now) === 'live' && getRemainingMs(window, now) <= FINAL_STRETCH_MS;
}

/** Flags, hints and attachments are only available while the event is live. */
export function isEventLive(window: EventWindow, now: number): boolean {
  return getEventPhase(window, now) === 'live';
}

/** The event has started (so mission titles/points may show) regardless of pause/end. */
export function hasEventStarted(window: EventWindow, now: number): boolean {
  if (window.mode === 'scheduled') return now >= window.startsAt;
  return true; // live, paused and ended all imply the event has started
}

/**
 * Countdown for the top bar. Upcoming shows days; live/paused show HH:MM:SS.
 * Rounds down so it never shows time that is not left.
 */
export function formatCountdown(ms: number, withDays = false): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (withDays || days > 0) {
    return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Offset to add to the local clock to approximate server time.
 * Assumes the server stamped `serverNow` halfway through the round trip.
 */
export function estimateClockOffset(serverNow: number, sentAt: number, receivedAt: number): number {
  const roundTrip = Math.max(0, receivedAt - sentAt);
  return serverNow + roundTrip / 2 - receivedAt;
}
