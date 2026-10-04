import type { AIDifficulty, Category, Player, Squad } from '@/lib/domain/types';
import { FORMATIONS, requireFormation } from '@/lib/data/formations';
import { effectiveRating, poolFor } from './filters';
import { emptySquad, rateSquad } from './rating';
import { createRng, type Rng } from './rng';

export interface AIManagerProfile {
  id: string;
  name: string;
  difficulty: AIDifficulty;
  /** Flavour line shown on the opponent card. */
  tagline: string;
  rating: number;
}

/**
 * The opponents.
 *
 * Every one of them is this program drafting a side, so every one of them says
 * so. They were once given invented human names, which is a small lie told to
 * the one person who cannot check it: a manager who loses to "Ren Sato" has no
 * way to know whether anybody was ever there. The difficulty and the drafting
 * habit are the real differences between them, so that is what the name
 * carries now.
 *
 * Ids are stable: the opponent for a seed is picked from this list, and
 * renaming a profile must not change who a given draw faces.
 */
export const AI_MANAGERS: AIManagerProfile[] = [
  { id: 'ai-marchetti', name: 'FutDuel AI · Sunday', difficulty: 'amateur', tagline: 'Sunday league heart, Sunday league defending.', rating: 780 },
  { id: 'ai-okafor', name: 'FutDuel AI · Instinct', difficulty: 'amateur', tagline: 'Picks on a hunch, not a spreadsheet.', rating: 840 },
  { id: 'ai-lindqvist', name: 'FutDuel AI · Anchor', difficulty: 'pro', tagline: 'Builds the midfield first, always.', rating: 1120 },
  { id: 'ai-bakare', name: 'FutDuel AI · Engine', difficulty: 'pro', tagline: 'Will out-run you for ninety minutes.', rating: 1180 },
  { id: 'ai-sato', name: 'FutDuel AI · Chemistry', difficulty: 'pro', tagline: 'Chemistry obsessive. Never plays anyone out of position.', rating: 1240 },
  { id: 'ai-varela', name: 'FutDuel AI · Analyst', difficulty: 'elite', tagline: 'Reads the category and solves it in seconds.', rating: 1620 },
  { id: 'ai-kowalczyk', name: 'FutDuel AI · Ruthless', difficulty: 'elite', tagline: 'Takes the best eleven and dares you to match it.', rating: 1710 },
];

const DIFFICULTY: Record<AIDifficulty, { window: number; chemWeight: number; formationSense: number }> = {
  // `window` is how far down the shortlist the AI is willing to reach.
  amateur: { window: 7, chemWeight: 0.2, formationSense: 0.2 },
  pro: { window: 3, chemWeight: 1.1, formationSense: 0.7 },
  elite: { window: 1, chemWeight: 1.8, formationSense: 1 },
};

/** Picks a shape that suits what the category actually offers. */
function chooseFormation(pool: Player[], rng: Rng, sense: number): string {
  const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of pool.slice(0, 40)) counts[p.position] += 1;

  if (rng.next() > sense) return rng.pick(FORMATIONS).id;

  if (counts.FWD >= 12 && counts.DEF < 12) return '3-5-2';
  if (counts.DEF >= 16 && counts.FWD < 8) return '4-1-4-1';
  if (counts.MID >= 14) return '4-2-3-1';
  if (counts.FWD >= 10) return '4-3-3';
  return '4-4-2';
}

/**
 * Greedy slot-by-slot draft. The AI fills the spine first (keeper, centre
 * backs, holding midfield) because that is what a human does under pressure,
 * then adds the flair. Difficulty controls how far down its own shortlist it
 * is willing to reach and how much it values chemistry.
 */
export function draftSquad(
  category: Category,
  difficulty: AIDifficulty,
  seed: string,
): Squad {
  const rng = createRng(`${seed}:${category.id}:${difficulty}`);
  const settings = DIFFICULTY[difficulty];
  const pool = poolFor(category);

  if (pool.length < 11) {
    // Should be impossible for shipped categories, but never crash a duel.
    return emptySquad('4-3-3');
  }

  const formationId = chooseFormation(pool, rng, settings.formationSense);
  const formation = requireFormation(formationId);
  const squad = emptySquad(formationId);

  const priority = ['GK', 'CB', 'CDM', 'ST', 'CM', 'LB', 'RB', 'LWB', 'RWB', 'CAM', 'LW', 'RW', 'LM', 'RM', 'CF'];
  const slots = [...formation.slots].sort(
    (a, b) => priority.indexOf(a.role) - priority.indexOf(b.role),
  );

  // Keyed by footballer, not by card: two versions of one player are still one
  // player, and cannot both start.
  const taken = new Set<string>();
  const clubCount = new Map<string, number>();
  const nationCount = new Map<string, number>();

  for (const slot of slots) {
    const candidates = pool
      .filter((p) => !taken.has(p.identityId))
      .filter((p) => (slot.role === 'GK' ? p.position === 'GK' : p.position !== 'GK'))
      .map((player) => {
        const chem =
          (clubCount.get(player.clubId) ?? 0) * 3.2 + (nationCount.get(player.nation) ?? 0) * 2.1;
        const noise = (rng.next() - 0.5) * (difficulty === 'amateur' ? 10 : difficulty === 'pro' ? 4 : 1.5);
        return {
          player,
          score: effectiveRating(player, slot.role) + chem * settings.chemWeight + noise,
        };
      })
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) continue;
    const window = Math.min(settings.window, candidates.length);
    const chosen = candidates[rng.int(0, window - 1)]!.player;

    squad.picks[slot.id] = chosen.id;
    taken.add(chosen.identityId);
    clubCount.set(chosen.clubId, (clubCount.get(chosen.clubId) ?? 0) + 1);
    nationCount.set(chosen.nation, (nationCount.get(chosen.nation) ?? 0) + 1);
  }

  return squad;
}

/**
 * Drafts repeatedly until the squad clears a strength floor, so a challenge
 * that promises a hard opponent actually delivers one.
 */
export function draftSquadAtLeast(
  category: Category,
  difficulty: AIDifficulty,
  seed: string,
  floor: number,
  attempts = 12,
): Squad {
  let best = draftSquad(category, difficulty, seed);
  let bestOverall = rateSquad(best).overall;
  for (let i = 1; i < attempts && bestOverall < floor; i++) {
    const candidate = draftSquad(category, difficulty, `${seed}:${i}`);
    const overall = rateSquad(candidate).overall;
    if (overall > bestOverall) {
      best = candidate;
      bestOverall = overall;
    }
  }
  return best;
}

export function pickOpponent(difficulty: AIDifficulty, seed: string): AIManagerProfile {
  const rng = createRng(`opponent:${seed}`);
  const options = AI_MANAGERS.filter((m) => m.difficulty === difficulty);
  return rng.pick(options.length > 0 ? options : AI_MANAGERS);
}
