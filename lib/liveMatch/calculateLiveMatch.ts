import {
  calculateLivePlayerProjection,
} from "./calculateLivePlayerProjection";

import type { ScaledRoundContext } from "@/lib/priceEngine/estimateScaledRoundContexts";
import type { Player } from "@/types/player";
import type {
  LivePlayerProjection,
  LiveScoreOverrides,
} from "./types";

export function calculateLiveMatch(
  players: Player[],
  liveScores: LiveScoreOverrides,
  /** Round estimate updated with live scores (see buildLiveRoundContext). */
  context?: ScaledRoundContext,
): LivePlayerProjection[] {
  return players
    .map((player) =>
      calculateLivePlayerProjection(
        player,
        liveScores[player.id] ?? 0,
        context,
      ),
    )
    .filter(
      (
        projection,
      ): projection is LivePlayerProjection =>
        projection !== null,
    );
}
