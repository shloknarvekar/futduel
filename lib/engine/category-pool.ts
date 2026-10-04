import type { Category, CategoryFilter } from '@/lib/domain/types';
import { CATEGORIES } from '@/lib/data/categories';
import { coverageFor, poolFor } from './filters';

/**
 * The categories the game may use.
 *
 * Categories are data, and data is checked rather than trusted. Every category
 * is judged here once, and only those that pass are active. The wheel, weekly
 * challenges, challenge codes, listings and the ladder all read the active
 * list, so a broken category cannot reach a player by any route, and
 * `npm run verify` fails while one is defined at all.
 */

/** Whether a rule tests a player's age anywhere inside it, including under a negation. */
export function usesAgeRule(filter: CategoryFilter): boolean {
  switch (filter.kind) {
    case 'maxAge':
    case 'minAge':
    case 'ageRange':
      return true;
    case 'and':
    case 'or':
      return filter.of.some(usesAgeRule);
    case 'not':
      return usesAgeRule(filter.of);
    default:
      return false;
  }
}

export interface CategoryVerdict {
  category: Category;
  /** Why the category cannot be used. Empty when it can. */
  problems: string[];
}

export function judgeCategory(category: Category): CategoryVerdict {
  const problems: string[] = [];
  const coverage = coverageFor(category);

  if (!coverage.viable) {
    const { GK, DEF, MID, FWD } = coverage.byPosition;
    problems.push(
      `cannot field a legal eleven: no formation fills every slot with a different footballer in a natural or adjacent role (GK ${GK}, DEF ${DEF}, MID ${MID}, FWD ${FWD})`,
    );
  }

  // Age is judged on footballers as they are now. However the rule is written,
  // a historical card must never qualify through the age it had in a past
  // season.
  if (usesAgeRule(category.filter)) {
    const historical = poolFor(category).filter((p) => p.era !== 'current');
    if (historical.length > 0) {
      const sample = historical.slice(0, 3).map((p) => `${p.name} ${p.season}`).join(', ');
      problems.push(
        `age rule admits ${historical.length} historical card${historical.length === 1 ? '' : 's'} (${sample}); wrap it in currentEraOnly`,
      );
    }
  }

  return { category, problems };
}

export const CATEGORY_VERDICTS: CategoryVerdict[] = CATEGORIES.map(judgeCategory);

export const ACTIVE_CATEGORIES: Category[] = CATEGORY_VERDICTS.filter((v) => v.problems.length === 0).map(
  (v) => v.category,
);

/** Defined but unusable. Always empty in a build that passes `npm run verify`. */
export const REJECTED_CATEGORIES: CategoryVerdict[] = CATEGORY_VERDICTS.filter((v) => v.problems.length > 0);

export const ACTIVE_CATEGORY_BY_ID = new Map(ACTIVE_CATEGORIES.map((c) => [c.id, c]));

if (REJECTED_CATEGORIES.length > 0 && process.env.NODE_ENV !== 'production') {
  // Kept out of play either way; said out loud while developing.
  console.warn(
    `FutDuel: ${REJECTED_CATEGORIES.length} categor${REJECTED_CATEGORIES.length === 1 ? 'y is' : 'ies are'} not in play — ` +
      REJECTED_CATEGORIES.map((v) => `${v.category.name}: ${v.problems.join('; ')}`).join(' | '),
  );
}
