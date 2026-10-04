import 'server-only';

import type { Feed } from './feed';
import type { FootballDataProvider } from './provider';
import type { FantasyGameweek, FantasyRoundView } from './fantasy-types';
import type { FootballFixture, FootballRound, RoundStats, SquadPlayer } from './types';
import { activeRoundIndex, pickWindow, roundDeadline, scoreRound } from '@/lib/engine/fantasy-scoring';

/**
 * The fantasy round, assembled from live provider data only.
 *
 * Season, rounds, fixtures, squads, availability and match statistics all come
 * from the provider; FutDuel adds its scoring rules and its pick deadline and
 * nothing else. If a part the game cannot work without is unavailable, the
 * whole feed is unavailable, so the page never shows a half-real round.
 */

const OVER: FootballFixture['phase'][] = ['finished', 'postponed', 'cancelled'];

function buildRound(round: FootballRound, stats: RoundStats, players: SquadPlayer[]): FantasyRoundView {
  const teams = new Map<number, boolean>();
  for (const fixture of stats.fixtures) {
    for (const team of [fixture.home, fixture.away]) {
      teams.set(team.id, (teams.get(team.id) ?? true) && OVER.includes(fixture.phase));
    }
  }
  return {
    round,
    fixtures: stats.fixtures,
    deadline: roundDeadline(stats.fixtures),
    scores: scoreRound(players, stats.fixtures, stats.lines),
    finishedTeamIds: [...teams].filter(([, done]) => done).map(([id]) => id),
    hasStats: stats.lines.some((line) => line.minutes !== null),
  };
}

type Settled = Exclude<Feed<unknown>, { status: 'unavailable' }>;

/**
 * Combine component feeds: unavailable if any part is, stale if any part is.
 *
 * A live result reports the age of `clock`, the part that changes by the
 * minute (the round's fixtures and statistics). Season, rounds and squads
 * refresh on slower schedules of their own; each is live only inside its own
 * freshness window, and if any of them cannot be refreshed the whole feed is
 * stale and reports the oldest stale part's age.
 */
function combine<T>(parts: Feed<unknown>[], clock: Feed<unknown>, data: () => T): Feed<T> {
  const missing = parts.find((part) => part.status === 'unavailable');
  if (missing?.status === 'unavailable') return { status: 'unavailable', problem: missing.problem };
  const settled = parts as Settled[];
  const stale = settled
    .filter((part): part is Extract<Settled, { status: 'stale' }> => part.status === 'stale')
    .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt));
  if (stale[0]) return { status: 'stale', data: data(), fetchedAt: stale[0].fetchedAt, problem: stale[0].problem };
  const fetchedAt = clock.status === 'unavailable' ? new Date().toISOString() : clock.fetchedAt;
  return { status: 'live', data: data(), fetchedAt };
}

export async function getFantasyGameweek(
  provider: FootballDataProvider,
  now = Date.now(),
): Promise<Feed<FantasyGameweek>> {
  const seasonFeed = await provider.getCurrentSeason(provider.fantasyLeagueId);
  if (seasonFeed.status === 'unavailable') return seasonFeed;
  const season = seasonFeed.data;

  const [roundsFeed, squadsFeed] = await Promise.all([provider.getRounds(season.id), provider.getSquads(season.id)]);
  if (roundsFeed.status === 'unavailable') return roundsFeed;
  if (squadsFeed.status === 'unavailable') return squadsFeed;

  const rounds = roundsFeed.data;
  const players = squadsFeed.data;
  // No rounds or no squads is not a finished season; it is a season FutDuel
  // cannot see (or a plan that does not cover it). Nothing is shown.
  if (rounds.length === 0 || players.length === 0) return { status: 'unavailable', problem: 'no-current-season' };
  const index = activeRoundIndex(rounds);
  const activeRound = index >= 0 ? rounds[index]! : null;
  const previousRound = (index >= 0 ? rounds.slice(0, index) : rounds).filter((r) => r.finished).at(-1) ?? null;

  const [activeFeed, previousFeed] = await Promise.all([
    activeRound ? provider.getRoundStats(activeRound, provider.fantasyLeagueId) : null,
    previousRound ? provider.getRoundStats(previousRound, provider.fantasyLeagueId) : null,
  ]);
  if (activeFeed?.status === 'unavailable') return activeFeed;

  const parts: Feed<unknown>[] = [seasonFeed, roundsFeed, squadsFeed];
  if (activeFeed) parts.push(activeFeed);

  return combine(parts, activeFeed ?? roundsFeed, () => {
    const active = activeRound && activeFeed ? buildRound(activeRound, activeFeed.data, players) : null;
    // Last round's points are a reference, not a requirement: without them the
    // round still plays.
    const previous =
      previousRound && previousFeed && previousFeed.status !== 'unavailable'
        ? buildRound(previousRound, previousFeed.data, players)
        : null;
    return {
      attribution: provider.attribution,
      season,
      active,
      window: active ? pickWindow(now, active.deadline) : { state: 'closed' as const },
      previous,
      players,
    };
  });
}
