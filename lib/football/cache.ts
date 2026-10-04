import 'server-only';

import type { Feed, FeedProblem } from './feed';
import { ProviderError } from './sportmonks';

/**
 * Server-side cache for provider responses, with honest staleness.
 *
 * - A response is served as `live` until its freshness window closes. Windows
 *   are chosen per call and can depend on the data: a round with a match in
 *   progress refreshes every minute, a finished round every few hours.
 * - When a refresh fails, the last good response is served as `stale`, with
 *   its fetch time and the reason, for at most `maxStaleMs`. Beyond that the
 *   feed is `unavailable`: old data is never passed off as current.
 * - Concurrent requests for the same key share one upstream call, and a failed
 *   call backs off before the provider is asked again.
 *
 * In-memory and per server instance: enough to keep request volume far inside
 * the provider's hourly limits without adding infrastructure.
 */

interface Entry {
  value: unknown;
  fetchedAt: number;
  freshUntil: number;
}

export interface CachePolicy<T> {
  /** How long a successful response stays live. */
  ttlMs: number | ((value: T) => number);
  /** How long the last good response may be shown, labelled stale, after refreshes fail. */
  maxStaleMs: number;
}

const MAX_ENTRIES = 300;
const FAILURE_BACKOFF_MS = 30_000;
const RATE_LIMIT_BACKOFF_MS = 120_000;

const entries = new Map<string, Entry>();
const failures = new Map<string, { problem: FeedProblem; retryAt: number }>();
const inflight = new Map<string, Promise<unknown>>();

function remember(key: string, entry: Entry) {
  entries.delete(key);
  entries.set(key, entry);
  if (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
}

function fallback<T>(key: string, problem: FeedProblem, policy: CachePolicy<T>): Feed<T> {
  const entry = entries.get(key);
  if (entry && Date.now() - entry.fetchedAt <= policy.maxStaleMs) {
    return { status: 'stale', data: entry.value as T, fetchedAt: new Date(entry.fetchedAt).toISOString(), problem };
  }
  return { status: 'unavailable', problem };
}

export async function cachedFeed<T>(key: string, policy: CachePolicy<T>, load: () => Promise<T>): Promise<Feed<T>> {
  const now = Date.now();
  const entry = entries.get(key);
  if (entry && entry.freshUntil > now) {
    return { status: 'live', data: entry.value as T, fetchedAt: new Date(entry.fetchedAt).toISOString() };
  }

  const failure = failures.get(key);
  if (failure && failure.retryAt > now) return fallback(key, failure.problem, policy);

  try {
    let pending = inflight.get(key) as Promise<T> | undefined;
    if (!pending) {
      pending = load();
      inflight.set(key, pending);
    }
    const value = await pending;
    const fetchedAt = Date.now();
    const ttl = typeof policy.ttlMs === 'function' ? policy.ttlMs(value) : policy.ttlMs;
    remember(key, { value, fetchedAt, freshUntil: fetchedAt + ttl });
    failures.delete(key);
    return { status: 'live', data: value, fetchedAt: new Date(fetchedAt).toISOString() };
  } catch (error) {
    const problem: FeedProblem = error instanceof ProviderError ? error.problem : 'provider-error';
    if (!(error instanceof ProviderError)) {
      console.error(`[football] ${key}: ${error instanceof Error ? error.message : 'unexpected failure'}`);
    }
    failures.set(key, {
      problem,
      retryAt: Date.now() + (problem === 'rate-limited' ? RATE_LIMIT_BACKOFF_MS : FAILURE_BACKOFF_MS),
    });
    return fallback(key, problem, policy);
  } finally {
    inflight.delete(key);
  }
}
