/**
 * Fixture difficulty settings, in one place. The colour thresholds are
 * starting values only.
 */

/** A player counts if his season average is above this... */
export const MIN_SEASON_AVG = 80;

/** ...with at least this many games. */
export const MIN_GAMES = 5;

/**
 * Shrinkage for small samples: each cell is multiplied by n / (n + k).
 * 0 means no shrinkage.
 */
export const MATCHUP_SHRINK_K = 0;

/** Cells with fewer player-games than this are marked "low sample". */
export const LOW_SAMPLE_N = 10;

/** Position and Fixture cells: above +3 easy, below -3 hard (points). */
export const POSITION_COLOUR_THRESHOLD = 3;

/**
 * Teams view Net: above +75 easy, below -75 hard (points per game). Was
 * 50; at Round 10 that put half the teams in red and 11% neutral.
 */
export const TEAM_NET_COLOUR_THRESHOLD = 75;

/** Next5: this many upcoming played rounds (byes skipped). */
export const NEXT_ROUNDS = 5;

export const POSITION_GROUPS = ["DEF", "MID", "RUC", "FWD"] as const;
export type PositionGroup = (typeof POSITION_GROUPS)[number];
