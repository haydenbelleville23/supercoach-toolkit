import { currentMatchupValue } from "@/lib/fixtureDifficulty/current";
import { projectScore } from "@/lib/planner/projectScore";
import type { ProjectionMode } from "@/lib/projector/projectionModes";
import type { Player } from "@/types/player";

/**
 * The suggested score for a future round. "projected" uses the Trade
 * Planner's projection (projectScore): the season average from completed
 * rounds, else last season's average (50 for a debutant). With `matchup`
 * on, "projected" adds the opponent's position difficulty (method
 * seasonAverageRookie50Matchup).
 * The average modes stay plain, and use the plain projection until he
 * has played this season, so no one is shown as 0.
 */
export function getProjectedScore({
  player,
  round,
  completedRound,
  mode,
  matchup = false,
}: {
  player: Player;
  round: number;
  completedRound: number;
  mode: ProjectionMode;
  /** Add the matchup adjustment (Projected only). */
  matchup?: boolean;
}): number {
  const projected = (withMatchup: boolean) =>
    Math.round(
      projectScore(
        player,
        round,
        completedRound,
        withMatchup
          ? { method: "seasonAverageRookie50Matchup", matchup: currentMatchupValue }
          : { method: "seasonAverageRookie50" },
      ) ?? player.average,
    );

  const usesMatchup = matchup && mode === "projected";

  if (player.games === 0) {
    return projected(usesMatchup);
  }

  switch (mode) {
    case "projected":
      return projected(usesMatchup);

    case "season-average":
      return Math.round(player.average);

    case "three-round-average":
      return Math.round(player.average3);

    case "five-round-average":
      return Math.round(player.average5);

  }
}
