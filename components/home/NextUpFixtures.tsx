'use client';

import { useEffect, useState } from 'react';
import type { Feed } from '@/lib/football/feed';
import { FEED_PROBLEM_MESSAGE, mergeRefresh } from '@/lib/football/feed';
import type { FootballFixture } from '@/lib/football/types';
import { DataStatus, isShownStale, useClock } from '@/components/football/DataStatus';
import { FixtureLine } from '@/components/football/FixtureLine';

const VISIBLE = 6;
const LIVE_REFRESH_MS = 30_000;
const IDLE_REFRESH_MS = 5 * 60_000;
/**
 * A fixture list older than this is shown as not current: the server's
 * freshness window plus one refresh, with a little slack.
 */
const MAX_LIVE_AGE_MS = { live: 3 * 60_000, idle: 12 * 60_000 };
/** How long a failed refresh may keep showing the last list, labelled not current. Matches the server. */
const MAX_STALE_MS = 30 * 60_000;

function isFeed(value: unknown): value is Feed<FootballFixture[]> {
  if (typeof value !== 'object' || value === null) return false;
  const status = (value as { status?: unknown }).status;
  return status === 'live' || status === 'stale' || status === 'unavailable';
}

function anyLive(feed: Feed<FootballFixture[]>) {
  return feed.status !== 'unavailable' && feed.data.some((fixture) => fixture.phase === 'live');
}

/**
 * Real upcoming and in-play fixtures from the configured provider.
 *
 * Refreshes from FutDuel's own API route, never the provider directly: every
 * 30 seconds while a match is on, every five minutes otherwise, and not while
 * the tab is hidden.
 */
export function NextUpFixtures({
  initial,
  attribution,
}: {
  initial: Feed<FootballFixture[]>;
  attribution: string;
}) {
  const [feed, setFeed] = useState(initial);
  const [tick, setTick] = useState(0);
  const now = useClock();
  const maxLiveAgeMs = anyLive(feed) ? MAX_LIVE_AGE_MS.live : MAX_LIVE_AGE_MS.idle;
  const stale = isShownStale(feed, now, maxLiveAgeMs);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        if (document.visibilityState === 'visible') {
          let next: Feed<FootballFixture[]> | null = null;
          try {
            const response = await fetch('/api/football?resource=fixtures', { cache: 'no-store' });
            const body: unknown = await response.json().catch(() => null);
            if (isFeed(body)) next = body;
          } catch {
            // Offline: keep what is shown; its age label says how old it is.
          }
          if (!cancelled) setFeed((current) => mergeRefresh(current, next, Date.now(), MAX_STALE_MS));
        }
        if (!cancelled) setTick((n) => n + 1);
      },
      anyLive(feed) ? LIVE_REFRESH_MS : IDLE_REFRESH_MS,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [feed, tick]);

  if (feed.status === 'unavailable') {
    return (
      <div className="border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-6 sm:px-6">
        <p className="text-[16px] font-semibold text-[var(--color-ink)]">Live fixtures are unavailable right now</p>
        <p className="mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
          {FEED_PROBLEM_MESSAGE[feed.problem]} FutDuel does not show an old or estimated schedule in its place.
        </p>
      </div>
    );
  }

  const fixtures = [...feed.data]
    .sort((a, b) => Number(b.phase === 'live') - Number(a.phase === 'live'))
    .slice(0, VISIBLE);

  return (
    <div>
      <DataStatus feed={feed} attribution={attribution} maxLiveAgeMs={maxLiveAgeMs} className="mb-4" />
      {fixtures.length === 0 ? (
        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-6 sm:px-6">
          <p className="text-[15px] text-[var(--color-ink-soft)]">
            No matches are listed in the next seven days for the competitions FutDuel follows.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-px border border-[var(--color-line)] bg-[var(--color-line)]">
          {fixtures.map((fixture) => (
            <li key={fixture.id} className="bg-[var(--color-void)] transition-colors hover:bg-[var(--color-surface)]">
              <FixtureLine fixture={fixture} stale={stale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
