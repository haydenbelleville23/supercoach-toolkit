import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import type { Player } from "@/types/player";

import type { PlayerState } from "./types";

export function createPlayerState(
  player: Player,
): PlayerState {
  return {
    currentRound: 18,
    price: player.price,
    scores: [...player.recentScores],
  };
}