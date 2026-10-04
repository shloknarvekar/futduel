/**
 * Data integrity check — run with `npm run verify`.
 *
 * A category that cannot field a legal eleven is a broken game, not a broken
 * pixel, so this runs the real engine over the real dataset: every wheel
 * segment is drafted for, at every difficulty, and the resulting elevens are
 * rated. It also sanity-checks the simulator's scoreline distribution, because
 * a match engine that produces 7-6 every week is worse than no engine at all.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import type { Category, CategoryFilter, SlotRole, Squad } from '../lib/domain/types';
import { CATEGORIES, currentEraOnly, requireCategory } from '../lib/data/categories';
import {
  ACTIVE_CATEGORIES,
  ACTIVE_CATEGORY_BY_ID,
  REJECTED_CATEGORIES,
  judgeCategory,
  usesAgeRule,
} from '../lib/engine/category-pool';
import { MANUAL_MIN_SEARCH, MANUAL_RESULT_LIMIT, pickProblem, pickerResults } from '../lib/engine/picker';
import { challengesFor, parseChallengeId } from '../lib/data/challenges';
import { LADDER } from '../lib/data/ladder';
import {
  CURRENT_PLAYERS,
  DATASET_SEASON,
  IDENTITIES,
  LEGEND_PLAYERS,
  PLAYERS,
  PLAYER_BY_ID,
  SINCE_SNAPSHOT,
  versionsOf,
} from '../lib/data/players';
import type { DuelRecord, Player } from '../lib/domain/types';
import { requireFormation } from '../lib/data/formations';
import { PITCH_GEOMETRY, PITCH_VIEWPORTS, slotBoxes, slotCollisions } from '../lib/engine/pitch-layout';
import { applyMove, moveProblem } from '../lib/engine/picker';
import { chosenDraw } from '../lib/engine/wheel';
import { DEFAULT_SETTINGS, createProfile, reconcile } from '../lib/store/profile';
import { HISTORY_KEPT, historyKey, openReplay, replayProblem, resimulate } from '../lib/engine/history';
import { LINEUP_PHASES, lineupsVisible } from '../lib/engine/lineups';
import { SUGGESTION_LIMITS, checkSuggestion, type SuggestionField, type SuggestionInput } from '../lib/engine/suggestions';
import { LEGEND_IDENTITY_BY_ID, ageAtSeasonStart, seasonStart } from '../lib/data/legends';
import { CLUBS, CLUB_BY_ID, HISTORIC_CLUBS, LEAGUES, LEAGUE_BY_ID } from '../lib/data/clubs';
import { FORMATIONS } from '../lib/data/formations';
import { coverageFor, fitFor, legalElevenFor, poolFor, queryPool } from '../lib/engine/filters';
import { AI_MANAGERS, draftSquad, pickOpponent } from '../lib/engine/ai-manager';
import { isSquadComplete, rateSquad } from '../lib/engine/rating';
import { simulateMatch } from '../lib/engine/simulate';
import { isBroadcastMoment, newestFirst } from '../lib/engine/broadcast';
import { ratePlayer } from '../lib/engine/player-rating';
import { NAV_ITEMS, isActive, morphicShape, navItems } from '../components/layout/nav-items';
import { profileMenu } from '../components/layout/profile-menu';
import { THEME_STORAGE_KEY, oppositeScheme, schemeAnnouncement, switchLabel } from '../components/ui/color-scheme';
import {
  SEGMENT_ANGLE,
  SPIN_TURNS,
  WHEEL_SEGMENTS,
  openingDraw,
  pointerOffset,
  sideSeed,
  spin,
} from '../lib/engine/wheel';
import { REVEAL_HOLD_MS, SKIP_REVEAL_MS, spinTarget, spinTiming } from '../lib/engine/spin-timing';
import { createRng, indexFromUint32, isSeed, makeSeed } from '../lib/engine/rng';
import { decodeChallenge, encodeChallenge } from '../lib/engine/share';
import { CURRENT_SHIRT_NUMBERS, LEGEND_SHIRT_NUMBERS } from '../lib/data/shirt-numbers';
import { compareVersions, onePerFootballer, representatives } from '../lib/engine/versions';
import {
  normalizeCurrentSeason,
  normalizeFixtures,
  normalizeLineupStats,
  normalizeRounds,
  normalizeSquads,
  normalizeStandings,
} from '../lib/football/normalize';
import { mergeRefresh, presentFeed } from '../lib/football/feed';
import {
  activeRoundIndex,
  canAdd,
  pickWindow,
  roundDeadline,
  scoreMatch,
  squadRoundPoints,
  validateSquad,
} from '../lib/engine/fantasy-scoring';
import type {
  FantasyPosition,
  FootballFixture,
  FootballRound,
  PlayerMatchStats,
  SquadPlayer,
} from '../lib/football/types';

const failures: string[] = [];
const warnings: string[] = [];

function fail(message: string) {
  failures.push(message);
}

function warn(message: string) {
  warnings.push(message);
}

/* ------------------------------------------------------------------ dataset */

console.log(
  `\nDataset: ${PLAYERS.length} cards (${CURRENT_PLAYERS.length} current, ${LEGEND_PLAYERS.length} historical) · ${IDENTITIES.length} footballers · ${CLUBS.length} current + ${HISTORIC_CLUBS.length} historical clubs · ${CATEGORIES.length} categories · ${FORMATIONS.length} formations\n`,
);

/** Roles from the far end of the pitch that a position can never be listed for. */
const FORBIDDEN_ROLES: Record<string, SlotRole[]> = {
  DEF: ['ST', 'CF', 'LW', 'RW'],
  MID: [],
  FWD: ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'],
};
const ALL_ROLES = new Set<SlotRole>(['GK', 'LB', 'CB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF']);
// The declared leagues, including the other-leagues bucket, which has no
// current club and so cannot be read off the current snapshot.
const KNOWN_LEAGUES = new Set(LEAGUE_BY_ID.keys());

const ids = new Set<string>();
for (const player of PLAYERS) {
  const label = `${player.name} (${player.season})`;
  if (ids.has(player.id)) fail(`Duplicate card id: ${player.id}`);
  ids.add(player.id);

  // Attributes, rating and roles.
  const values = Object.values(player.attributes);
  if (values.length !== 6 || values.some((v) => !Number.isInteger(v) || v < 1 || v > 99)) {
    fail(`${label}: attribute missing or out of range`);
  }
  if (!Number.isInteger(player.rating) || player.rating < 50 || player.rating > 99) fail(`${label}: rating missing or out of range`);
  if (player.roles.length === 0) fail(`${label}: no roles`);
  if (new Set(player.roles).size !== player.roles.length) fail(`${label}: a role is listed twice`);
  if (player.roles.some((r) => !ALL_ROLES.has(r))) fail(`${label}: unknown role in ${player.roles.join(',')}`);
  if (player.position === 'GK' && player.roles.join() !== 'GK') fail(`${label}: keeper with outfield roles`);
  if (player.position !== 'GK' && player.roles.includes('GK')) fail(`${label}: outfielder with the GK role`);
  const forbidden = player.roles.filter((r) => FORBIDDEN_ROLES[player.position]?.includes(r));
  if (forbidden.length > 0) fail(`${label}: impossible role ${forbidden.join(',')} for a ${player.position}`);

  // Club and league must resolve, and agree with each other.
  const club = CLUB_BY_ID.get(player.clubId);
  if (!club) fail(`${label}: unknown club ${player.clubId}`);
  else {
    if (club.name !== player.club) fail(`${label}: club name "${player.club}" does not match ${club.name}`);
    if (club.league !== player.league) fail(`${label}: listed in ${player.league} but ${club.name} play in ${club.league}`);
  }
  if (!KNOWN_LEAGUES.has(player.league)) fail(`${label}: unknown league ${player.league}`);
  if (player.age < 16 || player.age > 45) fail(`${label}: implausible age ${player.age}`);

  // Season, era and card classification.
  try {
    seasonStart(player.season);
  } catch {
    fail(`${label}: malformed season "${player.season}"`);
  }
  if (player.cardType === 'standard' && player.cardReason !== null) fail(`${label}: standard card with a reason`);
  if (player.cardType !== 'standard' && !player.cardReason) fail(`${label}: ${player.cardType} card without a reason`);
}

// Current records: the 2025/26 snapshot, and nothing else, except a verified
// move since then, which carries its own season and a named source.
for (const player of CURRENT_PLAYERS) {
  if (player.era !== 'current') fail(`${player.name}: current-season record not marked current`);
  const expectedSeason = SINCE_SNAPSHOT[player.id]?.season ?? DATASET_SEASON;
  if (player.season !== expectedSeason) fail(`${player.name}: current record describes ${player.season}`);
  if (player.cardType !== 'standard' || player.prime) fail(`${player.name}: current record carries Icon/Hero/prime status`);
  if (player.value === null) fail(`${player.name}: current record has no market value`);
  if (player.id !== player.identityId) fail(`${player.name}: current record id differs from its identity`);
}

// Historical records: a past season, no invented valuation, a real classification.
for (const player of LEGEND_PLAYERS) {
  const label = `${player.name} (${player.season})`;
  const identity = LEGEND_IDENTITY_BY_ID.get(player.identityId);
  if (player.era !== 'legend') fail(`${label}: historical version not marked legend`);
  if (seasonStart(player.season) >= seasonStart(DATASET_SEASON)) fail(`${label}: historical version is not in the past`);
  if (player.value !== null) fail(`${label}: historical version carries a market value`);
  if (!identity) {
    fail(`${label}: no authored identity`);
    continue;
  }
  if (player.age !== ageAtSeasonStart(identity.born, player.season)) fail(`${label}: age disagrees with date of birth`);
  const isIcon = identity.honours.length > 0;
  if (isIcon && player.cardType !== 'icon') fail(`${label}: identity holds Icon honours but the card is ${player.cardType}`);
  if (!isIcon && player.cardType === 'icon') fail(`${label}: Icon card without recorded honours`);
  if (player.cardType === 'hero' && isIcon) fail(`${label}: both Icon and Hero`);
}

// Versions of one footballer must describe the same person, in distinct seasons.
{
  let multiVersion = 0;
  for (const identity of IDENTITIES) {
    const versions = versionsOf(identity.id);
    if (versions.length === 0) fail(`${identity.name}: identity with no versions`);
    if (versions.length > 1) multiVersion += 1;
    for (const v of versions) {
      if (v.name !== identity.name || v.nation !== identity.nation || v.foot !== identity.foot) {
        fail(`${identity.name}: version ${v.id} disagrees on name, nation or foot`);
      }
    }
    const seasons = versions.map((v) => v.season);
    if (new Set(seasons).size !== seasons.length) fail(`${identity.name}: two versions describe the same season`);
  }
  // A current record that shares a name with a legend but not an identity would
  // mean the same person was split in two.
  const byName = new Map<string, Set<string>>();
  for (const p of PLAYERS) byName.set(p.name, (byName.get(p.name) ?? new Set()).add(p.identityId));
  for (const [name, set] of byName) if (set.size > 1) fail(`${name}: split across identities ${[...set].join(', ')}`);

  const tally = <K extends string>(key: (p: (typeof LEGEND_PLAYERS)[number]) => K) => {
    const m = new Map<K, number>();
    for (const p of LEGEND_PLAYERS) m.set(key(p), (m.get(key(p)) ?? 0) + 1);
    return [...m].map(([k, n]) => `${k} ${n}`).join(', ');
  };
  const icons = new Set(LEGEND_PLAYERS.filter((p) => p.cardType === 'icon').map((p) => p.identityId));
  console.log('Historical versions');
  console.log(`  ${LEGEND_PLAYERS.length} versions of ${new Set(LEGEND_PLAYERS.map((p) => p.identityId)).size} footballers, ${LEGEND_PLAYERS.filter((p) => p.prime).length} prime`);
  console.log(`  card types: ${tally((p) => p.cardType)} (${icons.size} Icon footballers)`);
  console.log(`  positions: ${tally((p) => p.position)}`);
  console.log(`  icon positions: ${[...['GK', 'DEF', 'MID', 'FWD']].map((pos) => `${pos} ${LEGEND_PLAYERS.filter((p) => p.cardType === 'icon' && p.position === pos).length}`).join(', ')}`);
  console.log(`  leagues: ${tally((p) => p.league)}`);
  console.log(`  footballers with more than one version: ${multiVersion}\n`);
  if (multiVersion === 0) fail('No footballer has more than one version');
  for (const pos of ['GK', 'DEF', 'MID', 'FWD'] as const) {
    if (LEGEND_PLAYERS.filter((p) => p.position === pos).length < 8) fail(`Too few historical ${pos}s to build elevens`);
  }
}

for (const club of CLUBS) {
  const squad = CURRENT_PLAYERS.filter((p) => p.clubId === club.id);
  if (squad.length === 0) fail(`${club.name}: no players`);
  if (!squad.some((p) => p.position === 'GK')) warn(`${club.name}: no goalkeeper in the database`);
}

/* --------------------------------------------------------------- categories */

console.log(`Categories (${CATEGORIES.length})`);
{
  const seen = new Set<string>();
  const groups = new Map<string, number>();
  for (const category of CATEGORIES) {
    if (seen.has(category.id)) fail(`Duplicate category id: ${category.id}`);
    seen.add(category.id);
    if (!category.group) fail(`${category.name}: no group`);
    if (!category.wheelLabel) fail(`${category.name}: no wheel label`);
    groups.set(category.group, (groups.get(category.group) ?? 0) + 1);
  }
  console.log(
    '  groups: ' + [...groups].map(([g, n]) => `${g} ${n}`).join(', '),
  );
}

/**
 * Re-checks a legal eleven from first principles rather than trusting the
 * solver that produced it: complete, all eligible, eleven different
 * footballers, a keeper in goal and nowhere else, and no slot filled out of
 * position.
 */
function elevenProblems(squad: Squad, pool: readonly { id: string }[]): string[] {
  const problems: string[] = [];
  const formation = FORMATIONS.find((f) => f.id === squad.formationId);
  if (!formation) return [`unknown formation ${squad.formationId}`];
  const eligible = new Set(pool.map((p) => p.id));
  const people = new Set<string>();
  for (const slot of formation.slots) {
    const id = squad.picks[slot.id];
    const player = id ? PLAYER_BY_ID.get(id) : undefined;
    if (!player) {
      problems.push(`${slot.role} empty`);
      continue;
    }
    if (!eligible.has(player.id)) problems.push(`${player.id} not eligible`);
    if (people.has(player.identityId)) problems.push(`${player.identityId} fielded twice`);
    people.add(player.identityId);
    if ((slot.role === 'GK') !== (player.position === 'GK')) problems.push(`${player.id} in ${slot.role}`);
    if (fitFor(player, slot.role) === 'out-of-position') problems.push(`${player.id} out of position at ${slot.role}`);
  }
  return problems;
}

// Every defined category must be in play. The active list drops a broken one
// on its own, so this is what stops it from disappearing quietly.
for (const { category, problems } of REJECTED_CATEGORIES) {
  fail(`${category.name}: not in play — ${problems.join('; ')}`);
}
if (ACTIVE_CATEGORIES.length !== CATEGORIES.length) {
  fail(`${CATEGORIES.length} categories defined but only ${ACTIVE_CATEGORIES.length} in play`);
}
if (WHEEL_SEGMENTS.length !== ACTIVE_CATEGORIES.length) fail('The wheel does not show exactly the active categories');

for (const category of CATEGORIES) {
  const coverage = coverageFor(category);
  const pool = poolFor(category);
  const label = category.name.padEnd(18);

  const eleven = legalElevenFor(pool);
  if (!coverage.viable || !eleven) {
    fail(`${category.name}: cannot field a legal eleven (${coverage.total} players, ${coverage.byPosition.GK} keepers, ${coverage.byPosition.FWD} forwards)`);
    continue;
  }
  const witness = elevenProblems(eleven, pool);
  if (witness.length > 0) fail(`${category.name}: its proof eleven is not legal (${witness.join(', ')})`);
  if (!WHEEL_SEGMENTS.some((c) => c.id === category.id)) {
    fail(`${category.name}: viable but missing from the wheel`);
  }
  if (coverage.byPosition.GK < 2) warn(`${category.name}: only ${coverage.byPosition.GK} keeper(s)`);
  if (pool.length < 22) warn(`${category.name}: thin pool (${pool.length})`);
  if (coverage.outfield < 10) fail(`${category.name}: only ${coverage.outfield} outfielders`);

  // Every rule must actually select on something. A filter that matched the
  // whole database would be a label, not a category.
  if (category.id !== 'open-play' && pool.length === PLAYERS.length) {
    fail(`${category.name}: rule selects every player, so it restricts nothing`);
  }

  const overalls: number[] = [];
  for (const difficulty of ['amateur', 'pro', 'elite'] as const) {
    const squad = draftSquad(category, difficulty, `verify:${category.id}`);
    if (!isSquadComplete(squad)) {
      fail(`${category.name} / ${difficulty}: AI could not complete an eleven`);
      continue;
    }
    overalls.push(rateSquad(squad).overall);
  }

  const keepers = new Set(pool.filter((p) => p.position === 'GK').map((p) => p.identityId)).size;
  console.log(
    `  ${label} pool ${String(pool.length).padStart(3)}  GK ${String(keepers).padStart(2)}  DEF ${String(coverage.byPosition.DEF).padStart(3)}  MID ${String(coverage.byPosition.MID).padStart(3)}  FWD ${String(coverage.byPosition.FWD).padStart(3)}  legal XI ${eleven.formationId.padEnd(7)} AI ${overalls.map((n) => n.toFixed(1)).join(' / ')}`,
  );
}

/* ------------------------------------------------------- category integrity */

console.log('\nCategory integrity');
{
  const fixture = (id: string, filter: CategoryFilter): Category => ({
    id: `fixture-${id}`,
    name: `Fixture ${id}`,
    wheelLabel: id,
    brief: 'Verification fixture.',
    group: 'special',
    rarity: 'standard',
    filter,
    modifier: { label: 'none' },
  });
  const keeperOr = (rule: CategoryFilter): CategoryFilter => ({
    kind: 'or',
    of: [
      { kind: 'and', of: [{ kind: 'not', of: { kind: 'position', positions: ['GK'] } }, rule] },
      { kind: 'and', of: [{ kind: 'position', positions: ['GK'] }, { kind: 'attrMin', attr: 'pace', value: 78 }] },
    ],
  });

  // E. The removed categories are gone from every surface a player can reach.
  const removed = [
    { id: 'iron-wall', name: 'Iron Wall' },
    { id: 'the-back-line', name: 'The Back Line' },
    { id: 'ball-winners', name: 'Ball Winners' },
  ];
  const weeks = Array.from({ length: 520 }, (_, i) => new Date(Date.UTC(2024, 7, 12) + i * 7 * 86_400_000));
  const challengeIds = new Set(weeks.flatMap((date) => challengesFor(date).map((c) => c.categoryId)));
  const drawn = new Set(Array.from({ length: 3000 }, (_, i) => spin(`removed-${i}`).category.id));
  const signatures = new Set(LADDER.map((entry) => entry.signature));
  for (const { id, name } of removed) {
    if (CATEGORIES.some((c) => c.id === id)) fail(`${name} is still defined`);
    if (ACTIVE_CATEGORY_BY_ID.has(id) || WHEEL_SEGMENTS.some((c) => c.id === id)) fail(`${name} is still in play`);
    if (challengeIds.has(id)) fail(`${name} can still be a weekly challenge`);
    if (drawn.has(id)) fail(`${name} can still be drawn`);
    if (signatures.has(name)) fail(`${name} still appears on the ladder`);
    if (parseChallengeId(`w100-${id}-pro`) !== null) fail(`A challenge link can still open ${name}`);
    let encodable = true;
    try {
      encodeChallenge({ seed: 'REMOVED1', categoryId: id, squad: draftSquad(requireCategory('open-play'), 'pro', 'x'), managerName: 'X' });
    } catch {
      encodable = false;
    }
    if (encodable) fail(`A challenge code can still carry ${name}`);
  }
  console.log(`  categories defined ${CATEGORIES.length}, in play ${ACTIVE_CATEGORIES.length}, on the wheel ${WHEEL_SEGMENTS.length}`);
  console.log(`  removed (${removed.map((r) => r.name).join(', ')}): absent from the wheel, ${weeks.length} weeks of challenges, the ladder, links and codes`);

  // The checks that removed them would catch them again. Their original rules
  // are rebuilt here as fixtures and must be refused.
  const regressions: [string, CategoryFilter][] = [
    ['iron-wall', keeperOr({ kind: 'attrMin', attr: 'defending', value: 82 })],
    ['ball-winners', keeperOr({ kind: 'attrMin', attr: 'defending', value: 80 })],
    ['the-back-line', { kind: 'position', positions: ['GK', 'DEF'] }],
  ];
  for (const [id, filter] of regressions) {
    const verdict = judgeCategory(fixture(id, filter));
    if (!verdict.problems.some((p) => p.startsWith('cannot field a legal eleven'))) {
      fail(`The viability check would let the old ${id} rule back in`);
    }
  }
  console.log('  old Iron Wall, Ball Winners and Back Line rules rebuilt as fixtures: all refused');

  // An age rule written without currentEraOnly — plainly or under a negation —
  // is refused too, and it is refused for exactly the bug it would reintroduce.
  const rawAge = fixture('raw-age', { kind: 'maxAge', age: 23 });
  if (!poolFor(rawAge).some((p) => p.id === 'cristiano-ronaldo-2007-08')) {
    fail('Fixture no longer reproduces the historical wonderkid bug');
  }
  for (const filter of [
    { kind: 'maxAge', age: 23 },
    { kind: 'not', of: { kind: 'minAge', age: 30 } },
    { kind: 'and', of: [{ kind: 'league', league: 'premier-league' }, { kind: 'ageRange', min: 20, max: 25 }] },
  ] satisfies CategoryFilter[]) {
    const verdict = judgeCategory(fixture(`age-${JSON.stringify(filter).length}`, filter));
    if (!verdict.problems.some((p) => p.startsWith('age rule admits'))) {
      fail(`An age rule that admits historical cards was accepted: ${JSON.stringify(filter)}`);
    }
  }
  const wrapped = judgeCategory(fixture('wrapped-age', currentEraOnly({ kind: 'maxAge', age: 23 })));
  if (wrapped.problems.length > 0) fail(`currentEraOnly(maxAge 23) was refused: ${wrapped.problems.join('; ')}`);
  console.log('  unwrapped or negated age rules refused; currentEraOnly accepted');
}

/* ------------------------------------------------------------- age categories */

console.log('\nAge categories judge current players only');
{
  const ageCategories = ACTIVE_CATEGORIES.filter((c) => usesAgeRule(c.filter));
  const expected = ['wonderkids', 'breakout-stars', 'peak-years', 'old-guard', 'last-dance'];
  if (JSON.stringify(ageCategories.map((c) => c.id)) !== JSON.stringify(expected)) {
    fail(`Age categories are ${ageCategories.map((c) => c.id).join(', ')}; expected ${expected.join(', ')}`);
  }

  // B. Historical versions of every kind stay out, whatever age their card records.
  const namedHistoric = [
    'cristiano-ronaldo-2007-08',
    'cristiano-ronaldo-2013-14',
    'cristiano-ronaldo-2018-19',
    'lionel-messi-2011-12',
    'lionel-messi-2014-15',
    'ronaldo-nazario-1996-97',
    'wayne-rooney-2009-10',
  ];
  for (const id of namedHistoric) if (!PLAYER_BY_ID.has(id)) fail(`Expected historical card ${id} does not exist`);

  for (const category of ageCategories) {
    const pool = poolFor(category);
    const legends = pool.filter((p) => p.era !== 'current');
    const icons = pool.filter((p) => p.cardType === 'icon');
    const heroes = pool.filter((p) => p.cardType === 'hero');
    if (legends.length + icons.length + heroes.length > 0) {
      fail(`${category.name} admits ${legends.length} historical, ${icons.length} Icon and ${heroes.length} Hero cards`);
    }
    for (const id of namedHistoric) if (pool.some((p) => p.id === id)) fail(`${category.name} admits ${id}`);
    // Guided recommendations and a Manual search are both drawn from this pool.
    for (const role of ['ST', 'RW', 'LW'] as SlotRole[]) {
      const suggested = pickerResults(pool, { assistance: 'guided', search: '', position: 'ALL', role, isUnavailable: () => false });
      if (suggested.players.some((p) => p.era !== 'current')) fail(`${category.name} suggests a historical card at ${role}`);
    }
    const searched = pickerResults(pool, { assistance: 'manual', search: 'ronaldo', position: 'ALL', role: 'ST', isUnavailable: () => false });
    if (searched.players.some((p) => p.identityId === 'cristiano-ronaldo' || p.era !== 'current')) {
      fail(`${category.name}: searching "ronaldo" finds a historical card`);
    }
    const ages = pool.map((p) => p.age);
    console.log(
      `  ${category.name.padEnd(15)} ${String(pool.length).padStart(3)} current cards, ages ${Math.min(...ages)}–${Math.max(...ages)}, historical 0, Icon 0, Hero 0`,
    );
  }

  // The same rule written without the wrapper is exactly the bug.
  const unwrapped = PLAYERS.filter((p) => p.age <= 23 && p.era === 'legend');
  console.log(
    `  without the rule, 23-and-under would admit ${unwrapped.length} historical cards, e.g. ${unwrapped
      .filter((p) => p.identityId === 'cristiano-ronaldo' || p.identityId === 'ronaldo-nazario')
      .map((p) => `${p.name} ${p.season} (${p.age})`)
      .join(', ')}`,
  );

  // C. A genuine current young player still qualifies, and still gets suggested.
  const wonderkids = poolFor(requireCategory('wonderkids'));
  const yamal = PLAYER_BY_ID.get('lamine-yamal');
  if (!yamal || yamal.era !== 'current') fail('Lamine Yamal is missing as a current card');
  else if (!wonderkids.some((p) => p.id === yamal.id)) fail('Lamine Yamal does not qualify for Wonderkids');
  else {
    const atRW = pickerResults(wonderkids, { assistance: 'guided', search: '', position: 'ALL', role: 'RW', isUnavailable: () => false });
    const rank = atRW.players.findIndex((p) => p.id === yamal.id);
    if (rank < 0) fail('Lamine Yamal is not suggested at RW in Wonderkids');
    console.log(`  Lamine Yamal (${yamal.age}, ${yamal.club}) qualifies for Wonderkids; suggested #${rank + 1} at RW`);
  }
}

/* ------------------------------------------------------ Ronaldo at Juventus */

console.log('\nCristiano Ronaldo, Juventus 2018/19');
{
  const id = 'cristiano-ronaldo-2018-19';
  const card = PLAYER_BY_ID.get(id);
  const versions = versionsOf('cristiano-ronaldo');
  const expectedIds = ['cristiano-ronaldo-2007-08', 'cristiano-ronaldo-2013-14', id];

  if (!card) fail('Cristiano Ronaldo has no Juventus card');
  else {
    const facts = {
      identityId: card.identityId === 'cristiano-ronaldo',
      club: card.clubId === 'juventus' && card.club === 'Juventus',
      league: card.league === 'serie-a',
      season: card.season === '2018/19',
      era: card.era === 'legend',
      cardType: card.cardType === 'icon',
      age: card.age === 33,
      shirt: card.shirtNumber === 7,
      value: card.value === null,
    };
    const wrong = Object.entries(facts).filter(([, ok]) => !ok).map(([key]) => key);
    if (wrong.length > 0) fail(`Ronaldo's Juventus card has the wrong ${wrong.join(', ')}`);
    console.log(
      `  ${card.name}, ${card.club} ${card.season}, ${card.league}, age ${card.age}, ${card.cardType} (${card.cardReason}), rated ${card.rating}, shirt ${card.shirtNumber}`,
    );
  }

  // Still one footballer, and his other versions untouched.
  if (JSON.stringify(versions.map((p) => p.id)) !== JSON.stringify(expectedIds)) {
    fail(`Ronaldo versions are ${versions.map((p) => p.id).join(', ')}`);
  }
  if (IDENTITIES.filter((i) => i.id === 'cristiano-ronaldo').length !== 1) fail('Cristiano Ronaldo exists as more than one identity');
  if (IDENTITIES.some((i) => i.id !== 'cristiano-ronaldo' && i.name === 'Cristiano Ronaldo')) fail('A second Cristiano Ronaldo identity exists');
  const united = PLAYER_BY_ID.get('cristiano-ronaldo-2007-08');
  const madrid = PLAYER_BY_ID.get('cristiano-ronaldo-2013-14');
  if (united?.clubId !== 'man-united' || madrid?.clubId !== 'real-madrid') fail('An existing Ronaldo version changed club');
  console.log(`  versions: ${versions.map((p) => `${p.season} ${p.club} (${p.rating})`).join(' · ')}`);

  // Discover shows one card for him, and the detail view lists all three.
  const shown = onePerFootballer(PLAYERS).filter((p) => p.identityId === 'cristiano-ronaldo');
  if (shown.length !== 1) fail(`Discover shows ${shown.length} Ronaldo cards`);
  const inSerieA = onePerFootballer(poolFor(requireCategory('serie-a'))).filter((p) => p.identityId === 'cristiano-ronaldo');
  if (inSerieA.length !== 1 || inSerieA[0]!.id !== id) fail('Discover filtered to Serie A does not show the Juventus card');
  console.log(`  Discover: one card (${shown[0]?.season}); filtered to Serie A it is the Juventus card; detail lists ${versions.length}`);

  // D. Selectable wherever the category allows him, and nowhere it does not.
  // Each checked against the card by hand: pace 85, shooting 93, passing 81,
  // dribbling 86, physical 80, roles LW/ST, Portuguese, right-footed, Icon, no
  // value, and outside every age category because the card is historical.
  const expectedIn = [
    'open-play', 'serie-a', 'continental-elite', 'pace-merchants', 'dribblers', 'engine-room',
    'wing-play', 'the-spine', 'old-continent', 'iberian', 'right-foot', 'icons-only',
  ];
  const actuallyIn = ACTIVE_CATEGORIES.filter((c) => poolFor(c).some((p) => p.id === id)).map((c) => c.id);
  if (JSON.stringify(actuallyIn) !== JSON.stringify(expectedIn)) {
    fail(`Juventus Ronaldo is eligible in ${actuallyIn.join(', ')}; expected ${expectedIn.join(', ')}`);
  }
  const empty = draftSquad(requireCategory('open-play'), 'pro', 'juve').formationId;
  for (const categoryId of actuallyIn) {
    const pool = poolFor(requireCategory(categoryId));
    const squad: Squad = { formationId: empty, picks: Object.fromEntries(FORMATIONS.find((f) => f.id === empty)!.slots.map((s) => [s.id, null])) };
    const slot = FORMATIONS.find((f) => f.id === empty)!.slots.find((s) => s.role !== 'GK')!;
    const problem = pickProblem(PLAYER_BY_ID.get(id)!, { squad, slotId: slot.id, eligibleIds: new Set(pool.map((p) => p.id)) });
    if (problem) fail(`Juventus Ronaldo cannot be picked in ${categoryId}: ${problem}`);
    const found = pickerResults(pool, { assistance: 'manual', search: 'cristiano ronaldo', position: 'FWD', role: 'LW', isUnavailable: () => false });
    if (categoryId === 'serie-a' && !found.players.some((p) => p.id === id)) fail('Searching "cristiano ronaldo" in Serie A does not find him');
    const byClub = pickerResults(pool, { assistance: 'manual', search: 'juventus', position: 'FWD', role: 'LW', isUnavailable: () => false });
    if (byClub.players.length > 0) fail('Manual answers a club name with a squad list');
  }
  console.log(`  eligible and pickable in ${actuallyIn.join(', ')}`);

  // H. Three versions, still one footballer in any eleven.
  const base = draftSquad(requireCategory('open-play'), 'pro', 'versions');
  const formation = FORMATIONS.find((f) => f.id === base.formationId)!;
  const [first, second] = formation.slots.filter((s) => s.role !== 'GK');
  const withMadrid: Squad = {
    ...base,
    picks: { ...Object.fromEntries(formation.slots.map((s) => [s.id, null])), [first!.id]: 'cristiano-ronaldo-2013-14' },
  };
  const openIds = new Set(poolFor(requireCategory('open-play')).map((p) => p.id));
  const blockedElsewhere = pickProblem(card!, { squad: withMadrid, slotId: second!.id, eligibleIds: openIds });
  const swapInPlace = pickProblem(card!, { squad: withMadrid, slotId: first!.id, eligibleIds: openIds });
  const unitedElsewhere = pickProblem(PLAYER_BY_ID.get('cristiano-ronaldo-2007-08')!, { squad: withMadrid, slotId: second!.id, eligibleIds: openIds });
  if (blockedElsewhere !== 'already-in-eleven') fail('The Juventus card can join an eleven that already has Ronaldo');
  if (unitedElsewhere !== 'already-in-eleven') fail('The United card can join an eleven that already has Ronaldo');
  if (swapInPlace !== null) fail('One Ronaldo version cannot replace another in the same slot');
  const crafted = { ...base, picks: { ...base.picks, [first!.id]: 'cristiano-ronaldo-2013-14', [second!.id]: id } };
  const code = decodeChallenge(encodeChallenge({ seed: 'JUVE0001', categoryId: 'open-play', squad: crafted, managerName: 'X' }));
  if (code.ok || code.reason !== 'squad') fail('A code fielding Madrid and Juventus Ronaldo together was accepted');
  console.log('  second Ronaldo version refused in another slot, swapped in place, and refused in a challenge code');
}

/* ---------------------------------------------------------- build assistance */

console.log('\nBuild assistance');
{
  const samples: [string, SlotRole][] = [
    ['open-play', 'ST'],
    ['wonderkids', 'RW'],
    ['serie-a', 'CB'],
    ['icons-only', 'CAM'],
    ['african-power', 'GK'],
  ];
  let compared = 0;
  for (const [categoryId, role] of samples) {
    const pool = poolFor(requireCategory(categoryId));
    const base = { position: 'ALL' as const, role, isUnavailable: () => false };

    // G. Guided is the recommendation list the builder has always shown.
    const guided = pickerResults(pool, { ...base, assistance: 'guided', search: '' });
    const before = queryPool(pool, { role });
    if (guided.awaitingSearch || JSON.stringify(guided.players.map((p) => p.id)) !== JSON.stringify(before.map((p) => p.id))) {
      fail(`${categoryId}/${role}: Guided no longer lists the recommendations it used to`);
    }
    if (guided.players[0] && fitFor(guided.players[0], role) !== 'natural' && before.some((p) => fitFor(p, role) === 'natural')) {
      fail(`${categoryId}/${role}: Guided does not lead with a natural fit`);
    }

    // F. Manual recommends nobody…
    for (const search of ['', ' ', 'a'.repeat(MANUAL_MIN_SEARCH - 1)]) {
      const manual = pickerResults(pool, { ...base, assistance: 'manual', search });
      if (!manual.awaitingSearch || manual.players.length > 0) fail(`${categoryId}/${role}: Manual lists players before a search ("${search}")`);
    }

    // …and a fragment is not a search: it identifies nobody, so it lists
    // nobody, however many names happen to begin with it.
    for (const search of ['ro', 'ron', 'mad', 'an']) {
      const m = pickerResults(pool, { ...base, assistance: 'manual', search });
      if (m.players.length > 0) {
        fail(`${categoryId}/${role}: Manual answers the fragment "${search}" with ${m.players.length} players`);
      }
      compared += 1;
    }

    // What it does return is a short, eligible, relevance-ordered list.
    for (const search of ['ronaldo', 'messi', 'rodri']) {
      const m = pickerResults(pool, { ...base, assistance: 'manual', search });
      if (m.players.length > MANUAL_RESULT_LIMIT) {
        fail(`${categoryId}/${role} "${search}": Manual returned ${m.players.length} players, over the ${MANUAL_RESULT_LIMIT} limit`);
      }
      if (m.players.some((p) => !pool.includes(p))) fail(`${categoryId}/${role} "${search}": Manual found an ineligible player`);
      compared += 1;
    }
  }

  // Unavailable players are listed after available ones in both modes.
  const open = poolFor(requireCategory('open-play'));
  const blocked = new Set(open.filter((p) => p.name.toLowerCase().includes('ro')).slice(0, 3).map((p) => p.id));
  for (const assistance of ['guided', 'manual'] as const) {
    const list = pickerResults(open, { assistance, search: 'ro', position: 'ALL', role: 'ST', isUnavailable: (p) => blocked.has(p.id) }).players;
    const firstBlocked = list.findIndex((p) => blocked.has(p.id));
    if (firstBlocked >= 0 && list.slice(firstBlocked).some((p) => !blocked.has(p.id))) fail(`${assistance}: unavailable players are not listed last`);
  }

  // The pick rule takes no assistance mode at all, so it cannot differ between them.
  if (pickProblem.length !== 2) fail('pickProblem signature changed; check it still ignores build assistance');
  const ineligible = PLAYER_BY_ID.get('cristiano-ronaldo-2007-08')!;
  const squad = draftSquad(requireCategory('wonderkids'), 'pro', 'assist');
  const slot = FORMATIONS.find((f) => f.id === squad.formationId)!.slots.find((s) => s.role !== 'GK')!;
  if (pickProblem(ineligible, { squad, slotId: slot.id, eligibleIds: new Set(poolFor(requireCategory('wonderkids')).map((p) => p.id)) }) !== 'not-eligible') {
    fail('Historical Ronaldo can be placed in a Wonderkids eleven');
  }
  if (pickProblem(ineligible, { squad, slotId: 'no-such-slot', eligibleIds: new Set([ineligible.id]) }) !== 'unknown-slot') {
    fail('A pick into a slot the formation does not have was accepted');
  }
  console.log(`  Guided keeps the ranked recommendations; Manual lists nobody before ${MANUAL_MIN_SEARCH} letters`);
  console.log(`  Manual withheld every fragment and capped every hit at ${MANUAL_RESULT_LIMIT}, over ${compared} searches`);
  console.log('  one pick rule for both modes: ineligible, duplicate-footballer and unknown-slot picks refused');
}

/* ------------------------------------------------------ historical versions */

console.log('\nHistorical versions in play');
{
  const inPool = (categoryId: string, predicate: (p: (typeof PLAYERS)[number]) => boolean) =>
    poolFor(requireCategory(categoryId)).filter(predicate);

  // Icons Only selects the classification, and only it.
  const icons = poolFor(requireCategory('icons-only'));
  if (icons.length === 0) fail('Icons Only selects no Icon');
  if (icons.some((p) => p.cardType !== 'icon')) fail('Icons Only admits a card that is not an Icon');
  const allIcons = PLAYERS.filter((p) => p.cardType === 'icon').length;
  if (icons.length !== allIcons) fail(`Icons Only selects ${icons.length} of ${allIcons} Icon cards`);
  console.log(`  Icons Only: ${icons.length} Icon cards, e.g. ${icons.slice(0, 3).map((p) => `${p.name} ${p.season}`).join(', ')}`);

  // Every league reaches its own historical versions, and no other league's.
  for (const league of ['premier-league', 'la-liga', 'serie-a', 'bundesliga', 'ligue-1'] as const) {
    const historic = inPool(league, (p) => p.era === 'legend');
    const expected = LEGEND_PLAYERS.filter((p) => p.league === league).length;
    if (historic.length === 0) fail(`${league}: no historical version is selectable`);
    if (historic.length !== expected) fail(`${league}: selects ${historic.length} of ${expected} historical versions`);
    if (historic.some((p) => CLUB_BY_ID.get(p.clubId)?.league !== league)) fail(`${league}: admits a version from another league`);
    const sample = historic[0];
    console.log(`  ${league.padEnd(15)} ${String(historic.length).padStart(2)} historical, e.g. ${sample ? `${sample.name} ${sample.season} ${sample.club}` : 'none'}`);
  }

  // Named examples from the brief resolve to the right category.
  const expectIn = (categoryId: string, id: string) => {
    if (!PLAYER_BY_ID.has(id)) fail(`Expected card ${id} does not exist`);
    else if (!poolFor(requireCategory(categoryId)).some((p) => p.id === id)) fail(`${id} is not selectable in ${categoryId}`);
  };
  expectIn('premier-league', 'cristiano-ronaldo-2007-08');
  expectIn('premier-league', 'thierry-henry-2003-04');
  expectIn('premier-league', 'didier-drogba-2009-10');
  expectIn('la-liga', 'lionel-messi-2011-12');
  expectIn('la-liga', 'cristiano-ronaldo-2013-14');
  expectIn('serie-a', 'paolo-maldini-1993-94');
  expectIn('bundesliga', 'oliver-kahn-2000-01');
  expectIn('ligue-1', 'juninho-pernambucano-2004-05');
  expectIn('icons-only', 'zinedine-zidane-2001-02');
  expectIn('big-six', 'steven-gerrard-2008-09');
  expectIn('milan-derby', 'javier-zanetti-2009-10');

  // Current and historical cards stay distinguishable.
  const neuer = versionsOf('manuel-neuer');
  const eras = neuer.map((p) => `${p.season} ${p.era}`).join(', ');
  if (neuer.length !== 2 || new Set(neuer.map((p) => p.era)).size !== 2) fail(`Manuel Neuer should have a current and a historical card (${eras})`);
  console.log(`  current and historical side by side: Manuel Neuer ${eras}`);

  // Multiple versions of one footballer coexist in a pool as separate cards…
  const ronaldo = inPool('open-play', (p) => p.identityId === 'cristiano-ronaldo');
  if (ronaldo.length < 2) fail('Open Play does not offer both Cristiano Ronaldo versions');
  console.log(`  Cristiano Ronaldo in Open Play: ${ronaldo.map((p) => `${p.season} ${p.club}`).join(' / ')}`);

  // …but never start together: not from the AI…
  let doubled = 0;
  for (const category of CATEGORIES) {
    for (const difficulty of ['amateur', 'pro', 'elite'] as const) {
      for (let i = 0; i < 6; i++) {
        const squad = draftSquad(category, difficulty, `identity-${i}`);
        const people = Object.values(squad.picks).flatMap((id) => (id ? [PLAYER_BY_ID.get(id)!.identityId] : []));
        if (new Set(people).size !== people.length) doubled += 1;
      }
    }
  }
  if (doubled > 0) fail(`${doubled} AI elevens fielded the same footballer twice`);
  console.log(`  AI elevens fielding one footballer twice: ${doubled} of ${CATEGORIES.length * 18}`);

  // …nor from a hand-crafted challenge code.
  const open = requireCategory('open-play');
  const base = draftSquad(open, 'pro', 'crafted');
  const formation = FORMATIONS.find((f) => f.id === base.formationId)!;
  const [first, second] = formation.slots.filter((s) => s.role !== 'GK');
  const crafted = {
    ...base,
    picks: { ...base.picks, [first!.id]: 'cristiano-ronaldo-2007-08', [second!.id]: 'cristiano-ronaldo-2013-14' },
  };
  const rejected = decodeChallenge(encodeChallenge({ seed: 'CRAFT01', categoryId: open.id, squad: crafted, managerName: 'X' }));
  if (rejected.ok || rejected.reason !== 'squad') fail('A code fielding two versions of one footballer was accepted');
  else console.log('  challenge code with two versions of one footballer: rejected');

  // Historical cards travel in challenge codes intact.
  const legends = draftSquad(requireCategory('icons-only'), 'elite', 'legend-code');
  const legendCode = decodeChallenge(encodeChallenge({ seed: 'LEGEND01', categoryId: 'icons-only', squad: legends, managerName: 'L' }));
  if (!legendCode.ok || JSON.stringify(legendCode.payload.squad.picks) !== JSON.stringify(legends.picks)) {
    fail('An eleven of historical cards did not survive a challenge code');
  } else console.log('  eleven of Icon cards round-trips through a challenge code');

  // Seed → category → pool → eleven → match, end to end, twice.
  const chain = (seed: string) => {
    const { category } = spin(seed);
    const pool = poolFor(category).map((p) => p.id).join();
    const home = draftSquad(category, 'pro', `${seed}:h`);
    const away = draftSquad(category, 'elite', `${seed}:a`);
    const result = simulateMatch({
      seed,
      home: { name: 'H', squad: home, rating: rateSquad(home), category },
      away: { name: 'A', squad: away, rating: rateSquad(away), category },
    });
    return JSON.stringify({ category: category.id, pool, home: home.picks, away: away.picks, result });
  };
  let divergent = 0;
  for (let i = 0; i < 40; i++) if (chain(`CHAIN${i}`) !== chain(`CHAIN${i}`)) divergent += 1;
  if (divergent > 0) fail(`${divergent} seeds produced a different category, pool, eleven or match on replay`);
  console.log(`  seed to category, pool, elevens and match replays identically: ${divergent === 0 ? 'yes' : 'NO'} (40 seeds)`);
}

/* ---------------------------------------------------------------- simulator */

console.log('\nSimulator (200 duels between evenly matched pro squads)');
{
  const open = ACTIVE_CATEGORIES[0]!;
  let goals = 0;
  let homeWins = 0;
  let draws = 0;
  let biggest = 0;

  for (let i = 0; i < 200; i++) {
    const home = draftSquad(open, 'pro', `sim-h-${i}`);
    const away = draftSquad(open, 'pro', `sim-a-${i}`);
    const result = simulateMatch({
      seed: `sim-${i}`,
      home: { name: 'H', squad: home, rating: rateSquad(home), category: open },
      away: { name: 'A', squad: away, rating: rateSquad(away), category: open },
    });
    goals += result.homeGoals + result.awayGoals;
    if (result.winner === 'home') homeWins += 1;
    if (result.winner === 'draw') draws += 1;
    biggest = Math.max(biggest, result.homeGoals + result.awayGoals);
  }

  const perMatch = goals / 200;
  console.log(`  goals per match ${perMatch.toFixed(2)}  draws ${((draws / 200) * 100).toFixed(0)}%  home wins ${((homeWins / 200) * 100).toFixed(0)}%  busiest ${biggest} goals`);

  if (perMatch < 1.6 || perMatch > 4.4) fail(`Unrealistic scoring rate: ${perMatch.toFixed(2)} goals per match`);
  if (draws / 200 > 0.42) warn(`High draw rate: ${((draws / 200) * 100).toFixed(0)}%`);
}

/* ---------------------------------------------------------- determinism */

console.log('\nDeterminism');
{
  const open = ACTIVE_CATEGORIES[0]!;
  const home = draftSquad(open, 'pro', 'det-h');
  const away = draftSquad(open, 'pro', 'det-a');
  const run = () =>
    simulateMatch({
      seed: 'DETERMIN',
      home: { name: 'H', squad: home, rating: rateSquad(home), category: open },
      away: { name: 'A', squad: away, rating: rateSquad(away), category: open },
    });
  const a = run();
  const b = run();
  if (a.homeGoals !== b.homeGoals || a.awayGoals !== b.awayGoals || a.events.length !== b.events.length) {
    fail('Same seed produced two different matches');
  } else {
    console.log(`  same seed replays identically (${a.homeGoals}-${a.awayGoals}, ${a.events.length} events)`);
  }
}

/* -------------------------------------------------------------------- wheel */

console.log('\nWheel');
{
  // The wheel is told where to stop by the engine, so the engine has to be
  // right about it. Anything outside half a wedge would leave the pointer
  // sitting on a different category than the one that was drawn.
  const limit = SEGMENT_ANGLE / 2;
  let worst = 0;
  let rewinds = 0;
  let drifted = 0;

  for (let i = 0; i < 500; i++) {
    const outcome = spin(`wheel-${i}`);
    worst = Math.max(worst, Math.abs(pointerOffset(outcome.rotation, outcome.segmentIndex)));

    // Chain a second spin from where the first stopped: it must always travel
    // forwards, and must draw the same category regardless of the start angle.
    const chained = spin(`wheel-next-${i}`, { from: outcome.rotation });
    if (chained.rotation <= outcome.rotation) rewinds += 1;
    worst = Math.max(worst, Math.abs(pointerOffset(chained.rotation, chained.segmentIndex)));

    const fromZero = spin(`wheel-next-${i}`);
    if (fromZero.category.id !== chained.category.id) drifted += 1;
  }

  console.log(`  worst pointer offset ${worst.toFixed(2)}deg of ${limit.toFixed(2)}deg allowed`);
  console.log(`  forward-only across chained spins: ${rewinds === 0 ? 'yes' : 'NO'}`);
  console.log(`  draw independent of start angle: ${drifted === 0 ? 'yes' : 'NO'}`);

  // Timing policy. The wheel is the signature interaction, so "it looked fast
  // enough" is not a test.
  const full = spinTiming(false);
  const reduced = spinTiming(true);
  console.log(`  full spin ${(full.spinMs / 1000).toFixed(1)}s, reveals at ${(full.revealAtMs / 1000).toFixed(1)}s over ${full.turns} turns`);
  console.log(`  reduced spin ${(reduced.spinMs / 1000).toFixed(1)}s, reveals at ${(reduced.revealAtMs / 1000).toFixed(1)}s`);

  if (full.spinMs < 5000 || full.spinMs > 7000) {
    fail(`Full spin is ${full.spinMs}ms; it must sit between 5s and 7s of visible rotation`);
  }
  if (full.revealAtMs <= full.spinMs) fail('Category can be revealed before the wheel stops');
  if (reduced.revealAtMs <= reduced.spinMs) fail('Reduced-motion reveal precedes the wheel stopping');
  if (reduced.spinMs < 600) fail('Reduced-motion spin is too brief to read as a transition');
  if (full.turns < 3) fail(`Full spin only travels ${full.turns} turns`);

  // Dropping whole turns for reduced motion must not move the landing.
  for (let i = 0; i < 200; i++) {
    const outcome = spin(`timing-${i}`);
    const reducedTarget = spinTarget(outcome.rotation, true);
    const offset = Math.abs(pointerOffset(reducedTarget, outcome.segmentIndex));
    if (offset >= limit) fail(`Reduced-motion spin lands ${offset.toFixed(2)}deg off centre`);
    if (reducedTarget !== outcome.rotation - SPIN_TURNS * 360) fail('Reduced target is not a whole-turn reduction');
  }
  console.log('  reduced motion lands on the same wedge as the full spin');

  if (worst >= limit) fail(`Wheel can stop ${worst.toFixed(2)}deg from a wedge centre (limit ${limit.toFixed(2)}deg)`);
  if (rewinds > 0) fail(`${rewinds} chained spins rotated backwards`);
  if (drifted > 0) fail(`${drifted} spins changed category when started from a different angle`);

  // Skipping only shortens the wait: the lock still holds, and never longer
  // than a normal reveal would have.
  if (SKIP_REVEAL_MS <= 0 || SKIP_REVEAL_MS >= REVEAL_HOLD_MS) {
    fail(`Skip hold is ${SKIP_REVEAL_MS}ms; it must be positive and shorter than the ${REVEAL_HOLD_MS}ms reveal hold`);
  }

}

/* ----------------------------------------------------------- wheel fairness */

console.log('\nWheel fairness');
{
  // Every category on the wheel is exactly as likely as every other: the draw
  // is one uniform index into the candidates, with no weight for rarity, group,
  // difficulty or anything else. Until 2026-09-19 it weighted Standard 5,
  // Rare 3, Legendary 1, so a standard category came up five times as often as
  // a legendary one while every wedge looked the same size.
  const n = WHEEL_SEGMENTS.length;
  const code = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  if (/weight/i.test(code('lib/engine/wheel.ts'))) fail('The wheel draw carries a weight again');
  if (/RARITY_WEIGHT/.test(code('lib/data/categories.ts'))) fail('A rarity weight table is back beside the categories');
  if (!code('lib/engine/wheel.ts').includes('pool[rng.index(pool.length)]')) fail('The wheel no longer draws one uniform index');
  if (n !== ACTIVE_CATEGORIES.length || WHEEL_SEGMENTS.some((c, i) => c !== ACTIVE_CATEGORIES[i])) fail('The wheel is not exactly the active category pool');
  if (new Set(WHEEL_SEGMENTS.map((c) => c.id)).size !== n) fail('A category is on the wheel twice');
  if (WHEEL_SEGMENTS.some((c) => !c || !ACTIVE_CATEGORY_BY_ID.has(c.id))) fail('The wheel holds a category that is not in play');

  // Equal wedges: the engine's angle and the drawing's angle are the same 360 / N.
  if (Math.abs(SEGMENT_ANGLE * n - 360) > 1e-9) fail(`${n} segments of ${SEGMENT_ANGLE}deg do not make a circle`);
  if (!code('components/duel/Wheel.tsx').includes('const step = 360 / segments.length;')) fail('The wheel drawing no longer gives every wedge the same angle');

  // The index mapping itself, at its edges: every index owns exactly the same
  // number of raw values, and the leftovers (fewer than n) belong to none.
  const RANGE = 2 ** 32;
  let mappingFaults = 0;
  for (const size of [1, 2, 3, 7, 32, 39, n, 41, 97, 1000]) {
    const bucket = Math.floor(RANGE / size);
    const limit = bucket * size;
    if (indexFromUint32(0, size) !== 0) mappingFaults += 1;
    for (let k = 0; k < size; k++) {
      if (indexFromUint32(k * bucket, size) !== k || indexFromUint32((k + 1) * bucket - 1, size) !== k) mappingFaults += 1;
    }
    if (indexFromUint32(limit - 1, size) !== size - 1) mappingFaults += 1;
    if (RANGE - limit >= size) mappingFaults += 1;
    const top = indexFromUint32(RANGE - 1, size);
    if (limit === RANGE ? top !== size - 1 : top !== null) mappingFaults += 1;
  }
  const one = createRng('index-check');
  const twin = createRng('index-check');
  for (let i = 0; i < 20000; i++) {
    const size = 1 + (i % 97);
    const x = one.index(size);
    if (!Number.isInteger(x) || x < 0 || x >= size || x !== twin.index(size)) mappingFaults += 1;
  }
  if (mappingFaults > 0) fail(`${mappingFaults} index mappings fell out of range, off a boundary, or were not reproducible`);

  // The distribution, over a large fixed set of seeds. The seeds are fixed, so
  // the result is the same on every run: this cannot flake, and a weighted or
  // skewed draw fails it by orders of magnitude (the old 5/3/1 weights scored
  // chi-square 9,012 over 40,000 seeds, against a limit of about 72).
  const chiSquareCritical = (df: number) => df * (1 - 2 / (9 * df) + 3.090232 * Math.sqrt(2 / (9 * df))) ** 3; // p = 0.001
  const judge = (label: string, counts: Map<string, number>, samples: number) => {
    const cells = [...counts.values()];
    const expected = samples / cells.length;
    const chi = cells.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    const critical = chiSquareCritical(cells.length - 1);
    const sigma = Math.sqrt(samples * (1 / cells.length) * (1 - 1 / cells.length));
    const worstZ = Math.max(...cells.map((c) => Math.abs(c - expected) / sigma));
    if (cells.some((c) => c === 0)) fail(`${label}: a category was never drawn`);
    if (chi > critical) fail(`${label}: chi-square ${chi.toFixed(1)} exceeds ${critical.toFixed(1)} (p = 0.001), the draw is skewed`);
    if (worstZ > 4.5) fail(`${label}: a category sits ${worstZ.toFixed(1)} standard deviations from its fair share`);
    return { chi, critical, min: Math.min(...cells), max: Math.max(...cells), expected };
  };

  const SAMPLES = n * 1200;
  const home = new Map(WHEEL_SEGMENTS.map((c) => [c.id, 0]));
  const away = new Map(WHEEL_SEGMENTS.map((c) => [c.id, 0]));
  let mismatched = 0;
  let clashes = 0;
  let unstable = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const seed = `fair-${i}`;
    const draw = openingDraw(seed);
    if (!draw.home.category || WHEEL_SEGMENTS[draw.home.segmentIndex] !== draw.home.category) mismatched += 1;
    if (Math.abs(pointerOffset(draw.home.rotation, draw.home.segmentIndex)) >= SEGMENT_ANGLE / 2) mismatched += 1;
    if (draw.away.category.id === draw.home.category.id) clashes += 1;
    home.set(draw.home.category.id, home.get(draw.home.category.id)! + 1);
    away.set(draw.away.category.id, away.get(draw.away.category.id)! + 1);
    if (i % 40 === 0) {
      const again = spin(sideSeed(seed, 'home'));
      if (again.category.id !== draw.home.category.id || again.rotation !== draw.home.rotation) unstable += 1;
    }
  }
  if (mismatched > 0) fail(`${mismatched} draws landed on a wedge other than the category drawn`);
  if (clashes > 0) fail(`${clashes} opponents drew the home category`);
  if (unstable > 0) fail(`${unstable} seeds drew differently the second time`);
  const homeFair = judge('Home draw', home, SAMPLES);
  // The opponent draws evenly from the other N - 1; across many duels that
  // makes it even over all N as well.
  const awayFair = judge('Opponent draw', away, SAMPLES);

  // With one category excluded, the rest share its chance equally.
  const excluded = WHEEL_SEGMENTS[0]!.id;
  const rest = new Map(WHEEL_SEGMENTS.filter((c) => c.id !== excluded).map((c) => [c.id, 0]));
  let leaked = 0;
  for (let i = 0; i < (n - 1) * 1000; i++) {
    const id = spin(`excluded-${i}`, { exclude: [excluded] }).category.id;
    if (id === excluded) leaked += 1;
    else rest.set(id, rest.get(id)! + 1);
  }
  if (leaked > 0) fail(`An excluded category was drawn ${leaked} times`);
  const restFair = judge('Draw with one category excluded', rest, (n - 1) * 1000 - leaked);

  // Rarity no longer bends the odds: each rarity's share is just its share of
  // the categories.
  for (const rarity of ['standard', 'rare', 'legendary'] as const) {
    const categories = WHEEL_SEGMENTS.filter((c) => c.rarity === rarity);
    const drawn = categories.reduce((sum, c) => sum + home.get(c.id)!, 0);
    const p = categories.length / n;
    const z = Math.abs(drawn - SAMPLES * p) / Math.sqrt(SAMPLES * p * (1 - p));
    if (categories.length > 0 && z > 4.5) fail(`${rarity} categories land ${((drawn / SAMPLES) * 100).toFixed(1)}% of the time, not their ${(p * 100).toFixed(1)}% share`);
  }

  console.log(`  ${n} categories, ${n} equal wedges of ${SEGMENT_ANGLE}deg, each drawn 1 in ${n}; no weights anywhere in the draw`);
  console.log(
    `  ${SAMPLES} seeds: every category ${homeFair.min}–${homeFair.max} times (expected ${homeFair.expected}), chi-square ${homeFair.chi.toFixed(1)} vs ${homeFair.critical.toFixed(1)} at p = 0.001`,
  );
  console.log(
    `  opponent draw chi-square ${awayFair.chi.toFixed(1)}; one excluded ${restFair.chi.toFixed(1)} vs ${restFair.critical.toFixed(1)}; index mapping exact at every boundary; same seed, same wedge`,
  );
}

/* ------------------------------------------------------------ home draw */

console.log('\nHome page draw');
{
  // The home page wheel spins the home side from a fresh seed and hands only
  // that seed to the builder. The builder draws again. If these ever diverged,
  // the category a player saw locked would not be the one they build under.
  let mismatched = 0;
  let unstable = 0;
  let clashes = 0;
  let angleDependent = 0;

  for (let i = 0; i < 400; i++) {
    const seed = makeSeed();
    if (!isSeed(seed)) fail(`makeSeed produced ${seed}, which isSeed rejects`);

    // What the home page shows: the hook's spin from wherever the wheel was left.
    const from = (i * 997) % 7200;
    const shown = spin(sideSeed(seed, 'home'), { from });
    // What the builder opens on.
    const opened = openingDraw(seed);
    // What the arena would have drawn for both sides from the same seed.
    const arenaHome = spin(sideSeed(seed, 'home'));
    const arenaAway = spin(sideSeed(seed, 'away'), { exclude: [arenaHome.category.id] });

    if (shown.category.id !== opened.home.category.id || opened.home.category.id !== arenaHome.category.id) mismatched += 1;
    if (opened.away.category.id !== arenaAway.category.id) mismatched += 1;
    if (opened.home.category.id === opened.away.category.id) clashes += 1;
    if (shown.segmentIndex !== opened.home.segmentIndex) angleDependent += 1;

    const again = openingDraw(seed);
    if (again.home.category.id !== opened.home.category.id || again.away.category.id !== opened.away.category.id) unstable += 1;
  }

  const rejected = ['', 'abcdefgh', 'ABCDEFG', 'ABCDEFGHJ', 'ABCDEFG0', 'ABCDEFGI', 'ABCD EFG', '<script>', 'ABCDEFGH:home'];
  const wronglyAccepted = rejected.filter((value) => isSeed(value));

  console.log(`  home page draw matches the builder and the arena: ${mismatched === 0 ? 'yes' : 'NO'}`);
  console.log(`  same seed redraws identically: ${unstable === 0 ? 'yes' : 'NO'}`);
  console.log(`  opponent never shares the drawn category: ${clashes === 0 ? 'yes' : 'NO'}`);
  console.log(`  malformed draw links rejected: ${wronglyAccepted.length === 0 ? 'yes' : 'NO'}`);

  if (mismatched > 0) fail(`${mismatched} home page draws opened the builder on a different category`);
  if (unstable > 0) fail(`${unstable} seeds redrew a different category`);
  if (clashes > 0) fail(`${clashes} draws gave both sides the same category`);
  if (angleDependent > 0) fail(`${angleDependent} home page draws changed wedge with the wheel's start angle`);
  if (wronglyAccepted.length > 0) fail(`isSeed accepted ${wronglyAccepted.join(', ')}`);
}

/* ------------------------------------------------------------- broadcast */

console.log('\nBroadcast playback');
{
  // The live feed derives the score from the event stream as the clock
  // advances, while the result screen reports the engine totals. If those two
  // ever disagreed, watching a match and skipping it would show different
  // scores. This asserts they cannot.
  const open = ACTIVE_CATEGORIES[0]!;
  let mismatches = 0;
  let prefixBreaks = 0;

  for (let i = 0; i < 150; i++) {
    const home = draftSquad(open, 'pro', `bc-h-${i}`);
    const away = draftSquad(open, 'pro', `bc-a-${i}`);
    const result = simulateMatch({
      seed: `bc-${i}`,
      home: { name: 'H', squad: home, rating: rateSquad(home), category: open },
      away: { name: 'A', squad: away, rating: rateSquad(away), category: open },
    });

    const lastMinute = result.events.reduce((m, e) => Math.max(m, e.minute), 90);

    // Full playback: the score at the final minute must equal the engine total.
    const countTo = (minute: number) => {
      let h = 0;
      let a = 0;
      for (const e of result.events) {
        if (e.minute > minute || e.type !== 'goal') continue;
        if (e.side === 'home') h += 1;
        else if (e.side === 'away') a += 1;
      }
      return [h, a] as const;
    };

    const [fh, fa] = countTo(lastMinute);
    if (fh !== result.homeGoals || fa !== result.awayGoals) mismatches += 1;

    // Skipping sets the clock straight to the final minute, so it reads the
    // same value. Also check the score never decreases as the clock advances.
    let prevH = 0;
    let prevA = 0;
    for (let m = 0; m <= lastMinute; m++) {
      const [h, a] = countTo(m);
      if (h < prevH || a < prevA) prefixBreaks += 1;
      prevH = h;
      prevA = a;
    }
  }

  console.log(`  feed score matches engine total at full time: ${mismatches === 0 ? 'yes' : 'NO'}`);
  console.log(`  score never rewinds as the clock advances: ${prefixBreaks === 0 ? 'yes' : 'NO'}`);

  if (mismatches > 0) fail(`${mismatches} matches where the live feed disagreed with the final score`);
  if (prefixBreaks > 0) fail(`${prefixBreaks} points where the running score went backwards`);

  // The feed is read newest first, and the order is a view: it never changes
  // which events exist, and an arriving event never re-keys the ones shown.
  const sample = ['kickoff', 'chance', 'goal', 'whistle'];
  const ordered = newestFirst(sample);
  if (ordered[0]?.event !== 'whistle' || ordered[ordered.length - 1]?.event !== 'kickoff') fail('The match feed is not newest first');
  if (ordered.some(({ event, index }) => sample[index] !== event)) fail('The match feed lost an event\'s chronological index');
  const grown = newestFirst([...sample, 'save']);
  if (!sample.every((event, index) => grown.find((row) => row.index === index)?.event === event)) {
    fail('An arriving event re-keyed the events already in the feed');
  }

  // The page only moves for the moments a broadcast cuts to the score: every
  // goal, the half-time whistle and full time. Walk real matches minute by
  // minute, the way the clock does, and count the cuts.
  let tooMany = 0;
  let missedGoals = 0;
  let missedWhistles = 0;
  let skipMissed = 0;
  let minutesWalked = 0;
  let cuts = 0;
  for (let i = 0; i < 150; i++) {
    const home = draftSquad(open, 'pro', `bm-h-${i}`);
    const away = draftSquad(open, 'pro', `bm-a-${i}`);
    const result = simulateMatch({
      seed: `bm-${i}`,
      home: { name: 'H', squad: home, rating: rateSquad(home), category: open },
      away: { name: 'A', squad: away, rating: rateSquad(away), category: open },
    });
    const lastMinute = result.events.reduce((m, e) => Math.max(m, e.minute), 90);
    const stateAt = (minute: number) => ({
      goals: result.events.filter((e) => e.type === 'goal' && e.minute <= minute).length,
      phase: minute === 0 ? 'kickoff' : minute >= lastMinute ? 'full-time' : minute === 45 ? 'half-time' : 'play',
    });

    let previous = stateAt(0);
    let matchCuts = 0;
    let sawHalfTime = false;
    let sawFullTime = false;
    for (let m = 1; m <= lastMinute; m++) {
      const next = stateAt(m);
      minutesWalked += 1;
      if (isBroadcastMoment(previous, next)) {
        matchCuts += 1;
        if (next.phase === 'half-time') sawHalfTime = true;
        if (next.phase === 'full-time') sawFullTime = true;
      } else if (next.goals > previous.goals) {
        missedGoals += 1;
      }
      previous = next;
    }
    cuts += matchCuts;
    // At most one cut per goal plus the two whistles; never one per minute.
    if (matchCuts > result.homeGoals + result.awayGoals + 2) tooMany += 1;
    if (!sawHalfTime || !sawFullTime) missedWhistles += 1;
    // Skipping jumps straight to full time, and that is a moment too.
    if (!isBroadcastMoment(stateAt(Math.floor(lastMinute / 3)), stateAt(lastMinute))) skipMissed += 1;
  }
  if (tooMany > 0) fail(`${tooMany} matches cut to the score more often than goals and whistles allow`);
  if (missedGoals > 0) fail(`${missedGoals} goals did not bring the score into view`);
  if (missedWhistles > 0) fail(`${missedWhistles} matches missed the half-time or full-time cut`);
  if (skipMissed > 0) fail(`${skipMissed} skips to full time did not bring the result into view`);
  console.log(`  feed newest first; ${cuts} cuts to the score over ${minutesWalked} minutes of play, goals and whistles only`);
}

/* --------------------------------------------------------------- share codes */

console.log('\nChallenge codes');
{
  const category = ACTIVE_CATEGORIES[1]!;
  const squad = draftSquad(category, 'pro', 'code-test');
  const code = encodeChallenge({ seed: 'ABCD1234', categoryId: category.id, squad, managerName: 'Test  Manager' });
  const decoded = decodeChallenge(code);

  if (!decoded.ok) {
    fail(`Round-trip failed: ${decoded.reason}`);
  } else {
    const same = JSON.stringify(decoded.payload.squad.picks) === JSON.stringify(squad.picks);
    if (!same) fail('Round-trip changed the squad');
    else console.log(`  round-trip intact (${code.length} characters)`);
  }

  for (const bad of ['', 'not-a-code', 'AAAA', code.slice(0, -6)]) {
    const result = decodeChallenge(bad);
    if (result.ok) fail(`Malformed code was accepted: "${bad.slice(0, 16)}"`);
  }
  console.log('  malformed codes rejected');
}

/* ------------------------------------------------------------ shirt numbers */

const expect = (ok: boolean, message: string) => {
  if (!ok) fail(message);
};

console.log('\nShirt numbers');
{
  for (const [source, numbers] of [
    ['current', CURRENT_SHIRT_NUMBERS],
    ['historical', LEGEND_SHIRT_NUMBERS],
  ] as const) {
    for (const [id, number] of Object.entries(numbers)) {
      const card = PLAYER_BY_ID.get(id);
      if (!card) fail(`Shirt number for a card that does not exist: ${id}`);
      else expect((card.era === 'current') === (source === 'current'), `${id}: ${source} shirt number on a ${card.era} card`);
      expect(Number.isInteger(number) && number >= 1 && number <= 99, `${id}: shirt number ${number} out of range`);
    }
  }
  for (const player of PLAYERS) {
    const table: Record<string, number> = player.era === 'current' ? CURRENT_SHIRT_NUMBERS : LEGEND_SHIRT_NUMBERS;
    expect(player.shirtNumber === (table[player.id] ?? null), `${player.id}: shirtNumber does not match its source`);
  }
  // Two players in one current squad cannot wear the same number.
  const worn = new Map<string, string>();
  for (const player of CURRENT_PLAYERS) {
    if (player.shirtNumber === null) continue;
    const key = `${player.clubId}#${player.shirtNumber}`;
    const other = worn.get(key);
    if (other) fail(`${player.id} and ${other} both wear ${player.shirtNumber} at ${player.clubId}`);
    worn.set(key, player.id);
  }
  const numbered = PLAYERS.filter((p) => p.shirtNumber !== null);
  console.log(
    `  ${numbered.length} of ${PLAYERS.length} cards carry a sourced number (${numbered.filter((p) => p.era === 'current').length} current, ${numbered.filter((p) => p.era !== 'current').length} historical); the rest show a blank shirt`,
  );
}

/* --------------------------------------------------------- discover grouping */

console.log('\nDiscover grouping');
{
  const cards = PLAYERS.length;
  const shown = onePerFootballer(PLAYERS);
  expect(shown.length === IDENTITIES.length, `Discover shows ${shown.length} cards for ${IDENTITIES.length} footballers`);
  expect(new Set(shown.map((p) => p.identityId)).size === shown.length, 'Discover shows a footballer twice');
  for (const card of shown) {
    const best = Math.max(...versionsOf(card.identityId).map((v) => v.rating));
    expect(card.rating === best, `${card.identityId}: representative ${card.id} is not the highest-rated version`);
  }

  // The representative does not depend on the order cards arrive in.
  const ids = (list: { id: string }[]) => list.map((p) => p.id).sort().join();
  expect(ids(onePerFootballer([...PLAYERS].reverse())) === ids(shown), 'The representative depends on input order');

  // Tie-break: rating, then Icon over Hero over standard, then newer season, then id.
  const base = PLAYERS[0]!;
  const tied = [
    { ...base, id: 'b', rating: 90, cardType: 'standard' as const, season: '2010/11' },
    { ...base, id: 'c', rating: 90, cardType: 'icon' as const, season: '2001/02' },
    { ...base, id: 'a', rating: 90, cardType: 'hero' as const, season: '2020/21' },
    { ...base, id: 'd', rating: 91, cardType: 'standard' as const, season: '1999/00' },
    { ...base, id: 'e', rating: 90, cardType: 'standard' as const, season: '2010/11' },
  ].sort(compareVersions);
  expect(tied.map((p) => p.id).join() === 'd,c,a,b,e', `Tie-break order is ${tied.map((p) => p.id).join()}`);

  // Grouping runs after filtering, so the representative belongs to the filter.
  const premier = onePerFootballer(PLAYERS.filter((p) => p.league === 'premier-league'));
  expect(premier.every((p) => p.league === 'premier-league'), 'A filtered shelf shows a version from outside the filter');

  // Every version stays in the database and in the duel pools.
  expect(PLAYERS.length === cards, 'Grouping changed the card database');
  const openPlay = poolFor(requireCategory('open-play'));
  const poolIdentities = new Set(openPlay.map((p) => p.identityId));
  expect(openPlay.length > poolIdentities.size, 'The duel pool lost its extra versions');
  expect(openPlay.some((p) => p.id === 'cristiano-ronaldo-2007-08'), 'A historical version left the duel pool');

  const multi = IDENTITIES.filter((i) => i.versions.length > 1).length;
  const ronaldo = representatives(PLAYERS).get('cristiano-ronaldo');
  console.log(`  ${cards} cards → ${shown.length} footballers; ${multi} have more than one version`);
  console.log(`  duel pool (open play): ${openPlay.length} cards across ${poolIdentities.size} footballers`);
  console.log(`  e.g. Cristiano Ronaldo: ${versionsOf('cristiano-ronaldo').length} versions, Discover shows ${ronaldo?.season} (${ronaldo?.rating})`);
}

/* ------------------------------------------------------------- live data */
/* Synthetic records in the provider's documented response shape. Nothing here
 * is real football; it checks how FutDuel reads the shape. */

console.log('\nLive data normaliser (synthetic records, documented shapes)');
{
  const participants = [
    { id: 1, name: 'Home FC', short_code: 'HOM', meta: { location: 'home' } },
    { id: 2, name: 'Away FC', short_code: 'AWY', meta: { location: 'away' } },
  ];
  const current = (home: number, away: number) => [
    { description: 'CURRENT', score: { goals: home, participant: 'home' } },
    { description: 'CURRENT', score: { goals: away, participant: 'away' } },
    { description: '1ST_HALF', score: { goals: 0, participant: 'home' } },
  ];
  const fixtures = normalizeFixtures([
    {
      id: 101, league_id: 8, season_id: 1, round_id: 11, state_id: 22,
      starting_at: '2025-11-24 20:00:00', starting_at_timestamp: 1764014400,
      participants, scores: current(2, 1), state: { id: 22, name: '2nd Half' }, league: { id: 8, name: 'Test League' },
    },
    { id: 102, league_id: 8, season_id: 1, state_id: 1, starting_at: '2025-11-25 15:00:00', participants, scores: current(0, 0) },
    { id: 103, league_id: 8, season_id: 1, state_id: 13, starting_at: '2025-11-26 00:00:00', participants },
    { id: 104, league_id: 8, season_id: 1, state_id: 5, participants: participants.slice(0, 1) },
    { id: 105, league_id: 8, season_id: 1, state_id: 999, starting_at: '2025-11-27 12:00:00', participants },
    'not a fixture',
  ]);
  const [live, scheduled, tba, unknown] = fixtures;
  expect(fixtures.length === 4, `normaliser kept ${fixtures.length} of 4 readable fixtures`);
  expect(live?.phase === 'live' && live.score?.home === 2 && live.score.away === 1, 'live fixture: phase or CURRENT score misread');
  expect(live?.kickoff === '2025-11-24T20:00:00.000Z' && live.stateLabel === '2nd Half' && live.leagueName === 'Test League', 'live fixture: kickoff, state label or league misread');
  expect(scheduled?.phase === 'scheduled' && scheduled.score === null, 'a match not yet started must have no score, never 0-0');
  expect(tba?.kickoff === null, 'a to-be-announced date must not be shown as a kickoff time');
  expect(unknown?.phase === 'unknown', 'an undocumented state must read as unknown');

  const season = normalizeCurrentSeason({ id: 8, name: 'Test League', currentseason: { id: 7, name: 'Test season', starting_at: '2025-08-15', ending_at: '2026-05-24' } });
  expect(season?.id === 7 && season.leagueId === 8 && season.startsAt === '2025-08-15', 'current season misread');
  expect(normalizeCurrentSeason({ id: 8, name: 'Test League' }) === null, 'a league with no current season must not produce one');

  const rounds = normalizeRounds([
    { id: 2, season_id: 7, name: '2', starting_at: '2025-08-22', ending_at: '2025-08-25', finished: false, is_current: true },
    { id: 1, season_id: 7, name: '1', starting_at: '2025-08-15', ending_at: '2025-08-18', finished: true, is_current: false },
  ]);
  expect(rounds.map((r) => r.id).join() === '1,2' && rounds[0]!.finished && !rounds[1]!.finished, 'rounds misread or unsorted');

  const table = normalizeStandings([
    { position: 2, points: 3, participant: { id: 2, name: 'Away FC' } },
    { position: 1, points: 6, participant: { id: 1, name: 'Home FC' } },
    { position: 3, participant: { id: 3, name: 'No Points FC' } },
  ]);
  expect(table.length === 2 && table[0]!.team.name === 'Home FC', 'standings misread');

  const squad = normalizeSquads(
    [
      {
        id: 1, name: 'Home FC',
        players: [
          { player_id: 10, jersey_number: 9, start: '2025-07-01', player: { id: 10, display_name: 'Test Forward', position_id: 27 } },
          { player_id: 11, jersey_number: 1, player: { id: 11, common_name: 'Test Keeper', position_id: 24 } },
          { player_id: 12, player: { id: 12, name: 'No Position' } },
        ],
        sidelined: [
          { player_id: 10, category: 'injury', end_date: '2099-01-01', completed: false },
          { player_id: 11, category: 'suspension', end_date: '2000-01-01', completed: false },
        ],
      },
    ],
    '2025-11-20',
  );
  const forward = squad.find((p) => p.id === 10);
  const keeper = squad.find((p) => p.id === 11);
  expect(squad.length === 2, 'a player without a known position must be left out, not guessed');
  expect(forward?.position === 'FWD' && forward.jerseyNumber === 9 && forward.availability.status === 'injured', 'squad player or injury misread');
  expect(keeper?.availability.status === 'available', 'an absence that has ended must not mark a player unavailable');

  const lines = normalizeLineupStats([
    {
      id: 101,
      lineups: [
        {
          player_id: 10, team_id: 1, type_id: 11,
          details: [
            { type_id: 119, data: { value: 90 } },
            { type_id: 52, data: { value: { total: 1, goals: 1, penalties: 0 } } },
            { type_id: 118, data: { value: '7.4' } },
          ],
        },
        { player_id: 11, team_id: 1, type_id: 12 },
      ],
    },
  ]);
  expect(lines[0]?.started === true && lines[0].minutes === 90 && lines[0].goals === 1 && lines[0].rating === 7.4, 'lineup statistics misread');
  expect(lines[1]?.started === false && lines[1].minutes === null && lines[1].goals === null, 'an unreported statistic must be null, not zero');
  console.log('  fixtures, scores, states, season, rounds, standings, squads, injuries and player statistics read as documented');
}

console.log('\nFantasy scoring (FutDuel rules on reported statistics)');
{
  const team = (id: number) => ({ id, name: `Team ${id}`, shortCode: null });
  const match = (phase: FootballFixture['phase'], home: number, away: number): FootballFixture => ({
    id: 1, leagueId: 8, leagueName: null, seasonId: 1, roundId: 1, kickoff: '2025-11-24T20:00:00.000Z',
    phase, stateLabel: '', home: team(1), away: team(2), score: { home, away },
  });
  const line = (stats: Partial<PlayerMatchStats>): PlayerMatchStats => ({
    playerId: 1, teamId: 1, fixtureId: 1, started: true, minutes: null, goals: null, assists: null, saves: null,
    goalsConceded: null, yellowCards: null, redCards: null, yellowRedCards: null, ownGoals: null, tackles: null,
    interceptions: null, clearances: null, blockedShots: null, rating: null, ...stats,
  });
  const points = (position: FantasyPosition, stats: Partial<PlayerMatchStats>, fixture: FootballFixture) =>
    scoreMatch(position, line(stats), fixture).points;

  const cases: [string, number, number][] = [
    ['forward, 90 minutes, a goal, won', points('FWD', { minutes: 90, goals: 1 }, match('finished', 2, 1)), 7],
    ['goalkeeper, clean sheet, 7 saves, won', points('GK', { minutes: 90, saves: 7, goalsConceded: 0 }, match('finished', 1, 0)), 9],
    ['defender, conceded 4, lost', points('DEF', { minutes: 90, goalsConceded: 4 }, match('finished', 0, 4)), 0],
    ['midfielder, 45 minutes, yellow then red', points('MID', { minutes: 45, yellowCards: 1, redCards: 1 }, match('finished', 1, 1)), -2],
    ['defender, 1-0 up but still live', points('DEF', { minutes: 90 }, match('live', 1, 0)), 2],
    ['no statistics reported', points('DEF', {}, match('finished', 1, 0)), 0],
    ['defender, 10 defensive actions, drew', points('DEF', { minutes: 90, tackles: 4, interceptions: 3, clearances: 3 }, match('finished', 1, 1)), 4],
    ['forward, own goal', points('FWD', { minutes: 90, ownGoals: 1 }, match('finished', 0, 1)), 0],
  ];
  for (const [label, actual, wanted] of cases) expect(actual === wanted, `scoring: ${label} scored ${actual}, expected ${wanted}`);
  expect(
    points('FWD', { minutes: 90, goals: 1, rating: 3 }, match('finished', 2, 1)) ===
      points('FWD', { minutes: 90, goals: 1, rating: 10 }, match('finished', 2, 1)),
    "the provider's rating must never change FutDuel points",
  );

  const sp = (id: number, position: FantasyPosition, teamId: number): SquadPlayer => ({
    id, name: `Player ${id}`, team: team(teamId), position, jerseyNumber: null,
    availability: { status: 'available', expectedReturn: null },
  });
  const three = [sp(1, 'DEF', 1), sp(2, 'MID', 1), sp(3, 'FWD', 1)];
  expect(!canAdd(three, sp(4, 'MID', 1)).ok, 'a fourth player from one team was allowed');
  expect(!canAdd([sp(1, 'GK', 1)], sp(2, 'GK', 2)).ok, 'a second goalkeeper was allowed');
  const nine = [1, 2, 3, 4, 5].map((i) => sp(i, 'DEF', i)).concat([6, 7, 8, 9].map((i) => sp(i, 'MID', i)));
  expect(!canAdd(nine, sp(10, 'MID', 10)).ok, 'an eleven that could no longer fit a keeper and a forward was allowed');
  expect(canAdd(nine, sp(10, 'GK', 10)).ok, 'a needed goalkeeper was refused');
  const eleven = [sp(1, 'GK', 1), ...[2, 3, 4, 5].map((i) => sp(i, 'DEF', i)), ...[6, 7, 8, 9].map((i) => sp(i, 'MID', i)), sp(10, 'FWD', 10), sp(11, 'FWD', 11)];
  expect(validateSquad(eleven).complete, 'a legal 1-4-4-2 eleven was not complete');
  expect(!validateSquad(eleven.slice(1)).complete, 'an eleven without a keeper was complete');

  const played = (total: number, minutes: number) => ({ playerId: 0, total, minutes, matches: [] });
  const pair = [sp(1, 'FWD', 1), sp(2, 'MID', 2)];
  const captained = squadRoundPoints(pair, 1, 2, { 1: played(5, 90), 2: played(3, 90) }, () => true);
  expect(captained.total === 13 && captained.doubled === 'captain', 'the captain did not score double');
  const vice = squadRoundPoints(pair, 1, 2, { 2: played(3, 90) }, (teamId) => teamId === 1);
  expect(vice.total === 6 && vice.doubled === 'vice', 'the vice-captain did not step in for a captain who did not play');
  const waiting = squadRoundPoints(pair, 1, 2, { 2: played(3, 90) }, () => false);
  expect(waiting.total === 3 && waiting.doubled === null, "the vice-captain was doubled before the captain's match was over");

  const at = (iso: string, phase: FootballFixture['phase'] = 'scheduled'): FootballFixture => ({ ...match(phase, 0, 0), kickoff: iso, score: null });
  const deadline = roundDeadline([at('2025-11-22T15:00:00Z'), at('2025-11-22T12:30:00Z'), at('2025-11-22T10:00:00Z', 'postponed')]);
  expect(deadline === '2025-11-22T11:00:00.000Z', `deadline was ${deadline}, expected 90 minutes before the first playable kickoff`);
  expect(pickWindow(Date.parse('2025-11-22T10:59:00Z'), deadline).state === 'open', 'picks locked before the deadline');
  expect(pickWindow(Date.parse('2025-11-22T11:00:00Z'), deadline).state === 'locked', 'picks still open at the deadline');
  const round = (id: number, finished: boolean): FootballRound => ({ id, seasonId: 1, name: String(id), startsAt: null, endsAt: null, finished, isCurrent: false });
  expect(activeRoundIndex([round(1, true), round(2, true), round(3, false)]) === 2, 'the active round is not the first unfinished one');
  expect(activeRoundIndex([round(1, true)]) === -1, 'a finished season still has an active round');

  const now = Date.parse('2025-11-22T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();
  expect(presentFeed({ status: 'live', data: 1, fetchedAt: ago(60_000) }, now, 300_000).state === 'live', 'a fresh live feed was not live');
  expect(presentFeed({ status: 'live', data: 1, fetchedAt: ago(600_000) }, now, 300_000).state === 'stale', 'an old "live" feed was still presented as live');
  expect(presentFeed({ status: 'stale', data: 1, fetchedAt: ago(0), problem: 'provider-error' }, now, 300_000).state === 'stale', 'a stale feed was presented as live');
  expect(presentFeed({ status: 'unavailable', problem: 'not-configured' }, now, 300_000).state === 'unavailable', 'an unavailable feed was presented with data');

  const shown = { status: 'live' as const, data: 1, fetchedAt: ago(10 * 60_000) };
  const down = { status: 'unavailable' as const, problem: 'rate-limited' as const };
  const kept = mergeRefresh(shown, down, now, 30 * 60_000);
  expect(kept.status === 'stale' && kept.problem === 'rate-limited' && kept.fetchedAt === shown.fetchedAt, 'a failed refresh did not keep the last data labelled stale with its original fetch time');
  expect(mergeRefresh({ ...shown, fetchedAt: ago(31 * 60_000) }, down, now, 30 * 60_000).status === 'unavailable', 'a failed refresh kept data older than the stale limit');
  expect(mergeRefresh(shown, null, now, 30 * 60_000) === shown, 'an offline refresh changed what was shown');
  expect(mergeRefresh(kept, { status: 'live', data: 2, fetchedAt: ago(0) }, now, 30 * 60_000).status === 'live', 'a recovered provider did not replace stale data');

  console.log(`  ${cases.length + 1} scoring cases, squad rules, captaincy, deadline and feed honesty checked`);
}

/* ------------------------------------------------- playtest fix regressions */

console.log('\nPlaytest fixes');
{
  const byIdentity = (identityId: string) => PLAYERS.filter((p) => p.identityId === identityId);
  const rep = representatives(PLAYERS);

  // 1-4. The four footballers this pass was asked for, each exactly once as a
  // footballer, in the era they belong to.
  const milanDinho = byIdentity('ronaldinho').find((p) => p.clubId === 'milan');
  if (!milanDinho) fail('Ronaldinho has no AC Milan version');
  else {
    if (milanDinho.league !== 'serie-a') fail(`Ronaldinho's Milan card is in ${milanDinho.league}`);
    if (milanDinho.era === 'current') fail("Ronaldinho's Milan card is not historical");
    if (milanDinho.cardType !== 'icon') fail(`Ronaldinho's Milan card is a ${milanDinho.cardType}, not an Icon`);
  }

  const gullit = byIdentity('ruud-gullit');
  if (gullit.length === 0) fail('Ruud Gullit is missing');
  if (new Set(PLAYERS.filter((p) => p.name === 'Ruud Gullit').map((p) => p.identityId)).size > 1) {
    fail('Ruud Gullit exists under more than one identity');
  }
  if (gullit[0] && gullit[0].cardType !== 'icon') fail('Ruud Gullit is not an Icon despite his Ballon d Or');

  for (const [identityId, club] of [['lamine-yamal', 'FC Barcelona'], ['pau-cubarsi', 'FC Barcelona']] as const) {
    const versions = byIdentity(identityId);
    if (versions.length === 0) {
      fail(`${identityId} is missing`);
      continue;
    }
    const current = versions.filter((p) => p.era === 'current');
    if (current.length !== 1) fail(`${identityId} has ${current.length} current cards, expected exactly one`);
    if (current[0] && current[0].club !== club) fail(`${identityId} plays for ${current[0].club}, expected ${club}`);
    if (current[0] && current[0].season !== DATASET_SEASON) fail(`${identityId} is not on the ${DATASET_SEASON} snapshot`);
    if (!rep.get(identityId)) fail(`${identityId} has no Discover representative`);
  }

  // 5-7. The intended top of the Discover collection: two at the summit, and
  // Ronaldo Nazario one step below, where Cristiano used to sit.
  const repRating = (identityId: string) => rep.get(identityId)?.rating ?? 0;
  const top = Math.max(...[...rep.values()].map((p) => p.rating));
  if (repRating('cristiano-ronaldo') !== top) fail(`Cristiano's representative is ${repRating('cristiano-ronaldo')}, not the top rating ${top}`);
  if (repRating('lionel-messi') !== top) fail(`Messi's representative is ${repRating('lionel-messi')}, not the top rating ${top}`);
  if (repRating('ronaldo-nazario') !== top - 1) {
    fail(`Ronaldo Nazario's representative is ${repRating('ronaldo-nazario')}, expected ${top - 1}, the level Cristiano held before this pass`);
  }
  // The alternates are untouched: every historical version still exists.
  if (byIdentity('cristiano-ronaldo').length < 3) fail('Cristiano lost a historical version');
  if (byIdentity('ronaldo-nazario').length < 3) fail('Ronaldo Nazario lost a historical version');

  // 8-10. Manual search: fragments identify nobody, whole names do, and a
  // plausible typo still lands on the right footballer.
  const openPlay = poolFor(requireCategory('open-play'));
  const manual = (search: string) =>
    pickerResults(openPlay, { assistance: 'manual', search, position: 'ALL', role: 'ST', isUnavailable: () => false });
  for (const fragment of ['r', 'ro', 'ron', 'cris']) {
    const hits = manual(fragment).players;
    if (hits.length > 0) fail(`Manual gives ${hits.length} players for the fragment "${fragment}"`);
  }
  // "ronal" is most of Ronald Araujo's actual first name, so naming him is the
  // right answer. What it must not do is hand over the Ronaldos, who it does
  // not name.
  const ronal = manual('ronal').players;
  if (ronal.length > 1) fail(`Manual gives ${ronal.length} players for "ronal"`);
  if (ronal.some((p) => ['ronaldo-nazario', 'cristiano-ronaldo', 'ronaldinho'].includes(p.identityId))) {
    fail('Manual reveals a Ronaldo from the fragment "ronal"');
  }
  for (const [query, expected] of [
    ['ronaldo', 'ronaldo-nazario'],
    ['cristiano ronaldo', 'cristiano-ronaldo'],
    ['cristinao ronaldo', 'cristiano-ronaldo'],
    ['messi', 'lionel-messi'],
    ['ronaldinho', 'ronaldinho'],
    ['gullit', 'ruud-gullit'],
    ['yamal', 'lamine-yamal'],
    ['cubarsi', 'pau-cubarsi'],
    ['cubarsí', 'pau-cubarsi'],
  ] as const) {
    const hits = manual(query).players;
    if (!hits.some((p) => p.identityId === expected)) fail(`Manual search "${query}" does not find ${expected}`);
    if (hits.length > MANUAL_RESULT_LIMIT) fail(`Manual search "${query}" returned ${hits.length} players`);
  }
  // A short real name is still searchable; a confidence gate that broke this
  // would be a character count in disguise.
  for (const short of ['gavi', 'pedri', 'rodri']) {
    if (manual(short).players.length === 0) fail(`Manual search cannot find "${short}"`);
  }

  // 11. Guided is untouched: still the whole ranked pool for the slot.
  for (const role of ['ST', 'CB'] as SlotRole[]) {
    const guided = pickerResults(openPlay, { assistance: 'guided', search: '', position: 'ALL', role, isUnavailable: () => false });
    if (guided.players.length !== queryPool(openPlay, { role }).length) fail(`Guided no longer lists the whole pool at ${role}`);
  }

  // 12. Five at the back: a real shape, and one that can actually be filled.
  const backFive = FORMATIONS.find((f) => f.id === '5-3-2');
  if (!backFive) fail('5-3-2 is missing');
  else {
    const defenders = backFive.slots.filter((s) => ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(s.role));
    const midfield = backFive.slots.filter((s) => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(s.role));
    const attack = backFive.slots.filter((s) => ['ST', 'CF', 'LW', 'RW'].includes(s.role));
    if (backFive.slots.length !== 11) fail(`5-3-2 has ${backFive.slots.length} slots`);
    if (defenders.length !== 5) fail(`5-3-2 has ${defenders.length} defenders`);
    if (midfield.length !== 3) fail(`5-3-2 has ${midfield.length} midfielders`);
    if (attack.length !== 2) fail(`5-3-2 has ${attack.length} forwards`);
    if (new Set(backFive.slots.map((s) => s.id)).size !== backFive.slots.length) fail('5-3-2 has duplicate slot ids');
    // No two slots on top of each other, which is how a pitch board overlaps.
    for (let i = 0; i < backFive.slots.length; i++) {
      for (let j = i + 1; j < backFive.slots.length; j++) {
        const a = backFive.slots[i]!;
        const b = backFive.slots[j]!;
        // 10 is the gap below which two cards touch on the pitch board; the
        // keeper and the middle centre back, both at x 50, were the pair that
        // found it.
        if (Math.hypot(a.x - b.x, a.y - b.y) < 10) fail(`5-3-2 slots ${a.id} and ${b.id} overlap`);
      }
    }
    // Fillable for real: every slot takes a soundly-fitting, distinct footballer.
    const squad: Squad = { formationId: '5-3-2', picks: Object.fromEntries(backFive.slots.map((s) => [s.id, null])) };
    const taken = new Set<string>();
    for (const slot of backFive.slots) {
      const pick = openPlay.find(
        (p) =>
          !taken.has(p.identityId) &&
          (slot.role === 'GK' ? p.position === 'GK' : p.position !== 'GK' && fitFor(p, slot.role) !== 'out-of-position'),
      );
      if (!pick) {
        fail(`5-3-2 cannot be filled at ${slot.id} (${slot.role}) from open play`);
        break;
      }
      const problem = pickProblem(pick, { squad, slotId: slot.id, eligibleIds: new Set(openPlay.map((p) => p.id)) });
      if (problem) fail(`5-3-2 refused a legal pick at ${slot.id}: ${problem}`);
      squad.picks[slot.id] = pick.id;
      taken.add(pick.identityId);
    }
    if (!isSquadComplete(squad)) fail('A filled 5-3-2 does not count as a complete eleven');
  }

  // 13. The opponent says what it is, everywhere it is named.
  for (const manager of AI_MANAGERS) {
    if (!manager.name.startsWith('FutDuel AI')) fail(`AI opponent "${manager.name}" is not identified as the program`);
  }
  const invented = ['Ren Sato', 'Ines Varela', 'Jan Kowalczyk', 'Femi Bakare', 'Tove Lindqvist', 'Ada Okafor', 'Rui Marchetti'];
  for (const name of invented) {
    if (AI_MANAGERS.some((m) => m.name === name)) fail(`AI opponent is still the invented human "${name}"`);
    if (LADDER.some((entry) => entry.name === name)) fail(`The ladder still ranks the invented human "${name}" as an opponent`);
  }
  // Renaming must not move who a seed faces.
  if (pickOpponent('pro', 'fixed-seed').id !== pickOpponent('pro', 'fixed-seed').id) fail('Opponent selection is not deterministic');

  // Garrincha: one footballer, one historical Icon card, in the other-leagues
  // bucket with a calendar-year season, and nowhere a league would claim him.
  const garrincha = byIdentity('garrincha');
  if (garrincha.length !== 1) fail(`Garrincha has ${garrincha.length} cards, expected exactly one`);
  if (new Set(PLAYERS.filter((p) => p.name === 'Garrincha').map((p) => p.identityId)).size !== 1) {
    fail('Garrincha exists under more than one identity');
  }
  const mane = garrincha[0];
  if (mane) {
    if (mane.era !== 'legend') fail('Garrincha is not a historical card');
    if (mane.cardType !== 'icon') fail(`Garrincha is a ${mane.cardType}, not an Icon, despite two World Cups`);
    if (mane.clubId !== 'botafogo' || mane.league !== 'other-leagues') fail(`Garrincha is at ${mane.club} in ${mane.league}`);
    if (mane.season !== '1962' || mane.age !== 28) fail(`Garrincha's card is ${mane.season}, age ${mane.age}; expected 1962, age 28`);
    if (!mane.roles.includes('RW')) fail('Garrincha is not listed as a right winger');
    if (mane.value !== null) fail('Garrincha carries a market value');

    // Discover finds him, as one representative card, but only under "All
    // leagues": he is in none of the five.
    if (!queryPool(PLAYERS, { search: 'garrincha' }).some((p) => p.id === mane.id)) fail('Discover search cannot find Garrincha');
    if (rep.get('garrincha')?.id !== mane.id) fail('Garrincha has no Discover representative');
    for (const league of LEAGUES) {
      if (queryPool(PLAYERS, { search: 'garrincha', league: league.id }).length > 0) fail(`Garrincha appears under ${league.name}`);
    }
    for (const id of ['premier-league', 'la-liga', 'serie-a', 'bundesliga', 'ligue-1']) {
      const category = ACTIVE_CATEGORY_BY_ID.get(id);
      if (!category) {
        fail(`League category "${id}" is missing, so Garrincha's exclusion from it was not checked`);
        continue;
      }
      if (poolFor(category).some((p) => p.id === mane.id)) fail(`The ${category.name} category admits Garrincha`);
    }

    // Selectable where a category allows him: found by a Manual search and
    // accepted at a wide slot in Open Play, refused where a rule forbids him.
    if (!manual('garrincha').players.some((p) => p.id === mane.id)) fail('Manual search cannot find Garrincha in Open Play');
    const squad = draftSquad(requireCategory('open-play'), 'pro', 'garrincha');
    const wide = FORMATIONS.find((f) => f.id === squad.formationId)!.slots.find((s) => s.role !== 'GK')!;
    const openIds = new Set(openPlay.map((p) => p.id));
    for (const [slotId, id] of Object.entries(squad.picks)) if (id === mane.id) squad.picks[slotId] = null;
    if (pickProblem(mane, { squad, slotId: wide.id, eligibleIds: openIds }) !== null) fail('Garrincha cannot be picked in Open Play');
    const wonderkids = new Set(poolFor(requireCategory('wonderkids')).map((p) => p.id));
    if (wonderkids.has(mane.id)) fail('Garrincha, a historical card, is eligible for Wonderkids');
  }

  // The bucket stays a bucket: calendar seasons only there, and never a league
  // chip in Discover.
  for (const player of PLAYERS) {
    const calendar = /^\d{4}$/.test(player.season);
    if (calendar !== (player.league === 'other-leagues')) fail(`${player.name} (${player.season}) mixes a season format with ${player.league}`);
  }
  if (LEAGUES.some((l) => l.id === 'other-leagues') || LEAGUES.length !== 5) fail('Discover would show the other-leagues bucket as a league filter');

  console.log(`  Ronaldinho ${byIdentity('ronaldinho').length} versions incl. Milan · Gullit ${gullit.length} · Yamal and Cubarsi current`);
  console.log(`  Garrincha: ${mane ? `${mane.season} ${mane.club}, ${mane.cardType}, rated ${mane.rating}, Other leagues` : 'missing'}`);
  console.log(`  Discover top: Cristiano ${repRating('cristiano-ronaldo')}, Messi ${repRating('lionel-messi')}, Ronaldo Nazario ${repRating('ronaldo-nazario')}`);
  console.log('  Manual withholds fragments, resolves typos and caps results; Guided unchanged; 5-3-2 fillable; opponents named as AI');
}

/* ------------------------------ age bands, Yamal, Walker, header navigation */

console.log('\nAge bands, Lamine Yamal, Kyle Walker, header');
{
  const rep = representatives(PLAYERS);
  const yamal = PLAYER_BY_ID.get('lamine-yamal');

  // Breakout Stars leaves Yamal out because it is 24 to 26 and he is 18. That
  // is the rule working, so the bands are pinned instead of bent: every current
  // footballer lands in exactly one of them, by age alone.
  const bands = [
    { id: 'wonderkids', min: 0, max: 23 },
    { id: 'breakout-stars', min: 24, max: 26 },
    { id: 'peak-years', min: 27, max: 29 },
    { id: 'old-guard', min: 30, max: Infinity },
  ];
  const bandPools = new Map(bands.map((band) => [band.id, new Set(poolFor(requireCategory(band.id)).map((p) => p.id))]));
  for (const player of CURRENT_PLAYERS) {
    const byAge = bands.filter((band) => player.age >= band.min && player.age <= band.max).map((band) => band.id);
    const byPool = bands.filter((band) => bandPools.get(band.id)!.has(player.id)).map((band) => band.id);
    if (byAge.length !== 1 || byPool.join() !== byAge.join()) {
      fail(`${player.name} (${player.age}) is in ${byPool.join(', ') || 'no age band'}; by age belongs in ${byAge.join(', ')}`);
    }
  }
  const lastDance = poolFor(requireCategory('last-dance'));
  if (lastDance.some((p) => p.age < 33 || !bandPools.get('old-guard')!.has(p.id))) fail('Last Dance admits someone who is not 33+ Old Guard');

  if (!yamal) fail('Lamine Yamal is missing');
  else {
    if (!bandPools.get('wonderkids')!.has(yamal.id)) fail('Lamine Yamal is not a Wonderkid');
    if (bandPools.get('breakout-stars')!.has(yamal.id)) fail(`Breakout Stars admits Lamine Yamal at ${yamal.age}`);
  }

  // No rule may name a footballer: categories are filters over attributes,
  // never lists of people, so there is no way to exempt one.
  const identityIds = new Set(IDENTITIES.map((identity) => identity.id));
  const strings = (value: unknown): string[] =>
    typeof value === 'string'
      ? [value]
      : Array.isArray(value)
        ? value.flatMap(strings)
        : value && typeof value === 'object'
          ? Object.values(value).flatMap(strings)
          : [];
  for (const category of CATEGORIES) {
    const named = strings(category.filter).filter((s) => identityIds.has(s) || PLAYER_BY_ID.has(s));
    if (named.length > 0) fail(`${category.name} names footballers in its rule: ${named.join(', ')}`);
  }

  // Every card's rating is the one its attributes produce, so a rating is
  // never typed in, and Yamal's comes from his attributes like anyone's.
  for (const player of PLAYERS) {
    if (player.rating !== ratePlayer(player.position, player.attributes)) fail(`${player.name} (${player.season}) has a rating its attributes do not produce`);
  }
  if (yamal) {
    if (yamal.rating !== 93) fail(`Lamine Yamal is rated ${yamal.rating}, expected 93`);
    const currentReps = [...rep.values()].filter((p) => p.era === 'current');
    const above = currentReps.filter((p) => p.rating > yamal.rating);
    if (above.length > 5) fail(`${above.length} current footballers rate above Lamine Yamal; he should be among the very best`);
    const shown = rep.get('lamine-yamal');
    if (shown?.id !== yamal.id || shown.rating !== yamal.rating) fail('Discover shows a different Lamine Yamal card or rating');
    const picked = pickerResults(poolFor(requireCategory('wonderkids')), {
      assistance: 'manual',
      search: 'yamal',
      position: 'ALL',
      role: 'RW',
      isUnavailable: () => false,
    }).players.find((p) => p.identityId === 'lamine-yamal');
    if (!picked || picked.rating !== yamal.rating) fail('The picker shows Lamine Yamal at a different rating from Discover');
    if (PLAYERS.filter((p) => p.name === 'Lamine Yamal').some((p) => p.identityId !== 'lamine-yamal')) fail('Lamine Yamal exists under two identities');
    console.log(`  Yamal ${yamal.age}: Wonderkids, not Breakout (24–26); rated ${yamal.rating}, ${above.length} current footballers above him`);
  }

  // Kyle Walker: missing from Big Six because he was not in the dataset at
  // all. He comes in as a footballer with a real season, and the unchanged
  // club rule admits him.
  const walkers = PLAYERS.filter((p) => p.identityId === 'kyle-walker');
  if (walkers.length !== 1) fail(`Kyle Walker has ${walkers.length} cards, expected exactly one`);
  if (new Set(PLAYERS.filter((p) => p.name === 'Kyle Walker').map((p) => p.identityId)).size !== 1) fail('Kyle Walker exists under more than one identity');
  const walker = walkers[0];
  if (walker) {
    if (walker.clubId !== 'man-city' || walker.season !== '2017/18') fail(`Kyle Walker's card is ${walker.club} ${walker.season}`);
    if (!rep.get('kyle-walker')) fail('Kyle Walker has no Discover representative');
    if (!ACTIVE_CATEGORY_BY_ID.has('big-six')) fail('Big Six is not an active category');
    const bigSix = requireCategory('big-six');
    const pool = poolFor(bigSix);
    const eligible = new Set(pool.map((p) => p.id));
    if (!eligible.has(walker.id)) fail('Big Six does not admit Kyle Walker');
    const searched = pickerResults(pool, { assistance: 'manual', search: 'walker', position: 'ALL', role: 'RB', isUnavailable: () => false });
    if (!searched.players.some((p) => p.id === walker.id)) fail('A Manual search for "walker" in Big Six cannot find him');
    const guided = pickerResults(pool, { assistance: 'guided', search: '', position: 'ALL', role: 'RB', isUnavailable: () => false });
    if (!guided.players.some((p) => p.id === walker.id)) fail('Guided does not list Kyle Walker at RB in Big Six');

    // Into a legal eleven, and only once.
    const squad = draftSquad(bigSix, 'pro', 'kyle-walker');
    for (const [slotId, id] of Object.entries(squad.picks)) {
      if (id && PLAYER_BY_ID.get(id)?.identityId === 'kyle-walker') squad.picks[slotId] = null;
    }
    const formation = FORMATIONS.find((f) => f.id === squad.formationId)!;
    const slot = formation.slots.find((s) => s.role === walker.roles[0]) ?? formation.slots.find((s) => walker.roles.includes(s.role));
    if (!slot) fail(`The Big Six ${formation.id} has no slot for ${walker.roles.join('/')}`);
    else {
      squad.picks[slot.id] = null;
      if (pickProblem(walker, { squad, slotId: slot.id, eligibleIds: eligible }) !== null) fail(`Kyle Walker cannot be picked at ${slot.role} in Big Six`);
      squad.picks[slot.id] = walker.id;
      if (!isSquadComplete(squad)) fail('A Big Six eleven with Kyle Walker is not complete');
      const elsewhere = formation.slots.find((s) => s.id !== slot.id)!;
      if (pickProblem(walker, { squad, slotId: elsewhere.id, eligibleIds: eligible }) !== 'already-in-eleven') {
        fail('Kyle Walker can be picked twice in one eleven');
      }
      console.log(`  Walker: ${walker.club} ${walker.season}, ${walker.cardType}, rated ${walker.rating}; in Big Six (${pool.length} cards), picked at ${slot.role}, second pick refused`);
    }
  }

  // Header navigation. The URL decides what is current: usePathname() hands
  // over the path without its query, so /duel?challenge=… arrives as /duel.
  const routeExists = (href: string) => existsSync(`app${href === '/' ? '' : href}/page.tsx`);
  for (const item of NAV_ITEMS) if (!routeExists(item.href)) fail(`Navigation links to ${item.href}, which has no page`);
  const desktop = navItems(true, 'desktop');
  const everywhere = navItems(true, 'all');
  const cases: [string, string | null][] = [
    ['/', null],
    ['/duel', '/duel'],
    ['/discover', '/discover'],
    ['/discover/lamine-yamal', '/discover'],
    ['/challenges', '/challenges'],
    ['/leaderboard', '/leaderboard'],
    ['/fantasy', '/fantasy'],
    ['/profile', null],
    ['/duelling', null],
    ['/lab/image-stream', null],
  ];
  for (const [pathname, expected] of cases) {
    const active = desktop.filter((item) => isActive(pathname, item.href)).map((item) => item.href);
    if (active.join() !== (expected ?? '')) fail(`On ${pathname} the header marks ${active.join(', ') || 'nothing'}; expected ${expected ?? 'nothing'}`);
    if (everywhere.filter((item) => isActive(pathname, item.href)).length > 1) fail(`On ${pathname} more than one destination is current`);

    const activeIndex = desktop.findIndex((item) => isActive(pathname, item.href));
    const shapes = desktop.map((_, index) => morphicShape(index, activeIndex, desktop.length));
    if (shapes.filter((s) => s.active).length !== (expected ? 1 : 0)) fail(`On ${pathname} the navbar lifts the wrong number of items`);
    if (!shapes[0]!.roundLeft || !shapes.at(-1)!.roundRight) fail(`On ${pathname} the navbar's ends are square`);
    if (activeIndex > 0 && !shapes[activeIndex - 1]!.roundRight) fail(`On ${pathname} the bar before the active item is cut square`);
    if (activeIndex >= 0 && activeIndex < desktop.length - 1 && !shapes[activeIndex + 1]!.roundLeft) fail(`On ${pathname} the bar after the active item is cut square`);
    shapes.forEach((shape, index) => {
      const joined = !shape.active && Math.abs(index - activeIndex) > 1 && index > 0 && index < desktop.length - 1;
      if (joined && (shape.roundLeft || shape.roundRight)) fail(`On ${pathname} a joined navbar segment is rounded`);
    });
  }
  if (!everywhere.some((item) => item.href === '/' && isActive('/', item.href))) fail('Home is not current on /');

  // Profile menu: real destinations only, drawn from the site navigation, and
  // none of the Kokonut demo's account, model or subscription entries.
  for (const rating of [0, 1000, 1850, 3000]) {
    for (const item of profileMenu(rating)) {
      if (!routeExists(item.href)) fail(`The profile menu links to ${item.href}, which has no page`);
      if (!NAV_ITEMS.some((nav) => nav.href === item.href && nav.label === item.label)) fail(`The profile menu's ${item.label} is not the site's own destination`);
      if (/sign|log ?out|subscri|model|settings|upgrade/i.test(item.label)) fail(`The profile menu offers "${item.label}", which FutDuel does not have`);
    }
  }

  const headerSources = [
    'components/layout/SiteHeader.tsx',
    'components/layout/MorphicNav.tsx',
    'components/layout/ProfileDropdown.tsx',
    'components/layout/profile-menu.ts',
    'components/layout/nav-items.ts',
    'components/ui/dropdown-menu.tsx',
    'components/ui/switch-button.tsx',
    'components/ui/color-scheme.ts',
  ];
  const banned: [RegExp, string][] = [
    [/Eugene/i, "the Kokonut demo's user"],
    [/Gemini/i, "the Kokonut demo's model"],
    [/href=\{?["']#|href:\s*["']#/, 'a dead # link'],
    [/https?:\/\//, 'an external URL'],
    [/<img\b|<Image\b|avatarUrl|avatar:/, 'an image avatar'],
    [/\b(?:zinc|slate|gray|neutral|purple|pink|orange|amber|violet|blue)-\d{2,3}\b|\b(?:bg|text|border)-(?:black|white)\b/, 'a hard-coded palette colour'],
    [/\bglass\b/, "Kokonut's glass class"],
    [/signOut|onSignOut|LogOut/, 'a sign-out for an account FutDuel does not have'],
    [/useState\([^)]*[Pp]ath/, 'a current page kept in state rather than read from the URL'],
  ];
  const semantic = /(?:bg|text|border|ring)-(card-foreground|card|popover-foreground|popover|primary-foreground|primary|secondary-foreground|secondary|muted-foreground|muted|accent-foreground|accent|border|ring|background|foreground)\b/g;
  const tokens = new Set<string>();
  for (const file of headerSources) {
    const source = readFileSync(file, 'utf8');
    for (const [pattern, what] of banned) if (pattern.test(source)) fail(`${file} contains ${what}`);
    for (const match of source.matchAll(semantic)) tokens.add(match[1]!);
  }

  // Light and dark: every theme token those components paint with is defined
  // in both the light (:root) and dark (.dark) theme.
  const css = readFileSync('app/globals.css', 'utf8');
  const block = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    return start < 0 ? '' : css.slice(start, css.indexOf('\n}', start));
  };
  const light = block(':root');
  const dark = block('.dark');
  for (const token of tokens) {
    if (!light.includes(`--${token}:`)) fail(`--${token} is used in the header but missing from the light theme`);
    if (!dark.includes(`--${token}:`)) fail(`--${token} is used in the header but missing from the dark theme`);
  }
  if (tokens.size < 8) fail(`The header reads only ${tokens.size} theme tokens; expected it to be built on the semantic theme`);

  console.log(`  Header: ${cases.length} paths mark the right destination; profile menu ${profileMenu(1000).map((i) => i.label).join(', ')}; ${tokens.size} theme tokens, all in light and dark`);
}

/* -------------------------------------------------------------- theme switch */

console.log('\nTheme switch');
{
  // One theme system: the layout's pre-paint script and the switch agree on
  // where a choice lives, so a refresh opens in the mode that was picked.
  const layout = readFileSync('app/layout.tsx', 'utf8');
  if (!layout.includes(`localStorage.getItem('${THEME_STORAGE_KEY}')`)) {
    fail(`The switch stores the theme under "${THEME_STORAGE_KEY}", which the layout's pre-paint script does not read`);
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  if (pkg.dependencies?.['next-themes'] || pkg.devDependencies?.['next-themes']) fail('next-themes is installed beside the existing theme script');
  const sources = ['app', 'components', 'lib']
    .flatMap((dir) => (readdirSync(dir, { recursive: true }) as string[]).map((file) => `${dir}/${file.replace(/\\/g, '/')}`))
    .filter((file) => /\.(tsx?|jsx?)$/.test(file));
  const keyHolders: string[] = [];
  for (const file of sources) {
    const source = readFileSync(file, 'utf8');
    if (/from ['"]next-themes['"]/.test(source)) fail(`${file} imports next-themes; FutDuel has one theme system`);
    if (/\bThemeProvider\b/.test(source)) fail(`${file} declares a ThemeProvider; FutDuel has one theme system`);
    if (source.includes(`'${THEME_STORAGE_KEY}'`)) keyHolders.push(file);
  }
  if (keyHolders.sort().join() !== ['app/layout.tsx', 'components/ui/color-scheme.ts'].join()) {
    fail(`The theme key is written in ${keyHolders.join(', ')}; expected only the layout script and color-scheme.ts`);
  }

  // dark → light, light → dark, and labels that say what pressing does.
  if (oppositeScheme('dark') !== 'light' || oppositeScheme('light') !== 'dark') fail('The switch does not alternate light and dark');
  if (switchLabel('light', false) !== 'Switch to dark mode') fail(`In light mode the switch is labelled "${switchLabel('light', false)}"`);
  if (switchLabel('dark', false) !== 'Switch to light mode') fail(`In dark mode the switch is labelled "${switchLabel('dark', false)}"`);
  // With the mode written on the button, the name starts with that word (label in name).
  for (const scheme of ['light', 'dark'] as const) {
    const named = switchLabel(scheme, true);
    const shown = scheme === 'dark' ? 'Dark' : 'Light';
    if (!named.startsWith(shown) || !named.endsWith(switchLabel(scheme, false))) fail(`The labelled switch is named "${named}"`);
  }
  if (/light|dark/i.test(switchLabel(null, true))) fail('Before mount the switch names a mode React cannot know yet');
  if (schemeAnnouncement('dark') !== 'Dark mode on' || schemeAnnouncement('light') !== 'Light mode on') fail('The new mode is not announced after a change');

  // In the header, in place of the old toggle; built to the brief.
  const header = readFileSync('components/layout/SiteHeader.tsx', 'utf8');
  if (!/<SwitchButton\b/.test(header) || /ThemeToggle/.test(header)) fail('The header does not use the switch button');
  if (existsSync('components/layout/ThemeToggle.tsx')) fail('The old ThemeToggle still exists beside the switch');
  const button = readFileSync('components/ui/switch-button.tsx', 'utf8');
  if (/\bh-(?:8|9|10)\b/.test(button)) fail('A switch size is shorter than the 44px touch target');
  if (!button.includes('motion-safe:group-hover:rotate-[360deg]') || !button.includes('motion-safe:group-hover:translate-x-full')) {
    fail('The switch spins or shimmers even when reduced motion is asked for');
  }
  if (!button.includes('type="button"') || !button.includes('role="status"') || !button.includes('aria-label={switchLabel(')) {
    fail('The switch is missing its button type, its label or its status announcement');
  }
  if (/\btheme\s*===/.test(button)) fail('The switch draws mode-dependent visuals from React state instead of the dark class');

  console.log(`  one theme system (key "${THEME_STORAGE_KEY}" in layout script and color-scheme.ts only); labels: "${switchLabel('light', true)}" / "${switchLabel('dark', false)}"`);
}

/* ----------------------------------------------------- gameplay pass, 2026-09 */

console.log('\nGameplay pass: contrast, formations, moves, choosing, history, data');
{
  const sourceFiles = ['app', 'components', 'lib']
    .flatMap((dir) => (readdirSync(dir, { recursive: true }) as string[]).map((file) => `${dir}/${file.replace(/\\/g, '/')}`))
    .filter((file) => /\.(tsx?|jsx?)$/.test(file));
  const pitchSource = readFileSync('components/duel/PitchBoard.tsx', 'utf8');
  const buildSource = readFileSync('components/duel/stages/BuildStage.tsx', 'utf8');
  const duelSource = readFileSync('components/duel/DuelExperience.tsx', 'utf8');
  const open = requireCategory('open-play');
  const openPool = poolFor(open);
  const eligible = new Set(openPool.map((p) => p.id));
  const roleOf = (formationId: string, slotId: string) => requireFormation(formationId).slots.find((s) => s.id === slotId)?.role;

  /* Light-mode ratings. A row thumbnail is a dark object (dark art, a white
     rating) and has to take the dark tokens locally, like a card, the wheel and
     the pitch; left out of those lists, its rating inherits light-mode ink and
     turns dark on dark. */
  const css = readFileSync('app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const darkLists = css
    .split('{')
    .map((chunk) => chunk.slice(Math.max(chunk.lastIndexOf('}'), chunk.lastIndexOf(';')) + 1).trim())
    .filter((selector) => selector.includes('.fd-card') && selector.includes('.fd-wheel') && selector.includes('.pitch-turf'));
  if (darkLists.length < 3) fail(`globals.css has ${darkLists.length} dark-object selector lists; expected the card, wheel and pitch lists`);
  for (const list of darkLists) {
    if (!list.includes('.fd-row__art')) fail(`A dark-object selector list leaves out .fd-row__art: ${list.replace(/\s+/g, ' ').slice(0, 90)}`);
  }
  if (!readFileSync('components/players/PlayerCard.tsx', 'utf8').includes('fd-row__art')) fail('The player row thumbnail lost .fd-row__art');

  /* Finishers, retired on 2026-09-19: gone from the categories, the wheel,
     challenge links, share codes and every source file. */
  if (CATEGORIES.some((c) => c.id === 'finishers' || c.name === 'Finishers')) fail('Finishers is still a category');
  if (WHEEL_SEGMENTS.some((c) => c.id === 'finishers')) fail('Finishers is still on the wheel');
  if (parseChallengeId('w1-finishers-pro')) fail('A Finishers challenge link still opens');
  let finishersEncodes = true;
  try {
    encodeChallenge({ seed: makeSeed(), categoryId: 'finishers', squad: draftSquad(open, 'pro', 'finishers'), managerName: 'Test' });
  } catch {
    finishersEncodes = false;
  }
  if (finishersEncodes) fail('A share code can still carry Finishers');
  for (const file of sourceFiles) {
    if (/['"]finishers['"]/.test(readFileSync(file, 'utf8'))) fail(`${file} still names the finishers category`);
  }

  /* Formations: eleven slots each, one keeper, known roles, fillable from open
     play with natural players, and no token overlapping another at any
     supported width. */
  const SHAPES = ['4-3-3', '4-3-3-cam', '4-2-3-1', '4-3-1-2', '4-4-2', '4-1-4-1', '3-5-2', '3-4-3', '5-3-2', '5-2-3', '5-4-1'];
  for (const id of SHAPES) if (!FORMATIONS.some((f) => f.id === id)) fail(`Formation ${id} is missing`);
  const cam = FORMATIONS.find((f) => f.id === '4-3-3-cam');
  const camRoles = cam?.slots.map((s) => s.role).sort().join();
  if (camRoles !== ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CAM', 'LW', 'ST', 'RW'].sort().join()) {
    fail(`4-3-3 CAM should be GK, LB, CB, CB, RB, CM, CM, CAM, LW, ST, RW; it is ${camRoles}`);
  }
  let tightestKeeperGap = Infinity;
  for (const formation of FORMATIONS) {
    const roles = formation.slots.map((s) => s.role);
    if (formation.slots.length !== 11) fail(`${formation.shape}: ${formation.slots.length} slots`);
    if (roles.filter((r) => r === 'GK').length !== 1) fail(`${formation.shape}: not exactly one keeper`);
    if (new Set(formation.slots.map((s) => s.id)).size !== formation.slots.length) fail(`${formation.shape}: a slot id repeats`);
    if (roles.some((r) => !ALL_ROLES.has(r))) fail(`${formation.shape}: unknown role`);
    if (formation.slots.some((s) => s.x < 0 || s.x > 100 || s.y < 0 || s.y > 100)) fail(`${formation.shape}: a slot is off the pitch`);

    const used = new Set<string>();
    for (const slot of formation.slots) {
      const pick = openPool
        .filter((p) => !used.has(p.identityId))
        .filter((p) => (slot.role === 'GK' ? p.position === 'GK' : p.position !== 'GK' && p.roles.includes(slot.role)))
        .sort((a, b) => b.rating - a.rating)[0];
      if (pick) used.add(pick.identityId);
      else fail(`${formation.shape}: open play has no natural ${slot.role} left for ${slot.id}`);
    }

    for (const viewport of PITCH_VIEWPORTS) {
      for (const hit of slotCollisions(formation, viewport)) {
        fail(`${formation.shape} at ${viewport}px: ${hit.a} overlaps ${hit.b}${hit.b === 'pitch edge' ? '' : ` by ${hit.overlapX.toFixed(0)}x${hit.overlapY.toFixed(0)}px`}`);
      }
    }
    // The reported bug: the keeper's label running into a centre-back's token on a phone.
    for (const viewport of [375, 390]) {
      const boxes = slotBoxes(formation, viewport);
      const keeper = boxes.find((b) => roleOf(formation.id, b.slotId) === 'GK')!;
      for (const back of boxes.filter((b) => roleOf(formation.id, b.slotId) === 'CB')) {
        const across = Math.min(keeper.right, back.right) - Math.max(keeper.left, back.left);
        const gap = back.bottom - keeper.top;
        if (across > 1 && gap < 0) fail(`${formation.shape} at ${viewport}px: the keeper overlaps ${back.slotId}`);
        if (across > 1) tightestKeeperGap = Math.min(tightestKeeperGap, gap);
      }
    }
  }
  const { token, width, yScale, yOffset } = PITCH_GEOMETRY;
  for (const needle of [
    `size-[clamp(${token.min}px,${token.vw}vw,${token.max}px)]`,
    `w-[clamp(${width.min}px,${width.vw}vw,${width.max}px)]`,
    `slot.y * ${yScale} + ${yOffset}`,
  ]) {
    if (!pitchSource.includes(needle)) fail(`PitchBoard no longer matches lib/engine/pitch-layout.ts: "${needle}" not found`);
  }
  if (!buildSource.includes('className="w-full flex-wrap"')) fail('The formation choice no longer wraps, so shapes scroll out of sight on a phone');
  const aiShapes = new Set<string>();
  for (let i = 0; i < 150; i++) {
    for (const difficulty of ['amateur', 'pro', 'elite'] as const) {
      const squad = draftSquad(open, difficulty, `shape-${i}`);
      if (!isSquadComplete(squad)) fail(`AI draft ${difficulty} shape-${i} is incomplete in ${squad.formationId}`);
      aiShapes.add(squad.formationId);
    }
  }
  console.log(
    `  ${FORMATIONS.length} formations, 11 slots each, clear at ${PITCH_VIEWPORTS.join('/')}px; keeper clears the nearest CB by ${tightestKeeperGap.toFixed(1)}px on a phone; AI used ${aiShapes.size} shapes`,
  );

  /* Moving players: drag and drop and the picker's buttons share one rule. */
  const identityOf = (id: string) => PLAYER_BY_ID.get(id)?.identityId ?? id;
  const cards = (squad: Squad) => Object.values(squad.picks).filter((id): id is string => Boolean(id)).sort().join();
  const base = draftSquad(open, 'pro', 'moves-1');
  const baseSlots = requireFormation(base.formationId).slots;
  const keeperSlot = baseSlots.find((s) => s.role === 'GK')!.id;
  const [a, b, c] = baseSlots.filter((s) => s.role !== 'GK').map((s) => s.id) as [string, string, string];
  const swapped = applyMove(base, a, b, eligible);
  if (swapped.picks[a] !== base.picks[b] || swapped.picks[b] !== base.picks[a]) fail('A drop on a team-mate does not swap the two');
  if (cards(swapped) !== cards(base)) fail('A swap lost or duplicated a card');
  const holed: Squad = { ...base, picks: { ...base.picks, [b]: null } };
  const moved = applyMove(holed, a, b, eligible);
  if (moved.picks[b] !== base.picks[a] || moved.picks[a] !== null) fail('A drop on an empty slot does not move the player');
  if (cards(moved) !== cards(holed)) fail('A move lost or duplicated a card');
  if (moveProblem(base, keeperSlot, a, eligible) !== 'keeper-rule') fail('A keeper can be dragged out of goal');
  if (moveProblem(base, a, keeperSlot, eligible) !== 'keeper-rule') fail('An outfielder can be dragged into goal');
  if (moveProblem(base, a, a, eligible) !== 'same-slot') fail('A drop on its own slot is not a no-op');
  if (moveProblem(holed, b, a, eligible) !== 'empty-slot') fail('An empty slot can be dragged');
  if (moveProblem(base, 'nowhere', a, eligible) !== 'unknown-slot') fail('A move from outside the formation is accepted');
  const narrowed = new Set([...eligible].filter((id) => id !== base.picks[a]));
  if (moveProblem(base, a, b, narrowed) !== 'not-eligible') fail('A move can carry a player the category does not allow');
  const twin = IDENTITIES.find((identity) => identity.versions.filter((v) => v.position !== 'GK').length >= 2);
  if (twin) {
    const [first, second] = twin.versions.filter((v) => v.position !== 'GK') as [Player, Player];
    const doubled: Squad = { ...base, picks: { ...base.picks, [a]: first.id, [b]: second.id } };
    if (moveProblem(doubled, a, c, eligible) !== 'already-in-eleven') fail(`A move is allowed in an eleven with ${twin.name} twice`);
    if (applyMove(doubled, a, c, eligible) !== doubled) fail('A refused move still changed the squad');
  }
  let tried = 0;
  let refused = 0;
  for (let i = 0; i < 60; i++) {
    let squad = draftSquad(open, (['amateur', 'pro', 'elite'] as const)[i % 3]!, `fuzz-${i}`);
    const slots = requireFormation(squad.formationId).slots;
    const before = cards(squad);
    for (let k = 0; k < 30; k++) {
      const next = applyMove(squad, slots[(i * 7 + k * 13) % 11]!.id, slots[(i * 3 + k * 5 + 1) % 11]!.id, eligible);
      tried += 1;
      if (next === squad) refused += 1;
      squad = next;
    }
    if (cards(squad) !== before) fail(`Random moves lost or duplicated a card (fuzz-${i})`);
    const keeper = squad.picks[slots.find((s) => s.role === 'GK')!.id];
    if (!keeper || PLAYER_BY_ID.get(keeper)?.position !== 'GK') fail(`Random moves put an outfielder in goal (fuzz-${i})`);
    const identities = Object.values(squad.picks).filter((id): id is string => Boolean(id)).map(identityOf);
    if (new Set(identities).size !== identities.length) fail(`Random moves put a footballer in twice (fuzz-${i})`);
  }
  if (!buildSource.includes('applyMove(') || !buildSource.includes('moveProblem(')) fail('The builder moves players without the move rule');
  if (!/onMove=\{movePlayer\}/.test(buildSource) || !/onMoveTo=\{/.test(buildSource)) fail('Drag and the picker buttons are not both wired to the move');
  if (!pitchSource.includes('[touch-action:none]') || !pitchSource.includes("'Escape'") || !pitchSource.includes('setPointerCapture')) {
    fail('The pitch drag is missing touch handling, Escape to cancel, or pointer capture');
  }
  const deps = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: Record<string, string> };
  for (const heavy of ['react-dnd', '@dnd-kit/core', 'react-beautiful-dnd', '@hello-pangea/dnd', 'sortablejs']) {
    if (deps.dependencies?.[heavy]) fail(`${heavy} was added for dragging`);
  }
  console.log(`  moves: swap, move, keeper rule both ways, eligibility and duplicate identity enforced; ${tried} random moves, ${refused} refused, no card lost`);

  /* Choosing a category: only a wheel segment, the opponent's wheel lands
     where the engine says, and the seeded draws are untouched. */
  let chosenPairs = 0;
  for (let i = 0; i < 30; i++) {
    const seed = `choose-${i}`;
    const before = openingDraw(seed);
    for (const category of WHEEL_SEGMENTS) {
      const draw = chosenDraw(seed, category.id);
      if (!draw) {
        fail(`${category.name} is on the wheel but cannot be chosen`);
        continue;
      }
      if (draw.home.id !== category.id) fail(`Choosing ${category.name} opened ${draw.home.name}`);
      if (draw.away.id === category.id) fail(`The opponent was given the chosen ${category.name}`);
      if (!WHEEL_SEGMENTS.includes(draw.away)) fail(`The opponent drew ${draw.away.name}, which is not on the wheel`);
      if (chosenDraw(seed, category.id)?.away.id !== draw.away.id) fail('A chosen duel draws a different opponent category on the same seed');
      if (spin(sideSeed(seed, 'away'), { exclude: [category.id] }).category.id !== draw.away.id) fail('The opponent wheel would land somewhere the engine does not say');
      chosenPairs += 1;
    }
    const after = openingDraw(seed);
    if (after.home.category.id !== before.home.category.id || after.away.category.id !== before.away.category.id) fail('Choosing changed a seeded wheel draw');
    if (before.home.category.id !== spin(sideSeed(seed, 'home')).category.id) fail('The seeded home draw no longer comes from the wheel');
  }
  if (chosenDraw('x', 'finishers') !== null || chosenDraw('x', 'not-a-category') !== null) fail('A category that is not on the wheel can be chosen');
  const chooser = readFileSync('components/duel/stages/CategoryChooser.tsx', 'utf8');
  if (!chooser.includes('WHEEL_SEGMENTS') || /\bCATEGORIES\b/.test(chooser.replace(/ACTIVE_CATEGORIES|WHEEL_SEGMENTS/g, ''))) {
    fail('The category chooser lists something other than the wheel segments');
  }
  if (!duelSource.includes("'choose-home'") || !duelSource.includes('categorySource')) fail('Choosing is not a phase of the duel, or is not recorded');
  console.log(`  choosing: ${chosenPairs} seed and category pairs, opponent never shares, wheel draws unchanged`);

  /* Quick Build: on by default, off survives a reload, bad values repaired. */
  if (!DEFAULT_SETTINGS.quickBuild || !createProfile().settings.quickBuild) fail('Quick Build is not on by default');
  if (!reconcile(undefined).settings.quickBuild || !reconcile({ managerName: 'Old' }).settings.quickBuild) fail('A profile from before the setting existed loses Quick Build');
  const off = reconcile(JSON.parse(JSON.stringify({ ...createProfile(), settings: { quickBuild: false } })));
  if (off.settings.quickBuild !== false) fail('Turning Quick Build off does not survive a reload');
  if (reconcile({ settings: { quickBuild: 'no' } }).settings.quickBuild !== true) fail('A corrupt Quick Build value is not repaired');
  if (!buildSource.includes("assistance === 'guided' && quickBuildOn")) fail('Quick build is not gated on the setting and Guided mode');
  console.log('  Quick Build: on by default, off persists, corrupt values repaired, shown only in Guided');

  /* Lineups: from kickoff on, never while a squad is being built. */
  for (const phase of ['mode', 'spin-home', 'spin-away', 'choose-home', 'choose-away', 'build-home', 'handoff', 'build-away', 'share']) {
    if (lineupsVisible(phase, true)) fail(`Lineups show during ${phase}, before both elevens are locked`);
  }
  for (const phase of LINEUP_PHASES) {
    if (!lineupsVisible(phase, true)) fail(`Lineups are not offered during ${phase}`);
    if (lineupsVisible(phase, false)) fail(`Lineups show during ${phase} without two locked elevens`);
  }
  if (!duelSource.includes('lineupsVisible(')) fail('The duel does not decide lineups through lineupsVisible');

  /* Match history: the saved duel replays exactly, is kept to a limit, and
     explains itself when it cannot be shown. */
  const awayCategory = WHEEL_SEGMENTS.find((cat) => cat.id !== open.id)!;
  const homeSquad = draftSquad(open, 'elite', 'history-home');
  const awaySquad = draftSquad(awayCategory, 'pro', 'history-away');
  const historySeed = makeSeed();
  const played = simulateMatch({
    seed: historySeed,
    decisive: false,
    home: { name: 'You', squad: homeSquad, category: open, rating: rateSquad(homeSquad) },
    away: { name: 'FutDuel AI · Anchor', squad: awaySquad, category: awayCategory, rating: rateSquad(awaySquad) },
  });
  const record: DuelRecord = {
    id: played.seed,
    playedAt: Date.UTC(2026, 8, 19, 20, 0),
    mode: 'solo',
    home: { name: 'You', categoryName: open.name, goals: played.homeGoals, overall: rateSquad(homeSquad).overall },
    away: { name: 'FutDuel AI · Anchor', categoryName: awayCategory.name, goals: played.awayGoals, overall: rateSquad(awaySquad).overall },
    result: played.winner === 'home' ? 'win' : played.winner === 'away' ? 'loss' : 'draw',
    ratingDelta: 0,
    difficulty: 'pro',
    categorySource: 'chosen',
    replay: {
      seed: historySeed,
      home: { name: 'You', categoryId: open.id, squad: homeSquad },
      away: { name: 'FutDuel AI · Anchor', categoryId: awayCategory.id, squad: awaySquad },
      result: played,
    },
  };
  const stored = JSON.parse(JSON.stringify(record)) as DuelRecord;
  if (replayProblem(stored) !== null) fail(`A fresh record cannot be replayed: ${replayProblem(stored)}`);
  if (JSON.stringify(resimulate(stored.replay!)) !== JSON.stringify(played)) fail('Replaying a saved duel does not reproduce its ninety minutes');
  if (openReplay(stored)?.awayCategory.id !== awayCategory.id) fail('A saved duel reopens with the wrong categories');
  if (replayProblem({ ...stored, replay: undefined }) !== 'no-replay') fail('A score-only record claims to have a replay');
  if (replayProblem({ ...stored, replay: { ...stored.replay!, away: { ...stored.replay!.away, categoryId: 'finishers' } } }) !== 'category-removed') {
    fail('A duel under a retired category still claims to replay');
  }
  const ghostSquad: Squad = { ...homeSquad, picks: { ...homeSquad.picks, [Object.keys(homeSquad.picks)[0]!]: 'not-a-card' } };
  if (replayProblem({ ...stored, replay: { ...stored.replay!, home: { ...stored.replay!.home, squad: ghostSquad } } }) !== 'player-removed') {
    fail('A duel with a retired card still claims to replay');
  }
  const key = historyKey(stored);
  if (encodeURIComponent(key) !== key) fail(`History key ${key} is not safe in a URL`);
  const many = Array.from({ length: HISTORY_KEPT + 20 }, (_, i) => ({ ...stored, playedAt: stored.playedAt + i }));
  if (HISTORY_KEPT !== 50 || reconcile({ history: many }).history.length !== HISTORY_KEPT) fail(`History is not capped at ${HISTORY_KEPT}`);
  if (!readFileSync('lib/store/profile.ts', 'utf8').includes('[record, ...current.history].slice(0, HISTORY_KEPT)')) fail('New duels are not capped as they are saved');
  if (!duelSource.includes('setResult(replay.result)')) fail('A history replay re-simulates instead of showing the saved result');
  if (!duelSource.includes('setUserSide(null)') || !duelSource.includes('onRematch={replayOf ? undefined : rematch}')) {
    fail('A history replay could record a result or offer a rematch');
  }
  const recordBytes = JSON.stringify(stored).length;
  console.log(
    `  history: replay reproduces the saved result; ${(recordBytes / 1024).toFixed(1)} KB a duel, about ${Math.round((recordBytes * HISTORY_KEPT) / 1024)} KB for the ${HISTORY_KEPT} kept`,
  );

  /* Category suggestions: validated, kept on this device, never sent. */
  const names = CATEGORIES.map((cat) => cat.name);
  const description = 'Every player in the eleven prefers their left foot.';
  const saved = [{ id: 's-1', name: 'Left Footers', description, rule: '', createdAt: 0 }];
  const good = checkSuggestion({ name: '  Right   Footers ', description, rule: '' }, { categoryNames: names, saved });
  if (!good.ok || good.value.name !== 'Right Footers') fail(`A valid suggestion is refused or not tidied: ${JSON.stringify(good.errors)}`);
  const refusals: [string, SuggestionInput, SuggestionField][] = [
    ['empty name', { name: '', description }, 'name'],
    ['short name', { name: 'Ab', description }, 'name'],
    ['long name', { name: 'x'.repeat(SUGGESTION_LIMITS.name.max + 1), description }, 'name'],
    ['name without letters', { name: '1 2 3 4', description }, 'name'],
    ['existing category', { name: names[0]!.toUpperCase(), description }, 'name'],
    ['repeat suggestion', { name: 'left footers', description }, 'name'],
    ['empty description', { name: 'Right Footers', description: '' }, 'description'],
    ['short description', { name: 'Right Footers', description: 'Too short' }, 'description'],
    ['long description', { name: 'Right Footers', description: 'y'.repeat(SUGGESTION_LIMITS.description.max + 1) }, 'description'],
    ['description without words', { name: 'Right Footers', description: '1234567890 1234' }, 'description'],
    ['long rule', { name: 'Right Footers', description, rule: 'z'.repeat(SUGGESTION_LIMITS.rule.max + 1) }, 'rule'],
  ];
  for (const [label, input, field] of refusals) {
    const verdict = checkSuggestion(input, { categoryNames: names, saved });
    if (verdict.ok || !verdict.errors[field]) fail(`Suggestion check accepts a ${label}`);
  }
  const suggestionSource = readFileSync('components/profile/SuggestCategory.tsx', 'utf8');
  if (/\bfetch\(|XMLHttpRequest|sendBeacon|axios/.test(suggestionSource)) fail('The suggestion form sends data somewhere');
  if (!suggestionSource.includes('Saved on this device')) fail('The suggestion form does not say where a suggestion is kept');
  const flood = Array.from({ length: 40 }, (_, i) => ({ ...saved[0]!, id: `s-${i}` }));
  if (reconcile({ suggestions: flood }).suggestions.length !== SUGGESTION_LIMITS.kept) fail(`Suggestions are not capped at ${SUGGESTION_LIMITS.kept}`);
  console.log(`  suggestions: ${refusals.length} bad inputs refused, saved on this device only, ${SUGGESTION_LIMITS.kept} kept`);

  /* Club moves, verified 2026-09-19 (sources on SINCE_SNAPSHOT). */
  const currentOf = (identityId: string) => CURRENT_PLAYERS.find((p) => p.identityId === identityId);
  const olderAt = (identityId: string, clubId: string) => versionsOf(identityId).some((p) => p.era !== 'current' && p.clubId === clubId);
  const rodri = currentOf('rodri');
  if (rodri?.clubId !== 'barcelona' || rodri.league !== 'la-liga' || rodri.id !== 'rodri') fail(`Rodri's current card is at ${rodri?.clubId}`);
  if (!olderAt('rodri', 'man-city')) fail('Rodri has lost his Manchester City version');
  const trafford = currentOf('james-trafford');
  if (trafford?.clubId !== 'leeds') fail(`Trafford's current card is at ${trafford?.clubId}, not Leeds`);
  const mbappe = currentOf('kylian-mbappe');
  if (mbappe?.clubId !== 'real-madrid' || !olderAt('kylian-mbappe', 'psg')) fail('Mbappe should be current at Real Madrid with a historical PSG version');
  const messi = currentOf('lionel-messi');
  if (messi?.clubId !== 'inter-miami' || !olderAt('lionel-messi', 'psg')) fail('Messi should be current at Inter Miami with a historical PSG version');
  for (const [id, entry] of Object.entries(SINCE_SNAPSHOT)) {
    const player = currentOf(id);
    if (!player) fail(`SINCE_SNAPSHOT names ${id}, who has no current card`);
    else if (player.season !== entry.season) fail(`${player.name}: SINCE_SNAPSHOT says ${entry.season}, the card says ${player.season}`);
    if (!/\(.+\)\.$/.test(entry.source)) fail(`SINCE_SNAPSHOT ${id} does not name its source`);
  }
  for (const stale of ['rodri', 'james-trafford']) {
    if (stale in CURRENT_SHIRT_NUMBERS) fail(`${stale} still wears a number from his old club`);
  }

  /* Ratings come from attributes only; Discover, the picker, the detail view
     and the AI all read the same player.rating. */
  const shown = representatives(PLAYERS);
  const EXPECTED: Record<string, number> = {
    neymar: 95,
    'sergio-busquets': 89,
    marcelo: 89,
    'dani-alves': 90,
    'michael-olise': 88,
    'ousmane-dembele': 91,
    'pau-cubarsi': 84,
    'desire-doue': 85,
  };
  for (const [id, rating] of Object.entries(EXPECTED)) {
    const card = shown.get(id);
    if (card?.rating !== rating) fail(`${id}: Discover shows ${card?.rating}, expected ${rating}`);
  }
  for (const player of PLAYERS) {
    if (player.rating !== ratePlayer(player.position, player.attributes)) fail(`${player.name} (${player.season}): rating does not follow from attributes`);
  }
  for (const file of sourceFiles) {
    if (/rating\s*override|RATING_OVERRIDES?/i.test(readFileSync(file, 'utf8'))) fail(`${file} overrides a rating`);
  }

  /* Schlotterbeck and Galacticos. Galacticos is a value rule (current cards
     at 35m and up), not a Real Madrid rule, so a Dortmund defender valued at
     40m belongs in it on the data as it is. */
  const galacticos = requireCategory('galacticos');
  const schlotterbeck = currentOf('nico-schlotterbeck');
  if (!schlotterbeck) fail('Schlotterbeck is missing');
  else {
    if (schlotterbeck.clubId === 'real-madrid') fail('Schlotterbeck was given a Real Madrid stint');
    if (galacticos.filter.kind !== 'minValue' || (schlotterbeck.value ?? 0) < galacticos.filter.value) fail('Galacticos is no longer the value rule that admits Schlotterbeck');
    if (!poolFor(galacticos).some((p) => p.id === schlotterbeck.id)) fail('Schlotterbeck is valued past the Galacticos line but not in its pool');
  }

  /* Zambrotta: a historical card, found by search, shown in Discover, and
     eligible for Old Continent. */
  const zambrotta = PLAYER_BY_ID.get('gianluca-zambrotta-2005-06');
  if (!zambrotta) fail('Zambrotta is missing');
  else {
    if (zambrotta.era === 'current' || zambrotta.cardType === 'standard') fail('Zambrotta is not a historical Icon or Hero');
    if (zambrotta.clubId !== 'juventus' || !zambrotta.roles.includes('RB') || !zambrotta.roles.includes('LB')) fail('Zambrotta lost his club or his full-back roles');
    if (PLAYERS.filter((p) => p.id === zambrotta.id).length !== 1) fail('Zambrotta has a duplicate id');
    if (!queryPool([...PLAYERS], { search: 'zambrotta' }).some((p) => p.id === zambrotta.id)) fail('Zambrotta cannot be found by search');
    if (shown.get(zambrotta.identityId)?.id !== zambrotta.id) fail('Zambrotta is not the card Discover shows');
    if (!poolFor(requireCategory('old-continent')).some((p) => p.id === zambrotta.id)) fail('Zambrotta is not eligible for Old Continent');
  }

  console.log(
    `  data: Rodri Barcelona (+ City ${shown.get('rodri')?.season}), Trafford Leeds, Mbappe Real Madrid (+ PSG), Messi Inter Miami (+ PSG); Neymar ${shown.get('neymar')?.rating}; Schlotterbeck (${schlotterbeck?.club}, ${schlotterbeck?.value}m) in Galacticos by value; Zambrotta ${zambrotta?.rating} in Old Continent; ${ACTIVE_CATEGORIES.length} of ${CATEGORIES.length} categories viable`,
  );
}

/* ------------------------------------------------ homepage features, footer */

console.log('\nHomepage features and footer');
{
  const featureSource = readFileSync('components/ui/feature-section-with-hover-effects.tsx', 'utf8');
  const footerSource = readFileSync('components/ui/footer-section.tsx', 'utf8');
  const homeSource = readFileSync('app/page.tsx', 'utf8');
  const layoutSource = readFileSync('app/layout.tsx', 'utf8');
  const profileSource = readFileSync('components/profile/ProfilePanel.tsx', 'utf8');

  // Every link is a real page, or a real section of one.
  const hrefs = [...`${featureSource}\n${footerSource}`.matchAll(/href:\s*'([^']*)'/g)].map((m) => m[1]!);
  for (const href of hrefs) {
    const [route, hash] = href.split('#') as [string, string | undefined];
    const page = route === '/' ? 'app/page.tsx' : `app${route}/page.tsx`;
    if (!route || !existsSync(page)) fail(`A homepage or footer link points at ${href}, which is not a page`);
    if (hash !== undefined && !(route === '/profile' && profileSource.includes(`id="${hash}"`))) fail(`${href}: no section #${hash} on that page`);
  }
  if (hrefs.length < 14) fail(`Only ${hrefs.length} links found in the feature section and footer`);
  if (/href=["']#["']|href:\s*'#'/.test(`${featureSource}${footerSource}`)) fail('A placeholder "#" link shipped');
  if (/EveryAI|Asme|uptime|Pricing|Facebook|Instagram|LinkedIn|Youtube|FrameIcon/i.test(`${featureSource}${footerSource}`)) fail('Demo copy or demo icons shipped');

  // One explanatory section: the loop and the category showcase were folded
  // into the feature grid on 2026-09-19 and must not come back beside it.
  const hero = homeSource.indexOf('<HeroWheel');
  const features = homeSource.indexOf('<FeaturesSectionWithHoverEffects />');
  if (!(hero > 0 && features > hero)) fail('The feature section does not follow the hero');
  if (/Three moves, endless arguments|The categories that change everything|const STEPS\b|coverageFor/.test(homeSource)) {
    fail('A removed homepage section (the loop or the category showcase) is back');
  }
  if ((homeSource.match(/<section/g) ?? []).length > 3) fail('The homepage grew another section beside the feature grid');
  // The grid opens with the game itself, in order, and names real categories.
  const titles = [...featureSource.matchAll(/title:\s*'([^']*)'/g)].map((m) => m[1]!);
  if (titles.slice(0, 3).join() !== 'Spin the wheel,Build your XI,Duel' || titles.length !== 8) {
    fail(`The feature grid should open with Spin, Build, Duel and hold eight cells: ${titles.join(', ')}`);
  }
  if (!featureSource.includes('ACTIVE_CATEGORIES.length') || !featureSource.includes('IDENTITIES.length') || !featureSource.includes('FORMATIONS.length') || !featureSource.includes('HISTORY_KEPT')) {
    fail('A count in the feature grid is typed in instead of read from the game data');
  }
  if (/Wonderkids|Old Guard|Last Dance|Continental Elite|Pace Merchants|Dribblers/.test(featureSource)) {
    fail('Category examples are typed into the feature grid instead of drawn from the active pool');
  }
  if (!layoutSource.includes('<Footer ') || /SiteFooter/.test(layoutSource) || existsSync('components/layout/SiteFooter.tsx')) {
    fail('The layout does not render exactly the one animated footer');
  }
  // The footer is client-side; the player data must stay on the server.
  if (/@\/lib\/data\/players|@\/lib\/engine/.test(footerSource)) fail('The client footer imports game data');
  if (featureSource.includes("'use client'")) fail('The feature section became a client component');

  // One animation library: framer-motion is what motion/react re-exports.
  const deps = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: Record<string, string> };
  if (deps.dependencies?.motion) fail('motion was installed beside framer-motion, the same library twice');
  if (!deps.dependencies?.['@tabler/icons-react']) fail('@tabler/icons-react is missing');
  if (!/useReducedMotion/.test(footerSource) || !readFileSync('app/globals.css', 'utf8').includes('.fd-footer-reveal')) {
    fail('The footer reveal lost its reduced-motion and no-script handling');
  }

  console.log(`  ${hrefs.length} links, all to real pages and sections; one explanatory section opening ${titles.slice(0, 3).join(' → ')}; one footer, framer-motion only`);
}

/* -------------------------------------------------------------------- report */

console.log('');
for (const message of warnings) console.log(`  warn  ${message}`);
for (const message of failures) console.log(`  FAIL  ${message}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s).\n`);
  process.exit(1);
}
console.log(`\nAll checks passed${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : ''}.\n`);
