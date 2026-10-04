#!/usr/bin/env node
/**
 * A local stand-in for the Sportmonks Football API v3. Development only.
 *
 * EVERYTHING IT SERVES IS SYNTHETIC. The league, teams, players, fixtures,
 * scores and statistics are generated ("Mock League (synthetic)", "MCK Defender
 * 3") and describe no real football. It exists so FutDuel's live-data path,
 * cache and failure states can be exercised in a browser, in the response
 * shapes FutDuel reads, without spending a real token's quota.
 *
 *   node scripts/mock-sportmonks.mjs
 *
 *   # .env.local, then `npm run dev` (the base-URL override is ignored in production)
 *   SPORTMONKS_API_TOKEN=mock
 *   SPORTMONKS_LEAGUE_IDS=90001
 *   SPORTMONKS_BASE_URL=http://127.0.0.1:4010/v3/football
 *
 * Switches (GET, on the same port):
 *   /__mode/ok | error | ratelimit | unauthorised | empty
 *   /__scenario/locked   the round is under way: one match live, one finished, two to come
 *   /__scenario/open     the round has not started: picks are open
 *   /__stats             upstream request counts, to see the server-side cache working
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_SPORTMONKS_PORT ?? 4010);
const BASE = '/v3/football';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const START = Math.floor(Date.now() / MINUTE) * MINUTE;

const LEAGUE = { id: 90001, name: 'Mock League (synthetic)' };
const SEASON_ID = 5001;
const ROUNDS = 7;
const CURRENT_ROUND = 4;
const NO_RESULTS =
  "No result(s) found matching your request. Either the query did not return any results or you don't have access to it via your current subscription.";

let mode = 'ok';
let scenario = 'locked';
const stats = new Map();

/* ------------------------------------------------------------------ helpers */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const upTo = (random, max) => Math.floor(random() * (max + 1));
const pad = (n) => String(n).padStart(2, '0');
const date = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const dateTime = (ms) => {
  const d = new Date(ms);
  return `${date(ms)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};

/* --------------------------------------------------------------------- data */

const TEAMS = [
  ['Mock Athletic', 'MCK'],
  ['Test Rovers', 'TST'],
  ['Sample United', 'SMP'],
  ['Fixture City', 'FXC'],
  ['Placeholder Town', 'PLH'],
  ['Stub Wanderers', 'STB'],
  ['Dummy Albion', 'DMY'],
  ['Example FC', 'EXA'],
].map(([name, short_code], index) => ({ id: index + 1, sport_id: 1, name, short_code, type: 'domestic' }));

const TEAM_BY_ID = new Map(TEAMS.map((team) => [team.id, team]));

/** [position_id, label, count]: 24 goalkeeper, 25 defender, 26 midfielder, 27 attacker. */
const ROLES = [
  [24, 'Keeper', 2],
  [25, 'Defender', 5],
  [26, 'Midfielder', 5],
  [27, 'Forward', 4],
];

const SQUADS = new Map(
  TEAMS.map((team) => {
    const players = [];
    for (const [positionId, label, count] of ROLES) {
      for (let k = 1; k <= count; k++) {
        const shirt = players.length + 1;
        players.push({ id: team.id * 100 + shirt, teamId: team.id, positionId, shirt, name: `${team.short_code} ${label} ${k}` });
      }
    }
    return [team.id, players];
  }),
);

const STATES = {
  1: { id: 1, state: 'NS', name: 'Not Started', short_name: 'NS', developer_name: 'NS' },
  5: { id: 5, state: 'FT', name: 'Full Time', short_name: 'FT', developer_name: 'FT' },
  22: { id: 22, state: 'INPLAY_2ND_HALF', name: '2nd Half', short_name: '2nd', developer_name: 'INPLAY_2ND_HALF' },
};

/** Circle-method pairings, so every team plays once a round. */
function pairings(roundIndex) {
  const rest = TEAMS.slice(1).map((team) => team.id);
  for (let i = 0; i < roundIndex; i++) rest.unshift(rest.pop());
  const order = [TEAMS[0].id, ...rest];
  return [0, 1, 2, 3].map((i) => (roundIndex % 2 === 0 ? [order[i], order[7 - i]] : [order[7 - i], order[i]]));
}

function timing(round, match) {
  if (round < CURRENT_ROUND) return { at: START - (CURRENT_ROUND - round) * 7 * DAY + match * 3 * HOUR, state: 5 };
  if (round > CURRENT_ROUND) return { at: START + (round - CURRENT_ROUND) * 7 * DAY + match * 3 * HOUR, state: 1 };
  if (scenario === 'open') return { at: START + [20, 23, 44, 47][match] * HOUR, state: 1 };
  return [
    { at: START - 50 * MINUTE, state: 22 },
    { at: START - 5 * HOUR, state: 5 },
    { at: START + 26 * HOUR, state: 1 },
    { at: START + 50 * HOUR, state: 1 },
  ][match];
}

function allFixtures() {
  const fixtures = [];
  for (let round = 1; round <= ROUNDS; round++) {
    pairings(round - 1).forEach(([homeId, awayId], match) => {
      const id = 700000 + round * 10 + match;
      const { at, state } = timing(round, match);
      const random = rng(id);
      const goals = state === 1 ? null : [upTo(random, 3), upTo(random, 2)];
      fixtures.push({ id, round, homeId, awayId, at, state, goals });
    });
  }
  return fixtures.sort((a, b) => a.at - b.at);
}

function lineupsFor(fixture) {
  const entries = [];
  const live = fixture.state === 22;
  [fixture.homeId, fixture.awayId].forEach((teamId, side) => {
    const squad = SQUADS.get(teamId);
    const scored = fixture.goals[side];
    const conceded = fixture.goals[1 - side];
    const random = rng(fixture.id * 7 + side);
    const keeper = squad[0];
    const defenders = squad.slice(2, 6);
    const midfielders = squad.slice(7, 11);
    const forwards = squad.slice(12, 14);
    const substitute = squad[14];
    const attackers = [...forwards, ...forwards, ...midfielders];

    const tally = new Map();
    const bump = (player, key) => {
      const entry = tally.get(player.id) ?? {};
      entry[key] = (entry[key] ?? 0) + 1;
      tally.set(player.id, entry);
    };
    for (let g = 0; g < scored; g++) {
      bump(attackers[upTo(random, attackers.length - 1)], 'goals');
      if (random() < 0.7) bump(midfielders[upTo(random, midfielders.length - 1)], 'assists');
    }

    const detail = (player, typeId, value) => ({
      id: fixture.id * 1000 + player.id * 10 + typeId,
      fixture_id: fixture.id,
      player_id: player.id,
      team_id: teamId,
      type_id: typeId,
      data: { value },
    });

    const line = (player, typeId, minutes) => {
      const made = tally.get(player.id) ?? {};
      const details = [detail(player, 119, minutes)];
      if (made.goals) details.push(detail(player, 52, { total: made.goals, goals: made.goals, penalties: 0 }));
      if (made.assists) details.push(detail(player, 79, made.assists));
      if (player.positionId === 24) details.push(detail(player, 57, upTo(random, 6)), detail(player, 88, conceded));
      if (player.positionId === 25) {
        details.push(
          detail(player, 88, conceded),
          detail(player, 78, upTo(random, 5)),
          detail(player, 100, upTo(random, 4)),
          detail(player, 101, upTo(random, 6)),
          detail(player, 97, upTo(random, 2)),
        );
      }
      if (player.positionId === 26) details.push(detail(player, 78, upTo(random, 4)), detail(player, 100, upTo(random, 3)));
      if (random() < 0.12) details.push(detail(player, 84, 1));
      // A provider match rating, present so it can be shown never to become points.
      details.push(detail(player, 118, Number((6 + random() * 2.5).toFixed(2))));
      return {
        id: fixture.id * 100 + player.id,
        sport_id: 1,
        fixture_id: fixture.id,
        player_id: player.id,
        team_id: teamId,
        position_id: player.positionId,
        type_id: typeId,
        player_name: player.name,
        jersey_number: player.shirt,
        details,
      };
    };

    const full = live ? 50 : 90;
    for (const player of [keeper, ...defenders, ...midfielders, forwards[0]]) entries.push(line(player, 11, full));
    entries.push(line(forwards[1], 11, live ? 50 : 70));
    if (!live) entries.push(line(substitute, 12, 20));
  });
  return entries;
}

function fixtureJson(fixture, withLineups) {
  const home = TEAM_BY_ID.get(fixture.homeId);
  const away = TEAM_BY_ID.get(fixture.awayId);
  const scores = fixture.goals
    ? [
        { id: fixture.id * 10 + 1, fixture_id: fixture.id, type_id: 1525, participant_id: home.id, description: 'CURRENT', score: { goals: fixture.goals[0], participant: 'home' } },
        { id: fixture.id * 10 + 2, fixture_id: fixture.id, type_id: 1525, participant_id: away.id, description: 'CURRENT', score: { goals: fixture.goals[1], participant: 'away' } },
      ]
    : [];
  return {
    id: fixture.id,
    sport_id: 1,
    league_id: LEAGUE.id,
    season_id: SEASON_ID,
    stage_id: 1,
    round_id: 800000 + fixture.round,
    state_id: fixture.state,
    name: `${home.name} vs ${away.name}`,
    starting_at: dateTime(fixture.at),
    starting_at_timestamp: Math.floor(fixture.at / 1000),
    participants: [
      { ...home, meta: { location: 'home', winner: null, position: null } },
      { ...away, meta: { location: 'away', winner: null, position: null } },
    ],
    scores,
    state: STATES[fixture.state],
    league: { id: LEAGUE.id, sport_id: 1, name: LEAGUE.name, short_code: 'MOCK', type: 'league' },
    ...(withLineups ? { lineups: fixture.goals ? lineupsFor(fixture) : [] } : {}),
  };
}

function roundsJson() {
  const fixtures = allFixtures();
  return Array.from({ length: ROUNDS }, (_, index) => {
    const round = index + 1;
    const times = fixtures.filter((f) => f.round === round).map((f) => f.at);
    return {
      id: 800000 + round,
      sport_id: 1,
      league_id: LEAGUE.id,
      season_id: SEASON_ID,
      stage_id: 1,
      name: String(round),
      finished: round < CURRENT_ROUND,
      is_current: round === CURRENT_ROUND,
      starting_at: date(Math.min(...times)),
      ending_at: date(Math.max(...times)),
      games_in_current_week: round === CURRENT_ROUND,
    };
  });
}

function teamsJson() {
  return TEAMS.map((team) => ({
    ...team,
    players: SQUADS.get(team.id).map((player) => ({
      id: player.id * 10,
      transfer_id: null,
      player_id: player.id,
      team_id: team.id,
      position_id: player.positionId,
      start: date(START - 60 * DAY),
      end: date(START + 300 * DAY),
      captain: false,
      jersey_number: player.shirt,
      player: {
        id: player.id,
        sport_id: 1,
        position_id: player.positionId,
        name: player.name,
        common_name: player.name,
        display_name: player.name,
      },
    })),
    sidelined:
      team.id === 1
        ? [{ id: 1, player_id: 108, type_id: 1, team_id: 1, season_id: SEASON_ID, category: 'injury', start_date: date(START - 5 * DAY), end_date: date(START + 10 * DAY), games_missed: 1, completed: false }]
        : team.id === 2
          ? [{ id: 2, player_id: 212, type_id: 2, team_id: 2, season_id: SEASON_ID, category: 'suspension', start_date: date(START - 2 * DAY), end_date: null, games_missed: 0, completed: false }]
          : [],
  }));
}

function standingsJson() {
  const table = new Map(TEAMS.map((team) => [team.id, 0]));
  for (const fixture of allFixtures()) {
    if (fixture.state !== 5) continue;
    const [home, away] = fixture.goals;
    table.set(fixture.homeId, table.get(fixture.homeId) + (home > away ? 3 : home === away ? 1 : 0));
    table.set(fixture.awayId, table.get(fixture.awayId) + (away > home ? 3 : home === away ? 1 : 0));
  }
  return [...table]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([teamId, points], index) => ({
      id: 900000 + teamId,
      participant_id: teamId,
      sport_id: 1,
      league_id: LEAGUE.id,
      season_id: SEASON_ID,
      stage_id: 1,
      position: index + 1,
      points,
      participant: TEAM_BY_ID.get(teamId),
    }));
}

/* ------------------------------------------------------------------- server */

const envelope = (extra) => ({
  ...extra,
  subscription: [{ meta: { mock: true, note: 'Synthetic data from scripts/mock-sportmonks.mjs' } }],
  rate_limit: { resets_in_seconds: 3600, remaining: 2999, requested_entity: 'Mock' },
  timezone: 'UTC',
});

function paginate(rows, query) {
  const perPage = Math.min(50, Math.max(1, Number(query.get('per_page') ?? 25)));
  const page = Math.max(1, Number(query.get('page') ?? 1));
  const slice = rows.slice((page - 1) * perPage, page * perPage);
  if (slice.length === 0) return { message: NO_RESULTS };
  const hasMore = page * perPage < rows.length;
  return {
    data: slice,
    pagination: { count: slice.length, per_page: perPage, current_page: page, next_page: hasMore ? page + 1 : null, has_more: hasMore },
  };
}

function route(path, query) {
  const includes = (query.get('include') ?? '').toLowerCase();
  let match;

  if ((match = /^\/fixtures\/between\/(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/.exec(path))) {
    const [, from, to] = match;
    const leagues = (query.get('filters') ?? '').match(/fixtureLeagues:([\d,]+)/)?.[1]?.split(',').map(Number);
    if (leagues && !leagues.includes(LEAGUE.id)) return { message: NO_RESULTS };
    const rows = allFixtures()
      .filter((f) => date(f.at) >= from && date(f.at) <= to)
      .map((f) => fixtureJson(f, includes.includes('lineups')));
    return paginate(rows, query);
  }
  if ((match = /^\/leagues\/(\d+)$/.exec(path))) {
    if (Number(match[1]) !== LEAGUE.id) return { message: NO_RESULTS };
    return {
      data: {
        id: LEAGUE.id,
        sport_id: 1,
        name: LEAGUE.name,
        short_code: 'MOCK',
        type: 'league',
        ...(includes.includes('currentseason')
          ? {
              currentseason: {
                id: SEASON_ID,
                sport_id: 1,
                league_id: LEAGUE.id,
                name: 'Mock season',
                finished: false,
                is_current: true,
                starting_at: date(START - 60 * DAY),
                ending_at: date(START + 120 * DAY),
              },
            }
          : {}),
      },
    };
  }
  if (path === `/rounds/seasons/${SEASON_ID}`) return { data: roundsJson() };
  if (path === `/teams/seasons/${SEASON_ID}`) return paginate(teamsJson(), query);
  if (path === `/standings/seasons/${SEASON_ID}`) return { data: standingsJson() };
  return null;
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname.startsWith('/__mode/')) {
    const next = url.pathname.slice('/__mode/'.length);
    if (!['ok', 'error', 'ratelimit', 'unauthorised', 'empty'].includes(next)) return send(response, 400, { error: 'unknown mode' });
    mode = next;
    console.log(`mode -> ${mode}`);
    return send(response, 200, { mode, scenario });
  }
  if (url.pathname.startsWith('/__scenario/')) {
    const next = url.pathname.slice('/__scenario/'.length);
    if (!['open', 'locked'].includes(next)) return send(response, 400, { error: 'unknown scenario' });
    scenario = next;
    console.log(`scenario -> ${scenario}`);
    return send(response, 200, { mode, scenario });
  }
  if (url.pathname === '/__stats') return send(response, 200, { mode, scenario, requests: Object.fromEntries(stats) });

  if (!url.pathname.startsWith(BASE)) return send(response, 404, { message: 'Not found (mock)' });
  const path = url.pathname.slice(BASE.length);
  const key = path.replace(/\d{4}-\d{2}-\d{2}/g, ':date');
  stats.set(key, (stats.get(key) ?? 0) + 1);

  const status = (code, body) => {
    console.log(`${code} ${path}${url.search}`);
    send(response, code, body);
  };

  if (!request.headers.authorization && !url.searchParams.get('api_token')) return status(401, { message: 'Unauthenticated.' });
  if (mode === 'unauthorised') return status(401, { message: 'Unauthenticated. (mock)' });
  if (mode === 'ratelimit') return status(429, { message: 'You have reached the rate limit for this entity. (mock)' });
  if (mode === 'error') return status(500, { message: 'Server error. (mock)' });
  if (mode === 'empty') return status(200, envelope({ message: NO_RESULTS }));

  const body = route(path, url.searchParams);
  if (!body) return status(404, { message: 'Not found (mock)' });
  return status(200, envelope(body));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock Sportmonks (SYNTHETIC DATA) on http://127.0.0.1:${PORT}${BASE}`);
  console.log(`mode ${mode}, scenario ${scenario}; switch with /__mode/<mode> and /__scenario/<open|locked>`);
});
