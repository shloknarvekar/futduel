import type { Category, DuelRecord, DuelReplay, MatchResult } from '@/lib/domain/types';
import { CATEGORIES } from '@/lib/data/categories';
import { PLAYER_BY_ID } from '@/lib/data/players';
import { rateSquad } from './rating';
import { simulateMatch } from './simulate';

/**
 * Match history: finished duels kept in this browser so they can be watched
 * again. Nothing is uploaded and nothing is invented; a record only exists
 * because the duel was played here.
 */

export { HISTORY_KEPT } from './local-limits';

/** A stable key for a record, safe in a URL. The seed alone repeats if a duel is replayed. */
export function historyKey(record: Pick<DuelRecord, 'id' | 'playedAt'>): string {
  return `${record.id}-${record.playedAt}`;
}

export type ReplayProblem = 'no-replay' | 'category-removed' | 'player-removed';

export const REPLAY_PROBLEM_TEXT: Record<ReplayProblem, string> = {
  'no-replay': 'This duel was recorded before FutDuel kept replays, so only its score was saved.',
  'category-removed': 'One of this duel’s categories has since been retired, so it can no longer be shown.',
  'player-removed': 'A card in one of these elevens is no longer in the game, so the lineups cannot be shown.',
};

const categoryById = (id: string) => CATEGORIES.find((category) => category.id === id);

/** Why a record cannot be reopened, or null when it can. */
export function replayProblem(record: DuelRecord): ReplayProblem | null {
  const replay = record.replay;
  if (!replay) return 'no-replay';
  if (!categoryById(replay.home.categoryId) || !categoryById(replay.away.categoryId)) return 'category-removed';
  for (const side of [replay.home, replay.away]) {
    for (const id of Object.values(side.squad.picks)) if (id && !PLAYER_BY_ID.has(id)) return 'player-removed';
  }
  return null;
}

export interface OpenedReplay {
  replay: DuelReplay;
  homeCategory: Category;
  awayCategory: Category;
}

/** The record ready to show, or null when `replayProblem` says it cannot be. */
export function openReplay(record: DuelRecord): OpenedReplay | null {
  if (replayProblem(record) || !record.replay) return null;
  return {
    replay: record.replay,
    homeCategory: categoryById(record.replay.home.categoryId)!,
    awayCategory: categoryById(record.replay.away.categoryId)!,
  };
}

/**
 * Plays the saved duel again from its seed and squads. On the data it was
 * played with this returns the saved result exactly, which is what makes the
 * stored result trustworthy; the replay view shows the stored result either
 * way, so a later data change can never rewrite a match that already happened.
 */
export function resimulate(replay: DuelReplay): MatchResult {
  const home = categoryById(replay.home.categoryId)!;
  const away = categoryById(replay.away.categoryId)!;
  return simulateMatch({
    seed: replay.seed,
    decisive: false,
    home: { name: replay.home.name, squad: replay.home.squad, category: home, rating: rateSquad(replay.home.squad) },
    away: { name: replay.away.name, squad: replay.away.squad, category: away, rating: rateSquad(replay.away.squad) },
  });
}
