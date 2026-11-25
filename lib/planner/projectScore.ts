import type { Player } from "@/types/player";

/**
 * The Trade Planner's score projection: ONE function, so it can be swapped
 * (a mean-reverting projection that discounts outliers comes later).
 *
 * For now: the player's season average from completed rounds (Round 0 to
 * `completedRound`). Null if they have not played yet, which the planner
 * treats as not playing (price unchanged).
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
    return null;
  }

  return scores.reduce((total, score) => total + score, 0) / scores.length;
}
