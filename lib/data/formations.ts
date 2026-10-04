import type { Formation } from '@/lib/domain/types';

/**
 * Coordinates are percentages of the pitch board: x runs left (0) to right
 * (100), y runs from your own goal line (0) to the halfway line and beyond
 * (100 is the top of the attacking third as drawn). The same numbers drive the
 * pitch view on every breakpoint, so the shape never distorts.
 *
 * Spacing is checked, not eyeballed: `lib/engine/pitch-layout.ts` turns these
 * numbers into each token's box, labels included, at 375 to 1440px, and the
 * verifier refuses any formation where two boxes overlap. On a phone that means
 * two slots less than about 16 apart across need about 22 apart up the pitch,
 * which is why the keeper sits on the line (y 0) and every back line at 20–22.
 */
export const FORMATIONS: Formation[] = [
  {
    id: '4-3-3',
    name: 'Front Three',
    shape: '4-3-3',
    bias: { attack: 1.05, midfield: 1.0, defence: 0.98 },
    slots: [
      { id: 'gk', role: 'GK', x: 50, y: 0 },
      { id: 'lb', role: 'LB', x: 12, y: 27 },
      { id: 'lcb', role: 'CB', x: 35, y: 22 },
      { id: 'rcb', role: 'CB', x: 65, y: 22 },
      { id: 'rb', role: 'RB', x: 88, y: 27 },
      { id: 'cdm', role: 'CDM', x: 50, y: 44 },
      { id: 'lcm', role: 'CM', x: 29, y: 58 },
      { id: 'rcm', role: 'CM', x: 71, y: 58 },
      { id: 'lw', role: 'LW', x: 14, y: 82 },
      { id: 'st', role: 'ST', x: 50, y: 88 },
      { id: 'rw', role: 'RW', x: 86, y: 82 },
    ],
  },
  {
    // The front three with a ten behind them: two central midfielders (a
    // holding player fits the deeper of them) and a CAM in the pocket.
    id: '4-3-3-cam',
    name: 'Attacking Three',
    shape: '4-3-3 CAM',
    bias: { attack: 1.07, midfield: 1.02, defence: 0.95 },
    slots: [
      { id: 'gk', role: 'GK', x: 50, y: 0 },
      { id: 'lb', role: 'LB', x: 12, y: 27 },
      { id: 'lcb', role: 'CB', x: 35, y: 22 },
      { id: 'rcb', role: 'CB', x: 65, y: 22 },
      { id: 'rb', role: 'RB', x: 88, y: 27 },
      { id: 'lcm', role: 'CM', x: 32, y: 48 },
      { id: 'rcm', role: 'CM', x: 68, y: 48 },
      { id: 'cam', role: 'CAM', x: 50, y: 66 },
      { id: 'lw', role: 'LW', x: 14, y: 82 },
      { id: 'st', role: 'ST', x: 50, y: 88 },
      { id: 'rw', role: 'RW', x: 86, y: 82 },
    ],
  },
  {
    id: '4-2-3-1',
    name: 'Double Pivot',
    shape: '4-2-3-1',
    bias: { attack: 1.0, midfield: 1.05, defence: 1.0 },
    slots: [
      { id: 'gk', role: 'GK', x: 50, y: 0 },
      { id: 'lb', role: 'LB', x: 12, y: 27 },
      { id: 'lcb', role: 'CB', x: 35, y: 22 },
      { id: 'rcb', role: 'CB', x: 65, y: 22 },
      { id: 'rb', role: 'RB', x: 88, y: 27 },
      { id: 'ldm', role: 'CDM', x: 35, y: 44 },
      { id: 'rdm', role: 'CDM', x: 65, y: 44 },
      { id: 'lam', role: 'LM', x: 14, y: 66 },
      { id: 'cam', role: 'CAM', x: 50, y: 66 },
      { id: 'ram', role: 'RM', x: 86, y: 66 },
      { id: 'st', role: 'ST', x: 50, y: 88 },
    ],
  },
  {
    // A three-man midfield under a ten, feeding two strikers through the middle.
    id: '4-3-1-2',
    name: 'Number Ten',
    shape: '4-3-1-2',
    bias: { attack: 1.03, midfield: 1.05, defence: 0.97 },
    slots: [
      { id: 'gk', role: 'GK', x: 50, y: 0 },
      { id: 'lb', role: 'LB', x: 12, y: 27 },
      { id: 'lcb', role: 'CB', x: 35, y: 22 },
      { id: 'rcb', role: 'CB', x: 65, y: 22 },
      { id: 'rb', role: 'RB', x: 88, y: 27 },
      { id: 'cdm', role: 'CDM', x: 50, y: 44 },
      { id: 'lcm', role: 'CM', x: 28, y: 54 },
      { id: 'rcm', role: 'CM', x: 72, y: 54 },
      { id: 'cam', role: 'CAM', x: 50, y: 66 },
      { id: 'lst', role: 'ST', x: 34, y: 88 },
      { id: 'rst', role: 'ST', x: 66, y: 88 },
    ],
  },
  {
    id: '4-4-2',
    name: 'Flat Four',
    shape: '4-4-2',
    bias: { attack: 1.0, midfield: 0.98, defence: 1.06 },
    slots: [
      { id: 'gk', role: 'GK', x: 50, y: 0 },
      { id: 'lb', role: 'LB', x: 12, y: 27 },
      { id: 'lcb', role: 'CB', x: 35, y: 22 },
      { id: 'rcb', role: 'CB', x: 65, y: 22 },
      { id: 'rb', role: 'RB', x: 88, y: 27 },
      { id: 'lm', role: 'LM', x: 12, y: 55 },
      { id: 'lcm', role: 'CM', x: 37, y: 50 },
      { id: 'rcm', role: 'CM', x: 63, y: 50 },
      { id: 'rm', role: 'RM', x: 88, y: 55 },
      { id: 'lst', role: 'ST', x: 37, y: 84 },
      { id: 'rst', role: 'ST', x: 63, y: 84 },
    ],
  },
  {
    id: '4-1-4-1',
    name: 'Low Block',
    shape: '4-1-4-1',
    bias: { attack: 0.94, midfield: 1.02, defence: 1.1 },
    slots: [
      { id: 'gk', role: 'GK', x: 50, y: 0 },
      { id: 'lb', role: 'LB', x: 12, y: 27 },
      { id: 'lcb', role: 'CB', x: 35, y: 22 },
      { id: 'rcb', role: 'CB', x: 65, y: 22 },
      { id: 'rb', role: 'RB', x: 88, y: 27 },
      { id: 'cdm', role: 'CDM', x: 50, y: 44 },
      { id: 'lm', role: 'LM', x: 12, y: 62 },
      { id: 'lcm', role: 'CM', x: 32, y: 64 },
      { id: 'rcm', role: 'CM', x: 68, y: 64 },
      { id: 'rm', role: 'RM', x: 88, y: 62 },
      { id: 'st', role: 'ST', x: 50, y: 88 },
    ],
  },
  {
    id: '3-5-2',
    name: 'Wing-Backs',
    shape: '3-5-2',
    bias: { attack: 1.02, midfield: 1.06, defence: 0.96 },
    slots: [
      { id: 'gk', role: 'GK', x: 50, y: 0 },
      { id: 'lcb', role: 'CB', x: 28, y: 22 },
      { id: 'ccb', role: 'CB', x: 50, y: 22 },
      { id: 'rcb', role: 'CB', x: 72, y: 22 },
      { id: 'lwb', role: 'LWB', x: 10, y: 48 },
      { id: 'rwb', role: 'RWB', x: 90, y: 48 },
      { id: 'cdm', role: 'CDM', x: 50, y: 44 },
      { id: 'lcm', role: 'CM', x: 32, y: 58 },
      { id: 'rcm', role: 'CM', x: 68, y: 58 },
      { id: 'lst', role: 'ST', x: 38, y: 86 },
      { id: 'rst', role: 'ST', x: 62, y: 86 },
    ],
  },
  {
    // Three centre backs, four across midfield and a front three.
    id: '3-4-3',
    name: 'Three at the Back',
    shape: '3-4-3',
    bias: { attack: 1.08, midfield: 1.0, defence: 0.93 },
    slots: [
      { id: 'gk', role: 'GK', x: 50, y: 0 },
      { id: 'lcb', role: 'CB', x: 28, y: 22 },
      { id: 'ccb', role: 'CB', x: 50, y: 22 },
      { id: 'rcb', role: 'CB', x: 72, y: 22 },
      { id: 'lm', role: 'LM', x: 12, y: 52 },
      { id: 'lcm', role: 'CM', x: 37, y: 48 },
      { id: 'rcm', role: 'CM', x: 63, y: 48 },
      { id: 'rm', role: 'RM', x: 88, y: 52 },
      { id: 'lw', role: 'LW', x: 15, y: 80 },
      { id: 'st', role: 'ST', x: 50, y: 88 },
      { id: 'rw', role: 'RW', x: 85, y: 80 },
    ],
  },
  {
    id: '5-3-2',
    name: 'Back Five',
    shape: '5-3-2',
    bias: { attack: 0.98, midfield: 0.96, defence: 1.12 },
    slots: [
      { id: 'gk', role: 'GK', x: 50, y: 0 },
      // A back five: three centre backs with a wing-back either side of them,
      // sitting lower than the 3-5-2's, where the same players are the width
      // of the midfield rather than the edge of the defence.
      { id: 'lwb', role: 'LWB', x: 10, y: 32 },
      { id: 'lcb', role: 'CB', x: 29, y: 20 },
      // Straight in front of the keeper, so it sits a full token clear above him.
      { id: 'ccb', role: 'CB', x: 50, y: 22 },
      { id: 'rcb', role: 'CB', x: 71, y: 20 },
      { id: 'rwb', role: 'RWB', x: 90, y: 32 },
      { id: 'cdm', role: 'CDM', x: 50, y: 44 },
      { id: 'lcm', role: 'CM', x: 28, y: 56 },
      { id: 'rcm', role: 'CM', x: 72, y: 56 },
      { id: 'lst', role: 'ST', x: 38, y: 84 },
      { id: 'rst', role: 'ST', x: 62, y: 84 },
    ],
  },
  {
    // The back five, a two-man midfield and a front three to break with.
    id: '5-2-3',
    name: 'Wide Counter',
    shape: '5-2-3',
    bias: { attack: 1.04, midfield: 0.95, defence: 1.05 },
    slots: [
      { id: 'gk', role: 'GK', x: 50, y: 0 },
      { id: 'lwb', role: 'LWB', x: 10, y: 34 },
      { id: 'lcb', role: 'CB', x: 29, y: 20 },
      { id: 'ccb', role: 'CB', x: 50, y: 22 },
      { id: 'rcb', role: 'CB', x: 71, y: 20 },
      { id: 'rwb', role: 'RWB', x: 90, y: 34 },
      { id: 'lcm', role: 'CM', x: 35, y: 48 },
      { id: 'rcm', role: 'CM', x: 65, y: 48 },
      { id: 'lw', role: 'LW', x: 15, y: 78 },
      { id: 'st', role: 'ST', x: 50, y: 88 },
      { id: 'rw', role: 'RW', x: 85, y: 78 },
    ],
  },
  {
    // Everyone behind the ball bar one: five at the back, four across the middle.
    id: '5-4-1',
    name: 'Deep Block',
    shape: '5-4-1',
    bias: { attack: 0.9, midfield: 1.03, defence: 1.13 },
    slots: [
      { id: 'gk', role: 'GK', x: 50, y: 0 },
      { id: 'lwb', role: 'LWB', x: 10, y: 32 },
      { id: 'lcb', role: 'CB', x: 29, y: 20 },
      { id: 'ccb', role: 'CB', x: 50, y: 22 },
      { id: 'rcb', role: 'CB', x: 71, y: 20 },
      { id: 'rwb', role: 'RWB', x: 90, y: 32 },
      { id: 'lm', role: 'LM', x: 12, y: 58 },
      { id: 'lcm', role: 'CM', x: 37, y: 50 },
      { id: 'rcm', role: 'CM', x: 63, y: 50 },
      { id: 'rm', role: 'RM', x: 88, y: 58 },
      { id: 'st', role: 'ST', x: 50, y: 86 },
    ],
  },
];

export const FORMATION_BY_ID = new Map(FORMATIONS.map((f) => [f.id, f]));

export function requireFormation(id: string): Formation {
  const f = FORMATION_BY_ID.get(id);
  if (!f) throw new Error(`Unknown formation id: ${id}`);
  return f;
}

/**
 * Roles a player can cover for a given slot, ordered by how natural the fit is.
 * Playing out of position is allowed but costs chemistry, which is exactly the
 * tension a narrow category is meant to create.
 */
export const ROLE_ADJACENCY: Record<string, string[]> = {
  GK: [],
  LB: ['LWB', 'CB', 'LM'],
  RB: ['RWB', 'CB', 'RM'],
  LWB: ['LB', 'LM', 'LW'],
  RWB: ['RB', 'RM', 'RW'],
  CB: ['CDM', 'LB', 'RB'],
  CDM: ['CM', 'CB'],
  CM: ['CDM', 'CAM', 'LM', 'RM'],
  CAM: ['CM', 'CF', 'LW', 'RW'],
  LM: ['LW', 'CM', 'LWB'],
  RM: ['RW', 'CM', 'RWB'],
  LW: ['LM', 'CAM', 'ST'],
  RW: ['RM', 'CAM', 'ST'],
  ST: ['CF', 'LW', 'RW'],
  CF: ['ST', 'CAM'],
};
