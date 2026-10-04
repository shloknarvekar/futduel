import type { Category, CategoryFilter, Player, SlotRole, Squad } from '@/lib/domain/types';
import { PLAYERS } from '@/lib/data/players';
import { FORMATIONS, ROLE_ADJACENCY } from '@/lib/data/formations';
import { normalizeName } from './search';

/**
 * Resolves a declarative category filter into a predicate.
 *
 * Recursive, because categories are composed: most of the pool is an `and` or
 * an `or` over a handful of leaf rules rather than a bespoke condition.
 */
export function matchesFilter(player: Player, filter: CategoryFilter): boolean {
  switch (filter.kind) {
    case 'all':
      return true;
    case 'league':
      return player.league === filter.league;
    case 'nation':
      return filter.nations.includes(player.nation);
    case 'continent':
      return player.continent === filter.continent;
    case 'club':
      return filter.clubIds.includes(player.clubId);
    case 'maxAge':
      return player.age <= filter.age;
    case 'minAge':
      return player.age >= filter.age;
    case 'ageRange':
      return player.age >= filter.min && player.age <= filter.max;
    case 'foot':
      return player.foot === filter.foot;
    case 'attrMin':
      return player.attributes[filter.attr] >= filter.value;
    case 'attrMax':
      return player.attributes[filter.attr] <= filter.value;
    // Historical versions carry no present-day valuation, so no value rule can
    // admit them: an unknown price is neither a bargain nor a Galactico.
    case 'maxValue':
      return player.value !== null && player.value <= filter.value;
    case 'minValue':
      return player.value !== null && player.value >= filter.value;
    case 'ratingRange':
      return player.rating >= filter.min && player.rating <= filter.max;
    case 'position':
      return filter.positions.includes(player.position);
    case 'role':
      return player.roles.some((role) => filter.roles.includes(role));
    case 'tier':
      return filter.tiers.includes(player.tier);
    case 'era':
      return filter.eras.includes(player.era);
    case 'cardType':
      return filter.types.includes(player.cardType);
    case 'and':
      return filter.of.every((inner) => matchesFilter(player, inner));
    case 'or':
      return filter.of.some((inner) => matchesFilter(player, inner));
    case 'not':
      return !matchesFilter(player, filter.of);
  }
}

const poolCache = new Map<string, Player[]>();

/** Every player legal under a category, strongest first. */
export function poolFor(category: Category): Player[] {
  const cached = poolCache.get(category.id);
  if (cached) return cached;
  const pool = PLAYERS.filter((p) => matchesFilter(p, category.filter)).sort(
    (a, b) => b.rating - a.rating,
  );
  poolCache.set(category.id, pool);
  return pool;
}

export type FitQuality = 'natural' | 'adjacent' | 'out-of-position';

export function fitFor(player: Player, role: SlotRole): FitQuality {
  if (player.roles.includes(role)) return 'natural';
  // A goalkeeper is never anything but a goalkeeper, and vice versa.
  if (role === 'GK' || player.position === 'GK') return 'out-of-position';
  const adjacent = ROLE_ADJACENCY[role] ?? [];
  if (player.roles.some((r) => adjacent.includes(r))) return 'adjacent';
  return 'out-of-position';
}

export const FIT_PENALTY: Record<FitQuality, number> = {
  natural: 0,
  adjacent: 4,
  'out-of-position': 12,
};

/** Effective rating once the out-of-position penalty is applied. */
export function effectiveRating(player: Player, role: SlotRole): number {
  return Math.max(40, player.rating - FIT_PENALTY[fitFor(player, role)]);
}

/**
 * Whether a player can fill a slot in a positionally sound eleven: a keeper in
 * goal, an outfielder everywhere else, and never further from home than an
 * adjacent role.
 *
 * This is the bar a category has to clear, not a rule on what a manager may
 * pick. The builder still lets anyone play out of position, at a cost; what a
 * category may not do is make that cost unavoidable.
 */
function soundFit(player: Player, role: SlotRole): boolean {
  if (role === 'GK') return player.position === 'GK';
  if (player.position === 'GK') return false;
  return fitFor(player, role) !== 'out-of-position';
}

/**
 * A complete, legal, positionally sound eleven from `pool`, or null when none
 * exists in any formation.
 *
 * Solved exactly rather than drafted greedily: slots are matched to footballers
 * by augmenting paths, so a "no" means no eleven exists, not that one attempt
 * got stuck. Footballers are matched by `identityId`, so two versions of one
 * player can never make up two of the eleven. The eleven returned is a witness:
 * the proof that the category can be played.
 */
export function legalElevenFor(pool: readonly Player[]): Squad | null {
  // Strongest version first, so the witness is a sensible side and the result
  // never depends on the order the pool arrived in.
  const versions = new Map<string, Player[]>();
  for (const player of [...pool].sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id))) {
    const list = versions.get(player.identityId);
    if (list) list.push(player);
    else versions.set(player.identityId, [player]);
  }
  const identities = [...versions.keys()];

  for (const formation of FORMATIONS) {
    const slots = formation.slots;
    const candidates = slots.map((slot) =>
      identities.filter((id) => versions.get(id)!.some((p) => soundFit(p, slot.role))),
    );
    const holder = new Map<string, number>();

    const assign = (slotIndex: number, visited: Set<string>): boolean => {
      for (const id of candidates[slotIndex]!) {
        if (visited.has(id)) continue;
        visited.add(id);
        const current = holder.get(id);
        if (current === undefined || assign(current, visited)) {
          holder.set(id, slotIndex);
          return true;
        }
      }
      return false;
    };

    if (!slots.every((_, index) => assign(index, new Set()))) continue;

    const picks: Squad['picks'] = Object.fromEntries(slots.map((s) => [s.id, null]));
    for (const [id, slotIndex] of holder) {
      const slot = slots[slotIndex]!;
      picks[slot.id] = versions.get(id)!.find((p) => soundFit(p, slot.role))!.id;
    }
    return { formationId: formation.id, picks };
  }
  return null;
}

export interface PoolCoverage {
  total: number;
  byPosition: Record<Player['position'], number>;
  /** Outfielders available, i.e. everyone who is not a goalkeeper. */
  outfield: number;
  /**
   * False when the category cannot field a legal eleven: eleven different
   * footballers, a keeper in goal, and every slot filled by a natural or
   * adjacent fit in at least one formation. A head count is not enough — a
   * category with no forward can count eleven players and still has nobody to
   * play up front.
   */
  viable: boolean;
}

const coverageCache = new Map<string, PoolCoverage>();

export function coverageFor(category: Category): PoolCoverage {
  const cached = coverageCache.get(category.id);
  if (cached) return cached;

  const pool = poolFor(category);
  const byPosition = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of pool) byPosition[p.position] += 1;
  const outfield = byPosition.DEF + byPosition.MID + byPosition.FWD;

  const coverage: PoolCoverage = {
    total: pool.length,
    byPosition,
    outfield,
    viable: legalElevenFor(pool) !== null,
  };
  coverageCache.set(category.id, coverage);
  return coverage;
}

export interface PlayerQuery {
  search?: string;
  position?: Player['position'] | 'ALL';
  league?: Player['league'] | 'ALL';
  sort?: 'rating' | 'value' | 'age' | 'pace' | 'name';
  /** Restrict to players legal for this slot's role. */
  role?: SlotRole;
}

export function queryPool(pool: Player[], q: PlayerQuery): Player[] {
  // Accent-insensitive both ways: the dataset writes Cubarsi and a Spanish
  // keyboard writes Cubarsí, and neither should hide the other.
  const search = normalizeName(q.search ?? '');
  let out = pool.filter((p) => {
    if (q.position && q.position !== 'ALL' && p.position !== q.position) return false;
    if (q.league && q.league !== 'ALL' && p.league !== q.league) return false;
    if (!search) return true;
    return (
      normalizeName(p.name).includes(search) ||
      normalizeName(p.club).includes(search) ||
      normalizeName(p.nation).includes(search)
    );
  });

  if (q.role) {
    // Sort natural fits to the top rather than hiding the rest — a narrow
    // category often forces a compromise, and hiding options hides the game.
    const order: Record<FitQuality, number> = { natural: 0, adjacent: 1, 'out-of-position': 2 };
    out = [...out].sort((a, b) => order[fitFor(a, q.role!)] - order[fitFor(b, q.role!)]);
    return out;
  }

  const sort = q.sort ?? 'rating';
  return [...out].sort((a, b) => {
    switch (sort) {
      case 'value':
        // Unvalued historical versions sort after every priced player.
        return (b.value ?? -1) - (a.value ?? -1);
      case 'age':
        return a.age - b.age;
      case 'pace':
        return b.attributes.pace - a.attributes.pace;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return b.rating - a.rating;
    }
  });
}
