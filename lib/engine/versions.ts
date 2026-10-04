import type { Player } from '@/lib/domain/types';

/**
 * Versions of one footballer.
 *
 * The database keeps every version as its own card, because the duel engine
 * and the picker need them apart: a 2007/08 Ronaldo can be drafted instead of
 * the 2013/14 one. Browsing is different. A collection that shows the same
 * person twice reads as a duplicate, so browsing surfaces show one
 * representative card per footballer and reach the others through it.
 *
 * Three surfaces, three rules:
 * - Discover collection: `onePerFootballer`, one card per `identityId`.
 * - Player detail: every version, ordered by `compareVersions`.
 * - Duel picker: every eligible version, untouched by anything here.
 */

const CARD_TYPE_RANK: Record<Player['cardType'], number> = { icon: 2, hero: 1, standard: 0 };

/**
 * Best version first. Highest rating wins; ties go to the rarer card type,
 * then the more recent season, then the id, so the order never depends on
 * input order and the same card is chosen on every render.
 */
export function compareVersions(a: Player, b: Player): number {
  return (
    b.rating - a.rating ||
    CARD_TYPE_RANK[b.cardType] - CARD_TYPE_RANK[a.cardType] ||
    // Seasons are `YYYY/YY`, so string order is chronological.
    b.season.localeCompare(a.season) ||
    a.id.localeCompare(b.id)
  );
}

/** The representative card for each footballer among `players`. */
export function representatives(players: readonly Player[]): Map<string, Player> {
  const best = new Map<string, Player>();
  for (const player of players) {
    const current = best.get(player.identityId);
    if (!current || compareVersions(player, current) < 0) best.set(player.identityId, player);
  }
  return best;
}

/**
 * One card per footballer, keeping the order of `players`.
 *
 * Grouping happens after filtering, so the representative is the best version
 * that matches what the user asked for: filtering to the Premier League shows
 * Ronaldo's 2007/08 United card, not the higher-rated Madrid one it excludes.
 */
export function onePerFootballer(players: readonly Player[]): Player[] {
  const chosen = new Set([...representatives(players).values()].map((p) => p.id));
  return players.filter((p) => chosen.has(p.id));
}

/** How many distinct footballers `players` contains. */
export function footballerCount(players: readonly Player[]): number {
  return new Set(players.map((p) => p.identityId)).size;
}
