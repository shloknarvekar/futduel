/**
 * How the live match centre is read, as opposed to what happened in it.
 *
 * The match itself is resolved in full before a minute is shown (see
 * `simulate.ts`), and the clock only reveals it. These two helpers decide what
 * the viewer is shown as it is revealed, and neither can touch the result: they
 * take events and phases in and hand orderings and yes/no answers back.
 */

/**
 * The feed as it is read: newest first. Each entry keeps its chronological
 * index, so a list keyed on it does not shift every row when an event arrives.
 *
 * The feed used to keep chronological order and flip it with
 * `flex-direction: column-reverse`. In a reversed scroll container the scroll
 * origin is the visual bottom, so `scrollTop: 0` — which the feed scrolled to
 * on every event, meaning "newest" — pinned it to the kick-off line instead,
 * and each new event arrived above the visible window. Ordering the data
 * newest first puts the live edge where `scrollTop: 0` actually is.
 */
export function newestFirst<T>(events: readonly T[]): { event: T; index: number }[] {
  return events.map((event, index) => ({ event, index })).reverse();
}

export interface BroadcastState {
  /** Goals scored by both sides so far. */
  goals: number;
  phase: string;
}

/**
 * The moments a broadcast cuts back to the score: a goal, the half-time
 * whistle and full time. Anything else — a chance, a card, the clock ticking
 * over — is watched in the feed, and moving the page for it would mean moving
 * the page every few seconds.
 *
 * Leaving half time is not a moment: the viewer already has the score in front
 * of them from the whistle that started it.
 */
export function isBroadcastMoment(previous: BroadcastState, next: BroadcastState): boolean {
  if (next.goals > previous.goals) return true;
  return next.phase !== previous.phase && (next.phase === 'half-time' || next.phase === 'full-time');
}
