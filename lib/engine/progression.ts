import type { Achievement, Profile } from '@/lib/domain/types';

/* -------------------------------------------------------------------------- */
/* Manager rating                                                             */
/* -------------------------------------------------------------------------- */

export interface Tier {
  id: string;
  name: string;
  min: number;
  /** CSS colour token used for the badge. */
  token: string;
}

export const TIERS: Tier[] = [
  { id: 'sunday', name: 'Sunday League', min: 0, token: 'var(--color-ink-muted)' },
  { id: 'semi-pro', name: 'Semi-Pro', min: 900, token: 'var(--color-ink-soft)' },
  { id: 'pro', name: 'Professional', min: 1100, token: 'var(--color-away)' },
  { id: 'elite', name: 'Elite', min: 1350, token: 'var(--color-home)' },
  { id: 'world-class', name: 'World Class', min: 1600, token: 'var(--color-gold)' },
  { id: 'legend', name: 'Legend', min: 1850, token: 'var(--color-gold)' },
];

export const STARTING_RATING = 1000;

export function tierFor(rating: number): Tier {
  let current = TIERS[0]!;
  for (const t of TIERS) if (rating >= t.min) current = t;
  return current;
}

export function nextTier(rating: number): Tier | null {
  return TIERS.find((t) => t.min > rating) ?? null;
}

/** Progress through the current tier, 0 to 1. */
export function tierProgress(rating: number): number {
  const current = tierFor(rating);
  const next = nextTier(rating);
  if (!next) return 1;
  return Math.max(0, Math.min(1, (rating - current.min) / (next.min - current.min)));
}

/**
 * Elo with a goal-difference bonus. K is generous early so a new manager finds
 * their level within a handful of duels instead of grinding.
 */
export function ratingDelta(
  playerRating: number,
  opponentRating: number,
  outcome: 'win' | 'draw' | 'loss',
  goalDifference: number,
  played: number,
): number {
  const k = played < 10 ? 48 : played < 40 ? 32 : 24;
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  const margin = 1 + Math.min(Math.abs(goalDifference), 4) * 0.09;
  return Math.round(k * (score - expected) * margin);
}

/* -------------------------------------------------------------------------- */
/* Achievements                                                               */
/* -------------------------------------------------------------------------- */

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-blood', name: 'First Blood', description: 'Win your first duel.', tier: 'bronze', target: 1 },
  { id: 'ten-duels', name: 'Season Ticket', description: 'Play ten duels.', tier: 'bronze', target: 10 },
  { id: 'fifty-duels', name: 'Veteran', description: 'Play fifty duels.', tier: 'silver', target: 50 },
  { id: 'streak-3', name: 'On a Run', description: 'Win three duels in a row.', tier: 'bronze', target: 3 },
  { id: 'streak-7', name: 'Untouchable', description: 'Win seven duels in a row.', tier: 'gold', target: 7 },
  { id: 'clean-sheet', name: 'Nothing Through', description: 'Win a duel without conceding.', tier: 'bronze', target: 1 },
  { id: 'five-goals', name: 'Demolition', description: 'Score five or more in one duel.', tier: 'silver', target: 1 },
  { id: 'giant-killer', name: 'Giant Killer', description: 'Beat a squad rated ten points above yours.', tier: 'gold', target: 1 },
  { id: 'wheel-50', name: 'Wheel Addict', description: 'Spin the wheel fifty times.', tier: 'silver', target: 50 },
  { id: 'collector', name: 'Collector', description: 'See ten different categories.', tier: 'silver', target: 10 },
  { id: 'legendary-spin', name: 'Against the Odds', description: 'Win a duel under a legendary category.', tier: 'gold', target: 1 },
  { id: 'perfect-chem', name: 'Perfect Understanding', description: 'Build an eleven with 90+ chemistry.', tier: 'gold', target: 1 },
  { id: 'shootout', name: 'Nerves of Steel', description: 'Win a duel on penalties.', tier: 'silver', target: 1 },
  { id: 'challenge-5', name: 'Challenger', description: 'Complete five challenges.', tier: 'silver', target: 5 },
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function isUnlocked(profile: Profile, id: string): boolean {
  const achievement = ACHIEVEMENT_BY_ID.get(id);
  if (!achievement) return false;
  return (profile.achievements[id] ?? 0) >= achievement.target;
}

export function unlockedCount(profile: Profile): number {
  return ACHIEVEMENTS.filter((a) => isUnlocked(profile, a.id)).length;
}

export const ACHIEVEMENT_TIER_TOKEN: Record<Achievement['tier'], string> = {
  bronze: '#C98A5B',
  silver: '#C6D2CB',
  gold: 'var(--color-gold)',
};
