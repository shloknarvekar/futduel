import { NextResponse } from 'next/server';
import { getFootballProvider } from '@/lib/football/provider';
import { getFantasyGameweek } from '@/lib/football/fantasy';
import type { Feed } from '@/lib/football/feed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The browser's only door to live football data.
 *
 * It is not a proxy: the client names one of two fixed resources, and the
 * server decides every upstream path, parameter and competition. The provider
 * token never leaves the server, upstream error bodies are never forwarded,
 * and each response carries its own feed state and fetch time, so a response
 * held by any cache cannot pass for fresher than it is.
 */

const RESOURCES = ['fixtures', 'fantasy'] as const;

/* --------------------------- naive rate limiting -------------------------- */
/* Per-instance and in-memory: enough to stop one tab hammering the upstream
 * quota, and deliberately not presented as a security control. Upstream calls
 * are further bounded by the server-side cache behind the provider. */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const MAX_BUCKETS = 5_000;
const buckets = new Map<string, { count: number; reset: number }>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [id, entry] of buckets) if (entry.reset < now) buckets.delete(id);
      if (buckets.size >= MAX_BUCKETS) return false;
    }
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS) return false;
  bucket.count += 1;
  return true;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resource = url.searchParams.get('resource');

  if (resource !== 'fixtures' && resource !== 'fantasy') {
    return json({ error: `resource must be one of: ${RESOURCES.join(', ')}` }, 400);
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local';

  if (!rateLimit(ip)) {
    return json({ error: 'Too many requests. Try again in a minute.' }, 429, { 'Retry-After': '60' });
  }

  const provider = getFootballProvider();
  if (!provider) {
    const unavailable: Feed<never> = { status: 'unavailable', problem: 'not-configured' };
    return json(unavailable);
  }

  try {
    const feed = resource === 'fixtures' ? await provider.getUpcomingFixtures() : await getFantasyGameweek(provider);
    return json(feed);
  } catch (error) {
    console.error('[api/football] unexpected failure:', error instanceof Error ? error.message : 'unknown');
    const unavailable: Feed<never> = { status: 'unavailable', problem: 'provider-error' };
    return json(unavailable, 502);
  }
}
