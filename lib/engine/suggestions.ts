/**
 * Category suggestions from players.
 *
 * FutDuel has no server to send them to, so a suggestion is kept in this
 * browser and nowhere else, and the UI says so. It never touches the category
 * engine: a suggestion is an idea written down, not a rule that can be played.
 */

import type { CategorySuggestion } from '@/lib/domain/types';

export type { CategorySuggestion };

export const SUGGESTION_LIMITS = {
  name: { min: 3, max: 40 },
  description: { min: 12, max: 240 },
  rule: { max: 300 },
  /** Saved on this device at most; the oldest drop off. */
  kept: 25,
} as const;

export type SuggestionField = 'name' | 'description' | 'rule';

export interface SuggestionInput {
  name: string;
  description: string;
  rule?: string;
}

export interface SuggestionCheck {
  ok: boolean;
  errors: Partial<Record<SuggestionField, string>>;
  /** The input as it would be saved: trimmed, with runs of spaces collapsed. */
  value: { name: string; description: string; rule: string };
}

const tidy = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
const letters = (text: string) => (text.match(/\p{L}/gu) ?? []).length;
const key = (text: string) => tidy(text).toLowerCase();

/**
 * Whether a suggestion can be saved. Refuses the empty, the too short and the
 * too long, text with too few letters to be words, a name FutDuel already has
 * as a category, and a repeat of a suggestion already saved here.
 */
export function checkSuggestion(
  input: SuggestionInput,
  context: { categoryNames: readonly string[]; saved: readonly CategorySuggestion[] },
): SuggestionCheck {
  const value = { name: tidy(input.name), description: tidy(input.description), rule: tidy(input.rule) };
  const errors: SuggestionCheck['errors'] = {};
  const { name, description, rule } = SUGGESTION_LIMITS;

  if (!value.name) errors.name = 'Give the category a name.';
  else if (value.name.length < name.min) errors.name = `A name needs at least ${name.min} characters.`;
  else if (value.name.length > name.max) errors.name = `Keep the name to ${name.max} characters.`;
  else if (letters(value.name) < 2) errors.name = 'The name needs some letters in it.';
  else if (context.categoryNames.some((existing) => key(existing) === key(value.name))) {
    errors.name = `FutDuel already has a category called ${value.name}.`;
  } else if (context.saved.some((saved) => key(saved.name) === key(value.name))) {
    errors.name = 'You have already suggested a category with this name.';
  }

  if (!value.description) errors.description = 'Say what the category is about.';
  else if (value.description.length < description.min) {
    errors.description = `Describe it in at least ${description.min} characters.`;
  } else if (value.description.length > description.max) {
    errors.description = `Keep the description to ${description.max} characters.`;
  } else if (letters(value.description) < 6) errors.description = 'The description needs a few words.';

  if (value.rule.length > rule.max) errors.rule = `Keep the rule idea to ${rule.max} characters.`;

  return { ok: Object.keys(errors).length === 0, errors, value };
}
