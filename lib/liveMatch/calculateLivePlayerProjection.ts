import type { ScaledRoundContext } from "@/lib/priceEngine/estimateScaledRoundContexts";
import { projectNextRoundPrice } from "@/lib/projector/projectNextRoundPrice";

import type { Player } from "@/types/player";
import type { LivePlayerProjection } from "./types";

/**
 * Projected end-of-round price if the player's live score is their final
 * score, using the scaled price model (see projectNextRoundPrice), plus the
 * following round's breakeven after that price change.
 */
export function calculateLivePlayerProjection(
  player: Player,
  liveScore: number,
  context?: ScaledRoundContext,
): LivePlayerProjection | null {
  if (
    !Number.isFinite(player.price) ||
    !Number.isFinite(liveScore)
  ) {
    return null;
  }

  const safeLiveScore = Math.max(
    0,
    Math.round(liveScore),
  );

  const projection = projectNextRoundPrice(
    player,
    safeLiveScore,
    context,
  );

  if (!projection) {
    return null;
  }

  return {
    player,

    liveScore: safeLiveScore,

    currentPrice: player.price,
    currentBreakEven: player.breakeven,

    projectedPrice: projection.price,

    projectedPriceChange:
      projection.priceChange,

    nextBreakEven: projection.nextBreakEven,
  };
}
