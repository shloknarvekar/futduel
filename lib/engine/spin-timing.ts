import { SPIN_TURNS } from './wheel';

/**
 * Spin timing policy.
 *
 * Kept pure and out of the component so it can be asserted in the verification
 * suite rather than eyeballed in a browser. The wheel is the signature
 * interaction of the product, and "it looked fast to me" is not a test.
 */

/** Visible rotation for a viewer who has not asked for reduced motion. */
export const SPIN_MS_FULL = 6200;

/**
 * Reduced motion still gets a spin — a short one covering the final partial
 * turn. Honouring the preference by deleting the animation is what made the
 * wheel look broken; the point is to reduce motion, not remove the feedback.
 */
export const SPIN_MS_REDUCED = 1400;

/** The beat between the wheel stopping and the category landing. */
export const REVEAL_HOLD_MS = 900;

/**
 * After a skip the wheel snaps to its result and still holds the lock for a
 * beat, so the category lands as a decision rather than a cut. Shorter than
 * the normal hold: whoever skipped has already said they want to move on.
 */
export const SKIP_REVEAL_MS = 360;

/** Safety net for a tab that was hidden mid-spin. */
export const BACKSTOP_EXTRA_MS = 1400;

export interface SpinTiming {
  /** How long the rotor transition runs. */
  spinMs: number;
  /** Earliest moment the category may be revealed. */
  revealAtMs: number;
  /** Full rotations travelled before settling. */
  turns: number;
}

export function spinTiming(reduceMotion: boolean): SpinTiming {
  const spinMs = reduceMotion ? SPIN_MS_REDUCED : SPIN_MS_FULL;
  return {
    spinMs,
    revealAtMs: spinMs + REVEAL_HOLD_MS,
    turns: reduceMotion ? 0 : SPIN_TURNS,
  };
}

/**
 * The rotation the rotor should travel to. Reduced motion drops the whole
 * turns, which cannot change where the wheel lands because the angle modulo
 * 360 is identical either way.
 */
export function spinTarget(rotation: number, reduceMotion: boolean): number {
  return reduceMotion ? rotation - SPIN_TURNS * 360 : rotation;
}
