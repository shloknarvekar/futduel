import 'server-only';

import type { Feed } from './feed';
import type { FootballFixture, FootballRound, FootballSeason, RoundStats, SquadPlayer, StandingRow } from './types';
import { cachedFeed } from './cache';
import {
  normalizeCurrentSeason,
  normalizeFixtures,
  normalizeLineupStats,
  normalizeRounds,
  normalizeSquads,
  normalizeStandings,
} from './normalize';
import { ProviderError, readSportmonksConfig, sportmonksGet, sportmonksGetAll } from './sportmonks';
import type { SportmonksConfig } from './sportmonks';

/**
 * The seam between FutDuel and real, current football.
 *
 *   UI  →  this provider (server)  →  Sportmonks  →  normalised types
 *
 * Game mechanics, the card database and the duel engine never touch it. When
 * no provider is configured, `getFootballProvider()` returns `null` and every
 * live surface shows an explicit unavailable state: there is no fallback
 * calendar, no generated gameweek and no old fixture list behind it.
 */

export interface FootballDataProvider {
  /** Who supplies the data, shown next to it. */
  readonly attribution: string;
  /** Competitions followed for live fixtures. */
  readonly leagueIds: readonly number[];
  /** The competition the fantasy game is played in. */
  readonly fantasyLeagueId: number;
  /** Live and upcoming fixtures in the followed competitions, over the next seven days. */
  getUpcomingFixtures(): Promise<Feed<FootballFixture[]>>;
  /** The provider's current season for a competition. */
  getCurrentSeason(leagueId: number): Promise<Feed<FootballSeason>>;
  /** Every round of a season, oldest first. */
  getRounds(seasonId: number): Promise<Feed<FootballRound[]>>;
  /** A round's fixtures with every published player line. */
  getRoundStats(round: FootballRound, leagueId: number): Promise<Feed<RoundStats>>;
  /** Every current squad member in a season, with availability. */
  getSquads(seasonId: number): Promise<Feed<SquadPlayer[]>>;
  /** The league table. */
  getStandings(seasonId: number): Promise<Feed<StandingRow[]>>;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A kickoff inside this window keeps a fixture list on its fastest refresh. */
const IMMINENT_MS = 20 * MINUTE;

function hasLiveOrImminent(fixtures: FootballFixture[], now: number): boolean {
  return fixtures.some((fixture) => {
    if (fixture.phase === 'live') return true;
    if (fixture.phase !== 'scheduled' || !fixture.kickoff) return false;
    const kickoff = Date.parse(fixture.kickoff);
    return kickoff - now < IMMINENT_MS && kickoff > now - 3 * HOUR;
  });
}

const byKickoff = (a: FootballFixture, b: FootballFixture) => (a.kickoff ?? '9').localeCompare(b.kickoff ?? '9');

function createSportmonksProvider(config: SportmonksConfig): FootballDataProvider {
  const leagueFilter = (ids: readonly number[]) => `fixtureLeagues:${ids.join(',')}`;

  return {
    attribution: 'Sportmonks',
    leagueIds: config.leagueIds,
    fantasyLeagueId: config.fantasyLeagueId,

    getUpcomingFixtures() {
      return cachedFeed<FootballFixture[]>(
        `fixtures:upcoming:${config.leagueIds.join(',')}`,
        {
          // 30 seconds while a match is on or about to start, five minutes otherwise.
          ttlMs: (fixtures) => (hasLiveOrImminent(fixtures, Date.now()) ? 30_000 : 5 * MINUTE),
          maxStaleMs: 30 * MINUTE,
        },
        async () => {
          const now = Date.now();
          // From yesterday, so a match that kicked off before midnight UTC and
          // is still being played is not missed.
          const rows = await sportmonksGetAll(
            config,
            `/fixtures/between/${utcDate(now - DAY)}/${utcDate(now + 7 * DAY)}`,
            { include: 'participants;scores;state;league', filters: leagueFilter(config.leagueIds) },
          );
          return normalizeFixtures(rows)
            .filter((fixture) => fixture.phase === 'live' || fixture.phase === 'scheduled')
            .filter(
              (fixture) =>
                fixture.phase === 'live' || !fixture.kickoff || Date.parse(fixture.kickoff) > now - 3 * HOUR,
            )
            .sort(byKickoff);
        },
      );
    },

    getCurrentSeason(leagueId) {
      return cachedFeed<FootballSeason>(
        `season:${leagueId}`,
        { ttlMs: 6 * HOUR, maxStaleMs: DAY },
        async () => {
          const league = await sportmonksGet(config, `/leagues/${leagueId}`, { include: 'currentSeason' });
          const season = normalizeCurrentSeason(league);
          if (!season) throw new ProviderError('no-current-season', `league ${leagueId} has no current season`);
          return season;
        },
      );
    },

    getRounds(seasonId) {
      return cachedFeed<FootballRound[]>(
        `rounds:${seasonId}`,
        // Short enough to pick up the provider moving `is_current` on.
        { ttlMs: 30 * MINUTE, maxStaleMs: 6 * HOUR },
        async () => normalizeRounds(await sportmonksGet(config, `/rounds/seasons/${seasonId}`)),
      );
    },

    getRoundStats(round, leagueId) {
      return cachedFeed<RoundStats>(
        `round:${leagueId}:${round.id}`,
        {
          ttlMs: ({ fixtures }) => {
            if (hasLiveOrImminent(fixtures, Date.now())) return MINUTE;
            const settled =
              fixtures.length > 0 && fixtures.every((f) => f.phase !== 'scheduled' && f.phase !== 'live');
            return round.finished && settled ? 6 * HOUR : 10 * MINUTE;
          },
          maxStaleMs: HOUR,
        },
        async () => {
          if (!round.startsAt || !round.endsAt) {
            throw new ProviderError('provider-error', `round ${round.id} has no dates`);
          }
          const rows = await sportmonksGetAll(config, `/fixtures/between/${round.startsAt}/${round.endsAt}`, {
            include: 'participants;scores;state;lineups.details',
            filters: leagueFilter([leagueId]),
          });
          // The date window can include other rounds' fixtures; keep this round's.
          const inRound = rows.filter(
            (row) => typeof row === 'object' && row !== null && (row as { round_id?: unknown }).round_id === round.id,
          );
          return { fixtures: normalizeFixtures(inRound).sort(byKickoff), lines: normalizeLineupStats(inRound) };
        },
      );
    },

    getSquads(seasonId) {
      return cachedFeed<SquadPlayer[]>(
        `squads:${seasonId}`,
        { ttlMs: 6 * HOUR, maxStaleMs: 2 * DAY },
        async () => {
          const teams = await sportmonksGetAll(config, `/teams/seasons/${seasonId}`, {
            include: 'players.player;sidelined',
          });
          return normalizeSquads(teams, utcDate(Date.now()));
        },
      );
    },

    getStandings(seasonId) {
      return cachedFeed<StandingRow[]>(
        `standings:${seasonId}`,
        { ttlMs: 10 * MINUTE, maxStaleMs: 6 * HOUR },
        async () =>
          normalizeStandings(await sportmonksGet(config, `/standings/seasons/${seasonId}`, { include: 'participant' })),
      );
    },
  };
}

let current: { signature: string; provider: FootballDataProvider } | null = null;

/** The configured provider, or `null` when no football data provider is set up. */
export function getFootballProvider(): FootballDataProvider | null {
  const config = readSportmonksConfig();
  if (!config) return null;
  const signature = `${config.baseUrl}|${config.leagueIds.join(',')}|${config.fantasyLeagueId}|${config.token}`;
  if (current?.signature !== signature) current = { signature, provider: createSportmonksProvider(config) };
  return current.provider;
}

/** Whether live football features should be offered at all. */
export function isLiveFootballConfigured(): boolean {
  return readSportmonksConfig() !== null;
}
