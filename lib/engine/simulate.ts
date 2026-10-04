import type {
  Category,
  MatchEvent,
  MatchResult,
  Player,
  Squad,
  SquadRating,
} from '@/lib/domain/types';
import { requireFormation } from '@/lib/data/formations';
import { getPlayer } from '@/lib/data/players';
import { createRng, type Rng } from './rng';

export interface SimSide {
  name: string;
  squad: Squad;
  rating: SquadRating;
  category: Category;
}

export interface SimInput {
  seed: string;
  home: SimSide;
  away: SimSide;
  /** When true a draw is settled on penalties. */
  decisive?: boolean;
}

interface Contributor {
  player: Player;
  role: string;
  /** Likelihood of being the one to finish a chance. */
  finishing: number;
  /** Likelihood of being the one to create it. */
  creating: number;
  defensive: number;
}

const FINISH_WEIGHT: Record<string, number> = {
  ST: 1, CF: 0.95, LW: 0.75, RW: 0.75, CAM: 0.6, LM: 0.45, RM: 0.45,
  CM: 0.3, CDM: 0.12, LWB: 0.12, RWB: 0.12, LB: 0.08, RB: 0.08, CB: 0.07, GK: 0,
};

const CREATE_WEIGHT: Record<string, number> = {
  CAM: 1, CM: 0.85, LW: 0.8, RW: 0.8, LM: 0.75, RM: 0.75, LWB: 0.6, RWB: 0.6,
  ST: 0.5, CF: 0.6, CDM: 0.45, LB: 0.4, RB: 0.4, CB: 0.12, GK: 0.04,
};

function contributors(squad: Squad): Contributor[] {
  const formation = requireFormation(squad.formationId);
  const out: Contributor[] = [];
  for (const slot of formation.slots) {
    const id = squad.picks[slot.id];
    if (!id) continue;
    const player = getPlayer(id);
    if (!player) continue;
    const a = player.attributes;
    out.push({
      player,
      role: slot.role,
      finishing: (FINISH_WEIGHT[slot.role] ?? 0.2) * (a.shooting * 0.6 + a.dribbling * 0.4) ** 1.4,
      creating: (CREATE_WEIGHT[slot.role] ?? 0.3) * (a.passing * 0.7 + a.dribbling * 0.3) ** 1.2,
      defensive: (a.defending * 0.7 + a.physical * 0.3) ** 1.2,
    });
  }
  return out;
}

function weightedPick(rng: Rng, items: Contributor[], key: keyof Contributor): Contributor | null {
  const pool = items.filter((i) => (i[key] as number) > 0);
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, i) => sum + (i[key] as number), 0);
  let roll = rng.next() * total;
  for (const item of pool) {
    roll -= item[key] as number;
    if (roll <= 0) return item;
  }
  return pool[pool.length - 1]!;
}

function keeperOf(squad: Squad): Player | null {
  const formation = requireFormation(squad.formationId);
  const gkSlot = formation.slots.find((s) => s.role === 'GK');
  const id = gkSlot ? squad.picks[gkSlot.id] : null;
  return id ? getPlayer(id) ?? null : null;
}

/* -------------------------------------------------------------------------- */
/* Commentary                                                                 */
/* -------------------------------------------------------------------------- */

const GOAL_LINES = [
  '{scorer} finishes it off, {assist} with the pass.',
  '{scorer} buries it. {assist} did the hard work.',
  'Cut back from {assist} and {scorer} makes no mistake.',
  '{scorer} gets across his marker and steers it home.',
  '{assist} slides it through, {scorer} is ice cold.',
];

const SOLO_GOAL_LINES = [
  '{scorer} takes it himself and absolutely leathers it.',
  'Nobody closes {scorer} down — and that is a goal from range.',
  '{scorer} dances through two and finishes low.',
];

const SAVE_LINES = [
  '{keeper} gets a strong hand to {shooter}.',
  'Enormous save. {keeper} denies {shooter} from close range.',
  '{shooter} thought that was in — {keeper} says otherwise.',
];

const CHANCE_LINES = [
  '{shooter} drags it wide with the goal at his mercy.',
  'Half a yard was all {shooter} needed. He did not get it.',
  '{shooter} snatches at the shot and it climbs into the stand.',
];

const WOODWORK_LINES = [
  '{shooter} rattles the post. Millimetres.',
  'Off the bar from {shooter} and away to safety.',
];

const CARD_LINES = [
  '{player} goes into the book for a cynical trip.',
  'Late and clumsy from {player}. Yellow.',
];

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? 'someone');
}

/* -------------------------------------------------------------------------- */
/* Simulation                                                                 */
/* -------------------------------------------------------------------------- */

interface Shot {
  minute: number;
  side: 'home' | 'away';
  xg: number;
  goal: boolean;
  onTarget: boolean;
  woodwork: boolean;
  shooter: Contributor | null;
  assist: Contributor | null;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function simulateMatch(input: SimInput): MatchResult {
  const rng = createRng(input.seed);

  const mod = (side: SimSide) => ({
    attack: side.rating.attack * (side.category.modifier.attack ?? 1),
    midfield: side.rating.midfield * (side.category.modifier.midfield ?? 1),
    defence: side.rating.defence * (side.category.modifier.defence ?? 1),
    chaos: side.category.modifier.chaos ?? 1,
  });

  const H = mod(input.home);
  const A = mod(input.away);

  const homeSquad = contributors(input.home.squad);
  const awaySquad = contributors(input.away.squad);
  const homeKeeper = keeperOf(input.home.squad);
  const awayKeeper = keeperOf(input.away.squad);

  // Possession follows midfield control, damped so it never runs away.
  const midShare = H.midfield / (H.midfield + A.midfield);
  const possessionHome = clamp(50 + (midShare - 0.5) * 120, 31, 69);

  const chaos = (H.chaos + A.chaos) / 2;

  const shotCount = (attack: number, oppDefence: number, possession: number) => {
    const index = Math.pow(attack / oppDefence, 1.4);
    const base = (7 + 9.5 * (possession / 100)) * index;
    const jitter = 0.78 + rng.next() * 0.44;
    return clamp(Math.round(base * jitter), 1, 27);
  };

  const homeShots = shotCount(H.attack, A.defence, possessionHome);
  const awayShots = shotCount(A.attack, H.defence, 100 - possessionHome);

  const buildShots = (
    count: number,
    side: 'home' | 'away',
    attack: number,
    oppDefence: number,
    squad: Contributor[],
    keeper: Player | null,
  ): Shot[] => {
    const index = clamp(attack / oppDefence, 0.55, 1.8);
    const baseXg = clamp(0.128 * Math.pow(index, 1.6), 0.045, 0.34);
    // Keeper quality suppresses conversion without ever making it impossible.
    const keeperFactor = keeper
      ? clamp(1 - (keeper.rating - 78) * 0.006, 0.86, 1.12)
      : 1.14;

    const shots: Shot[] = [];
    for (let i = 0; i < count; i++) {
      const minute = rng.int(2, 94);
      // Chance quality is heavily skewed: mostly half-chances, occasionally a
      // sitter. Higher chaos flattens the skew and produces more big moments.
      const skew = 2.2 / chaos;
      const quality = 0.3 + 1.9 * Math.pow(rng.next(), skew);
      const xg = clamp(baseXg * quality * keeperFactor, 0.02, 0.86);
      const goal = rng.next() < xg;
      const woodwork = !goal && rng.next() < 0.05 * chaos;
      const onTarget = goal || (!woodwork && rng.next() < 0.42);
      shots.push({
        minute,
        side,
        xg,
        goal,
        onTarget,
        woodwork,
        shooter: weightedPick(rng, squad, 'finishing'),
        assist: weightedPick(rng, squad, 'creating'),
      });
    }
    return shots;
  };

  const shots = [
    ...buildShots(homeShots, 'home', H.attack, A.defence, homeSquad, awayKeeper),
    ...buildShots(awayShots, 'away', A.attack, H.defence, awaySquad, homeKeeper),
  ].sort((a, b) => a.minute - b.minute);

  const events: MatchEvent[] = [
    { minute: 0, side: 'neutral', type: 'whistle', text: 'We are under way at the FutDuel Arena.' },
  ];

  let homeGoals = 0;
  let awayGoals = 0;
  const goalContributions = new Map<string, { count: number; side: 'home' | 'away'; name: string; goals: number; assists: number }>();

  const credit = (c: Contributor | null, side: 'home' | 'away', kind: 'goal' | 'assist') => {
    if (!c) return;
    const key = c.player.id;
    const entry = goalContributions.get(key) ?? { count: 0, side, name: c.player.name, goals: 0, assists: 0 };
    entry.count += kind === 'goal' ? 3 : 2;
    if (kind === 'goal') entry.goals += 1;
    else entry.assists += 1;
    goalContributions.set(key, entry);
  };

  for (const shot of shots) {
    const shooterName = shot.shooter?.player.short ?? 'the forward';
    const assistName = shot.assist?.player.short ?? 'a team-mate';
    const keeperName =
      (shot.side === 'home' ? awayKeeper?.short : homeKeeper?.short) ?? 'the keeper';

    if (shot.goal) {
      if (shot.side === 'home') homeGoals++;
      else awayGoals++;
      const solo = !shot.assist || shot.assist.player.id === shot.shooter?.player.id || rng.chance(0.22);
      const template = solo ? rng.pick(SOLO_GOAL_LINES) : rng.pick(GOAL_LINES);
      events.push({
        minute: shot.minute,
        side: shot.side,
        type: 'goal',
        playerId: shot.shooter?.player.id,
        playerName: shot.shooter?.player.name,
        xg: Math.round(shot.xg * 100) / 100,
        text: fill(template, { scorer: shooterName, assist: assistName }),
      });
      credit(shot.shooter, shot.side, 'goal');
      if (!solo) credit(shot.assist, shot.side, 'assist');
    } else if (shot.woodwork) {
      events.push({
        minute: shot.minute,
        side: shot.side,
        type: 'woodwork',
        playerId: shot.shooter?.player.id,
        playerName: shot.shooter?.player.name,
        xg: Math.round(shot.xg * 100) / 100,
        text: fill(rng.pick(WOODWORK_LINES), { shooter: shooterName }),
      });
    } else if (shot.onTarget) {
      events.push({
        minute: shot.minute,
        side: shot.side,
        type: 'save',
        playerId: shot.shooter?.player.id,
        playerName: shot.shooter?.player.name,
        xg: Math.round(shot.xg * 100) / 100,
        text: fill(rng.pick(SAVE_LINES), { keeper: keeperName, shooter: shooterName }),
      });
    } else if (shot.xg > 0.18 || rng.chance(0.35)) {
      // Only narrate the misses worth narrating — a wall of blocked shots is
      // noise, not drama.
      events.push({
        minute: shot.minute,
        side: shot.side,
        type: 'chance',
        playerId: shot.shooter?.player.id,
        playerName: shot.shooter?.player.name,
        xg: Math.round(shot.xg * 100) / 100,
        text: fill(rng.pick(CHANCE_LINES), { shooter: shooterName }),
      });
    }
  }

  // A couple of bookings, scaled by how frantic the tie is.
  const cards = rng.int(0, Math.round(2 * chaos));
  for (let i = 0; i < cards; i++) {
    const side = rng.chance(0.5) ? 'home' : 'away';
    const squad = side === 'home' ? homeSquad : awaySquad;
    const victim = weightedPick(rng, squad, 'defensive');
    if (!victim) continue;
    events.push({
      minute: rng.int(12, 90),
      side,
      type: 'card',
      playerId: victim.player.id,
      playerName: victim.player.name,
      text: fill(rng.pick(CARD_LINES), { player: victim.player.short }),
    });
  }

  events.push({ minute: 45, side: 'neutral', type: 'whistle', text: 'Half time.' });
  events.push({ minute: 90, side: 'neutral', type: 'whistle', text: 'Full time.' });
  events.sort((a, b) => a.minute - b.minute || (a.type === 'whistle' ? 1 : -1));

  const sumXg = (side: 'home' | 'away') =>
    Math.round(shots.filter((s) => s.side === side).reduce((t, s) => t + s.xg, 0) * 10) / 10;

  const onTargetCount = (side: 'home' | 'away') =>
    shots.filter((s) => s.side === side && s.onTarget).length;

  let winner: MatchResult['winner'] = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw';
  let shootout: MatchResult['shootout'];

  if (winner === 'draw' && input.decisive) {
    let h = 0;
    let a = 0;
    for (let i = 0; i < 5; i++) {
      if (rng.chance(0.76)) h++;
      if (rng.chance(0.76)) a++;
    }
    while (h === a) {
      if (rng.chance(0.74)) h++;
      if (rng.chance(0.74)) a++;
    }
    shootout = { home: h, away: a };
    winner = h > a ? 'home' : 'away';
    events.push({
      minute: 120,
      side: 'neutral',
      type: 'whistle',
      text: `Penalties: ${h}-${a}.`,
    });
  }

  let motm: MatchResult['motm'];
  const ranked = [...goalContributions.entries()].sort((x, y) => y[1].count - x[1].count);
  const best = ranked[0];
  if (best) {
    const [id, entry] = best;
    const parts: string[] = [];
    if (entry.goals) parts.push(`${entry.goals} goal${entry.goals > 1 ? 's' : ''}`);
    if (entry.assists) parts.push(`${entry.assists} assist${entry.assists > 1 ? 's' : ''}`);
    motm = { playerId: id, name: entry.name, side: entry.side, line: parts.join(', ') || 'Ran the game' };
  }

  return {
    seed: input.seed,
    homeGoals,
    awayGoals,
    events,
    stats: {
      possession: [Math.round(possessionHome), 100 - Math.round(possessionHome)],
      shots: [homeShots, awayShots],
      onTarget: [onTargetCount('home'), onTargetCount('away')],
      xg: [sumXg('home'), sumXg('away')],
    },
    shootout,
    winner,
    motm,
  };
}
