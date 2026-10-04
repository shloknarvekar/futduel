'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, Radio } from 'lucide-react';
import { FEED_PROBLEM_MESSAGE, describeAge, presentFeed, type Feed } from '@/lib/football/feed';
import { formatTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * The browser's clock, ticking every 30 seconds, or `null` before mount so the
 * server render and the first client render agree.
 */
export function useClock(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Whether a feed must be presented as not current: labelled stale, or too old for a live label. */
export function isShownStale(feed: Feed<unknown>, now: number | null, maxLiveAgeMs: number): boolean {
  if (feed.status === 'unavailable') return false;
  return feed.status === 'stale' || (now !== null && presentFeed(feed, now, maxLiveAgeMs).state === 'stale');
}

/**
 * Where the numbers on screen came from and how old they are.
 *
 * A feed is re-judged against its age on the client, so a page served from a
 * cache cannot present an old response as current. Before mount the fetch
 * time is shown as a clock time, which renders identically on server and
 * client; after mount it becomes a relative age that keeps counting. A change
 * between live and not current is announced to screen readers; the ticking
 * age is not.
 */
export function DataStatus({
  feed,
  attribution,
  maxLiveAgeMs,
  className,
}: {
  feed: Feed<unknown>;
  attribution: string;
  /** Older than this, a `live` response is shown as not current. */
  maxLiveAgeMs: number;
  className?: string;
}) {
  const now = useClock();

  if (feed.status === 'unavailable') {
    return (
      <p role="status" className={cn('flex items-start gap-2 text-[13px] leading-snug text-[var(--color-warn)]', className)}>
        <CircleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
        <span>{FEED_PROBLEM_MESSAGE[feed.problem]}</span>
      </p>
    );
  }

  const presented = now === null ? null : presentFeed(feed, now, maxLiveAgeMs);
  const stale = isShownStale(feed, now, maxLiveAgeMs);
  const when = presented?.ageMs != null ? describeAge(presented.ageMs) : `at ${formatTime(feed.fetchedAt)}`;

  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-snug',
        stale ? 'text-[var(--color-warn)]' : 'text-[var(--color-ink-soft)]',
        className,
      )}
    >
      {stale ? (
        <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Radio className="size-4 shrink-0 text-[var(--color-home)]" aria-hidden="true" />
      )}
      <span className="font-semibold" aria-live="polite">
        {stale ? 'Not current' : 'Live data'}
      </span>
      <span>
        {stale ? 'last updated' : 'updated'} {when}
        {feed.status === 'stale' ? ` · ${FEED_PROBLEM_MESSAGE[feed.problem]}` : ''}
      </span>
      <span className="text-[var(--color-ink-muted)]">· Data: {attribution}</span>
    </p>
  );
}
