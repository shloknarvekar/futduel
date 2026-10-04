/**
 * How much this browser keeps. Split out with no imports so the profile store,
 * which every page loads through the header, does not pull in the player data
 * or the match engine just to know a number.
 */

/** Finished duels kept per browser. The oldest drop off, so storage cannot grow without limit. */
export const HISTORY_KEPT = 50;
