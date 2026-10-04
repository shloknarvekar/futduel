/**
 * When both elevens may be shown. Only from kickoff on: by then both squads
 * are locked and the match is decided, so a lineup can never give away a
 * draft that is still being built, whether the other side is an AI, a friend
 * answering a link, or the next manager waiting to take the device.
 */
export const LINEUP_PHASES = ['kickoff', 'broadcast', 'result'] as const;

export function lineupsVisible(phase: string, bothLocked: boolean): boolean {
  return bothLocked && (LINEUP_PHASES as readonly string[]).includes(phase);
}
