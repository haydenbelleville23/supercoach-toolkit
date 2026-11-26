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
 * The Trade Planner's score projection: ONE function, so it can be swapped.
 *
 * - The player's season average from completed rounds (Round 0 to
 *   `completedRound`).
 * - No games yet this season (preseason, injured, or not yet picked):
 *   last season's average, or PRE_DEBUT_ROOKIE_SCORE for a debutant (no
 *   games last season). So every real player is projected to play.
 *
 * Rookie (TBC) placeholders keep their fixed price and get no projection
 * (null).
 */
export function projectScore(
  player: Player,
  round: number,
  completedRound: number,
): number | null {
  void round; // Same projection every round for now.

  const scores = player.history
    .filter((row) => row.round <= completedRound && row.games > 0)
    .map((row) => row.score as number);

  if (scores.length === 0) {
    if (isPlaceholderId(player.id)) {
      return null;
    }
    return player.previousGames > 0 && player.previousAverage > 0
      ? player.previousAverage
      : PRE_DEBUT_ROOKIE_SCORE;
  }

  return scores.reduce((total, score) => total + score, 0) / scores.length;
}
