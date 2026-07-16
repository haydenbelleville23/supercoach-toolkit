import {
  calculateLivePlayerProjection,
} from "./calculateLivePlayerProjection";

import type { Player } from "@/types/player";
import type {
  LivePlayerProjection,
  LiveScoreOverrides,
} from "./types";

export function calculateLiveMatch(
  players: Player[],
  liveScores: LiveScoreOverrides,
): LivePlayerProjection[] {
  return players
    .map((player) =>
      calculateLivePlayerProjection(
        player,
        liveScores[player.id] ?? 0,
      ),
    )
    .filter(
      (
        projection,
      ): projection is LivePlayerProjection =>
        projection !== null,
    );
}