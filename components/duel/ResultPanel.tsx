'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Crown, Repeat, Rewind, Star, TrendingDown, TrendingUp } from 'lucide-react';
import type { Category, MatchEvent, MatchResult, SquadRating } from '@/lib/domain/types';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge, CompareBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils/cn';
import { entrance } from '@/lib/utils/motion';

/**
 * "You wins" is the kind of thing that quietly cheapens a whole screen. The
 * default manager name is a pronoun, so the verb has to agree with it.
 */
function winLine(name: string): string {
  return /^(you|we|i|they)$/i.test(name.trim()) ? `${name} win` : `${name} wins`;
}

/** The moments worth retelling. Taken straight from the engine, never invented. */
function storyOf(events: MatchEvent[]): MatchEvent[] {
  return events.filter(
    (event) => event.type === 'goal' || event.type === 'woodwork' || event.type === 'card',
  );
}

function StrengthRow({ label, home, away }: { label: string; home: number; away: number }) {
  const peak = Math.max(home, away, 1);
  const homeLeads = home > away;
  const awayLeads = away > home;
  return (
    <div className="grid grid-cols-[3.25rem_1fr_4.5rem_1fr_3.25rem] items-center gap-2 text-[12px]">
      <span
        className={cn(
          'tnum text-right font-bold',
          homeLeads ? 'text-[var(--color-home)]' : 'text-[var(--color-ink-muted)]',
        )}
      >
        {home.toFixed(1)}
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
        <span
          className="ml-auto block h-full rounded-full bg-[var(--color-home)]"
          style={{ width: `${(home / peak) * 100}%` }}
        />
      </span>
      <span className="kicker text-center text-[9px]">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
        <span
          className="block h-full rounded-full bg-[var(--color-away)]"
          style={{ width: `${(away / peak) * 100}%` }}
        />
      </span>
      <span
        className={cn(
          'tnum font-bold',
          awayLeads ? 'text-[var(--color-away)]' : 'text-[var(--color-ink-muted)]',
        )}
      >
        {away.toFixed(1)}
      </span>
    </div>
  );
}

/**
 * The payoff screen, ordered the way a viewer actually asks the questions: who
 * won, by how much, how it happened, who decided it, what the numbers said —
 * and only then, what to do next.
 */
export function ResultPanel({
  result,
  homeName,
  awayName,
  homeCategory,
  awayCategory,
  homeRating,
  awayRating,
  ratingDelta,
  onRematch,
  onNewDuel,
  onRewatch,
  newDuelLabel = 'Spin again',
}: {
  result: MatchResult;
  homeName: string;
  awayName: string;
  homeCategory: Category;
  awayCategory: Category;
  homeRating?: SquadRating;
  awayRating?: SquadRating;
  /** Omitted for pass-and-play, where nobody's rating moves. */
  ratingDelta?: number;
  /** Omitted when replaying a duel from history, which is watched, not replayed for points. */
  onRematch?: () => void;
  onNewDuel: () => void;
  onRewatch?: () => void;
  newDuelLabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  const story = useMemo(() => storyOf(result.events), [result.events]);

  const winnerName =
    result.winner === 'home' ? homeName : result.winner === 'away' ? awayName : null;
  const accent =
    result.winner === 'home'
      ? 'var(--color-home)'
      : result.winner === 'away'
        ? 'var(--color-away)'
        : 'var(--color-ink-soft)';

  const margin = Math.abs(result.homeGoals - result.awayGoals);

  return (
    <motion.section
      initial={entrance(reduceMotion, { opacity: 0, y: 18 })}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="grid gap-5"
      aria-labelledby="result-heading"
    >
      {/* Winner, then the final score ------------------------------------- */}
      <div className="panel relative overflow-hidden px-5 py-8 text-center sm:px-8 sm:py-10">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.16] blur-3xl"
          style={{ background: accent }}
        />

        <p className="kicker relative mb-3">Full time</p>

        <h2
          id="result-heading"
          className="relative text-[clamp(2rem,8vw,3.6rem)] leading-[0.94]"
          style={{ color: accent }}
        >
          {winnerName ? winLine(winnerName) : 'Honours even'}
        </h2>

        {winnerName ? (
          <p className="relative mt-2 text-[13px] text-[var(--color-ink-muted)]">
            {margin === 1 ? 'By a single goal' : `By ${margin} goals`}
          </p>
        ) : null}

        <div className="relative mt-7 flex items-center justify-center gap-4 sm:gap-8">
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
              Home
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--color-home)] sm:text-base">
              {homeName}
            </p>
            <p className="mt-0.5 truncate text-2xs text-[var(--color-ink-faint)]">
              {homeCategory.name}
            </p>
          </div>

          <p className="tnum shrink-0 font-display text-[clamp(2.6rem,12vw,4.8rem)] leading-none">
            <span className="text-[var(--color-home)]">{result.homeGoals}</span>
            <span className="mx-2 text-[var(--color-ink-faint)]" aria-hidden="true">
              –
            </span>
            <span className="text-[var(--color-away)]">{result.awayGoals}</span>
          </p>

          <div className="min-w-0 flex-1 text-left">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
              Away
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--color-away)] sm:text-base">
              {awayName}
            </p>
            <p className="mt-0.5 truncate text-2xs text-[var(--color-ink-faint)]">
              {awayCategory.name}
            </p>
          </div>
        </div>

        {result.shootout ? (
          <p className="tnum relative mt-4 text-sm text-[var(--color-ink-muted)]">
            After penalties {result.shootout.home}–{result.shootout.away}
          </p>
        ) : null}
      </div>

      {/* The match story --------------------------------------------------- */}
      {story.length > 0 ? (
        <div className="panel px-4 py-5 sm:px-6">
          <p className="kicker mb-4">How it happened</p>
          <ol className="grid gap-2.5">
            {story.map((event, index) => {
              const isGoal = event.type === 'goal';
              const side = event.side === 'home' ? 'var(--color-home)' : 'var(--color-away)';
              return (
                <li
                  key={`${event.minute}-${event.type}-${index}`}
                  className="grid grid-cols-[2.75rem_1fr] items-start gap-3"
                >
                  <span
                    className="tnum rounded-[6px] py-0.5 text-center font-mono text-[11px] font-semibold"
                    style={{
                      color: side,
                      background: `color-mix(in oklab, ${side} 12%, transparent)`,
                    }}
                  >
                    {event.minute}&rsquo;
                  </span>
                  <p
                    className={cn(
                      'text-[13px] leading-snug',
                      isGoal
                        ? 'font-semibold text-[var(--color-ink)]'
                        : 'text-[var(--color-ink-muted)]',
                    )}
                  >
                    {isGoal ? (
                      <span className="mr-2 inline-block rounded-[4px] bg-[var(--color-gold)] px-1.5 py-px align-[1px] text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-void)]">
                        Goal
                      </span>
                    ) : null}
                    {event.text}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {/* Player of the match ------------------------------------------------ */}
      {result.motm ? (
        <div className="panel flex items-center gap-4 px-4 py-4 sm:px-5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-full"
            style={{ background: 'rgba(255,194,75,0.12)' }}
          >
            <Crown className="size-5 text-[var(--color-gold)]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="kicker text-[9px]">Player of the match</p>
            <p className="truncate text-base font-semibold text-[var(--color-ink)]">
              {result.motm.name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--color-ink-muted)]">
              <Star className="size-3" aria-hidden="true" />
              {result.motm.line}
              <span
                className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{
                  color: result.motm.side === 'home' ? 'var(--color-home)' : 'var(--color-away)',
                  background:
                    result.motm.side === 'home' ? 'color-mix(in oklab, var(--color-home) 10%, transparent)' : 'color-mix(in oklab, var(--color-away) 10%, transparent)',
                }}
              >
                {result.motm.side === 'home' ? homeName : awayName}
              </span>
            </p>
          </div>
        </div>
      ) : null}

      {/* Match statistics --------------------------------------------------- */}
      <div className="panel grid gap-4 px-4 py-5 sm:px-6">
        <p className="kicker">Match stats</p>
        <CompareBar
          label="Possession"
          home={result.stats.possession[0]}
          away={result.stats.possession[1]}
          format={(n) => `${n}%`}
        />
        <CompareBar label="Shots" home={result.stats.shots[0]} away={result.stats.shots[1]} />
        <CompareBar
          label="On target"
          home={result.stats.onTarget[0]}
          away={result.stats.onTarget[1]}
        />
        <CompareBar
          label="Expected goals"
          home={result.stats.xg[0]}
          away={result.stats.xg[1]}
          format={(n) => n.toFixed(1)}
        />
      </div>

      {/* How the elevens compared before a ball was kicked ------------------- */}
      {homeRating && awayRating ? (
        <div className="panel grid gap-3 px-4 py-5 sm:px-6">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <p className="kicker">How the elevens compared</p>
            <p className="text-[11px] text-[var(--color-ink-faint)]">Before kick-off</p>
          </div>
          <StrengthRow label="Attack" home={homeRating.attack} away={awayRating.attack} />
          <StrengthRow label="Midfield" home={homeRating.midfield} away={awayRating.midfield} />
          <StrengthRow label="Defence" home={homeRating.defence} away={awayRating.defence} />
          <StrengthRow label="Chem" home={homeRating.chemistry} away={awayRating.chemistry} />
        </div>
      ) : null}

      {/* Rating change ------------------------------------------------------- */}
      {ratingDelta !== undefined ? (
        <div className="panel flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="kicker text-[9px]">Manager rating</p>
            <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
              {ratingDelta >= 0 ? 'Gained from this duel' : 'Lost from this duel'}
            </p>
          </div>
          <Badge tone={ratingDelta >= 0 ? 'home' : 'danger'}>
            {ratingDelta >= 0 ? (
              <TrendingUp className="size-3.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-3.5" aria-hidden="true" />
            )}
            <span className="tnum">
              {ratingDelta >= 0 ? '+' : ''}
              {ratingDelta}
            </span>
          </Badge>
        </div>
      ) : null}

      {/* What next ----------------------------------------------------------- */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {onRematch ? (
          <Button block onClick={onRematch} icon={<Repeat className="size-4" aria-hidden="true" />}>
            Rematch
          </Button>
        ) : null}
        {onRewatch ? (
          <Button
            block
            variant="secondary"
            onClick={onRewatch}
            icon={<Rewind className="size-4" aria-hidden="true" />}
          >
            Watch again
          </Button>
        ) : null}
        <Button block variant="secondary" onClick={onNewDuel}>
          {newDuelLabel}
        </Button>
        <ButtonLink block variant="ghost" href="/leaderboard">
          See the ranks
        </ButtonLink>
      </div>

      <p className="text-center text-2xs text-[var(--color-ink-faint)]">
        Seed <span className="tnum font-mono">{result.seed}</span> — the same seed always replays the
        same ninety minutes.
      </p>
    </motion.section>
  );
}
