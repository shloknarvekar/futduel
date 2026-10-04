import type { Player } from '@/lib/domain/types';

/**
 * Rating-band colours, used where a rating needs a quick read (pitch tokens).
 * They stay off lime and ice (home and away) and off gold and silver (Icon and
 * Hero), so a current 90-rated player never looks like an Icon card.
 */
export const TIER_TOKEN: Record<Player['tier'], string> = {
  common: 'var(--color-tier-common)',
  rare: 'var(--color-tier-rare)',
  epic: 'var(--color-tier-epic)',
  'world-class': 'var(--color-tier-world)',
};

/**
 * Position hues sit outside the structural palette: lime and ice mean home and
 * away, gold and silver mean Icon and Hero, so no position may borrow them.
 */
export const POSITION_TOKEN: Record<Player['position'], string> = {
  GK: '#ff9f5a',
  DEF: '#8fb0ff',
  MID: '#8fe3c2',
  FWD: '#ff7a90',
};

/** Outfield attribute labels, and the goalkeeping equivalents. */
export const ATTRIBUTE_LABELS: Record<keyof Player['attributes'], string> = {
  pace: 'PAC',
  shooting: 'SHO',
  passing: 'PAS',
  dribbling: 'DRI',
  defending: 'DEF',
  physical: 'PHY',
};

export const GK_ATTRIBUTE_LABELS: Record<keyof Player['attributes'], string> = {
  pace: 'REF',
  shooting: 'HAN',
  passing: 'KIC',
  dribbling: 'SPD',
  defending: 'POS',
  physical: 'AER',
};

export const ATTRIBUTE_FULL: Record<keyof Player['attributes'], string> = {
  pace: 'Pace',
  shooting: 'Shooting',
  passing: 'Passing',
  dribbling: 'Dribbling',
  defending: 'Defending',
  physical: 'Physical',
};

export const GK_ATTRIBUTE_FULL: Record<keyof Player['attributes'], string> = {
  pace: 'Reflexes',
  shooting: 'Handling',
  passing: 'Kicking',
  dribbling: 'Speed',
  defending: 'Positioning',
  physical: 'Aerial',
};

export function attributeLabels(player: Player) {
  return player.position === 'GK'
    ? { short: GK_ATTRIBUTE_LABELS, full: GK_ATTRIBUTE_FULL }
    : { short: ATTRIBUTE_LABELS, full: ATTRIBUTE_FULL };
}

/**
 * Card classification. Metal carries the hierarchy because every collector
 * already reads it: a matte standard card, a silver Hero, a gold Icon. Lime and
 * ice stay reserved for home and away.
 */
export const CARD_TYPE_LABEL: Record<Player['cardType'], string> = {
  standard: 'Standard',
  hero: 'Hero',
  icon: 'Icon',
};

export const CARD_TYPE_TOKEN: Record<Player['cardType'], string> = {
  standard: 'var(--color-ink-soft)',
  hero: 'var(--color-hero-bright)',
  icon: 'var(--color-icon-bright)',
};

/** Relative luminance of a hex colour, per WCAG. */
export function luminanceOf(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Mixes two hex colours in sRGB. `amount` is the share of `toward`. */
export function mixHex(from: string, toward: string, amount: number): string {
  const a = Number.parseInt(from.replace('#', ''), 16);
  const b = Number.parseInt(toward.replace('#', ''), 16);
  const mix = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
  return `#${((mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).padStart(6, '0')}`;
}

/** Light or dark ink, whichever reads better on a club colour. */
export function inkOn(hex: string): '#f2f7f3' | '#07100c' {
  const l = luminanceOf(hex);
  const onLight = (0.93 + 0.05) / (l + 0.05);
  const onDark = (l + 0.05) / (0.005 + 0.05);
  return onLight >= onDark ? '#f2f7f3' : '#07100c';
}

/**
 * Lightness ramp for an attribute value, used only alongside the number. It
 * was lime-to-gold, which spent home and Icon colours on every stat line; the
 * strongest numbers now simply read brightest.
 */
export function attributeTone(value: number): string {
  if (value >= 88) return 'var(--color-ink)';
  if (value >= 80) return '#d3ddd7';
  if (value >= 70) return 'var(--color-ink-soft)';
  return 'var(--color-ink-muted)';
}
