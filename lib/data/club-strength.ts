import { CLUBS } from './clubs';
import { CURRENT_PLAYERS } from './players';

/**
 * Club strength derived from the squads FutDuel ships: the mean rating of each
 * club's best eight players in the 2025/26 snapshot. A FutDuel measure used to
 * order the club grid, not a real-world ranking, and never used to describe a
 * real fixture. Historical versions are excluded so a club's legends never
 * inflate its squad.
 */
export const CLUB_STRENGTH = (() => {
  const map = new Map<string, number>();
  for (const club of CLUBS) {
    const squad = CURRENT_PLAYERS.filter((p) => p.clubId === club.id);
    const top = [...squad].sort((a, b) => b.rating - a.rating).slice(0, 8);
    const avg = top.length ? top.reduce((s, p) => s + p.rating, 0) / top.length : 74;
    map.set(club.id, Math.round(avg * 10) / 10);
  }
  return map;
})();
