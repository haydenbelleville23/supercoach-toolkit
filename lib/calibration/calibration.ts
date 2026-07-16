import { createPlayerState } from "@/lib/priceEngine/createPlayerState";
import { projectSeason } from "@/lib/priceEngine/projectSeason";

import type { Player } from "@/types/player";
import type { CalibrationResult } from "@/types/calibration";

export function calibratePlayer(
  player: Player,
): CalibrationResult | null {
  if (player.projectedScores.length === 0) {
    return null;
  }

  const state = createPlayerState(player);

  const result = projectSeason(state, [
    player.projectedScores[0],
  ])[0];

  if (!result) {
    return null;
  }

  return {
    playerId: player.id,
    playerName: player.name,

    currentPrice: player.price,

    projectedScore: player.projectedScores[0],

    officialProjectedPrice:
      player.projectedPrices[0] ?? result.price,

    engineProjectedPrice:
      result.price,

    difference:
      result.price -
      (player.projectedPrices[0] ?? result.price),
  };
}