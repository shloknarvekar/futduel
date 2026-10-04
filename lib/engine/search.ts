import type { Player } from '@/lib/domain/types';

/**
 * Finding one footballer by name.
 *
 * This is the search behind Manual mode, where the manager is supposed to know
 * who they want. It is deliberately not autocomplete: a fragment like "ron"
 * matches a third of the database, and listing those is a recommendation by
 * another name. So a match has to be *confident* — the query has to identify
 * someone — and only a handful of the best are returned.
 *
 * The bar is a score, not a character count, because a character count is
 * wrong at both ends: it locks out "Gavi", who has four letters in his whole
 * name, and it lets "ronal" through at five. What matters is how much of a
 * name the query actually pins down.
 *
 * Typing errors are forgiven only once the query is long enough for an error
 * to be obvious rather than ambiguous: "cristinao ronaldo" is plainly meant to
 * be Cristiano Ronaldo, while "ronal" is not plainly anything.
 */

/** Lowercase, accent-free, punctuation reduced to spaces, whitespace collapsed. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The shortest query worth searching at all. */
export const SEARCH_MIN_LENGTH = 2;
/** A match below this is not confident enough to show. */
export const SEARCH_CONFIDENCE = 0.72;
/** Never more than a handful, however many nearly match. */
export const SEARCH_RESULT_LIMIT = 5;
/** Below this length a typo is indistinguishable from a different name. */
const FUZZY_MIN_LENGTH = 6;

/** How many single-character errors are forgiven at a given query length. */
function allowedDistance(length: number): number {
  if (length >= 9) return 2;
  if (length >= FUZZY_MIN_LENGTH) return 1;
  return 0;
}

/**
 * Levenshtein distance, abandoned as soon as it exceeds `max`. Returns -1 when
 * it does, so callers never pay for distances they would reject anyway.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return -1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
      current.push(value);
      if (value < rowBest) rowBest = value;
    }
    if (rowBest > max) return -1;
    previous = current;
  }
  const distance = previous[b.length]!;
  return distance > max ? -1 : distance;
}

/**
 * How well one query word identifies one name word, 0 (not at all) to 1 (it is
 * that word). A prefix only counts when it covers most of the word, so "ronal"
 * does not claim "Ronaldo" but "ronald" does.
 */
function wordScore(query: string, word: string): number {
  if (query === word) return 1;

  if (word.startsWith(query)) {
    const coverage = query.length / word.length;
    if (query.length >= 4 && coverage >= 0.75) return 0.72 + coverage * 0.2;
    return 0;
  }

  if (query.length >= FUZZY_MIN_LENGTH) {
    const distance = editDistance(query, word, allowedDistance(query.length));
    if (distance >= 0) return Math.max(0, 0.92 - distance * 0.12);
  }
  return 0;
}

/** The best score for `query` against one written form of a name. */
function nameScore(query: string, name: string): number {
  if (!name) return 0;
  if (query === name) return 1;

  const queryWords = query.split(' ').filter(Boolean);
  const nameWords = name.split(' ').filter(Boolean);
  let best = 0;

  // The query as a prefix of the whole name: "cristiano ron" is unmistakable
  // even though "ron" alone identifies nobody. The bar is the same as a single
  // word's, because for a one-word name — Ronaldinho, or Ronaldo's short name —
  // this rule and the word rule are looking at the same string, and the looser
  // of the two would decide.
  if (name.startsWith(query)) {
    const coverage = query.length / name.length;
    if (query.length >= 4 && coverage >= 0.75) best = Math.max(best, 0.72 + coverage * 0.2);
  }

  // One word of the query against one word of the name, each name word used
  // once, so a repeated word cannot score twice off a single surname.
  const used = new Set<number>();
  let total = 0;
  for (const queryWord of queryWords) {
    let wordBest = 0;
    let wordBestIndex = -1;
    nameWords.forEach((nameWord, index) => {
      if (used.has(index)) return;
      const score = wordScore(queryWord, nameWord);
      if (score > wordBest) {
        wordBest = score;
        wordBestIndex = index;
      }
    });
    // Every word of the query has to land, or the query is about someone else.
    if (wordBest === 0) return best;
    used.add(wordBestIndex);
    total += wordBest;
  }

  const averaged = total / queryWords.length;
  // A single word that identifies a surname is a real hit, but slightly less
  // certain than naming someone in full.
  return Math.max(best, queryWords.length === 1 ? averaged * 0.95 : averaged);
}

export interface SearchMatch {
  player: Player;
  score: number;
}

/**
 * Confident name matches from `pool`, best first.
 *
 * Only names are searched. Club and nationality are how Guided's filters
 * browse a pool; typing "juventus" into Manual would list a squad, which is
 * the recommendation this mode exists to withhold.
 */
export function searchMatches(
  pool: readonly Player[],
  rawQuery: string,
  limit: number = SEARCH_RESULT_LIMIT,
): SearchMatch[] {
  const query = normalizeName(rawQuery);
  if (query.length < SEARCH_MIN_LENGTH) return [];

  const matches: SearchMatch[] = [];
  for (const player of pool) {
    const score = Math.max(
      nameScore(query, normalizeName(player.name)),
      nameScore(query, normalizeName(player.short)),
    );
    if (score >= SEARCH_CONFIDENCE) matches.push({ player, score });
  }

  return matches
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.player.rating - a.player.rating ||
        a.player.id.localeCompare(b.player.id),
    )
    .slice(0, limit);
}

/** Just the players, for callers that do not need the scores. */
export function searchPlayers(
  pool: readonly Player[],
  rawQuery: string,
  limit?: number,
): Player[] {
  return searchMatches(pool, rawQuery, limit).map((m) => m.player);
}
