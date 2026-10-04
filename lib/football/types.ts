/**
 * Real, current football as a provider reports it, normalised for FutDuel.
 *
 * Nothing here is authored or simulated. These types are deliberately separate
 * from `lib/domain/types.ts`, which describes FutDuel's own card database and
 * game: a fixture here happened (or will happen) in the real world, and a
 * player here is a real squad member this season.
 *
 * Shared by server and client; contains no secrets and no fetching.
 */

/** A match's phase, collapsed from the provider's fixture states. */
export type MatchPhase =
  | 'scheduled'
  | 'live'
  | 'finished'
  | 'postponed'
  | 'suspended'
  | 'cancelled'
  | 'unknown';

export interface FootballTeam {
  id: number;
  name: string;
  shortCode: string | null;
}

export interface FootballFixture {
  id: number;
  leagueId: number;
  leagueName: string | null;
  seasonId: number;
  roundId: number | null;
  /** ISO kickoff. `null` while the provider lists the date as to be announced. */
  kickoff: string | null;
  phase: MatchPhase;
  /** The provider's own name for the state, e.g. "2nd Half". */
  stateLabel: string;
  home: FootballTeam;
  away: FootballTeam;
  /** Present only when the provider reports a current score. */
  score: { home: number; away: number } | null;
}

export interface FootballSeason {
  id: number;
  name: string;
  leagueId: number;
  leagueName: string;
  startsAt: string | null;
  endsAt: string | null;
}

export interface FootballRound {
  id: number;
  seasonId: number;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  finished: boolean;
  isCurrent: boolean;
}

export interface StandingRow {
  position: number;
  team: FootballTeam;
  points: number;
}

export type FantasyPosition = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface Availability {
  status: 'available' | 'injured' | 'suspended';
  /** ISO date the absence is expected to end, when the provider gives one. */
  expectedReturn: string | null;
}

/** A real squad member in the current season. */
export interface SquadPlayer {
  id: number;
  name: string;
  team: FootballTeam;
  position: FantasyPosition;
  jerseyNumber: number | null;
  availability: Availability;
}

/**
 * One player's statistics in one fixture, exactly as reported. A stat the
 * provider does not return is `null`, never zero: a missing tackle count is
 * not the same as a player who made no tackles.
 */
export interface PlayerMatchStats {
  playerId: number;
  teamId: number;
  fixtureId: number;
  started: boolean;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  saves: number | null;
  goalsConceded: number | null;
  yellowCards: number | null;
  redCards: number | null;
  yellowRedCards: number | null;
  ownGoals: number | null;
  tackles: number | null;
  interceptions: number | null;
  clearances: number | null;
  blockedShots: number | null;
  rating: number | null;
}

/** A round's fixtures with every player line the provider has published. */
export interface RoundStats {
  fixtures: FootballFixture[];
  lines: PlayerMatchStats[];
}
