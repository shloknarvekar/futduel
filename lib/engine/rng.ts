/**
 * Deterministic pseudo-randomness.
 *
 * Every duel is reproducible from its seed, which is what makes a shared
 * challenge code trustworthy: two people running the same code see the same
 * ninety minutes, goal for goal.
 */

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const UINT32_RANGE = 4294967296;

/**
 * One raw 32-bit value mapped to an index in [0, n), with every index owning
 * exactly the same number of raw values: index k is chosen by the values
 * [k * bucket, (k + 1) * bucket). The few values left over at the top (fewer
 * than n of them, when n does not divide 2^32) belong to no index, so this
 * returns null and the caller draws the next value. Scaling a float by n would
 * instead hand some indices one raw value more than others: a tiny bias, but
 * not an equal chance.
 */
export function indexFromUint32(value: number, n: number): number | null {
  if (!Number.isInteger(n) || n < 1 || n > UINT32_RANGE) throw new RangeError(`Cannot draw an index from ${n} options`);
  const bucket = Math.floor(UINT32_RANGE / n);
  if (value >= bucket * n) return null;
  return Math.floor(value / bucket);
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n), each exactly equally likely. See `indexFromUint32`. */
  index(n: number): number;
  /** Integer in [min, max]. */
  int(min: number, max: number): number;
  /** True with the given probability. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates, returns a new array. */
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: string): Rng {
  let state = hashSeed(seed);

  const nextUint32 = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
  const next = (): number => nextUint32() / UINT32_RANGE;

  return {
    next,
    index: (n) => {
      // A redraw happens only for the leftover top values: for 40 options,
      // 16 values in 2^32.
      for (;;) {
        const index = indexFromUint32(nextUint32(), n);
        if (index !== null) return index;
      }
    },
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('Rng.pick called with an empty list');
      return items[Math.floor(next() * items.length)]!;
    },
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
  };
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Whether a string is a seed `makeSeed` could have produced. A seed that
 * arrives in a URL is hostile input until this says otherwise.
 */
export function isSeed(value: unknown): value is string {
  return typeof value === 'string' && /^[A-HJ-NP-Z2-9]{8}$/.test(value);
}

/** URL-safe seed, short enough to read out loud. */
export function makeSeed(length = 8): string {
  const alphabet = SEED_ALPHABET;
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
