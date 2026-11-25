import { projectScore } from "@/lib/planner/projectScore";
import type { ProjectionMode } from "@/lib/projector/projectionModes";
import type { Player } from "@/types/player";

/**
 * The suggested score for a future round. "projected" (and "custom" with no
 * score typed) uses the Trade Planner's projection (projectScore): the
 * season average from completed rounds.
 */
export function getProjectedScore({
  player,
  round,
  completedRound,
  mode,
  existingScore,
}: {
  player: Player;
  round: number;
  completedRound: number;
  mode: ProjectionMode;
  existingScore?: number | null;
}): number {
  const projected = () =>
    Math.round(projectScore(player, round, completedRound) ?? player.average);

  switch (mode) {
    case "projected":
      return projected();

    case "season-average":
      return Math.round(player.average);

    case "three-round-average":
      return Math.round(player.average3);

    case "five-round-average":
      return Math.round(player.average5);

    case "custom":
      return existingScore ?? projected();
  }
}
