import type { FantasyPosition, SquadPlayer } from '@/lib/football/types';
import { formatDate } from '@/lib/utils/format';

/** Provider rounds are usually numbered; say "Matchweek 4" rather than "4". */
export function roundLabel(name: string): string {
  return /^\d+$/.test(name) ? `Matchweek ${name}` : name;
}

export const POSITION_GROUP: Record<FantasyPosition, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defenders',
  MID: 'Midfielders',
  FWD: 'Forwards',
};

export const signedPoints = (points: number) => `${points > 0 ? '+' : ''}${points}`;

/** "Injured, expected back Sat 20 Sep", from the provider's sidelined record. */
export function availabilityText(player: SquadPlayer): string | null {
  const { status, expectedReturn } = player.availability;
  if (status === 'available') return null;
  const label = status === 'injured' ? 'Injured' : 'Suspended';
  return expectedReturn ? `${label}, expected back ${formatDate(expectedReturn)}` : label;
}
