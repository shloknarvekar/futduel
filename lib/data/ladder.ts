import { createRng } from '@/lib/engine/rng';
import { ACTIVE_CATEGORIES } from '@/lib/engine/category-pool';

/**
 * The standing field.
 *
 * FutDuel has no server, so the ladder is a fixed, seeded cast of managers that
 * everyone competes against locally. It is stable between sessions and honest
 * about what it is: a benchmark, not a live population.
 */

/**
 * The field. The seven at the top are the opponents you can actually be drawn
 * against, under the same names they duel you with; the rest are the benchmark
 * cast described above.
 */
const NAMES = [
  'FutDuel AI · Analyst', 'FutDuel AI · Ruthless', 'FutDuel AI · Chemistry', 'FutDuel AI · Engine',
  'FutDuel AI · Anchor', 'FutDuel AI · Instinct', 'FutDuel AI · Sunday',
  'Noor Haddad', 'Milo Bertrand', 'Sanne de Vries',
  'Kwame Mensah', 'Lucia Ferrari', 'Emir Yilmaz', 'Priya Raghavan', 'Oskar Lindholm',
  'Marta Nowak', 'Hugo Beaumont', 'Chiara Rossi', 'Deniz Aslan', 'Tomas Havel',
  'Yuki Nakamura', 'Sofia Almeida', 'Andres Quiroga', 'Nia Thompson', 'Kai Bergstrom',
  'Leila Benali', 'Viktor Petrov', 'Amara Diallo', 'Joon-ho Park', 'Elena Marin',
  'Sam Okonkwo', 'Freya Nilsen', 'Diego Salvatierra', 'Ruth Adeyemi', 'Matteo Conti',
  'Anouk Verheyen', 'Rafael Ortiz', 'Zoya Karimova', 'Callum Brady', 'Nadia Hassan',
];

export interface LadderEntry {
  id: string;
  name: string;
  rating: number;
  played: number;
  won: number;
  /** The category this manager wins with most often — pure flavour, but sticky. */
  signature: string;
  streak: number;
}

export const LADDER: LadderEntry[] = (() => {
  const rng = createRng('futduel-ladder-v1');
  return NAMES.map((name, index) => {
    // A long tail at the bottom, a tight cluster at the top.
    const base = 2050 - Math.pow(index, 1.42) * 26;
    const rating = Math.max(760, Math.round(base + (rng.next() - 0.5) * 60));
    const played = rng.int(24, 220);
    const winRate = 0.34 + (rating - 760) / 1300 / 2.6;
    return {
      id: `ladder-${index}`,
      name,
      rating,
      played,
      won: Math.round(played * Math.min(0.86, winRate)),
      signature: rng.pick(ACTIVE_CATEGORIES).name,
      streak: rng.int(0, rating > 1500 ? 9 : 4),
    };
  }).sort((a, b) => b.rating - a.rating);
})();

/** Where a given rating would sit in the field, 1-indexed. */
export function rankFor(rating: number): number {
  const better = LADDER.filter((entry) => entry.rating > rating).length;
  return better + 1;
}
