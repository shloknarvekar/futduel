'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchEvent, MatchResult } from '@/lib/domain/types';

/**
 * Match presentation, kept strictly separate from match state.
 *
 * `simulateMatch` resolves the whole tie deterministically before anything is
 * rendered. This hook does not decide anything — it walks a clock across that
 * finished result and reports what a viewer would have seen by minute N. That
 * separation is what lets "skip to full time" land on precisely the same score,
 * scorers and statistics as watching it live: skipping moves the clock, it does
 * not run a different simulation.
 */

export type MatchPhase =
  | 'kickoff'
  | 'first-half'
  | 'half-time'
  | 'second-half'
  | 'stoppage'
  | 'full-time';

/** Wall-clock milliseconds per simulated minute. ~25s for a full match. */
const MS_PER_MINUTE = 255;

/** How long the half-time board holds. */
const HALF_TIME_MS = 2600;

const HALF_TIME_MINUTE = 45;
const FULL_TIME_MINUTE = 90;

/** Event types that represent an attempt on goal. */
const SHOT_TYPES = new Set<MatchEvent['type']>(['goal', 'chance', 'save', 'woodwork']);

export interface LiveStats {
  goals: [number, number];
  shots: [number, number];
  onTarget: [number, number];
  xg: [number, number];
  possession: [number, number];
  /** -1 (away on top) to 1 (home on top), from recent chance quality. */
  momentum: number;
}

export interface MatchClock {
  minute: number;
  /** Added time shown as 45+2 / 90+3. Zero when not in stoppage. */
  added: number;
  phase: MatchPhase;
  isLive: boolean;
  events: MatchEvent[];
  latest: MatchEvent | null;
  stats: LiveStats;
  skip: () => void;
  replay: () => void;
}

export function useMatchClock(
  result: MatchResult,
  options: { autoStart?: boolean } = {},
): MatchClock {
  const { autoStart = true } = options;

  // The engine can narrate beyond 90 when a shot lands in stoppage time.
  const lastMinute = useMemo(
    () => result.events.reduce((max, e) => Math.max(max, e.minute), FULL_TIME_MINUTE),
    [result.events],
  );

  // Always kick off at 0'. An earlier version started reduced-motion viewers at
  // the final minute, which dumped the entire feed at once and quietly deleted
  // the feature for anyone with "reduce motion" enabled. Reduced motion
  // suppresses *animation*; a match clock advancing is content, and content is
  // not something to opt people out of. The per-event entrance transitions are
  // the decorative part, and those are already gated with `motion-safe:`.
  const [minute, setMinute] = useState(0);
  const minuteRef = useRef(minute);
  minuteRef.current = minute;

  const skip = useCallback(() => setMinute(lastMinute), [lastMinute]);
  const replay = useCallback(() => setMinute(0), []);

  /* The clock. One interval, torn down and rebuilt whenever it pauses, so there
     is no latch that could leave it stopped. */
  useEffect(() => {
    if (!autoStart) return;
    if (minute >= lastMinute) return;

    // Hold at half time rather than sliding through it.
    if (minute === HALF_TIME_MINUTE) {
      const hold = window.setTimeout(() => setMinute((m) => m + 1), HALF_TIME_MS);
      return () => window.clearTimeout(hold);
    }

    const tick = window.setTimeout(() => setMinute((m) => Math.min(m + 1, lastMinute)), MS_PER_MINUTE);
    return () => window.clearTimeout(tick);
  }, [minute, autoStart, lastMinute]);

  const phase: MatchPhase =
    minute === 0
      ? 'kickoff'
      : minute >= lastMinute
        ? 'full-time'
        : minute === HALF_TIME_MINUTE
          ? 'half-time'
          : minute > FULL_TIME_MINUTE
            ? 'stoppage'
            : minute < HALF_TIME_MINUTE
              ? 'first-half'
              : 'second-half';

  const events = useMemo(
    () => result.events.filter((event) => event.minute <= minute),
    [result.events, minute],
  );

  /* Live statistics are read off the same event stream the viewer is watching,
     so the panel can never disagree with the feed above it. At full time the
     possession split settles onto the value the engine recorded. */
  const stats: LiveStats = useMemo(() => {
    const goals: [number, number] = [0, 0];
    const shots: [number, number] = [0, 0];
    const onTarget: [number, number] = [0, 0];
    const xg: [number, number] = [0, 0];

    let momentumHome = 0;
    let momentumAway = 0;

    for (const event of events) {
      if (event.side !== 'home' && event.side !== 'away') continue;
      const side: 0 | 1 = event.side === 'home' ? 0 : 1;

      if (SHOT_TYPES.has(event.type)) {
        shots[side] += 1;
        xg[side] += event.xg ?? 0;
        if (event.type === 'goal' || event.type === 'save') onTarget[side] += 1;
      }
      if (event.type === 'goal') goals[side] += 1;

      // Momentum weights the last fifteen minutes of chance quality.
      if (minute - event.minute <= 15 && SHOT_TYPES.has(event.type)) {
        const weight = (event.xg ?? 0.05) + (event.type === 'goal' ? 0.4 : 0);
        if (side === 0) momentumHome += weight;
        else momentumAway += weight;
      }
    }

    const swing = momentumHome + momentumAway;
    const momentum = swing === 0 ? 0 : (momentumHome - momentumAway) / swing;

    // Possession is a whole-match average, so it eases from even towards the
    // engine figure rather than pretending to be measured minute by minute.
    const progress = Math.min(1, minute / FULL_TIME_MINUTE);
    const target = result.stats.possession;
    const homePoss = Math.round(50 + (target[0] - 50) * progress);

    return {
      goals,
      shots,
      onTarget,
      xg: [Math.round(xg[0] * 100) / 100, Math.round(xg[1] * 100) / 100],
      possession: [homePoss, 100 - homePoss],
      momentum,
    };
  }, [events, minute, result.stats.possession]);

  const added = minute > FULL_TIME_MINUTE ? minute - FULL_TIME_MINUTE : 0;

  return {
    minute: Math.min(minute, FULL_TIME_MINUTE),
    added,
    phase,
    isLive: phase !== 'full-time' && phase !== 'kickoff',
    events,
    latest: events.length > 0 ? events[events.length - 1]! : null,
    stats,
    skip,
    replay,
  };
}
