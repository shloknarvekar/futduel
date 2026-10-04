import type { Player, SlotRole, Squad } from '@/lib/domain/types';
import { requireFormation } from '@/lib/data/formations';
import { getPlayer } from '@/lib/data/players';
import { queryPool } from './filters';
import { SEARCH_MIN_LENGTH, SEARCH_RESULT_LIMIT, normalizeName, searchPlayers } from './search';

/**
 * Filling a slot in the squad builder.
 *
 * Build assistance changes what the picker shows, never what may be picked.
 * `pickerResults` is the only place the two modes differ; `pickProblem`, the
 * rule on what a slot accepts, does not take the mode at all, so Manual cannot
 * be looser or stricter than Guided by construction.
 */

/**
 * - `guided`: every eligible player for the slot, natural fits first, strongest first.
 * - `manual`: nothing is listed until the manager names someone. A fragment is
 *   not a name, so the search has to identify a footballer before anyone is
 *   shown, and at most a handful of the closest come back. Anything looser is
 *   a recommendation list with a text box in front of it.
 */
export type BuildAssistance = 'guided' | 'manual';

/** In Manual, how much has to be typed before the search runs at all. */
export const MANUAL_MIN_SEARCH = SEARCH_MIN_LENGTH;
/** The most Manual will ever list, however many names are close. */
export const MANUAL_RESULT_LIMIT = SEARCH_RESULT_LIMIT;

export interface PickerQuery {
  assistance: BuildAssistance;
  search: string;
  position: Player['position'] | 'ALL';
  role: SlotRole;
  /** Players who cannot go in this slot. They stay listed, after everyone who can. */
  isUnavailable: (player: Player) => boolean;
}

export interface PickerResults {
  players: Player[];
  /** Manual with too little typed: the list is withheld, which is not the same as empty. */
  awaitingSearch: boolean;
}

export function pickerResults(pool: readonly Player[], query: PickerQuery): PickerResults {
  const availableFirst = (players: Player[]) =>
    // Stable, so each mode's own order is kept within each group.
    [...players].sort((a, b) => Number(query.isUnavailable(a)) - Number(query.isUnavailable(b)));

  if (query.assistance === 'guided') {
    const ranked = queryPool([...pool], { search: query.search, position: query.position, role: query.role });
    return { players: availableFirst(ranked), awaitingSearch: false };
  }

  if (normalizeName(query.search).length < MANUAL_MIN_SEARCH) return { players: [], awaitingSearch: true };
  // The position filter still applies: it is the manager's own filter, not a
  // suggestion. Everything else about who may be picked is `pickProblem`.
  const candidates =
    query.position === 'ALL' || !query.position
      ? pool
      : pool.filter((p) => p.position === query.position);
  return { players: availableFirst(searchPlayers(candidates, query.search)), awaitingSearch: false };
}

export type PickProblem = 'unknown-slot' | 'not-eligible' | 'already-in-eleven';

/**
 * Why `player` cannot go into `slotId`, or null when they can. The same in both
 * assistance modes.
 *
 * Out-of-position picks are allowed here on purpose: they cost rating and
 * chemistry, which is a tactical choice, not a broken rule.
 */
export function pickProblem(
  player: Player,
  { squad, slotId, eligibleIds }: { squad: Squad; slotId: string; eligibleIds: ReadonlySet<string> },
): PickProblem | null {
  if (!requireFormation(squad.formationId).slots.some((slot) => slot.id === slotId)) return 'unknown-slot';
  if (!eligibleIds.has(player.id)) return 'not-eligible';
  // Keyed by footballer, not card: another version of the same player anywhere
  // else in the eleven blocks the pick. The slot's own occupant does not, so one
  // version can be swapped for another in place.
  for (const [otherSlotId, id] of Object.entries(squad.picks)) {
    if (!id || otherSlotId === slotId) continue;
    if (getPlayer(id)?.identityId === player.identityId) return 'already-in-eleven';
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Moving a player who is already in the eleven                               */
/* -------------------------------------------------------------------------- */

export type MoveProblem =
  | 'unknown-slot'
  | 'same-slot'
  | 'empty-slot'
  | 'keeper-rule'
  | 'not-eligible'
  | 'already-in-eleven';

/** Keepers stay in goal and outfielders stay out of it: the rule the builder uses when a formation changes. */
function keeperFits(player: Player, role: SlotRole): boolean {
  return role === 'GK' ? player.position === 'GK' : player.position !== 'GK';
}

/** The move itself, with no checks: into an empty slot, or a straight swap. */
function moved(squad: Squad, fromSlotId: string, toSlotId: string): Squad {
  return {
    ...squad,
    picks: { ...squad.picks, [toSlotId]: squad.picks[fromSlotId] ?? null, [fromSlotId]: squad.picks[toSlotId] ?? null },
  };
}

/**
 * Why a player cannot be moved from one slot to another, or null when they
 * can. Dropping on an empty slot moves them; dropping on a team-mate swaps the
 * two. Drag and drop and the "move to" buttons both come through here, so a
 * move can never do what a pick could not: the same category, the same
 * one-version-per-footballer rule, the same formation. Out-of-position moves
 * stay legal, as out-of-position picks do; only the keeper rule is absolute.
 */
export function moveProblem(
  squad: Squad,
  fromSlotId: string,
  toSlotId: string,
  eligibleIds: ReadonlySet<string>,
): MoveProblem | null {
  const slots = requireFormation(squad.formationId).slots;
  const from = slots.find((slot) => slot.id === fromSlotId);
  const to = slots.find((slot) => slot.id === toSlotId);
  if (!from || !to) return 'unknown-slot';
  if (from.id === to.id) return 'same-slot';
  const movingId = squad.picks[from.id];
  const mover = movingId ? getPlayer(movingId) : undefined;
  if (!mover) return 'empty-slot';
  const displacedId = squad.picks[to.id];
  const displaced = displacedId ? getPlayer(displacedId) : undefined;

  if (!keeperFits(mover, to.role) || (displaced && !keeperFits(displaced, from.role))) return 'keeper-rule';
  if (!eligibleIds.has(mover.id) || (displaced && !eligibleIds.has(displaced.id))) return 'not-eligible';

  // A move only rearranges who is already there, but the result is checked
  // anyway: no footballer may appear twice, whatever state the squad came in.
  const seen = new Set<string>();
  for (const id of Object.values(moved(squad, from.id, to.id).picks)) {
    if (!id) continue;
    const identity = getPlayer(id)?.identityId ?? id;
    if (seen.has(identity)) return 'already-in-eleven';
    seen.add(identity);
  }
  return null;
}

/** The squad after the move, or the same squad untouched when the move is not allowed. */
export function applyMove(
  squad: Squad,
  fromSlotId: string,
  toSlotId: string,
  eligibleIds: ReadonlySet<string>,
): Squad {
  return moveProblem(squad, fromSlotId, toSlotId, eligibleIds) ? squad : moved(squad, fromSlotId, toSlotId);
}

export const MOVE_PROBLEM_TEXT: Record<MoveProblem, string> = {
  'unknown-slot': 'That position is not in this formation.',
  'same-slot': 'Already there.',
  'empty-slot': 'There is no one in that position to move.',
  'keeper-rule': 'Keepers stay in goal, and outfield players stay out of it.',
  'not-eligible': 'That player is not eligible under this category.',
  'already-in-eleven': 'That would put the same footballer in the eleven twice.',
};
