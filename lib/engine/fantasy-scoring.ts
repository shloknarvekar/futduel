import type {
  FantasyPosition,
  FootballFixture,
  FootballRound,
  PlayerMatchStats,
  SquadPlayer,
} from '@/lib/football/types';

/**
 * FutDuel Fantasy: scoring and squad rules.
 *
 * Two layers kept strictly apart:
 *
 * 1. REAL FOOTBALL STATISTICS: minutes, goals, assists, saves, cards and so
 *    on, exactly as the data provider reports them for a real match
 *    (`PlayerMatchStats`). Nothing in this file creates or adjusts them.
 * 2. FUTDUEL FANTASY SCORING: the rules below, which turn those statistics
 *    into points. They are FutDuel's own. They are not an official fantasy
 *    game's scoring, and the provider's match rating is never used as a score.
 *
 * A statistic the provider did not return scores nothing. A rule that needs a
 * finished match (clean sheet, win bonus) waits until the match is finished.
 * Pure and deterministic, so the verification suite can check every rule.
 *
 * ## The formula, per player, per match
 *
 * | Rule                                   | GK | DEF | MID | FWD |
 * | -------------------------------------- | -- | --- | --- | --- |
 * | Played 1-59 minutes                    | +1 | +1  | +1  | +1  |
 * | Played 60+ minutes (instead of above)  | +2 | +2  | +2  | +2  |
 * | Each goal                              | +6 | +6  | +5  | +4  |
 * | Each assist                            | +3 | +3  | +3  | +3  |
 * | Clean sheet (60+ min, match finished)  | +4 | +4  | +1  |  0  |
 * | Every 3 saves                          | +1 |  -  |  -  |  -  |
 * | Every 2 goals conceded while on pitch  | -1 | -1  |  -  |  -  |
 * | 10 defensive actions (DEF), 12 (MID/FWD) |  - | +2 | +2 | +2 |
 * | Team won (match finished)              | +1 | +1  | +1  | +1  |
 * | Yellow card                            | -1 | -1  | -1  | -1  |
 * | Sent off (replaces the yellow)         | -3 | -3  | -3  | -3  |
 * | Each own goal                          | -2 | -2  | -2  | -2  |
 *
 * Defensive actions are tackles + interceptions + clearances + blocked shots.
 * A round's score is the sum over the player's matches in that round. The
 * captain scores double; the vice-captain scores double instead only if the
 * captain's team has finished its matches and the captain played no minutes.
 */

export const SCORING = {
  shortAppearance: 1,
  fullAppearance: 2,
  fullAppearanceMinutes: 60,
  goal: { GK: 6, DEF: 6, MID: 5, FWD: 4 } satisfies Record<FantasyPosition, number>,
  assist: 3,
  cleanSheet: { GK: 4, DEF: 4, MID: 1, FWD: 0 } satisfies Record<FantasyPosition, number>,
  savesPerPoint: 3,
  concededPerPenalty: 2,
  concededPenaltyPositions: ['GK', 'DEF'] as FantasyPosition[],
  defensiveThreshold: { GK: null, DEF: 10, MID: 12, FWD: 12 } satisfies Record<FantasyPosition, number | null>,
  defensiveBonus: 2,
  teamWin: 1,
  yellowCard: -1,
  sendingOff: -3,
  ownGoal: -2,
  captainMultiplier: 2,
} as const;

/** The rules as plain sentences, for the page that explains them. */
export const SCORING_RULES: { rule: string; points: string }[] = [
  { rule: 'Played up to 59 minutes', points: '+1' },
  { rule: 'Played 60 minutes or more', points: '+2' },
  { rule: 'Goal by a goalkeeper or defender', points: '+6' },
  { rule: 'Goal by a midfielder', points: '+5' },
  { rule: 'Goal by a forward', points: '+4' },
  { rule: 'Assist', points: '+3' },
  { rule: 'Clean sheet, goalkeeper or defender (60+ minutes)', points: '+4' },
  { rule: 'Clean sheet, midfielder (60+ minutes)', points: '+1' },
  { rule: 'Every 3 saves, goalkeeper', points: '+1' },
  { rule: 'Every 2 goals conceded, goalkeeper or defender', points: '−1' },
  { rule: '10 defensive actions by a defender, 12 by anyone else', points: '+2' },
  { rule: 'Team won the match', points: '+1' },
  { rule: 'Yellow card', points: '−1' },
  { rule: 'Sent off', points: '−3' },
  { rule: 'Own goal', points: '−2' },
  { rule: 'Captain', points: '×2' },
];

export interface ScoreLine {
  label: string;
  points: number;
}

export interface MatchScore {
  fixtureId: number;
  minutes: number;
  points: number;
  lines: ScoreLine[];
}

export interface PlayerRoundScore {
  playerId: number;
  total: number;
  minutes: number;
  matches: MatchScore[];
}

const count = (value: number | null) => (value !== null && value > 0 ? value : 0);

function teamResult(stats: PlayerMatchStats, fixture: FootballFixture) {
  if (!fixture.score) return null;
  const home = stats.teamId === fixture.home.id;
  const away = stats.teamId === fixture.away.id;
  if (!home && !away) return null;
  return {
    scored: home ? fixture.score.home : fixture.score.away,
    conceded: home ? fixture.score.away : fixture.score.home,
  };
}

/** One player's FutDuel points in one real match. */
export function scoreMatch(position: FantasyPosition, stats: PlayerMatchStats, fixture: FootballFixture): MatchScore {
  const minutes = count(stats.minutes);
  const lines: ScoreLine[] = [];
  const add = (label: string, points: number) => {
    if (points !== 0) lines.push({ label, points });
  };

  if (minutes > 0) {
    const full = minutes >= SCORING.fullAppearanceMinutes;
    add(full ? '60+ minutes' : 'Appearance', full ? SCORING.fullAppearance : SCORING.shortAppearance);

    const goals = count(stats.goals);
    if (goals) add(goals === 1 ? 'Goal' : `${goals} goals`, goals * SCORING.goal[position]);

    const assists = count(stats.assists);
    if (assists) add(assists === 1 ? 'Assist' : `${assists} assists`, assists * SCORING.assist);

    const finished = fixture.phase === 'finished';
    const result = teamResult(stats, fixture);

    if (finished && result && result.conceded === 0 && full) add('Clean sheet', SCORING.cleanSheet[position]);

    if (position === 'GK') {
      const saves = count(stats.saves);
      add(`${saves} saves`, Math.floor(saves / SCORING.savesPerPoint));
    }

    if (SCORING.concededPenaltyPositions.includes(position) && stats.goalsConceded !== null) {
      const conceded = count(stats.goalsConceded);
      add(`${conceded} conceded`, -Math.floor(conceded / SCORING.concededPerPenalty));
    }

    const threshold = SCORING.defensiveThreshold[position];
    const actionStats = [stats.tackles, stats.interceptions, stats.clearances, stats.blockedShots];
    if (threshold !== null && actionStats.some((value) => value !== null)) {
      const actions = actionStats.reduce<number>((sum, value) => sum + count(value), 0);
      if (actions >= threshold) add(`${actions} defensive actions`, SCORING.defensiveBonus);
    }

    if (finished && result && result.scored > result.conceded) add('Team won', SCORING.teamWin);
  }

  // Discipline counts even when the provider has not registered minutes.
  const sentOff = count(stats.redCards) > 0 || count(stats.yellowRedCards) > 0;
  if (sentOff) add('Sent off', SCORING.sendingOff);
  else if (count(stats.yellowCards) > 0) add('Yellow card', SCORING.yellowCard);

  const ownGoals = count(stats.ownGoals);
  if (ownGoals) add(ownGoals === 1 ? 'Own goal' : `${ownGoals} own goals`, ownGoals * SCORING.ownGoal);

  return { fixtureId: fixture.id, minutes, points: lines.reduce((sum, line) => sum + line.points, 0), lines };
}

/** Every squad player's FutDuel points for a round, from the round's player lines. */
export function scoreRound(
  players: readonly SquadPlayer[],
  fixtures: readonly FootballFixture[],
  lines: readonly PlayerMatchStats[],
): Record<number, PlayerRoundScore> {
  const positionById = new Map(players.map((p) => [p.id, p.position]));
  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));
  const scores: Record<number, PlayerRoundScore> = {};

  for (const line of lines) {
    const position = positionById.get(line.playerId);
    const fixture = fixtureById.get(line.fixtureId);
    if (!position || !fixture) continue;
    const match = scoreMatch(position, line, fixture);
    const entry = (scores[line.playerId] ??= { playerId: line.playerId, total: 0, minutes: 0, matches: [] });
    entry.matches.push(match);
    entry.total += match.points;
    entry.minutes += match.minutes;
  }
  return scores;
}

/* -------------------------------------------------------------------------- */
/* Squad rules                                                                */
/* -------------------------------------------------------------------------- */

export const SQUAD_RULES = {
  size: 11,
  maxPerTeam: 3,
  positions: { GK: [1, 1], DEF: [3, 5], MID: [2, 5], FWD: [1, 3] } satisfies Record<FantasyPosition, [number, number]>,
} as const;

const POSITION_NAME: Record<FantasyPosition, [string, string]> = {
  GK: ['goalkeeper', 'goalkeepers'],
  DEF: ['defender', 'defenders'],
  MID: ['midfielder', 'midfielders'],
  FWD: ['forward', 'forwards'],
};

const POSITIONS = Object.keys(SQUAD_RULES.positions) as FantasyPosition[];

export function positionCounts(squad: readonly SquadPlayer[]): Record<FantasyPosition, number> {
  const counts: Record<FantasyPosition, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const player of squad) counts[player.position] += 1;
  return counts;
}

/** Whether `player` can join `squad`, and why not when he cannot. */
export function canAdd(
  squad: readonly SquadPlayer[],
  player: SquadPlayer,
): { ok: true } | { ok: false; reason: string } {
  if (squad.some((p) => p.id === player.id)) return { ok: false, reason: 'Already in your eleven' };
  if (squad.length >= SQUAD_RULES.size) return { ok: false, reason: 'Your eleven is full' };
  if (squad.filter((p) => p.team.id === player.team.id).length >= SQUAD_RULES.maxPerTeam) {
    return { ok: false, reason: `Already ${SQUAD_RULES.maxPerTeam} from ${player.team.name}` };
  }
  const counts = positionCounts(squad);
  if (counts[player.position] >= SQUAD_RULES.positions[player.position][1]) {
    return { ok: false, reason: `No room for another ${POSITION_NAME[player.position][0]}` };
  }
  // Keep enough places for the minimums of every other position.
  const placesLeft = SQUAD_RULES.size - squad.length - 1;
  const stillNeeded = POSITIONS.filter((pos) => pos !== player.position).reduce(
    (sum, pos) => sum + Math.max(0, SQUAD_RULES.positions[pos][0] - counts[pos]),
    0,
  );
  if (stillNeeded > placesLeft) return { ok: false, reason: 'Save room for the positions you still need' };
  return { ok: true };
}

export function validateSquad(squad: readonly SquadPlayer[]): { complete: boolean; missing: string[] } {
  const counts = positionCounts(squad);
  const missing = POSITIONS.flatMap((pos) => {
    const short = SQUAD_RULES.positions[pos][0] - counts[pos];
    return short > 0 ? [`${short} ${POSITION_NAME[pos][short === 1 ? 0 : 1]}`] : [];
  });
  return { complete: squad.length === SQUAD_RULES.size && missing.length === 0, missing };
}

/**
 * A squad's round total with captaincy. `teamDone(teamId)` says whether all of
 * that team's matches in the round are finished, which is what allows the
 * vice-captain to step in.
 */
export function squadRoundPoints(
  squad: readonly SquadPlayer[],
  captainId: number | null,
  viceId: number | null,
  scores: Record<number, PlayerRoundScore>,
  teamDone: (teamId: number) => boolean,
): { total: number; doubled: 'captain' | 'vice' | null } {
  const base = squad.reduce((sum, player) => sum + (scores[player.id]?.total ?? 0), 0);
  const bonus = (id: number) => (scores[id]?.total ?? 0) * (SCORING.captainMultiplier - 1);

  const captain = squad.find((p) => p.id === captainId);
  const vice = squad.find((p) => p.id === viceId);
  if (captain && (scores[captain.id]?.minutes ?? 0) > 0) return { total: base + bonus(captain.id), doubled: 'captain' };
  if (captain && vice && teamDone(captain.team.id) && (scores[vice.id]?.minutes ?? 0) > 0) {
    return { total: base + bonus(vice.id), doubled: 'vice' };
  }
  return { total: base, doubled: null };
}

/* -------------------------------------------------------------------------- */
/* Rounds and the pick window                                                 */
/* -------------------------------------------------------------------------- */

/** FutDuel locks picks this long before a round's first real kickoff. */
export const LOCK_LEAD_MS = 90 * 60_000;

const PLAYABLE: FootballFixture['phase'][] = ['scheduled', 'live', 'finished', 'unknown'];

/** A round's pick deadline: 90 minutes before its first scheduled kickoff. */
export function roundDeadline(fixtures: readonly FootballFixture[]): string | null {
  const kickoffs = fixtures
    .filter((f) => PLAYABLE.includes(f.phase) && f.kickoff)
    .map((f) => Date.parse(f.kickoff!))
    .filter((ms) => !Number.isNaN(ms));
  if (kickoffs.length === 0) return null;
  return new Date(Math.min(...kickoffs) - LOCK_LEAD_MS).toISOString();
}

/**
 * The round being played or next to be played: the first the provider has not
 * marked finished. The provider's own flag decides, so FutDuel never declares a
 * round over on its own reading of the scores.
 */
export function activeRoundIndex(rounds: readonly FootballRound[]): number {
  return rounds.findIndex((round) => !round.finished);
}

export type PickWindow =
  /** Picks can change until `deadline`. */
  | { state: 'open'; deadline: string | null }
  /** The round is under way; picks reopen once the provider marks it finished. */
  | { state: 'locked'; deadline: string };

export function pickWindow(now: number, deadline: string | null): PickWindow {
  if (deadline && now >= Date.parse(deadline)) return { state: 'locked', deadline };
  return { state: 'open', deadline };
}
