import type { Attributes, Position } from '@/lib/domain/types';

/**
 * The FutDuel rating model.
 *
 * ## What this is, and what it is not
 *
 * No free football data provider publishes player ratings, and FutDuel does not
 * pretend otherwise. A rating here is **derived**, not reported: it is a pure
 * function of the six FutDuel gameplay attributes, weighted by position. Change
 * an attribute and the rating moves; there is no hand-typed override anywhere in
 * the dataset.
 *
 * That split is deliberate, and the UI states it plainly:
 *
 * | Layer      | Source                                                       |
 * | ---------- | ------------------------------------------------------------ |
 * | Identity   | Real world — name, club, league, nationality, position, age   |
 * | Attributes | FutDuel editorial — a scouting judgement, not a measurement   |
 * | Rating     | Computed here from the attributes, reproducibly              |
 *
 * The attributes are the honest weak link: they are authored, not measured, and
 * the app says so rather than dressing them up as official statistics.
 *
 * ## How the number is produced
 *
 * 1. Weight the six attributes for the player's position, giving a *core* score.
 *    The weights sum to 1, so the core sits on the same 0-99 scale.
 * 2. Map that core onto the rating scale with a per-position linear
 *    calibration, so the same rating means the same standard of player whether
 *    they keep goal or play up front. See `CALIBRATION` below.
 * 3. Clamp to 55-96.
 *
 * Goalkeepers reuse the same six slots as reflexes / handling / kicking / speed
 * / positioning / aerial, so they get their own weights.
 */

export type AttributeKey = keyof Attributes;

/** Weights per position. Each row sums to 1. */
export const RATING_WEIGHTS: Record<Position, Record<AttributeKey, number>> = {
  GK: { pace: 0.32, shooting: 0.22, passing: 0.08, dribbling: 0.02, defending: 0.26, physical: 0.1 },
  DEF: { pace: 0.18, shooting: 0.04, passing: 0.12, dribbling: 0.06, defending: 0.36, physical: 0.24 },
  MID: { pace: 0.08, shooting: 0.14, passing: 0.28, dribbling: 0.22, defending: 0.12, physical: 0.16 },
  FWD: { pace: 0.22, shooting: 0.3, passing: 0.1, dribbling: 0.22, defending: 0.03, physical: 0.13 },
};

/** Human-readable weighting, for the model explainer in the UI. */
export const RATING_WEIGHT_LABEL: Record<Position, string> = {
  GK: 'Reflexes 32% · Positioning 26% · Handling 22% · Aerial 10% · Kicking 8% · Speed 2%',
  DEF: 'Defending 36% · Physical 24% · Pace 18% · Passing 12% · Dribbling 6% · Shooting 4%',
  MID: 'Passing 28% · Dribbling 22% · Physical 16% · Shooting 14% · Defending 12% · Pace 8%',
  FWD: 'Shooting 30% · Pace 22% · Dribbling 22% · Physical 13% · Passing 10% · Defending 3%',
};

/**
 * Calibration.
 *
 * A weighted mean lands each position on a different natural scale, because the
 * attribute mixes differ: goalkeepers cluster high on the three shot-stopping
 * values that dominate their weighting, so a single shared curve rated every
 * keeper several points above an equivalent outfielder. Each position therefore
 * gets its own two-point line, chosen so that the same rating means the same
 * thing wherever a player lines up.
 *
 * The anchors map the 10th and 90th percentile of each position's measured core
 * distribution onto a common rating band. They are fixed constants rather than
 * percentiles recomputed at load: a self-calibrating model would silently move
 * every existing player's rating each time one was added, and the dataset
 * fingerprint that guards challenge links would churn with it.
 */
interface Calibration {
  lowCore: number;
  lowRating: number;
  highCore: number;
  highRating: number;
}

const CALIBRATION: Record<Position, Calibration> = {
  GK: { lowCore: 77.1, lowRating: 74, highCore: 85.0, highRating: 88 },
  DEF: { lowCore: 73.6, lowRating: 74, highCore: 80.7, highRating: 88 },
  MID: { lowCore: 72.8, lowRating: 74, highCore: 80.9, highRating: 87.5 },
  FWD: { lowCore: 75.1, lowRating: 74, highCore: 82.7, highRating: 86.0 },
};

export const RATING_FLOOR = 55;
export const RATING_CEILING = 96;

/** The weighted attribute score, before calibration. Exposed for the explainer. */
export function coreScore(position: Position, attributes: Attributes): number {
  const weights = RATING_WEIGHTS[position];
  let total = 0;
  for (const key of Object.keys(weights) as AttributeKey[]) {
    total += attributes[key] * weights[key];
  }
  return Math.round(total * 100) / 100;
}

/** The FutDuel rating. Deterministic, and the only place a rating is produced. */
export function ratePlayer(position: Position, attributes: Attributes): number {
  const core = coreScore(position, attributes);
  const c = CALIBRATION[position];
  const slope = (c.highRating - c.lowRating) / (c.highCore - c.lowCore);
  const scaled = c.lowRating + slope * (core - c.lowCore);
  return Math.max(RATING_FLOOR, Math.min(RATING_CEILING, Math.round(scaled)));
}

/**
 * Rating band, shared by current and historical records so the same number
 * always lands in the same band. It describes quality only: whether a card is
 * an Icon or a Hero is a classification held separately (`Player.cardType`).
 */
export function ratingTier(rating: number): 'common' | 'rare' | 'epic' | 'world-class' {
  if (rating >= 90) return 'world-class';
  if (rating >= 85) return 'epic';
  if (rating >= 80) return 'rare';
  return 'common';
}

/**
 * Where a player's data comes from. Rendered next to the numbers so nobody has
 * to guess which of them are real.
 */
export const DATA_PROVENANCE = {
  identity: {
    label: 'Identity',
    detail: 'Real-world club, league, nationality, position and age.',
  },
  attributes: {
    label: 'Attributes',
    detail: 'FutDuel gameplay values. Authored for balance, not measured from matches.',
  },
  rating: {
    label: 'Rating',
    detail: 'Computed from the attributes by the FutDuel rating model.',
  },
} as const;
