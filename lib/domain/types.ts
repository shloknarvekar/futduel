/**
 * Core domain model. Everything the game reasons about is defined here so the
 * engine, the UI and the persistence layer share one vocabulary.
 */

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

/** Fine-grained slot roles used by formations. */
export type SlotRole =
  | 'GK'
  | 'LB' | 'CB' | 'RB' | 'LWB' | 'RWB'
  | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM'
  | 'LW' | 'RW' | 'ST' | 'CF';

export type LeagueId =
  | 'premier-league'
  | 'la-liga'
  | 'serie-a'
  | 'bundesliga'
  | 'ligue-1'
  /**
   * Not a league: the home of historical Icons whose peak was played outside
   * the five, such as Garrincha's Botafogo. See `OTHER_LEAGUES` in `clubs.ts`.
   */
  | 'other-leagues';

export type Foot = 'L' | 'R';

export interface Attributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

/**
 * One playable card: a footballer as they were in one particular season.
 *
 * A record is a *version*, not a person. Cristiano Ronaldo at Manchester United
 * in 2007/08 and at Real Madrid in 2013/14 are two records with two ids, and
 * both carry the same `identityId`. Everything the duel engine reads — club,
 * league, age, attributes — describes that season, so a category tests the
 * version rather than the career.
 */
export interface Player {
  /** Unique per version. Squads, share codes and match events reference this. */
  id: string;
  /**
   * The real-world footballer. Shared by every version of the same person, and
   * the key a squad is checked against so nobody can be fielded twice.
   */
  identityId: string;
  name: string;
  /** Short display name for tight card layouts. */
  short: string;
  position: Position;
  /** Roles this player can legitimately fill in a formation. */
  roles: SlotRole[];
  club: string;
  clubId: string;
  league: LeagueId;
  nation: string;
  nationCode: string;
  continent: 'Europe' | 'South America' | 'Africa' | 'North America' | 'Asia' | 'Oceania';
  /** Age during the season this version depicts. */
  age: number;
  rating: number;
  attributes: Attributes;
  /**
   * Present-day market value in millions of euros. `null` for historical
   * versions: a 2003 transfer fee is not comparable with a 2025 valuation, and
   * inventing an inflation-adjusted figure would be fabrication.
   */
  value: number | null;
  foot: Foot;
  /** Rating band. Says how good the card is, not what kind of card it is. */
  tier: 'common' | 'rare' | 'epic' | 'world-class';
  /** Current snapshot or historical version. */
  era: PlayerEra;
  /** The season depicted: `YYYY/YY`, or a calendar year `YYYY` outside the five leagues. */
  season: string;
  /** True when the version depicts the player's peak years. */
  prime: boolean;
  /** Icon, Hero or standard. See `CardType`. */
  cardType: CardType;
  /** Why an Icon or Hero card has that status. `null` exactly when standard. */
  cardReason: string | null;
  /**
   * The shirt number worn in the season this version depicts, when that is
   * known. `null` when it is not sourced, in which case the card art shows no
   * number rather than a guess. See `lib/data/shirt-numbers.ts`.
   */
  shirtNumber: number | null;
}

/**
 * Card classification, independent of rating.
 *
 * - `icon` — an all-time great whose standing outlives any single club or
 *   league. Held by the person, so every historical version of an Icon is one.
 * - `hero` — a player who defines a league or club era without reaching the
 *   Icon bar. Earned in one league, so it is held by the version.
 * - `standard` — everything else, including every current-season record.
 */
export type CardType = 'standard' | 'hero' | 'icon';

/** A real-world footballer and every playable version of them. */
export interface PlayerIdentity {
  id: string;
  name: string;
  nation: string;
  foot: Foot;
  /** Oldest season first. */
  versions: Player[];
}

export interface Club {
  id: string;
  name: string;
  short: string;
  league: LeagueId;
  city: string;
  /** Brand colour, used only as a thin accent bar — never as page chrome. */
  color: string;
  founded: number;
}

/* -------------------------------------------------------------------------- */
/* Categories — the spin wheel                                                */
/* -------------------------------------------------------------------------- */

export type CategoryRarity = 'standard' | 'rare' | 'legendary';

export interface MatchModifier {
  /** Human-readable effect shown on the category card. */
  label: string;
  /** Multipliers applied to simulated phase strength. 1 = neutral. */
  attack?: number;
  midfield?: number;
  defence?: number;
  /** Weighting for chaotic events (long shots, red cards, wonder goals). */
  chaos?: number;
}

/**
 * Which kind of record a version is.
 *
 * - `current` — the 2025/26 snapshot: the player as they are now.
 * - `legend` — a historical season, authored as its own record with the club,
 *   league, age and attributes of that season. Never inferred from a current
 *   record: a modern player whose club happens to match is not a legend.
 *
 * Whether a legend version is the player's peak is a separate flag (`prime`),
 * because a 2016/17 Buffon is historical without being prime.
 */
export type PlayerEra = 'current' | 'legend';

/**
 * A category eligibility rule.
 *
 * Leaf rules test one property. The three combinators let categories be
 * composed from them, which is what keeps the pool extensible: a new category
 * is usually an arrangement of existing rules rather than a new engine
 * primitive.
 */
export type CategoryFilter =
  /* --- leaves ---------------------------------------------------------- */
  | { kind: 'all' }
  | { kind: 'league'; league: LeagueId }
  | { kind: 'nation'; nations: string[] }
  | { kind: 'continent'; continent: Player['continent'] }
  | { kind: 'club'; clubIds: string[] }
  | { kind: 'maxAge'; age: number }
  | { kind: 'minAge'; age: number }
  | { kind: 'ageRange'; min: number; max: number }
  | { kind: 'foot'; foot: Foot }
  | { kind: 'attrMin'; attr: keyof Attributes; value: number }
  | { kind: 'attrMax'; attr: keyof Attributes; value: number }
  | { kind: 'maxValue'; value: number }
  | { kind: 'minValue'; value: number }
  | { kind: 'ratingRange'; min: number; max: number }
  | { kind: 'position'; positions: Position[] }
  | { kind: 'role'; roles: SlotRole[] }
  | { kind: 'tier'; tiers: Player['tier'][] }
  | { kind: 'era'; eras: PlayerEra[] }
  | { kind: 'cardType'; types: CardType[] }
  /* --- combinators ------------------------------------------------------ */
  | { kind: 'and'; of: CategoryFilter[] }
  | { kind: 'or'; of: CategoryFilter[] }
  | { kind: 'not'; of: CategoryFilter };

/** How categories are grouped on the wheel and in listings. */
export type CategoryGroup =
  | 'open'
  | 'era'
  | 'competition'
  | 'style'
  | 'position'
  | 'region'
  | 'club'
  | 'special';

export interface Category {
  id: string;
  name: string;
  /** Abbreviated name for the wheel, where a wedge is only so wide. */
  wheelLabel: string;
  /** One-line brief the manager plays against. */
  brief: string;
  /** Which family this category belongs to. */
  group: CategoryGroup;
  rarity: CategoryRarity;
  filter: CategoryFilter;
  modifier: MatchModifier;
  /** Optional squad budget in millions. */
  budget?: number;
}

/* -------------------------------------------------------------------------- */
/* Squads                                                                     */
/* -------------------------------------------------------------------------- */

export interface FormationSlot {
  id: string;
  role: SlotRole;
  /** Percentage coordinates on the pitch. 0,0 is bottom-left of own half. */
  x: number;
  y: number;
}

export interface Formation {
  id: string;
  name: string;
  shape: string;
  /** Tactical bias applied during simulation. */
  bias: { attack: number; midfield: number; defence: number };
  slots: FormationSlot[];
}

export interface Squad {
  formationId: string;
  /** slotId to playerId */
  picks: Record<string, string | null>;
}

export interface SquadRating {
  attack: number;
  midfield: number;
  defence: number;
  chemistry: number;
  overall: number;
  spend: number;
  /** The links that produced the chemistry score, so the UI can explain itself. */
  links: { label: string; count: number }[];
}

/* -------------------------------------------------------------------------- */
/* Duels                                                                      */
/* -------------------------------------------------------------------------- */

export type AIDifficulty = 'amateur' | 'pro' | 'elite';

export interface Manager {
  id: string;
  name: string;
  side: 'home' | 'away';
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
}

export interface DuelSide {
  manager: Manager;
  categoryId: string;
  squad: Squad;
  rating: SquadRating;
}

export interface MatchEvent {
  minute: number;
  side: 'home' | 'away' | 'neutral';
  type: 'goal' | 'chance' | 'save' | 'card' | 'whistle' | 'woodwork';
  playerId?: string;
  playerName?: string;
  text: string;
  /** Expected-goals contribution of the underlying shot, if any. */
  xg?: number;
}

export interface MatchResult {
  seed: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  stats: {
    possession: [number, number];
    shots: [number, number];
    onTarget: [number, number];
    xg: [number, number];
  };
  /** Set when the tie went to penalties. */
  shootout?: { home: number; away: number };
  winner: 'home' | 'away' | 'draw';
  motm?: { playerId: string; name: string; side: 'home' | 'away'; line: string };
}

export interface DuelRecord {
  id: string;
  playedAt: number;
  mode: 'solo' | 'local' | 'friend';
  home: { name: string; categoryName: string; goals: number; overall: number };
  away: { name: string; categoryName: string; goals: number; overall: number };
  result: 'win' | 'loss' | 'draw';
  ratingDelta: number;
  /** The AI's difficulty, for solo duels. */
  difficulty?: AIDifficulty;
  /** How the local manager's category was decided. */
  categorySource?: 'wheel' | 'chosen' | 'challenge';
  /** The duel exactly as played, for watching again. Absent on records from before replays were kept. */
  replay?: DuelReplay;
}

/**
 * Everything needed to show a finished duel again. Squads are stored by card
 * id and the result as it was simulated, so the replay is the match that was
 * played even if the data changes later; the seed is kept so it can be
 * re-simulated and checked while it still can be.
 */
export interface DuelReplay {
  seed: string;
  home: { name: string; categoryId: string; squad: Squad };
  away: { name: string; categoryId: string; squad: Squad };
  result: MatchResult;
}

/* -------------------------------------------------------------------------- */
/* Progression                                                                */
/* -------------------------------------------------------------------------- */

export interface Achievement {
  id: string;
  name: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold';
  /** Progress target. 1 means a simple boolean unlock. */
  target: number;
}

export interface Challenge {
  id: string;
  name: string;
  brief: string;
  categoryId: string;
  difficulty: AIDifficulty;
  reward: number;
  /** Opponent squad strength floor, so challenges stay hard. */
  opponentFloor: number;
}

export interface ProfileStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  streak: number;
  bestStreak: number;
  spins: number;
  categoriesSeen: string[];
}

export interface Profile {
  managerName: string;
  rating: number;
  stats: ProfileStats;
  /** achievementId to progress count. */
  achievements: Record<string, number>;
  completedChallenges: string[];
  history: DuelRecord[];
  createdAt: number;
  settings: ProfileSettings;
  /** Category ideas kept on this device. Never sent anywhere. */
  suggestions: CategorySuggestion[];
}

/** Preferences for how this browser plays. */
export interface ProfileSettings {
  /** Offer Quick Build in the squad builder. On by default, as it always was. */
  quickBuild: boolean;
}

export interface CategorySuggestion {
  id: string;
  name: string;
  description: string;
  /** How the player imagines eligibility working. Optional. */
  rule: string;
  createdAt: number;
}

/* Live football and fantasy types live in `lib/football/types.ts`: they
   describe the real, current game as a provider reports it, which is a
   different thing from FutDuel's curated card database above. */
