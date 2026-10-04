'use client';

import { create } from 'zustand';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { CategorySuggestion, DuelRecord, Profile, ProfileSettings } from '@/lib/domain/types';
import { ACHIEVEMENTS, STARTING_RATING } from '@/lib/engine/progression';
import { HISTORY_KEPT } from '@/lib/engine/local-limits';
import { SUGGESTION_LIMITS } from '@/lib/engine/suggestions';

/**
 * Local-first persistence.
 *
 * Everything lives in the player's own browser via IndexedDB. There is no
 * account, nothing is uploaded, and the store is only read after mount so the
 * server-rendered markup and the first client render always agree. Settings,
 * match history and category suggestions live in the same profile record, so
 * "Reset everything" really does reset everything.
 */

const STORAGE_KEY = 'futduel:profile:v1';

/** How this browser plays when nothing has been chosen: exactly as it always has. */
export const DEFAULT_SETTINGS: ProfileSettings = { quickBuild: true };

export function createProfile(managerName = 'You'): Profile {
  return {
    managerName,
    rating: STARTING_RATING,
    stats: {
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0,
      streak: 0, bestStreak: 0, spins: 0,
      categoriesSeen: [],
    },
    achievements: {},
    completedChallenges: [],
    history: [],
    createdAt: Date.now(),
    settings: { ...DEFAULT_SETTINGS },
    suggestions: [],
  };
}

/** Defensive merge: a profile from an older build must never crash the app. */
export function reconcile(raw: unknown): Profile {
  const base = createProfile();
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<Profile>;
  const settings = (input.settings ?? {}) as Partial<ProfileSettings>;
  return {
    ...base,
    ...input,
    managerName: typeof input.managerName === 'string' ? input.managerName.slice(0, 24) : base.managerName,
    rating: Number.isFinite(input.rating) ? Math.max(0, Math.round(input.rating as number)) : base.rating,
    stats: { ...base.stats, ...(input.stats ?? {}) },
    achievements: { ...(input.achievements ?? {}) },
    completedChallenges: Array.isArray(input.completedChallenges) ? input.completedChallenges : [],
    history: Array.isArray(input.history) ? input.history.slice(0, HISTORY_KEPT) : [],
    settings: {
      quickBuild: typeof settings.quickBuild === 'boolean' ? settings.quickBuild : DEFAULT_SETTINGS.quickBuild,
    },
    suggestions: Array.isArray(input.suggestions) ? input.suggestions.slice(0, SUGGESTION_LIMITS.kept) : [],
  };
}

export interface UnlockEvent {
  id: string;
  name: string;
  description: string;
}

interface ProfileStore {
  profile: Profile;
  hydrated: boolean;
  /** Achievements unlocked by the most recent action, for the UI to celebrate. */
  pendingUnlocks: UnlockEvent[];
  hydrate: () => Promise<void>;
  setManagerName: (name: string) => void;
  registerSpin: (categoryId: string) => void;
  recordDuel: (record: DuelRecord, flags: DuelFlags) => void;
  completeChallenge: (id: string) => void;
  setQuickBuild: (enabled: boolean) => void;
  /** Saves an already-checked suggestion (see `checkSuggestion`). */
  addSuggestion: (suggestion: Omit<CategorySuggestion, 'id' | 'createdAt'>) => void;
  removeSuggestion: (id: string) => void;
  clearUnlocks: () => void;
  reset: () => Promise<void>;
}

export interface DuelFlags {
  cleanSheet: boolean;
  goalsScored: number;
  wonOnPenalties: boolean;
  legendaryCategory: boolean;
  chemistry: number;
  opponentOverall: number;
  ownOverall: number;
}

function persist(profile: Profile) {
  void idbSet(STORAGE_KEY, profile).catch(() => {
    // Private browsing or a full quota should degrade to a session-only
    // profile rather than breaking the game.
  });
}

function applyAchievements(profile: Profile, flags: DuelFlags, record: DuelRecord): UnlockEvent[] {
  const before = { ...profile.achievements };
  const bump = (id: string, value: number) => {
    profile.achievements[id] = Math.max(profile.achievements[id] ?? 0, value);
  };

  const s = profile.stats;
  bump('ten-duels', s.played);
  bump('fifty-duels', s.played);
  bump('streak-3', s.bestStreak);
  bump('streak-7', s.bestStreak);
  bump('wheel-50', s.spins);
  bump('collector', s.categoriesSeen.length);
  bump('challenge-5', profile.completedChallenges.length);

  if (record.result === 'win') {
    bump('first-blood', 1);
    if (flags.cleanSheet) bump('clean-sheet', 1);
    if (flags.wonOnPenalties) bump('shootout', 1);
    if (flags.legendaryCategory) bump('legendary-spin', 1);
    if (flags.opponentOverall - flags.ownOverall >= 10) bump('giant-killer', 1);
  }
  if (flags.goalsScored >= 5) bump('five-goals', 1);
  if (flags.chemistry >= 90) bump('perfect-chem', 1);

  const unlocked: UnlockEvent[] = [];
  for (const achievement of ACHIEVEMENTS) {
    const now = profile.achievements[achievement.id] ?? 0;
    const then = before[achievement.id] ?? 0;
    if (then < achievement.target && now >= achievement.target) {
      unlocked.push({ id: achievement.id, name: achievement.name, description: achievement.description });
    }
  }
  return unlocked;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: createProfile(),
  hydrated: false,
  pendingUnlocks: [],

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const stored = await idbGet(STORAGE_KEY);
      set({ profile: reconcile(stored), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  setManagerName: (name) => {
    const managerName = name.trim().slice(0, 24) || 'You';
    const profile = { ...get().profile, managerName };
    set({ profile });
    persist(profile);
  },

  registerSpin: (categoryId) => {
    const current = get().profile;
    const categoriesSeen = current.stats.categoriesSeen.includes(categoryId)
      ? current.stats.categoriesSeen
      : [...current.stats.categoriesSeen, categoryId];
    const profile: Profile = {
      ...current,
      stats: { ...current.stats, spins: current.stats.spins + 1, categoriesSeen },
    };
    set({ profile });
    persist(profile);
  },

  recordDuel: (record, flags) => {
    const current = get().profile;
    const won = record.result === 'win';
    const streak = won ? current.stats.streak + 1 : 0;

    const profile: Profile = {
      ...current,
      rating: Math.max(0, current.rating + record.ratingDelta),
      stats: {
        ...current.stats,
        played: current.stats.played + 1,
        won: current.stats.won + (won ? 1 : 0),
        drawn: current.stats.drawn + (record.result === 'draw' ? 1 : 0),
        lost: current.stats.lost + (record.result === 'loss' ? 1 : 0),
        goalsFor: current.stats.goalsFor + record.home.goals,
        goalsAgainst: current.stats.goalsAgainst + record.away.goals,
        streak,
        bestStreak: Math.max(current.stats.bestStreak, streak),
      },
      achievements: { ...current.achievements },
      history: [record, ...current.history].slice(0, HISTORY_KEPT),
    };

    const unlocks = applyAchievements(profile, flags, record);
    set({ profile, pendingUnlocks: unlocks });
    persist(profile);
  },

  completeChallenge: (id) => {
    const current = get().profile;
    if (current.completedChallenges.includes(id)) return;
    const profile: Profile = {
      ...current,
      completedChallenges: [...current.completedChallenges, id],
    };
    set({ profile });
    persist(profile);
  },

  setQuickBuild: (enabled) => {
    const current = get().profile;
    const profile: Profile = { ...current, settings: { ...current.settings, quickBuild: enabled } };
    set({ profile });
    persist(profile);
  },

  addSuggestion: (suggestion) => {
    const current = get().profile;
    const createdAt = Date.now();
    const entry: CategorySuggestion = { ...suggestion, id: `s-${createdAt.toString(36)}`, createdAt };
    const profile: Profile = {
      ...current,
      suggestions: [entry, ...current.suggestions].slice(0, SUGGESTION_LIMITS.kept),
    };
    set({ profile });
    persist(profile);
  },

  removeSuggestion: (id) => {
    const current = get().profile;
    const profile: Profile = { ...current, suggestions: current.suggestions.filter((s) => s.id !== id) };
    set({ profile });
    persist(profile);
  },

  clearUnlocks: () => set({ pendingUnlocks: [] }),

  reset: async () => {
    await idbDel(STORAGE_KEY).catch(() => {});
    set({ profile: createProfile(), pendingUnlocks: [] });
  },
}));
