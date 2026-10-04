import type { Formation } from '@/lib/domain/types';

/**
 * Where each slot's token actually lands on the builder's pitch, in pixels, so
 * a formation's coordinates can be checked for collisions without a browser.
 *
 * Every number here mirrors `components/duel/PitchBoard.tsx`: the token is a
 * square of clamp(40px, 11vw, 56px) inside a button clamp(54px, 13vw, 68px)
 * wide with 4px of vertical padding, followed by a 6px gap, the name line and,
 * once filled, the role line (11px text at a 1.25 line height). The slot's
 * `bottom` sits at (y * 0.86 + 4)% of the pitch height and its centre at x% of
 * the width. The pitch is 3:4 below the sm breakpoint and 4:4.2 above it. The
 * verifier checks PitchBoard still says the same, so the two cannot drift.
 */
export const PITCH_GEOMETRY = {
  token: { min: 40, vw: 11, max: 56 },
  width: { min: 54, vw: 13, max: 68 },
  padding: 4,
  gap: 6,
  line: 11 * 1.25,
  yScale: 0.86,
  yOffset: 4,
} as const;

/** Viewport widths the builder is checked at: two phones, a tablet, a small and a large desktop. */
export const PITCH_VIEWPORTS = [375, 390, 768, 1024, 1440] as const;

const clamp = (min: number, value: number, max: number) => Math.max(min, Math.min(max, value));

/** The pitch's width for a viewport: the page gutters, and beside the sidebar from lg up. */
export function pitchWidth(viewport: number): number {
  if (viewport < 640) return viewport - 32;
  if (viewport < 1024) return viewport - 48;
  // max-w-[1240px] with lg:px-8, then a 22rem sidebar and a 2rem gap.
  return Math.min(viewport, 1240) - 64 - 352 - 32;
}

export function pitchHeight(viewport: number): number {
  const width = pitchWidth(viewport);
  return viewport < 640 ? (width * 4) / 3 : width * 1.05;
}

export interface SlotBox {
  slotId: string;
  role: string;
  left: number;
  right: number;
  /** Distance of the box's lower edge from the bottom of the pitch. */
  bottom: number;
  top: number;
}

/** Every slot's box for a viewport. `filled` adds the role line under the name. */
export function slotBoxes(formation: Formation, viewport: number, filled = true): SlotBox[] {
  const g = PITCH_GEOMETRY;
  const width = pitchWidth(viewport);
  const height = pitchHeight(viewport);
  const token = clamp(g.token.min, (viewport * g.token.vw) / 100, g.token.max);
  const boxWidth = clamp(g.width.min, (viewport * g.width.vw) / 100, g.width.max);
  const boxHeight = g.padding * 2 + token + g.gap + g.line * (filled ? 2 : 1);
  return formation.slots.map((slot) => {
    const centre = (slot.x / 100) * width;
    const bottom = ((slot.y * g.yScale + g.yOffset) / 100) * height;
    return {
      slotId: slot.id,
      role: slot.role,
      left: centre - boxWidth / 2,
      right: centre + boxWidth / 2,
      bottom,
      top: bottom + boxHeight,
    };
  });
}

export interface SlotCollision {
  viewport: number;
  a: string;
  b: string;
  /** Overlap in pixels on each axis. */
  overlapX: number;
  overlapY: number;
}

/**
 * Pairs of slots whose boxes overlap by more than `tolerance` pixels on both
 * axes, and slots that leave the pitch. A token's label sitting on the next
 * token's card is exactly what this catches: the boxes include the labels.
 */
export function slotCollisions(formation: Formation, viewport: number, tolerance = 1): SlotCollision[] {
  const boxes = slotBoxes(formation, viewport);
  const width = pitchWidth(viewport);
  const height = pitchHeight(viewport);
  const out: SlotCollision[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]!;
    if (a.left < -tolerance || a.right > width + tolerance || a.top > height + tolerance) {
      out.push({ viewport, a: a.slotId, b: 'pitch edge', overlapX: 0, overlapY: 0 });
    }
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j]!;
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
      if (overlapX > tolerance && overlapY > tolerance) out.push({ viewport, a: a.slotId, b: b.slotId, overlapX, overlapY });
    }
  }
  return out;
}
