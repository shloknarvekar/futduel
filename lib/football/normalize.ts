import type {
  FantasyPosition,
  FootballFixture,
  FootballRound,
  FootballSeason,
  FootballTeam,
  MatchPhase,
  PlayerMatchStats,
  SquadPlayer,
  StandingRow,
} from './types';

/**
 * Sportmonks Football API v3 responses, normalised.
 *
 * Pure functions with no fetching and no secrets, so the verification suite can
 * run them against documented response shapes. Every field is read
 * defensively: the provider's JSON is untrusted input, and a record missing
 * something essential is dropped rather than filled in.
 *
 * Identifiers used below are the provider's documented values:
 * - fixture states: https://docs.sportmonks.com/football/definitions/states
 * - positions 24-27: https://docs.sportmonks.com/v3/definitions/types/position-types
 * - lineup types 11 (starting XI) and 12 (bench), and player statistic types:
 *   https://docs.sportmonks.com/v3/definitions/types/statistics/player-statistics
 */

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function asInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

const asBool = (value: unknown): boolean => value === true || value === 1 || value === '1';

/** Includes are requested in camelCase and may come back lowercased. */
function include(record: Json, name: string): unknown {
  return record[name] ?? record[name.toLowerCase()];
}

/* ------------------------------------------------------------------ dates */

/**
 * Provider datetimes are UTC ("2025-11-24 20:00:00"). The unix timestamp is
 * preferred when present because it cannot be misread.
 */
export function toIsoDateTime(dateTime: unknown, timestamp?: unknown): string | null {
  const seconds = asInt(timestamp);
  if (seconds !== null && seconds > 0) return new Date(seconds * 1000).toISOString();
  const text = asText(dateTime);
  if (!text) return null;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(text);
  if (!match) return null;
  const parsed = Date.parse(`${match[1]}T${match[2]}Z`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/** A calendar date ("2025-08-15"), kept as a date. */
export function toIsoDate(value: unknown): string | null {
  const text = asText(value);
  const match = text ? /^(\d{4}-\d{2}-\d{2})/.exec(text) : null;
  return match ? match[1]! : null;
}

/* ----------------------------------------------------------------- states */

interface StateDef {
  phase: MatchPhase;
  label: string;
}

/** The documented fixture states, by `state_id`. */
const STATES: Record<number, StateDef> = {
  1: { phase: 'scheduled', label: 'Not started' },
  2: { phase: 'live', label: '1st half' },
  3: { phase: 'live', label: 'Half-time' },
  4: { phase: 'live', label: 'Awaiting extra time' },
  5: { phase: 'finished', label: 'Full-time' },
  6: { phase: 'live', label: 'Extra time' },
  7: { phase: 'finished', label: 'After extra time' },
  8: { phase: 'finished', label: 'After penalties' },
  9: { phase: 'live', label: 'Penalty shootout' },
  10: { phase: 'postponed', label: 'Postponed' },
  11: { phase: 'suspended', label: 'Suspended' },
  12: { phase: 'cancelled', label: 'Cancelled' },
  13: { phase: 'scheduled', label: 'Date to be announced' },
  14: { phase: 'finished', label: 'Walkover' },
  15: { phase: 'suspended', label: 'Abandoned' },
  16: { phase: 'scheduled', label: 'Kick-off delayed' },
  17: { phase: 'finished', label: 'Awarded' },
  18: { phase: 'suspended', label: 'Interrupted' },
  19: { phase: 'unknown', label: 'Awaiting updates' },
  20: { phase: 'cancelled', label: 'Deleted' },
  21: { phase: 'live', label: 'Extra-time break' },
  22: { phase: 'live', label: '2nd half' },
  25: { phase: 'live', label: 'Penalties break' },
  26: { phase: 'unknown', label: 'Pending' },
};

const TBA_STATE = 13;

export function stateFor(stateId: unknown): StateDef {
  const id = asInt(stateId);
  return (id !== null && STATES[id]) || { phase: 'unknown', label: 'Status unknown' };
}

/* ------------------------------------------------------------------ teams */

export function normalizeTeam(raw: unknown): FootballTeam | null {
  if (!isObject(raw)) return null;
  const id = asInt(raw.id);
  const name = asText(raw.name);
  if (id === null || !name) return null;
  return { id, name, shortCode: asText(raw.short_code) };
}

/* --------------------------------------------------------------- fixtures */

export function normalizeFixture(raw: unknown): FootballFixture | null {
  if (!isObject(raw)) return null;
  const id = asInt(raw.id);
  const leagueId = asInt(raw.league_id);
  const seasonId = asInt(raw.season_id);
  if (id === null || leagueId === null || seasonId === null) return null;

  let home: FootballTeam | null = null;
  let away: FootballTeam | null = null;
  for (const participant of asArray(include(raw, 'participants'))) {
    if (!isObject(participant)) continue;
    const team = normalizeTeam(participant);
    const location = isObject(participant.meta) ? participant.meta.location : null;
    if (team && location === 'home') home = team;
    if (team && location === 'away') away = team;
  }
  // Without both sides there is no fixture to show.
  if (!home || !away) return null;

  const state = stateFor(raw.state_id);
  const stateInclude = include(raw, 'state');
  const providerLabel = isObject(stateInclude) ? asText(stateInclude.name) : null;

  let score: FootballFixture['score'] = null;
  if (state.phase !== 'scheduled') {
    let homeGoals: number | null = null;
    let awayGoals: number | null = null;
    for (const entry of asArray(include(raw, 'scores'))) {
      if (!isObject(entry) || entry.description !== 'CURRENT' || !isObject(entry.score)) continue;
      const goals = asInt(entry.score.goals);
      if (entry.score.participant === 'home') homeGoals = goals;
      if (entry.score.participant === 'away') awayGoals = goals;
    }
    if (homeGoals !== null && awayGoals !== null) score = { home: homeGoals, away: awayGoals };
  }

  const league = include(raw, 'league');

  return {
    id,
    leagueId,
    leagueName: isObject(league) ? asText(league.name) : null,
    seasonId,
    roundId: asInt(raw.round_id),
    kickoff: asInt(raw.state_id) === TBA_STATE ? null : toIsoDateTime(raw.starting_at, raw.starting_at_timestamp),
    phase: state.phase,
    stateLabel: providerLabel ?? state.label,
    home,
    away,
    score,
  };
}

export function normalizeFixtures(raw: unknown): FootballFixture[] {
  return asArray(raw)
    .map(normalizeFixture)
    .filter((fixture): fixture is FootballFixture => fixture !== null);
}

/* ---------------------------------------------------------- season, rounds */

/** A league record fetched with `include=currentSeason`. */
export function normalizeCurrentSeason(rawLeague: unknown): FootballSeason | null {
  if (!isObject(rawLeague)) return null;
  const leagueId = asInt(rawLeague.id);
  const leagueName = asText(rawLeague.name);
  const season = include(rawLeague, 'currentSeason');
  if (leagueId === null || !leagueName || !isObject(season)) return null;
  const id = asInt(season.id);
  const name = asText(season.name);
  if (id === null || !name) return null;
  return {
    id,
    name,
    leagueId,
    leagueName,
    startsAt: toIsoDate(season.starting_at),
    endsAt: toIsoDate(season.ending_at),
  };
}

export function normalizeRounds(raw: unknown): FootballRound[] {
  const rounds: FootballRound[] = [];
  for (const entry of asArray(raw)) {
    if (!isObject(entry)) continue;
    const id = asInt(entry.id);
    const seasonId = asInt(entry.season_id);
    const name = asText(entry.name);
    if (id === null || seasonId === null || !name) continue;
    rounds.push({
      id,
      seasonId,
      name,
      startsAt: toIsoDate(entry.starting_at),
      endsAt: toIsoDate(entry.ending_at),
      finished: asBool(entry.finished),
      isCurrent: asBool(entry.is_current),
    });
  }
  return rounds.sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? '') || a.id - b.id);
}

/* -------------------------------------------------------------- standings */

export function normalizeStandings(raw: unknown): StandingRow[] {
  const rows: StandingRow[] = [];
  for (const entry of asArray(raw)) {
    if (!isObject(entry)) continue;
    const position = asInt(entry.position);
    const points = asInt(entry.points);
    const team = normalizeTeam(include(entry, 'participant'));
    if (position === null || points === null || !team) continue;
    rows.push({ position, points, team });
  }
  return rows.sort((a, b) => a.position - b.position);
}

/* ----------------------------------------------------------------- squads */

const POSITION_BY_ID: Record<number, FantasyPosition> = { 24: 'GK', 25: 'DEF', 26: 'MID', 27: 'FWD' };

/**
 * Teams fetched with `include=players.player;sidelined`, flattened into
 * squad players. A player without a known position is left out: FutDuel
 * cannot place him in an eleven, and guessing one would be invention.
 */
export function normalizeSquads(rawTeams: unknown, today: string): SquadPlayer[] {
  const byId = new Map<number, { player: SquadPlayer; start: string }>();

  for (const rawTeam of asArray(rawTeams)) {
    if (!isObject(rawTeam)) continue;
    const team = normalizeTeam(rawTeam);
    if (!team) continue;

    const absences = new Map<number, SquadPlayer['availability']>();
    for (const entry of asArray(include(rawTeam, 'sidelined'))) {
      if (!isObject(entry) || asBool(entry.completed)) continue;
      const playerId = asInt(entry.player_id);
      const endsOn = toIsoDate(entry.end_date);
      if (playerId === null || (endsOn !== null && endsOn < today)) continue;
      absences.set(playerId, {
        status: entry.category === 'suspension' ? 'suspended' : 'injured',
        expectedReturn: endsOn,
      });
    }

    for (const member of asArray(include(rawTeam, 'players'))) {
      if (!isObject(member)) continue;
      const person = include(member, 'player');
      const playerId = asInt(member.player_id) ?? (isObject(person) ? asInt(person.id) : null);
      if (playerId === null) continue;
      const name = isObject(person)
        ? asText(person.display_name) ?? asText(person.common_name) ?? asText(person.name)
        : null;
      const positionId = (isObject(person) ? asInt(person.position_id) : null) ?? asInt(member.position_id);
      const position = positionId !== null ? POSITION_BY_ID[positionId] : undefined;
      if (!name || !position) continue;

      const start = toIsoDate(member.start) ?? '';
      const existing = byId.get(playerId);
      // A player registered with two clubs this season is shown at the more recent one.
      if (existing && existing.start >= start) continue;

      byId.set(playerId, {
        start,
        player: {
          id: playerId,
          name,
          team,
          position,
          jerseyNumber: asInt(member.jersey_number),
          availability: absences.get(playerId) ?? { status: 'available', expectedReturn: null },
        },
      });
    }
  }

  return [...byId.values()].map((entry) => entry.player).sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------ match stats */

type StatField = keyof Omit<PlayerMatchStats, 'playerId' | 'teamId' | 'fixtureId' | 'started'>;

/** Documented player statistic type ids mapped onto FutDuel's stat fields. */
const STAT_TYPES: Record<number, StatField> = {
  119: 'minutes',
  52: 'goals',
  79: 'assists',
  57: 'saves',
  88: 'goalsConceded',
  84: 'yellowCards',
  83: 'redCards',
  85: 'yellowRedCards',
  324: 'ownGoals',
  78: 'tackles',
  100: 'interceptions',
  101: 'clearances',
  97: 'blockedShots',
  118: 'rating',
};

const LINEUP_STARTING = 11;

function detailValue(data: unknown): number | null {
  if (!isObject(data)) return null;
  const direct = asNumber(data.value);
  if (direct !== null) return direct;
  // Some statistics arrive split, e.g. { total, goals, penalties }.
  return isObject(data.value) ? asNumber(data.value.total) : null;
}

/**
 * Player lines from fixtures fetched with `include=lineups.details`. Players
 * whose lineup entry carries no details get a line with every stat `null`, so
 * "no data yet" stays distinguishable from "did nothing".
 */
export function normalizeLineupStats(rawFixtures: unknown): PlayerMatchStats[] {
  const lines: PlayerMatchStats[] = [];
  for (const rawFixture of asArray(rawFixtures)) {
    if (!isObject(rawFixture)) continue;
    const fixtureId = asInt(rawFixture.id);
    if (fixtureId === null) continue;

    for (const entry of asArray(include(rawFixture, 'lineups'))) {
      if (!isObject(entry)) continue;
      const playerId = asInt(entry.player_id);
      const teamId = asInt(entry.team_id);
      if (playerId === null || teamId === null) continue;

      const line: PlayerMatchStats = {
        playerId,
        teamId,
        fixtureId,
        started: asInt(entry.type_id) === LINEUP_STARTING,
        minutes: null,
        goals: null,
        assists: null,
        saves: null,
        goalsConceded: null,
        yellowCards: null,
        redCards: null,
        yellowRedCards: null,
        ownGoals: null,
        tackles: null,
        interceptions: null,
        clearances: null,
        blockedShots: null,
        rating: null,
      };

      for (const detail of asArray(include(entry, 'details'))) {
        if (!isObject(detail)) continue;
        const typeId = asInt(detail.type_id);
        const field = typeId !== null ? STAT_TYPES[typeId] : undefined;
        const value = detailValue(detail.data);
        if (field && value !== null) line[field] = value;
      }
      lines.push(line);
    }
  }
  return lines;
}
