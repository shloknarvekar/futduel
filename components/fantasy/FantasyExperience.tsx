'use client';

import { useEffect, useState } from 'react';
import { Clock, Flag, Lock } from 'lucide-react';
import type { Feed } from '@/lib/football/feed';
import { mergeRefresh } from '@/lib/football/feed';
import type { FantasyGameweek } from '@/lib/football/fantasy-types';
import type { StandingRow } from '@/lib/football/types';
import { LOCK_LEAD_MS, pickWindow } from '@/lib/engine/fantasy-scoring';
import { DataStatus, isShownStale } from '@/components/football/DataStatus';
import { Segmented } from '@/components/ui/Segmented';
import { formatDate, formatTime, timeUntil } from '@/lib/utils/format';
import { roundLabel } from './fantasy-format';
import { FantasySquadBuilder, storageKeyFor } from './FantasySquadBuilder';
import { RoundFixtures } from './RoundFixtures';
import { LeagueTable } from './LeagueTable';
import { ScoringRules } from './ScoringRules';
import { FantasyUnavailable } from './FantasyUnavailable';

type Available = Exclude<Feed<FantasyGameweek>, { status: 'unavailable' }>;
type Tab = 'squad' | 'fixtures' | 'table' | 'scoring';

const MINUTE = 60_000;
const LIVE_REFRESH_MS = MINUTE;
const IDLE_REFRESH_MS = 5 * MINUTE;
/** How long failed refreshes may keep the round on screen, labelled not current. Matches the server. */
const MAX_STALE_MS = 60 * MINUTE;

const TABS: { value: Tab; label: string; shortLabel?: string }[] = [
  { value: 'squad', label: 'Your eleven', shortLabel: 'Eleven' },
  { value: 'fixtures', label: 'Fixtures' },
  { value: 'table', label: 'Table' },
  { value: 'scoring', label: 'Scoring' },
];

const isLive = (data: FantasyGameweek) => data.active?.fixtures.some((f) => f.phase === 'live') ?? false;

/**
 * How old a live response may be before it is shown as not current. Wider than
 * the server's freshness window for the round plus one refresh interval, and
 * tight while a match is being played.
 */
const maxLiveAge = (data: FantasyGameweek) => (isLive(data) ? 5 * MINUTE : data.active ? 20 * MINUTE : 45 * MINUTE);

function isFeed(value: unknown): value is Feed<FantasyGameweek> {
  if (typeof value !== 'object' || value === null) return false;
  const status = (value as { status?: unknown }).status;
  return status === 'live' || status === 'stale' || status === 'unavailable';
}

/**
 * FutDuel Fantasy on real football.
 *
 * Everything about the round comes from the provider through FutDuel's own
 * API route; the page refreshes itself every minute while picks are locked or
 * a match is on, every five minutes otherwise, and never while hidden. If a
 * refresh fails, what is on screen stays, relabelled as not current, for an
 * hour at most; after that the game closes until current data returns.
 */
export function FantasyExperience({
  initial,
  standings,
}: {
  initial: Available;
  standings: Feed<StandingRow[]>;
}) {
  const [feed, setFeed] = useState<Feed<FantasyGameweek>>(initial);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('squad');
  const data = feed.status === 'unavailable' ? null : feed.data;

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // The deadline is judged against this browser's clock, not the render's.
  const pick = data ? (data.active && now !== null ? pickWindow(now, data.active.deadline) : data.window) : null;
  const busy = pick?.state === 'locked' || (data !== null && isLive(data));

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        if (document.visibilityState === 'visible') {
          let next: Feed<FantasyGameweek> | null = null;
          try {
            const response = await fetch('/api/football?resource=fantasy', { cache: 'no-store' });
            const body: unknown = await response.json().catch(() => null);
            if (isFeed(body)) next = body;
          } catch {
            // Offline: keep what is shown; its age label says how old it is.
          }
          if (!cancelled) setFeed((current) => mergeRefresh(current, next, Date.now(), MAX_STALE_MS));
        }
        if (!cancelled) setTick((n) => n + 1);
      },
      busy ? LIVE_REFRESH_MS : IDLE_REFRESH_MS,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [feed, tick, busy]);

  if (feed.status === 'unavailable' || !data || !pick) {
    return <FantasyUnavailable problem={feed.status === 'unavailable' ? feed.problem : 'provider-error'} />;
  }

  const { season, active } = data;
  const stale = isShownStale(feed, now, maxLiveAge(data));

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="mb-8 max-w-[62rem]">
        <p className="kicker mb-3">
          Fantasy &middot; {season.leagueName} &middot; {season.name}
        </p>
        <h1 className="text-[clamp(2.6rem,8vw,4.5rem)]">{active ? roundLabel(active.round.name) : 'Season complete'}</h1>

        <div className="mt-5 border-l-2 border-[var(--color-line-strong)] pl-4">
          {pick.state === 'open' && pick.deadline ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-[var(--color-ink)]">
              <Clock className="size-4 shrink-0 text-[var(--color-home)]" aria-hidden="true" />
              <span>
                Picks lock{' '}
                <time dateTime={pick.deadline} className="tnum font-semibold">
                  {formatDate(pick.deadline)}, {formatTime(pick.deadline)}
                </time>
                {now !== null ? <span className="text-[var(--color-ink-soft)]"> &middot; in {timeUntil(pick.deadline, now)}</span> : null}
              </span>
            </p>
          ) : pick.state === 'open' ? (
            <p className="flex items-center gap-2 text-[15px] text-[var(--color-ink)]">
              <Clock className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
              Kickoff times for this round are not confirmed yet, so picks stay open.
            </p>
          ) : pick.state === 'locked' ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-[var(--color-ink)]">
              <Lock className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden="true" />
              <span>
                Picks locked{' '}
                <time dateTime={pick.deadline} className="tnum font-semibold">
                  {formatDate(pick.deadline)}, {formatTime(pick.deadline)}
                </time>
                . Points update as match statistics arrive.
              </span>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-[15px] text-[var(--color-ink)]">
              <Flag className="size-4 shrink-0 text-[var(--color-ink-muted)]" aria-hidden="true" />
              No rounds are left this season. Fantasy reopens when the next season is listed.
            </p>
          )}
          {active ? (
            <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
              FutDuel locks picks {LOCK_LEAD_MS / MINUTE} minutes before a round&rsquo;s first kickoff.
            </p>
          ) : null}
        </div>

        <DataStatus feed={feed} attribution={data.attribution} maxLiveAgeMs={maxLiveAge(data)} className="mt-6" />
        <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
          Fixtures, squads, injuries and match statistics are real, from {data.attribution}. Points are FutDuel&rsquo;s
          own scoring of those statistics, not an official fantasy game. There are no prices or transfers, and your
          eleven is saved in this browser only.
        </p>
      </header>

      <Segmented label="Fantasy view" options={TABS} value={tab} onChange={setTab} className="mb-6" />

      <div className="max-w-[62rem]">
        {tab === 'squad' ? (
          <FantasySquadBuilder key={storageKeyFor(season)} data={data} pick={pick} stale={stale} />
        ) : tab === 'fixtures' ? (
          <RoundFixtures active={active} previous={data.previous} stale={stale} />
        ) : tab === 'table' ? (
          <LeagueTable standings={standings} attribution={data.attribution} leagueName={season.leagueName} />
        ) : (
          <ScoringRules attribution={data.attribution} />
        )}
      </div>
    </div>
  );
}
