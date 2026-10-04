import type { PickWindow, PlayerRoundScore } from '@/lib/engine/fantasy-scoring';
import type { FootballFixture, FootballRound, FootballSeason, SquadPlayer } from './types';

/**
 * The fantasy round as the server assembles it and the page renders it.
 * Shared by server and client; the assembly itself lives in `fantasy.ts`.
 */

export interface FantasyRoundView {
  round: FootballRound;
  fixtures: FootballFixture[];
  /** FutDuel's pick deadline: 90 minutes before the round's first kickoff. */
  deadline: string | null;
  scores: Record<number, PlayerRoundScore>;
  /** Teams whose matches in this round are all over. */
  finishedTeamIds: number[];
  /** Whether the provider has published any player statistics for the round yet. */
  hasStats: boolean;
}

export interface FantasyGameweek {
  attribution: string;
  season: FootballSeason;
  /** The round being played or next to be played. `null` once the season is over. */
  active: FantasyRoundView | null;
  window: PickWindow | { state: 'closed' };
  /** The most recent finished round, for last-round points. */
  previous: FantasyRoundView | null;
  players: SquadPlayer[];
}
