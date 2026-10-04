'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { FastForward, Goal, ShieldAlert, Square, Target, Zap } from 'lucide-react';
import type { MatchEvent, MatchResult } from '@/lib/domain/types';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { isBroadcastMoment, newestFirst } from '@/lib/engine/broadcast';
import { useMatchClock, type MatchPhase } from './useMatchClock';

const EVENT_ICON: Record<MatchEvent['type'], typeof Goal> = {
  goal: Goal,
  chance: Target,
  save: ShieldAlert,
  woodwork: Target,
  card: Square,
  whistle: Zap,
};

const PHASE_LABEL: Record<MatchPhase, string> = {
  kickoff: 'Kick off',
  'first-half': 'First half',
  'half-time': 'Half time',
  'second-half': 'Second half',
  stoppage: 'Stoppage',
  'full-time': 'Full time',
};

/** A single statistic, home value against away value. */
function StatRow({
  label,
  home,
  away,
  format = (n: number) => String(n),
}: {
  label: string;
  home: number;
  away: number;
  format?: (n: number) => string;
}) {
  const total = home + away || 1;
  const homePct = (home / total) * 100;
  return (
    <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-3">
      <span className="tnum text-right text-[13px] font-bold text-[var(--color-home)]">
        {format(home)}
      </span>
      <div>
        <p className="kicker mb-1.5 text-center text-[10px]">{label}</p>
        <div className="flex h-[3px] overflow-hidden bg-[var(--color-surface-3)]">
          <div
            className="h-full bg-[var(--color-home)] transition-[width] duration-500 ease-[var(--ease-out-soft)]"
            style={{ width: `${homePct}%` }}
          />
          <div
            className="h-full flex-1 bg-[var(--color-away)] transition-[width] duration-500 ease-[var(--ease-out-soft)]"
          />
        </div>
      </div>
      <span className="tnum text-[13px] font-bold text-[var(--color-away)]">{format(away)}</span>
    </div>
  );
}

/**
 * The live match centre.
 *
 * Everything here is a view onto a result the engine already resolved. The
 * clock walks that result minute by minute so the viewer watches it unfold;
 * skipping moves the clock to full time rather than running a second, different
 * simulation, which is why the two paths always agree.
 */
export function MatchBroadcast({
  result,
  homeName,
  awayName,
  onComplete,
}: {
  result: MatchResult;
  homeName: string;
  awayName: string;
  onComplete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const clock = useMatchClock(result);
  const feedRef = useRef<HTMLOListElement>(null);
  const scoreboardRef = useRef<HTMLElement>(null);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const feed = useMemo(() => newestFirst(clock.events), [clock.events]);

  /* The feed follows the live edge — its top, where the newest event is — for
     as long as the viewer is watching it. Scrolling down into the history lets
     go; scrolling back to the top picks it up again. This scrolls the feed's
     own box, never the page, so it runs under reduced motion too, just without
     the glide. */
  const followingRef = useRef(true);
  const onFeedScroll = () => {
    followingRef.current = (feedRef.current?.scrollTop ?? 0) <= 24;
  };
  useEffect(() => {
    if (!followingRef.current) return;
    feedRef.current?.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
  }, [clock.events.length, reduceMotion]);

  /* A goal, half time or full time brings the scoreboard into view — only if it
     has left the viewport, and never while someone is scrolling the page
     themselves. `block: 'nearest'` moves the page the least it can, and not at
     all when the board is already in view; the section's scroll margins keep
     it clear of the sticky header and the phone tab bar. */
  const lastUserScrollRef = useRef(0);
  useEffect(() => {
    const mark = () => {
      lastUserScrollRef.current = performance.now();
    };
    const markKey = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) mark();
    };
    window.addEventListener('wheel', mark, { passive: true });
    window.addEventListener('touchmove', mark, { passive: true });
    window.addEventListener('keydown', markKey);
    return () => {
      window.removeEventListener('wheel', mark);
      window.removeEventListener('touchmove', mark);
      window.removeEventListener('keydown', markKey);
    };
  }, []);

  const goals = clock.stats.goals[0] + clock.stats.goals[1];
  const momentRef = useRef({ goals, phase: clock.phase as string });
  useEffect(() => {
    const previous = momentRef.current;
    const next = { goals, phase: clock.phase as string };
    momentRef.current = next;
    if (!isBroadcastMoment(previous, next)) return;
    if (performance.now() - lastUserScrollRef.current < 2500) return;
    scoreboardRef.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'instant' : 'smooth' });
  }, [goals, clock.phase, reduceMotion]);

  const atFullTime = clock.phase === 'full-time';
  // The clock is live through the break, but the broadcast is not: at half time
  // the strip says so instead of pulsing "Live" over a stopped match.
  const onAir = clock.isLive && clock.phase !== 'half-time';
  const momentumPct = Math.round((clock.stats.momentum + 1) * 50);

  return (
    <div className="grid gap-4">
      {/* ------------------------------------------------------- Scoreboard */}
      <section
        ref={scoreboardRef}
        className="slab relative scroll-mt-20 scroll-mb-[calc(4.5rem+env(safe-area-inset-bottom))] overflow-hidden lg:scroll-mb-4"
        aria-label="Scoreboard"
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{
            background:
              'linear-gradient(90deg, var(--color-home), var(--color-line-strong) 50%, var(--color-away))',
          }}
        />

        {/* Status strip */}
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] px-4 py-2.5 sm:px-6">
          <span className="flex items-center gap-2">
            {onAir ? (
              <span
                aria-hidden="true"
                className="inline-block size-2 rounded-full bg-[var(--color-danger)] motion-safe:animate-pulse"
              />
            ) : null}
            <span
              className="meta text-[11px]"
              style={{ color: onAir ? 'var(--color-danger)' : 'var(--color-ink-muted)' }}
            >
              {onAir ? 'Live' : PHASE_LABEL[clock.phase]}
            </span>
          </span>

          <output
            aria-live="off"
            className="stat-figure text-[clamp(1.1rem,3.4vw,1.5rem)] text-[var(--color-ink)]"
          >
            {atFullTime ? 'FT' : clock.added > 0 ? `90+${clock.added}` : `${clock.minute}`}
            {!atFullTime ? <span className="text-[var(--color-ink-faint)]">&rsquo;</span> : null}
          </output>
        </div>

        {/* Score line */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8">
          <div className="min-w-0 text-right">
            <p className="meta text-[10px] text-[var(--color-ink-faint)]">Home</p>
            <p className="mt-1.5 truncate text-[clamp(0.95rem,3vw,1.35rem)] font-semibold text-[var(--color-home)]">
              {homeName}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:gap-5">
            <span
              key={`h-${clock.stats.goals[0]}`}
              className="stat-figure text-[clamp(2.6rem,11vw,4.5rem)] text-[var(--color-home)] motion-safe:animate-[rise-in_380ms_var(--ease-out-soft)]"
            >
              {clock.stats.goals[0]}
            </span>
            <span className="stat-figure text-[clamp(1.2rem,4vw,2rem)] text-[var(--color-ink-faint)]" aria-hidden="true">
              &ndash;
            </span>
            <span
              key={`a-${clock.stats.goals[1]}`}
              className="stat-figure text-[clamp(2.6rem,11vw,4.5rem)] text-[var(--color-away)] motion-safe:animate-[rise-in_380ms_var(--ease-out-soft)]"
            >
              {clock.stats.goals[1]}
            </span>
          </div>

          <div className="min-w-0">
            <p className="meta text-[10px] text-[var(--color-ink-faint)]">Away</p>
            <p className="mt-1.5 truncate text-[clamp(0.95rem,3vw,1.35rem)] font-semibold text-[var(--color-away)]">
              {awayName}
            </p>
          </div>
        </div>

        {/* Clock progress across both halves */}
        <div className="relative h-[3px] bg-[var(--color-surface-3)]">
          <div
            className="h-full bg-[var(--color-ink-faint)] transition-[width] duration-200 ease-linear"
            style={{ width: `${(clock.minute / 90) * 100}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-1/2 w-px bg-[var(--color-line-strong)]"
          />
        </div>

        {/* Momentum */}
        <div className="px-4 py-3 sm:px-6">
          <p className="kicker mb-2 text-[10px]">Momentum</p>
          <div className="relative h-1.5 overflow-hidden bg-[var(--color-surface-3)]">
            <div
              className="absolute inset-y-0 left-0 bg-[var(--color-home)] transition-[width] duration-700 ease-[var(--ease-out-soft)]"
              style={{ width: `${momentumPct}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-[var(--color-away)] transition-[width] duration-700 ease-[var(--ease-out-soft)]"
              style={{ width: `${100 - momentumPct}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-line)] px-4 py-3 sm:px-6">
          <span className="meta text-[10px] text-[var(--color-ink-faint)]">
            Seed {result.seed}
          </span>
          {atFullTime ? (
            <Button size="sm" onClick={() => onCompleteRef.current()}>
              See full result
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={clock.skip}
              icon={<FastForward className="size-4" aria-hidden="true" />}
            >
              Skip to full time
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* ----------------------------------------------------- Event feed */}
        <section className="panel min-w-0 p-3 sm:p-4" aria-label="Match events">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="kicker">Match feed</p>
            <p className="meta text-[10px] text-[var(--color-ink-faint)]">
              {clock.events.length} events
            </p>
          </div>

          <ol
            ref={feedRef}
            onScroll={onFeedScroll}
            className="flex max-h-[52vh] flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1"
          >
            {feed.map(({ event, index }) => {
              const Icon = EVENT_ICON[event.type];
              const isGoal = event.type === 'goal';
              const isLatest = index === clock.events.length - 1;
              const accent =
                event.side === 'home'
                  ? 'var(--color-home)'
                  : event.side === 'away'
                    ? 'var(--color-away)'
                    : 'var(--color-ink-muted)';

              // The whistles are punctuation, not incidents. Rendering them as
              // full-width rules gives the timeline the shape of a real match:
              // a first half, a break, a second half.
              if (event.type === 'whistle') {
                return (
                  <li
                    key={`${event.minute}-whistle-${index}`}
                    className="my-1 flex items-center gap-3 px-1 py-1"
                  >
                    <span className="h-px flex-1 bg-[var(--color-line-strong)]" />
                    <span className="meta whitespace-nowrap text-[10px] text-[var(--color-ink-muted)]">
                      {event.text.replace(/\.$/, '')}
                    </span>
                    <span className="h-px flex-1 bg-[var(--color-line-strong)]" />
                  </li>
                );
              }

              return (
                <li
                  key={`${event.minute}-${event.type}-${index}`}
                  className={cn(
                    'grid grid-cols-[3rem_auto_1fr] items-start gap-3 border-l-2 px-3 py-2.5 transition-colors',
                    isGoal
                      ? 'border-l-[var(--color-gold)] bg-[rgba(255,194,75,0.07)]'
                      : 'border-l-transparent',
                    isLatest && !isGoal && 'bg-[var(--color-surface-2)]',
                    isLatest && 'motion-safe:animate-[rise-in_320ms_var(--ease-out-soft)]',
                  )}
                >
                  <span className="tnum pt-px text-right font-mono text-[12px] font-semibold text-[var(--color-ink-faint)]">
                    {event.minute > 90 ? `90+${event.minute - 90}` : event.minute}
                    &rsquo;
                  </span>
                  <Icon
                    className="mt-0.5 size-4 shrink-0"
                    style={{ color: isGoal ? 'var(--color-gold)' : accent }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    {isGoal ? (
                      <p className="meta mb-1 text-[11px] text-[var(--color-gold)]">Goal</p>
                    ) : null}
                    <p
                      className={cn(
                        'text-[13px] leading-snug',
                        isGoal
                          ? 'font-semibold text-[var(--color-ink)]'
                          : 'text-[var(--color-ink-soft)]',
                      )}
                    >
                      {event.text}
                    </p>
                    {event.side !== 'neutral' ? (
                      <p className="meta mt-1 text-[10px]" style={{ color: accent }}>
                        {event.side === 'home' ? homeName : awayName}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ---------------------------------------------------- Live stats */}
        <section className="panel grid content-start gap-4 p-4 sm:p-5" aria-label="Match statistics">
          <p className="kicker">Match stats</p>

          <StatRow
            label="Possession"
            home={clock.stats.possession[0]}
            away={clock.stats.possession[1]}
            format={(n) => `${n}%`}
          />
          <StatRow label="Shots" home={clock.stats.shots[0]} away={clock.stats.shots[1]} />
          <StatRow
            label="On target"
            home={clock.stats.onTarget[0]}
            away={clock.stats.onTarget[1]}
          />
          <StatRow
            label="Expected goals"
            home={clock.stats.xg[0]}
            away={clock.stats.xg[1]}
            format={(n) => n.toFixed(2)}
          />

          <p className="mt-1 border-t border-[var(--color-line)] pt-3 text-[11px] leading-relaxed text-[var(--color-ink-faint)]">
            Counted from the events shown above as they arrive, so the panel always agrees with the
            feed.
          </p>
        </section>
      </div>
    </div>
  );
}
