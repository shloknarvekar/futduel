import type { Player, Squad, SquadRating } from '@/lib/domain/types';
import { requireFormation } from '@/lib/data/formations';
import { getPlayer } from '@/lib/data/players';
import { effectiveRating, fitFor } from './filters';

/** How much each slot role feeds the three phases of play. */
const PHASE_WEIGHTS: Record<string, { attack: number; midfield: number; defence: number }> = {
  GK: { attack: 0, midfield: 0, defence: 1.15 },
  CB: { attack: 0.05, midfield: 0.15, defence: 1 },
  LB: { attack: 0.2, midfield: 0.25, defence: 0.85 },
  RB: { attack: 0.2, midfield: 0.25, defence: 0.85 },
  LWB: { attack: 0.4, midfield: 0.35, defence: 0.6 },
  RWB: { attack: 0.4, midfield: 0.35, defence: 0.6 },
  CDM: { attack: 0.1, midfield: 0.7, defence: 0.6 },
  CM: { attack: 0.3, midfield: 1, defence: 0.35 },
  CAM: { attack: 0.6, midfield: 0.7, defence: 0.1 },
  LM: { attack: 0.5, midfield: 0.65, defence: 0.2 },
  RM: { attack: 0.5, midfield: 0.65, defence: 0.2 },
  LW: { attack: 0.95, midfield: 0.3, defence: 0.05 },
  RW: { attack: 0.95, midfield: 0.3, defence: 0.05 },
  CF: { attack: 1, midfield: 0.35, defence: 0.05 },
  ST: { attack: 1.15, midfield: 0.15, defence: 0.02 },
};

const mean = (...n: number[]) => n.reduce((a, b) => a + b, 0) / n.length;

function phaseScores(player: Player, role: string) {
  const eff = effectiveRating(player, role as never);
  const a = player.attributes;
  // Goalkeeper attributes are stored as reflexes/handling/kicking/speed/
  // positioning/aerial in the same six slots.
  if (player.position === 'GK') {
    return {
      attack: 0,
      midfield: 0.6 * eff + 0.4 * mean(a.passing, a.dribbling),
      defence: 0.6 * eff + 0.4 * mean(a.pace, a.defending, a.shooting),
    };
  }
  return {
    attack: 0.6 * eff + 0.4 * mean(a.shooting, a.dribbling, a.pace),
    midfield: 0.6 * eff + 0.4 * mean(a.passing, a.dribbling, a.physical),
    defence: 0.6 * eff + 0.4 * mean(a.defending, a.physical, a.pace),
  };
}

export interface ChemistryBreakdown {
  score: number;
  links: { label: string; count: number }[];
}

/**
 * Chemistry rewards a squad that could plausibly have played together: shared
 * clubs first, then nationality, then league. Playing people out of position
 * costs you, which is where a narrow category starts to bite.
 */
export function chemistryFor(players: { player: Player; role: string }[]): ChemistryBreakdown {
  if (players.length === 0) return { score: 0, links: [] };

  const tally = (key: (p: Player) => string) => {
    const map = new Map<string, number>();
    for (const { player } of players) map.set(key(player), (map.get(key(player)) ?? 0) + 1);
    return map;
  };

  const clubs = tally((p) => p.club);
  const nations = tally((p) => p.nation);
  const leagues = tally((p) => p.league);

  let score = 28;
  const links: { label: string; count: number }[] = [];

  for (const [club, n] of clubs) {
    if (n >= 2) {
      score += (n - 1) * 4.5;
      links.push({ label: club, count: n });
    }
  }
  for (const [nation, n] of nations) {
    if (n >= 2) {
      score += (n - 1) * 3;
      links.push({ label: nation, count: n });
    }
  }
  for (const [league, n] of leagues) {
    // Other leagues is a bucket, not a competition: two players in it never
    // shared a league, so it links nobody.
    if (league === 'other-leagues') continue;
    if (n >= 2) score += (n - 1) * 1.1;
  }

  for (const { player, role } of players) {
    const fit = fitFor(player, role as never);
    if (fit === 'natural') score += 1.6;
    else if (fit === 'out-of-position') score -= 5;
  }

  links.sort((a, b) => b.count - a.count);

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    links: links.slice(0, 5),
  };
}

const EMPTY: SquadRating = {
  attack: 0, midfield: 0, defence: 0, chemistry: 0, overall: 0, spend: 0, links: [],
};

export function rateSquad(squad: Squad): SquadRating {
  const formation = requireFormation(squad.formationId);
  const filled: { player: Player; role: string }[] = [];

  for (const slot of formation.slots) {
    const id = squad.picks[slot.id];
    if (!id) continue;
    const player = getPlayer(id);
    if (player) filled.push({ player, role: slot.role });
  }

  if (filled.length === 0) return EMPTY;

  let attackNum = 0, attackDen = 0;
  let midNum = 0, midDen = 0;
  let defNum = 0, defDen = 0;
  let spend = 0;

  for (const { player, role } of filled) {
    const w = PHASE_WEIGHTS[role] ?? { attack: 0.3, midfield: 0.5, defence: 0.3 };
    const s = phaseScores(player, role);
    attackNum += s.attack * w.attack; attackDen += w.attack;
    midNum += s.midfield * w.midfield; midDen += w.midfield;
    defNum += s.defence * w.defence; defDen += w.defence;
    // Historical versions have no present-day value, so they add nothing.
    spend += player.value ?? 0;
  }

  const chem = chemistryFor(filled);
  // Chemistry moves the needle without ever dwarfing raw quality.
  const chemMultiplier = 0.94 + (chem.score / 100) * 0.1;

  // An incomplete squad is rated as if the empty slots are league-average, so
  // the number you see while building is honest rather than flattering.
  const completeness = filled.length / formation.slots.length;
  const settle = (num: number, den: number) => {
    const raw = den > 0 ? num / den : 0;
    return raw * completeness + 62 * (1 - completeness);
  };

  const attack = settle(attackNum, attackDen) * formation.bias.attack * chemMultiplier;
  const midfield = settle(midNum, midDen) * formation.bias.midfield * chemMultiplier;
  const defence = settle(defNum, defDen) * formation.bias.defence * chemMultiplier;

  const r = (n: number) => Math.round(n * 10) / 10;

  return {
    attack: r(attack),
    midfield: r(midfield),
    defence: r(defence),
    chemistry: chem.score,
    overall: r((attack + midfield * 1.1 + defence) / 3.1),
    spend: Math.round(spend),
    links: chem.links,
  };
}

export function isSquadComplete(squad: Squad): boolean {
  const formation = requireFormation(squad.formationId);
  return formation.slots.every((s) => Boolean(squad.picks[s.id]));
}

export function emptySquad(formationId: string): Squad {
  const formation = requireFormation(formationId);
  return {
    formationId,
    picks: Object.fromEntries(formation.slots.map((s) => [s.id, null])),
  };
}
