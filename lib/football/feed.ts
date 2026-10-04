/**
 * The honesty contract for live data.
 *
 * Every piece of real-world football FutDuel shows arrives wrapped in a feed,
 * and a feed is always in exactly one of three states:
 *
 * - `live`: fetched from the provider within its freshness window.
 * - `stale`: the provider is failing right now, so the last good response is
 *   shown, labelled with when it was fetched and why it is not current.
 * - `unavailable`: there is nothing true to show. The UI says so and shows no
 *   data at all. It never substitutes generated, projected or old fixtures.
 *
 * Shared by server and client; contains no secrets and no fetching.
 */

export type FeedProblem =
  /** No provider credential is configured on the server. */
  | 'not-configured'
  /** The provider rejected the credential or the plan does not cover the request. */
  | 'unauthorised'
  /** The provider's rate limit is spent. */
  | 'rate-limited'
  /** The provider errored, timed out, or returned something unreadable. */
  | 'provider-error'
  /** The provider has no current season for the configured competition. */
  | 'no-current-season';

export type Feed<T> =
  | { status: 'live'; data: T; fetchedAt: string }
  | { status: 'stale'; data: T; fetchedAt: string; problem: FeedProblem }
  | { status: 'unavailable'; problem: FeedProblem };

/** Plain-language explanations, rendered directly in the UI. */
export const FEED_PROBLEM_MESSAGE: Record<FeedProblem, string> = {
  'not-configured': 'No live football data provider is connected.',
  unauthorised: 'The football data provider refused the request.',
  'rate-limited': 'The football data provider’s request limit has been reached.',
  'provider-error': 'The football data provider could not be reached.',
  'no-current-season': 'The football data provider lists no current season for this competition.',
};

/**
 * How a feed should be presented at `now`.
 *
 * A response can reach the page later than it was fetched (a cached page, a
 * slow tab), so `live` is re-judged against its age: a live feed older than
 * `maxLiveAgeMs` is shown as stale. Nothing is presented as current on the
 * strength of a label alone.
 */
export function presentFeed<T>(
  feed: Feed<T>,
  now: number,
  maxLiveAgeMs: number,
): { state: 'live' | 'stale' | 'unavailable'; ageMs: number | null } {
  if (feed.status === 'unavailable') return { state: 'unavailable', ageMs: null };
  const ageMs = Math.max(0, now - Date.parse(feed.fetchedAt));
  if (feed.status === 'stale' || ageMs > maxLiveAgeMs) return { state: 'stale', ageMs };
  return { state: 'live', ageMs };
}

/**
 * Fold a browser refresh into what is on screen.
 *
 * A refresh that finds the provider unavailable keeps the data already shown,
 * relabelled stale with the reason, but only for `maxStaleMs` after that data
 * was fetched (the same bound the server applies). Beyond it, or with nothing
 * to keep, the feed is unavailable. `now` is passed in so the rule is testable.
 */
export function mergeRefresh<T>(current: Feed<T>, next: Feed<T> | null, now: number, maxStaleMs: number): Feed<T> {
  if (next && next.status !== 'unavailable') return next;
  if (current.status === 'unavailable') return next ?? current;
  if (now - Date.parse(current.fetchedAt) > maxStaleMs) {
    return {
      status: 'unavailable',
      problem: next?.problem ?? (current.status === 'stale' ? current.problem : 'provider-error'),
    };
  }
  // No answer at all (the browser is offline): keep the feed; its age label keeps counting.
  if (!next) return current;
  return { status: 'stale', data: current.data, fetchedAt: current.fetchedAt, problem: next.problem };
}

/** "just now" / "4 min ago" / "2 hr ago". */
export function describeAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}
