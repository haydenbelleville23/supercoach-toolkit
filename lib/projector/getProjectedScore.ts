import type { Player } from "@/types/player";
import type { ProjectionMode } from "@/lib/projector/projectionModes";

export function getProjectedScore({
  player,
  projectionIndex,
  mode,
  existingScore,
}: {
  player: Player;
  projectionIndex: number;
  mode: ProjectionMode;
  existingScore?: number | null;
}): number {
  switch (mode) {
    case "projected":
      return (
        player.projectedScores[projectionIndex] ??
        Math.round(player.average)
      );

    case "season-average":
      return Math.round(player.average);

    case "three-round-average":
      return Math.round(player.average3);

    case "five-round-average":
      return Math.round(player.average5);

    case "custom":
      return (
        existingScore ??
        player.projectedScores[projectionIndex] ??
        Math.round(player.average)
      );
  }
}