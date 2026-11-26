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
 * - A debutant yet to play (no games last season or this season):
 *   PRE_DEBUT_ROOKIE_SCORE, so his price moves once he has played three
 *   projected games.
 * - Anyone else with no games this season (for example injured all year):
 *   null, which the planner treats as not playing (price unchanged).
 *
 * Rookie (TBC) placeholders keep their fixed price and get no projection.
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
    return !isPlaceholderId(player.id) && player.previousGames === 0
      ? PRE_DEBUT_ROOKIE_SCORE
      : null;
  }

  return scores.reduce((total, score) => total + score, 0) / scores.length;
}
