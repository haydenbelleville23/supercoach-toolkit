import type { Player } from "@/types/player";

import { isPlaceholderId } from "./placeholders";

/**
 * Projected score for a debutant who hasn't played yet (no games last
 * season and none this season). The projection backtest
 * (scripts/backtest-projections.ts) found a fixed 50 cut these players'
 * +3-round price error from about $34k to $15k; 55 and 60 were worse.
 */
export const PRE_DEBUT_ROOKIE_SCORE = 50;

/**
 * How future scores are projected:
 * - "seasonAverage": this season's average only (null with no games yet).
 * - "seasonAverageRookie50": the season average; with no games yet, last
 *   season's average, or PRE_DEBUT_ROOKIE_SCORE for a debutant.
 * - "seasonAverageRookie50Matchup": the same plus the opponent's position
 *   difficulty that round (see lib/fixtureDifficulty). A debutant yet to
 *   play stays at 50 with no adjustment.
 */
export type ProjectionMethod = "seasonAverage" | "seasonAverageRookie50" | "seasonAverageRookie50Matchup";

export const PROJECTION_METHODS: readonly ProjectionMethod[] = [
  "seasonAverage",
  "seasonAverageRookie50",
  "seasonAverageRookie50Matchup",
];

/** The Projector's Projected mode and the Trade Planner (matchup switch on). */
export const DEFAULT_PROJECTION_METHOD: ProjectionMethod = "seasonAverageRookie50Matchup";

export interface ProjectionOptions {
  /** Default "seasonAverageRookie50" (the previous behaviour). */
  method?: ProjectionMethod;
  /** Points to add for the opponent that round (Matchup method only); null or missing = 0. */
  matchup?: (player: Player, round: number) => number | null;
}

/**
 * The score projection used by the Trade Planner and the Projector: ONE
 * function, with the method chosen by the caller (see ProjectionMethod).
 *
 * - The player's season average from completed rounds (Round 0 to
 *   `completedRound`), plus the matchup adjustment with that method.
 * - No games yet this season (preseason, injured, or not yet picked):
 *   last season's average, or PRE_DEBUT_ROOKIE_SCORE for a debutant (no
 *   games last season). So every real player is projected to play.
 *
 * Rookie (TBC) placeholders keep their fixed price and get no projection
 * (null).
 */
/** A debutant yet to play: no games this season (to completedRound) and none last season. */
export function isPreDebutRookie(player: Player, completedRound: number): boolean {
  return (
    !isPlaceholderId(player.id) &&
    !player.history.some((row) => row.round <= completedRound && row.games > 0) &&
    !(player.previousGames > 0 && player.previousAverage > 0)
  );
}

export function projectScore(
  player: Player,
  round: number,
  completedRound: number,
  { method = "seasonAverageRookie50", matchup }: ProjectionOptions = {},
): number | null {
  const scores = player.history
    .filter((row) => row.round <= completedRound && row.games > 0)
    .map((row) => row.score as number);

  if (isPlaceholderId(player.id)) {
    return null;
  }

  if (scores.length === 0) {
    if (method === "seasonAverage") return null;
    const hasLastSeason = player.previousGames > 0 && player.previousAverage > 0;
    if (!hasLastSeason) return PRE_DEBUT_ROOKIE_SCORE; // debutant: never adjusted
    return player.previousAverage + (method === "seasonAverageRookie50Matchup" ? (matchup?.(player, round) ?? 0) : 0);
  }

  const average = scores.reduce((total, score) => total + score, 0) / scores.length;
  return average + (method === "seasonAverageRookie50Matchup" ? (matchup?.(player, round) ?? 0) : 0);
}
