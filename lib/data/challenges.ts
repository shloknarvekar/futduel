import type { AIDifficulty, Challenge } from '@/lib/domain/types';
import { ACTIVE_CATEGORIES, ACTIVE_CATEGORY_BY_ID } from '@/lib/engine/category-pool';
import { createRng } from '@/lib/engine/rng';

/**
 * Challenges rotate on a fixed weekly cycle derived from the date, so everyone
 * playing in the same week sees the same board without any server state.
 */

const MS_WEEK = 7 * 86_400_000;
const EPOCH = Date.UTC(2024, 7, 12);

export function weekIndex(now: Date): number {
  return Math.floor((now.getTime() - EPOCH) / MS_WEEK);
}

const BRIEFS: Record<AIDifficulty, string[]> = {
  amateur: [
    'A gentle one. Take the points and move on.',
    'Warm-up work. Do not overthink the shape.',
  ],
  pro: [
    'A proper test. Chemistry will decide this one.',
    'They will match you player for player. Find an edge.',
  ],
  elite: [
    'They take the strongest legal eleven and dare you to answer it.',
    'No favours here. You will need the category to work for you.',
  ],
};

const REWARDS: Record<AIDifficulty, number> = { amateur: 15, pro: 30, elite: 55 };
const FLOORS: Record<AIDifficulty, number> = { amateur: 0, pro: 76, elite: 82 };

const DIFFICULTY_CYCLE: AIDifficulty[] = ['amateur', 'pro', 'pro', 'elite'];

export function challengesFor(now: Date): Challenge[] {
  const week = weekIndex(now);
  const rng = createRng(`challenges:${week}`);
  const pool = rng.shuffle(ACTIVE_CATEGORIES.filter((c) => c.id !== 'open-play'));

  return DIFFICULTY_CYCLE.map((difficulty, index) => {
    const category = pool[index % pool.length]!;
    const briefs = BRIEFS[difficulty];
    return {
      id: `w${week}-${category.id}-${difficulty}`,
      name: `${category.name} gauntlet`,
      brief: briefs[index % briefs.length]!,
      categoryId: category.id,
      difficulty,
      reward: REWARDS[difficulty],
      opponentFloor: FLOORS[difficulty],
    };
  });
}

export function findChallenge(id: string, now: Date): Challenge | undefined {
  return challengesFor(now).find((challenge) => challenge.id === id);
}

/** Parses a challenge id well enough to run it, even across a week boundary. */
export function parseChallengeId(
  id: string,
): { categoryId: string; difficulty: AIDifficulty } | null {
  const match = /^w(-?\d+)-(.+)-(amateur|pro|elite)$/.exec(id);
  if (!match) return null;
  const categoryId = match[2]!;
  // A challenge link naming a removed or unplayable category opens nothing.
  if (!ACTIVE_CATEGORY_BY_ID.has(categoryId)) return null;
  return { categoryId, difficulty: match[3] as AIDifficulty };
}

export const DIFFICULTY_LABEL: Record<AIDifficulty, string> = {
  amateur: 'Amateur',
  pro: 'Pro',
  elite: 'Elite',
};
