import type { Category } from '@/lib/domain/types';
import { ACTIVE_CATEGORIES } from './category-pool';
import { createRng } from './rng';

/** Only categories that pass every check reach the wheel. See `category-pool.ts`. */
export const WHEEL_SEGMENTS: Category[] = ACTIVE_CATEGORIES;

/**
 * Every segment is the same size, and every segment is exactly as likely: with
 * N on the wheel, each covers 360 / N degrees and lands 1 time in N. Rarity is
 * how a category looks and how hard it is to build under, never how often it
 * comes up.
 */
export const SEGMENT_ANGLE = 360 / WHEEL_SEGMENTS.length;

export interface SpinOutcome {
  category: Category;
  segmentIndex: number;
  /** Absolute rotation to animate to, in degrees. Always greater than `from`. */
  rotation: number;
  /**
   * The same angle reduced to [0, 360). Rotating the wheel by this much puts
   * the chosen wedge under the pointer.
   */
  landingAngle: number;
}

export interface SpinOptions {
  /** Categories that cannot be drawn — normally the opponent's. */
  exclude?: string[];
  /**
   * The wheel's current rotation. The result is always further clockwise than
   * this, so a second spin never rewinds.
   */
  from?: number;
}

/** Full rotations a spin makes before landing. Exported so the UI can offer a
 *  shorter journey to anyone who has asked for reduced motion. */
export const SPIN_TURNS = 8;

const mod360 = (n: number) => ((n % 360) + 360) % 360;

/**
 * A uniform draw, then the rotation needed to land that segment under the
 * pointer.
 *
 * The draw is one index into the categories that may come up, taken straight
 * from the seed: every candidate is exactly equally likely, nothing is weighted,
 * and nothing is drawn from a larger list and then rejected. Excluding the
 * opponent's category narrows the candidates before the draw, so the other
 * side still draws evenly from what is left.
 *
 * The visual result is derived from the logical one — never the other way
 * around — so what the wheel shows is always what the game decided. The drawn
 * category depends only on the seed, so passing a different `from` moves the
 * wheel without changing the outcome.
 */
export function spin(seed: string, options: SpinOptions = {}): SpinOutcome {
  const rng = createRng(`spin:${seed}`);
  const candidates = WHEEL_SEGMENTS.filter((c) => !options.exclude?.includes(c.id));
  const pool = candidates.length > 0 ? candidates : WHEEL_SEGMENTS;
  const picked = pool[rng.index(pool.length)]!;

  const segmentIndex = WHEEL_SEGMENTS.findIndex((c) => c.id === picked.id);

  // Land somewhere inside the wedge rather than dead centre — it reads as
  // physics rather than a lookup table. Kept well inside the wedge so the
  // pointer can never come to rest on a boundary.
  const jitter = (rng.next() - 0.5) * SEGMENT_ANGLE * 0.6;
  const centre = segmentIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
  const landingAngle = mod360(360 - centre + jitter);

  const from = options.from ?? 0;
  const delta = mod360(landingAngle - mod360(from));

  return {
    category: picked,
    segmentIndex,
    landingAngle,
    rotation: from + SPIN_TURNS * 360 + delta,
  };
}

export type WheelSide = 'home' | 'away';

/**
 * The seed one side's wheel draws from. The arena and the home page both go
 * through here, so a draw started on either lands on the same category.
 */
export function sideSeed(seed: string, side: WheelSide): string {
  return `${seed}:${side}`;
}

export interface OpeningDraw {
  home: SpinOutcome;
  away: SpinOutcome;
}

/**
 * Both categories of a solo duel from one seed, drawn exactly as the arena
 * draws them: home first, then away with home's category excluded. Nothing
 * here is new randomness — it is the same `spin` the wheel itself runs.
 */
export function openingDraw(seed: string): OpeningDraw {
  const home = spin(sideSeed(seed, 'home'));
  const away = spin(sideSeed(seed, 'away'), { exclude: [home.category.id] });
  return { home, away };
}

/**
 * A solo duel whose home category was chosen instead of spun. The choice must
 * be one of the wheel's own validated segments, so choosing can never reach a
 * category the viability judge rejected. The opponent still spins, exactly as
 * the arena's second spin does: the away side's seed, the chosen category
 * excluded. So the same seed and choice always give the same pair, the
 * opponent's wheel lands where this says, and `openingDraw` is untouched.
 */
export function chosenDraw(seed: string, categoryId: string): { home: Category; away: Category } | null {
  const home = WHEEL_SEGMENTS.find((category) => category.id === categoryId);
  if (!home) return null;
  const away = spin(sideSeed(seed, 'away'), { exclude: [home.id] }).category;
  return { home, away };
}

/**
 * Where the pointer comes to rest relative to the centre of a wedge, in
 * degrees. The verification suite uses this to prove the wheel stops where the
 * engine said it would.
 */
export function pointerOffset(rotation: number, segmentIndex: number): number {
  const centre = segmentIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
  const offset = mod360(rotation + centre);
  return offset > 180 ? offset - 360 : offset;
}
