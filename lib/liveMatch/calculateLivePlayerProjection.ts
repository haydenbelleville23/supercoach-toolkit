import { createPlayerState } from "@/lib/priceEngine/createPlayerState";
import { projectSeason } from "@/lib/priceEngine/projectSeason";

import type { Player } from "@/types/player";
import type { LivePlayerProjection } from "./types";

export function calculateLivePlayerProjection(
  player: Player,
  liveScore: number,
): LivePlayerProjection | null {
  if (
    player.recentScores.length < 2 ||
    !Number.isFinite(player.price) ||
    !Number.isFinite(liveScore)
  ) {
    return null;
  }

  const safeLiveScore = Math.max(
    0,
    Math.round(liveScore),
  );

  const state = createPlayerState(player);

  /*
   * The first result calculates this round using the
   * supplied live score as the assumed final score.
   *
   * The second result is only used to obtain the
   * following round's break-even after this score and
   * price movement have been applied.
   */
  const projections = projectSeason(state, [
    safeLiveScore,
    0,
  ]);

  const currentRoundProjection =
    projections[0];

  const nextRoundProjection =
    projections[1];

  if (!currentRoundProjection) {
    return null;
  }

  return {
    player,

    liveScore: safeLiveScore,

    currentPrice: player.price,
    currentBreakEven: player.breakeven,

    projectedPrice:
      currentRoundProjection.price,

    projectedPriceChange:
      currentRoundProjection.priceChange,

    nextBreakEven:
      nextRoundProjection?.breakEven ?? null,
  };
}