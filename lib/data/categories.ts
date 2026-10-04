import type { Category, CategoryFilter, CategoryGroup } from '@/lib/domain/types';

/**
 * The wheel.
 *
 * Each category does two jobs at once: it narrows the talent pool you may pick
 * from, and it bends the match engine in a direction that suits the brief. A
 * category you "lose" the draft with can still win you the duel.
 *
 * ## Composing rules
 *
 * Filters are a small algebra — leaf tests plus and/or/not — so a category is
 * usually an arrangement of existing rules rather than a new engine primitive.
 * That is what lets the pool grow without the engine growing with it.
 *
 * ## The goalkeeper problem
 *
 * Goalkeeper attributes reuse the six outfield slots as reflexes, handling,
 * kicking, speed, positioning and aerial. So a rule like "dribbling 84+" reads
 * a keeper's *speed*, which no keeper has, and the category ends up with no
 * keeper and cannot field a legal eleven. Style categories therefore admit
 * keepers on a shot-stopping floor instead, and say so in the brief.
 *
 * ## Every category has to be playable
 *
 * A category ships only if it can field a legal eleven: eleven different
 * footballers, a keeper in goal, and every slot filled by a natural or adjacent
 * fit in at least one formation. That is checked, not trusted. A category that
 * fails never reaches the wheel, a challenge or any listing, and
 * `npm run verify` fails until it is fixed or removed. Iron Wall, The Back Line
 * and Ball Winners were removed for this reason: none of them had a single
 * player who could play up front.
 *
 * ## Age means age now
 *
 * A historical card records a footballer's age in a past season. Cristiano
 * Ronaldo's 2007/08 card is twenty-two, and he is not a wonderkid. So any
 * category defined by age judges current-season cards only, through
 * `currentEraOnly`, which by the same stroke leaves out every Icon and every
 * historical Hero. The verifier rejects an age rule that admits a historical
 * card, however the rule is written.
 */

/** Current-season cards only. */
const CURRENT_ERA: CategoryFilter = { kind: 'era', eras: ['current'] };

/**
 * Restricts a rule to footballers as they are now. Wrap every age rule in it
 * rather than repeating the era test inside each category.
 */
export const currentEraOnly = (rule: CategoryFilter): CategoryFilter => ({
  kind: 'and',
  of: [CURRENT_ERA, rule],
});

/** Any goalkeeper who can actually stop a shot. */
const CAPABLE_KEEPER: CategoryFilter = {
  kind: 'and',
  of: [
    { kind: 'position', positions: ['GK'] },
    { kind: 'attrMin', attr: 'pace', value: 78 },
  ],
};

/** An outfield rule, plus keepers judged on reflexes rather than the same stat. */
const withKeepers = (rule: CategoryFilter): CategoryFilter => ({
  kind: 'or',
  of: [{ kind: 'and', of: [{ kind: 'not', of: { kind: 'position', positions: ['GK'] } }, rule] }, CAPABLE_KEEPER],
});

/** Clubs that regularly contest the Champions League in this snapshot. */
const CONTINENTAL_ELITE = [
  'man-city', 'real-madrid', 'bayern', 'psg', 'inter', 'barcelona', 'liverpool',
  'arsenal', 'leverkusen', 'atletico', 'milan', 'dortmund', 'juventus', 'atalanta',
  'leipzig', 'monaco',
];

const BIG_SIX = ['man-city', 'arsenal', 'liverpool', 'chelsea', 'man-united', 'tottenham'];

export const CATEGORY_GROUP_LABEL: Record<CategoryGroup, string> = {
  open: 'Open',
  era: 'Generation',
  competition: 'Competition',
  style: 'Playing style',
  position: 'Shape',
  region: 'Region',
  club: 'Club',
  special: 'Wildcard',
};

export const CATEGORIES: Category[] = [
  /* --------------------------------------------------------------- Open --- */
  {
    id: 'open-play',
    name: 'Open Play',
    wheelLabel: 'Open Play',
    brief: 'No restrictions. Every player in the database is yours.',
    group: 'open',
    rarity: 'standard',
    filter: { kind: 'all' },
    modifier: { label: 'Balanced — no bonus, no excuses' },
  },

  /* --------------------------------------------------------- Generation --- */
  {
    id: 'wonderkids',
    name: 'Wonderkids',
    wheelLabel: 'Wonderkids',
    // Capped at 23 rather than 21 because the youngest current goalkeepers in
    // the dataset are 23, and a category with no keeper cannot field a legal
    // eleven. The threshold follows the data instead of the data being bent to
    // fit the threshold.
    brief: 'Current squads, twenty-three and under. Fearless, inconsistent, capable of anything.',
    group: 'era',
    rarity: 'rare',
    filter: currentEraOnly({ kind: 'maxAge', age: 23 }),
    modifier: { label: 'Fearless: +5% attack, high chaos', attack: 1.05, chaos: 1.45 },
  },
  {
    id: 'breakout-stars',
    name: 'Breakout Stars',
    wheelLabel: 'Breakout',
    brief: 'Current squads, twenty-four to twenty-six. Past the hype, not yet the ceiling.',
    group: 'era',
    rarity: 'standard',
    filter: currentEraOnly({ kind: 'ageRange', min: 24, max: 26 }),
    modifier: { label: 'Rising: +4% attack, +4% midfield', attack: 1.04, midfield: 1.04 },
  },
  {
    id: 'peak-years',
    name: 'Peak Years',
    wheelLabel: 'Peak Years',
    brief: 'Current squads, twenty-seven to twenty-nine. Everything works and nothing hurts yet.',
    group: 'era',
    rarity: 'standard',
    filter: currentEraOnly({ kind: 'ageRange', min: 27, max: 29 }),
    modifier: { label: 'Prime: +5% across the pitch', attack: 1.05, midfield: 1.05, defence: 1.05 },
  },
  {
    id: 'old-guard',
    name: 'Old Guard',
    wheelLabel: 'Old Guard',
    brief: 'Current squads, thirty and over. They have seen every trick already.',
    group: 'era',
    rarity: 'rare',
    filter: currentEraOnly({ kind: 'minAge', age: 30 }),
    modifier: {
      label: 'Game management: +9% defence, +5% midfield, low chaos',
      defence: 1.09,
      midfield: 1.05,
      chaos: 0.7,
    },
  },
  {
    id: 'last-dance',
    name: 'Last Dance',
    wheelLabel: 'Last Dance',
    brief: 'Current squads, thirty-three and up. Legs gone, brains intact.',
    group: 'era',
    rarity: 'legendary',
    filter: currentEraOnly({ kind: 'minAge', age: 33 }),
    modifier: {
      label: 'Guile over gas: +12% midfield, -6% attack, very low chaos',
      midfield: 1.12,
      attack: 0.94,
      chaos: 0.6,
    },
  },

  /* -------------------------------------------------------- Competition --- */
  {
    id: 'premier-league',
    name: 'Premier League',
    wheelLabel: 'Premier',
    brief: 'England only. Relentless tempo, relentless contact.',
    group: 'competition',
    rarity: 'standard',
    filter: { kind: 'league', league: 'premier-league' },
    modifier: { label: 'Intensity: +6% midfield, +4% defence', midfield: 1.06, defence: 1.04 },
  },
  {
    id: 'la-liga',
    name: 'LaLiga',
    wheelLabel: 'LaLiga',
    brief: 'Spain only. Control the ball, control the duel.',
    group: 'competition',
    rarity: 'standard',
    filter: { kind: 'league', league: 'la-liga' },
    modifier: { label: 'Possession: +8% midfield', midfield: 1.08 },
  },
  {
    id: 'serie-a',
    name: 'Serie A',
    wheelLabel: 'Serie A',
    brief: 'Italy only. Concede nothing, punish everything.',
    group: 'competition',
    rarity: 'standard',
    filter: { kind: 'league', league: 'serie-a' },
    modifier: { label: 'Catenaccio: +10% defence, -3% attack', defence: 1.1, attack: 0.97 },
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    wheelLabel: 'Bundesliga',
    brief: 'Germany only. Vertical, fearless, wide open.',
    group: 'competition',
    rarity: 'standard',
    filter: { kind: 'league', league: 'bundesliga' },
    modifier: { label: 'Gegenpress: +7% attack, more chaos', attack: 1.07, chaos: 1.25 },
  },
  {
    id: 'ligue-1',
    name: 'Ligue 1',
    wheelLabel: 'Ligue 1',
    brief: 'France only. Raw athletes and ridiculous teenagers.',
    group: 'competition',
    rarity: 'standard',
    filter: { kind: 'league', league: 'ligue-1' },
    modifier: { label: 'Athleticism: +6% attack', attack: 1.06 },
  },
  {
    id: 'continental-elite',
    name: 'Continental Elite',
    wheelLabel: 'Elite',
    brief: 'Only clubs who expect European nights. No hiding places.',
    group: 'competition',
    rarity: 'rare',
    filter: { kind: 'club', clubIds: CONTINENTAL_ELITE },
    modifier: { label: 'Big-game pedigree: +6% attack, +6% midfield', attack: 1.06, midfield: 1.06 },
  },

  /* ------------------------------------------------------ Playing style --- */
  {
    id: 'pace-merchants',
    name: 'Pace Merchants',
    wheelLabel: 'Pace',
    brief: 'Outfielders with pace 84 or above. Keepers judged on reflexes.',
    group: 'style',
    rarity: 'rare',
    filter: withKeepers({ kind: 'attrMin', attr: 'pace', value: 84 }),
    modifier: { label: 'On the counter: +11% attack, -6% defence', attack: 1.11, defence: 0.94 },
  },
  {
    id: 'dribblers',
    name: 'Dribblers',
    wheelLabel: 'Dribblers',
    brief: 'Dribbling 84 or above, keepers on reflexes. Take the full-back on.',
    group: 'style',
    rarity: 'rare',
    filter: withKeepers({ kind: 'attrMin', attr: 'dribbling', value: 84 }),
    modifier: { label: 'Carry it: +9% attack, high chaos', attack: 1.09, chaos: 1.3 },
  },
  {
    id: 'playmakers',
    name: 'Playmakers',
    wheelLabel: 'Playmakers',
    brief: 'Passing 84 or above, keepers on reflexes. Somebody has to see the pass.',
    group: 'style',
    rarity: 'rare',
    filter: withKeepers({ kind: 'attrMin', attr: 'passing', value: 84 }),
    modifier: { label: 'Through the lines: +12% midfield', midfield: 1.12 },
  },
  // Finishers (shooting 82+) was removed on 2026-09-19 at the product owner's
  // call: its pool has no natural centre-back and one natural full-back, so any
  // eleven fields a defence of midfielders playing out of role.
  {
    id: 'target-men',
    name: 'Target Men',
    wheelLabel: 'Target Men',
    brief: 'Physical 84 or above, keepers on reflexes. Win the first ball and the second.',
    group: 'style',
    rarity: 'rare',
    filter: withKeepers({ kind: 'attrMin', attr: 'physical', value: 84 }),
    modifier: { label: 'Route one: +8% attack, +6% defence', attack: 1.08, defence: 1.06 },
  },
  {
    id: 'engine-room',
    name: 'Engine Room',
    wheelLabel: 'Engine',
    brief: 'Passing 76 and physical 78, keepers on reflexes. Runs all afternoon.',
    group: 'style',
    rarity: 'rare',
    filter: withKeepers({
      kind: 'and',
      of: [
        { kind: 'attrMin', attr: 'passing', value: 76 },
        { kind: 'attrMin', attr: 'physical', value: 78 },
      ],
    }),
    modifier: { label: 'Relentless: +9% midfield, +5% defence', midfield: 1.09, defence: 1.05 },
  },
  {
    id: 'livewires',
    name: 'Livewires',
    wheelLabel: 'Livewires',
    brief: 'Pace 86 and dribbling 82, keepers on reflexes. Impossible to sit against.',
    group: 'style',
    rarity: 'legendary',
    filter: withKeepers({
      kind: 'and',
      of: [
        { kind: 'attrMin', attr: 'pace', value: 86 },
        { kind: 'attrMin', attr: 'dribbling', value: 82 },
      ],
    }),
    modifier: { label: 'Chaos on the break: +14% attack, -8% defence', attack: 1.14, defence: 0.92, chaos: 1.35 },
  },

  /* --------------------------------------------------------------- Shape --- */
  {
    id: 'midfield-maze',
    name: 'Midfield Maze',
    wheelLabel: 'Midfield',
    brief: 'Goalkeepers and midfielders only. Pass your way to a goal.',
    group: 'position',
    rarity: 'legendary',
    filter: { kind: 'position', positions: ['GK', 'MID'] },
    modifier: { label: 'Total control: +15% midfield, -8% attack', midfield: 1.15, attack: 0.92 },
  },
  {
    id: 'no-strikers',
    name: 'No Strikers',
    wheelLabel: 'No Strikers',
    brief: 'Not a recognised forward in sight. Goals from deep or not at all.',
    group: 'position',
    rarity: 'rare',
    filter: { kind: 'not', of: { kind: 'position', positions: ['FWD'] } },
    modifier: { label: 'False nine: +8% midfield, -6% attack', midfield: 1.08, attack: 0.94 },
  },
  {
    id: 'wing-play',
    name: 'Wing Play',
    wheelLabel: 'Wing Play',
    brief: 'Players comfortable in wide areas, plus a keeper. Get to the byline.',
    group: 'position',
    rarity: 'rare',
    filter: {
      kind: 'or',
      of: [
        { kind: 'position', positions: ['GK'] },
        { kind: 'role', roles: ['LW', 'RW', 'LM', 'RM', 'LWB', 'RWB', 'LB', 'RB'] },
      ],
    },
    modifier: { label: 'Width: +8% attack, more chaos', attack: 1.08, chaos: 1.2 },
  },
  {
    id: 'the-spine',
    name: 'The Spine',
    wheelLabel: 'The Spine',
    brief: 'Keeper, centre-backs, central midfielders, centre-forwards. Straight down the middle.',
    group: 'position',
    rarity: 'rare',
    filter: {
      kind: 'or',
      of: [
        { kind: 'position', positions: ['GK'] },
        { kind: 'role', roles: ['CB', 'CDM', 'CM', 'CAM', 'ST', 'CF'] },
      ],
    },
    modifier: { label: 'Solid through the middle: +7% defence, +5% midfield', defence: 1.07, midfield: 1.05 },
  },

  /* -------------------------------------------------------------- Region --- */
  {
    id: 'samba-line',
    name: 'Samba Line',
    wheelLabel: 'Samba',
    brief: 'South America only. Joy first, structure second.',
    group: 'region',
    rarity: 'rare',
    filter: { kind: 'continent', continent: 'South America' },
    modifier: { label: 'Flair: +8% attack, -4% defence', attack: 1.08, defence: 0.96, chaos: 1.2 },
  },
  {
    id: 'african-power',
    name: 'African Power',
    wheelLabel: 'Africa',
    brief: 'Africa only. Explosive from the first whistle.',
    group: 'region',
    rarity: 'rare',
    filter: { kind: 'continent', continent: 'Africa' },
    modifier: { label: 'Explosive: +7% attack, +5% midfield', attack: 1.07, midfield: 1.05 },
  },
  {
    id: 'old-continent',
    name: 'Old Continent',
    wheelLabel: 'Europe',
    brief: 'Europe only. Drilled, organised, hard to surprise.',
    group: 'region',
    rarity: 'standard',
    filter: { kind: 'continent', continent: 'Europe' },
    modifier: { label: 'Organised: +6% defence, +4% midfield', defence: 1.06, midfield: 1.04 },
  },
  {
    id: 'rest-of-world',
    name: 'Rest of the World',
    wheelLabel: 'World',
    brief: 'Every nationality outside Europe. A different football education.',
    group: 'region',
    rarity: 'rare',
    filter: { kind: 'not', of: { kind: 'continent', continent: 'Europe' } },
    modifier: { label: 'Unfamiliar rhythms: +7% attack, more chaos', attack: 1.07, chaos: 1.25 },
  },
  {
    id: 'iberian',
    name: 'Iberian',
    wheelLabel: 'Iberia',
    brief: 'Spain and Portugal. Keep it, move it, keep it again.',
    group: 'region',
    rarity: 'rare',
    filter: { kind: 'nation', nations: ['Spain', 'Portugal'] },
    modifier: { label: 'Tiki-taka: +10% midfield', midfield: 1.1 },
  },
  {
    id: 'les-bleus',
    name: 'Les Bleus',
    wheelLabel: 'France',
    brief: 'France only. Athletes with technique to match.',
    group: 'region',
    rarity: 'rare',
    filter: { kind: 'nation', nations: ['France'] },
    modifier: { label: 'Complete: +5% everywhere', attack: 1.05, midfield: 1.05, defence: 1.05 },
  },
  {
    id: 'three-lions',
    name: 'Three Lions',
    wheelLabel: 'England',
    brief: 'England only. Tempo, transitions and set pieces.',
    group: 'region',
    rarity: 'rare',
    filter: { kind: 'nation', nations: ['England'] },
    modifier: { label: 'Front foot: +7% attack, +4% physical duel', attack: 1.07, defence: 1.04 },
  },

  /* ---------------------------------------------------------------- Club --- */
  {
    id: 'clasico-blood',
    name: 'Clasico Blood',
    wheelLabel: 'Clasico',
    brief: 'Real Madrid and Barcelona only. The two biggest squads in the game.',
    group: 'club',
    rarity: 'legendary',
    filter: { kind: 'club', clubIds: ['real-madrid', 'barcelona'] },
    modifier: { label: 'Galactico: +9% attack, +4% midfield', attack: 1.09, midfield: 1.04 },
  },
  {
    id: 'big-six',
    name: 'Big Six',
    wheelLabel: 'Big Six',
    brief: 'The six English clubs who never stop spending.',
    group: 'club',
    rarity: 'rare',
    filter: { kind: 'club', clubIds: BIG_SIX },
    modifier: { label: 'Deep squads: +7% attack, +5% midfield', attack: 1.07, midfield: 1.05 },
  },
  {
    id: 'milan-derby',
    name: 'Milan Derby',
    wheelLabel: 'Milan',
    brief: 'Inter and Milan. One city, one stadium, no friendship.',
    group: 'club',
    rarity: 'legendary',
    filter: { kind: 'club', clubIds: ['inter', 'milan'] },
    modifier: { label: 'Derby tension: +9% defence, high chaos', defence: 1.09, chaos: 1.35 },
  },
  {
    id: 'german-giants',
    name: 'German Giants',
    wheelLabel: 'German',
    brief: 'Bayern, Dortmund and Leverkusen. Power and directness.',
    group: 'club',
    rarity: 'rare',
    filter: { kind: 'club', clubIds: ['bayern', 'dortmund', 'leverkusen'] },
    modifier: { label: 'Vertical: +9% attack, more chaos', attack: 1.09, chaos: 1.2 },
  },
  {
    id: 'madrid-derby',
    name: 'Madrid Derby',
    wheelLabel: 'Madrid',
    brief: 'Real Madrid and Atletico. Glamour against grit.',
    group: 'club',
    rarity: 'legendary',
    filter: { kind: 'club', clubIds: ['real-madrid', 'atletico'] },
    modifier: { label: 'Two philosophies: +7% attack, +7% defence', attack: 1.07, defence: 1.07 },
  },

  /* ------------------------------------------------------------ Wildcard --- */
  {
    id: 'wrong-foot',
    name: 'Wrong Foot',
    wheelLabel: 'Left Foot',
    brief: 'Left-footed players only. Everything arrives from an odd angle.',
    group: 'special',
    rarity: 'rare',
    filter: { kind: 'foot', foot: 'L' },
    modifier: { label: 'Unpredictable: +6% attack, high chaos', attack: 1.06, chaos: 1.4 },
  },
  {
    id: 'right-foot',
    name: 'Right Foot',
    wheelLabel: 'Right Foot',
    brief: 'Right-footed players only. The orthodox eleven.',
    group: 'special',
    rarity: 'standard',
    filter: { kind: 'foot', foot: 'R' },
    modifier: { label: 'Orthodox: +4% midfield, low chaos', midfield: 1.04, chaos: 0.85 },
  },
  {
    id: 'bargain-hunters',
    name: 'Bargain Hunters',
    wheelLabel: 'Bargain',
    brief: 'Current squads valued at 25m or less. Prove money is not the point.',
    group: 'special',
    rarity: 'legendary',
    filter: { kind: 'maxValue', value: 25 },
    modifier: { label: 'Nothing to lose: +6% midfield, big chaos', midfield: 1.06, chaos: 1.55 },
  },
  {
    id: 'underdogs',
    name: 'Underdogs',
    wheelLabel: 'Underdogs',
    brief: 'Ratings 74 to 83 only. No superstars are coming to save you.',
    group: 'special',
    rarity: 'legendary',
    filter: { kind: 'ratingRange', min: 74, max: 83 },
    modifier: { label: 'Giant-killers: +8% defence, huge chaos', defence: 1.08, chaos: 1.6 },
  },
  {
    id: 'galacticos',
    name: 'Galacticos',
    wheelLabel: 'Galacticos',
    brief: 'Current squads valued at 35m and up. The most expensive eleven you can name.',
    group: 'special',
    rarity: 'legendary',
    filter: { kind: 'minValue', value: 35 },
    modifier: { label: 'Star power: +10% attack, +6% midfield', attack: 1.1, midfield: 1.06 },
  },
  {
    id: 'icons-only',
    name: 'Icons Only',
    wheelLabel: 'Icons',
    brief: 'Icon cards alone. The all-time greats, from their historical seasons.',
    group: 'special',
    rarity: 'legendary',
    // Selects the Icon classification, not a rating band. Before historical
    // versions existed this read "rated 90+", which would now hand Icon status
    // to any current player or Hero who happens to rate that high.
    filter: { kind: 'cardType', types: ['icon'] },
    modifier: { label: 'Untouchable: +10% everywhere, low chaos', attack: 1.1, midfield: 1.1, defence: 1.1, chaos: 0.8 },
  },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function requireCategory(id: string): Category {
  const c = CATEGORY_BY_ID.get(id);
  if (!c) throw new Error(`Unknown category id: ${id}`);
  return c;
}

export const RARITY_META: Record<
  Category['rarity'],
  { label: string; token: string; ring: string }
> = {
  standard: { label: 'Standard', token: 'var(--color-ink-soft)', ring: 'var(--color-line-strong)' },
  rare: { label: 'Rare', token: 'var(--color-away)', ring: 'var(--color-away-deep)' },
  legendary: { label: 'Legendary', token: 'var(--color-gold)', ring: 'var(--color-gold)' },
};
