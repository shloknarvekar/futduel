import 'server-only';

import type { FeedProblem } from './feed';

/**
 * The Sportmonks Football API v3 client.
 *
 * Server-only. The token is read from the environment on the server, sent in
 * the `Authorization` header (never in a URL that could reach a log), and never
 * serialised into anything the browser receives. Upstream error bodies are not
 * passed on: callers get a `FeedProblem`, and the server log gets a status and
 * a path.
 *
 * Docs: https://docs.sportmonks.com/football
 */

const PRODUCTION_BASE_URL = 'https://api.sportmonks.com/v3/football';
const TIMEOUT_MS = 8000;
const PER_PAGE = 50;

/**
 * The Premier League (id 8), the league used in the provider's own
 * documentation. Operators on other plans set `SPORTMONKS_LEAGUE_IDS`, e.g.
 * `271,501` for the free plan's Danish Superliga and Scottish Premiership.
 */
const DEFAULT_LEAGUE_IDS = [8];
const MAX_LEAGUES = 10;

export interface SportmonksConfig {
  token: string;
  baseUrl: string;
  /** Competitions shown in live fixtures. */
  leagueIds: number[];
  /** The one competition the fantasy game is played in. */
  fantasyLeagueId: number;
}

export class ProviderError extends Error {
  constructor(
    readonly problem: FeedProblem,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

function parseIds(raw: string | undefined): number[] | null {
  if (!raw?.trim()) return null;
  const ids = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => /^\d{1,9}$/.test(part))
    .map(Number)
    .filter((id) => id > 0);
  return ids.length > 0 ? [...new Set(ids)].slice(0, MAX_LEAGUES) : null;
}

/**
 * A base URL override exists only so the integration can be exercised against
 * a local contract-test server. It is ignored in production builds and only
 * accepts a loopback address, so configuration can never point the server's
 * credentials at another host.
 */
function resolveBaseUrl(): string {
  const override = process.env.SPORTMONKS_BASE_URL?.trim();
  if (!override || process.env.NODE_ENV === 'production') return PRODUCTION_BASE_URL;
  try {
    const url = new URL(override);
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol === 'http:' && loopback) return override.replace(/\/+$/, '');
  } catch {
    // Fall through to the real provider.
  }
  return PRODUCTION_BASE_URL;
}

/** The provider configuration, or `null` when no token is set. */
export function readSportmonksConfig(): SportmonksConfig | null {
  const token = process.env.SPORTMONKS_API_TOKEN?.trim();
  if (!token) return null;
  const leagueIds = parseIds(process.env.SPORTMONKS_LEAGUE_IDS) ?? DEFAULT_LEAGUE_IDS;
  const fantasyLeagueId = parseIds(process.env.SPORTMONKS_FANTASY_LEAGUE_ID)?.[0] ?? leagueIds[0]!;
  return { token, baseUrl: resolveBaseUrl(), leagueIds, fantasyLeagueId };
}

function problemForStatus(status: number): FeedProblem {
  if (status === 401 || status === 403) return 'unauthorised';
  if (status === 429) return 'rate-limited';
  return 'provider-error';
}

interface Page {
  data: unknown;
  hasMore: boolean;
}

async function getPage(config: SportmonksConfig, path: string, params: Record<string, string>): Promise<Page> {
  const url = new URL(`${config.baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: config.token, Accept: 'application/json' },
      signal: controller.signal,
      // FutDuel keeps its own labelled cache; the framework cache would hide
      // how old a response is.
      cache: 'no-store',
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timed out' : 'network error';
    console.error(`[sportmonks] ${path}: ${reason}`);
    throw new ProviderError('provider-error', reason);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    console.error(`[sportmonks] ${path}: HTTP ${response.status}`);
    throw new ProviderError(problemForStatus(response.status), `HTTP ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    console.error(`[sportmonks] ${path}: unreadable response`);
    throw new ProviderError('provider-error', 'unreadable response');
  }
  // A query with nothing to return answers 200 with a `message` ("No result(s)
  // found matching your request...") and no `data`. That is an empty list, not
  // an outage: an international break has no fixtures. Callers that cannot
  // work with an empty list say so themselves.
  if (
    typeof body === 'object' &&
    body !== null &&
    !('data' in body) &&
    typeof (body as { message?: unknown }).message === 'string' &&
    /no result/i.test((body as { message: string }).message)
  ) {
    return { data: [], hasMore: false };
  }
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    console.error(`[sportmonks] ${path}: response without data`);
    throw new ProviderError('provider-error', 'response without data');
  }

  const record = body as { data: unknown; pagination?: { has_more?: unknown } };
  return { data: record.data, hasMore: record.pagination?.has_more === true };
}

/** A single-resource request. */
export async function sportmonksGet(
  config: SportmonksConfig,
  path: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  return (await getPage(config, path, params)).data;
}

/** A paginated request, collected into one array, up to `maxPages` pages. */
export async function sportmonksGetAll(
  config: SportmonksConfig,
  path: string,
  params: Record<string, string> = {},
  maxPages = 6,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const result = await getPage(config, path, { ...params, per_page: String(PER_PAGE), page: String(page) });
    if (Array.isArray(result.data)) rows.push(...result.data);
    if (!result.hasMore) break;
  }
  return rows;
}
