import { createPlayerState } from "@/lib/priceEngine/createPlayerState";
import { projectSeason } from "@/lib/priceEngine/projectSeason";

import type { Player } from "@/types/player";

export class EngineService {
  projectPlayer(
    player: Player,
    projectedScores: number[],
  ) {
    const state = createPlayerState(player);

    return projectSeason(
      state,
      projectedScores,
    );
  }
}

export const engineService =
  new EngineService();