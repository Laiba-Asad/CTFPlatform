/**
 * How a mission appears to the current player. The reason is explicit so the UI
 * never collapses "the admin hasn't released it" and "the event isn't live" into
 * one ambiguous "LOCKED".
 */
export type MissionState =
  | 'solved' // the player already solved it
  | 'available' // released, event live, service ready: openable
  | 'locked' // not released by the admin yet
  | 'opens_at_start' // event has not started
  | 'paused' // event is paused
  | 'event_ended' // event has ended
  | 'starting' // released + live but the service is still coming up
  | 'unavailable'; // released + live but the service is down after retries

/** Public mission card data. Never contains flag material. */
export interface MissionSummary {
  id: string;
  /** Display position in board order (points, then id). Derived, never stored. */
  number: number;
  title: string;
  /** Null while content is hidden (before the event starts or while locked). */
  description: string | null;
  category: string;
  points: number;
  state: MissionState;
  solves: number;
}
