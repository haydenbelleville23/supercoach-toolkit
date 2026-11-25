import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import {
  calculateScaledBreakEven,
  calculateScaledPlayerPrice,
} from "@/lib/priceEngine/calculateScaledPlayerPrice";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";
import type { Player } from "@/types/player";

export interface NextRoundPriceProjection {
  round: number;
  oldPrice: number;
  /** Two scores before this round that feed the three-round average. */
  previousScores: [number, number];
  score: number;
  threeRoundAverage: number;
  /** 0.75 * oldPrice + 0.25 * baseMN * threeRoundAverage, before k. */
  rawPrice: number;
  k: number;
  baseMagicNumber: number;
  price: number;
  priceChange: number;
  /** Breakeven for this round (score at which the price does not fall). */
  breakEven: number | null;
  /** Breakeven for the following round after this score and price. */
  nextBreakEven: number | null;
}

/**
 * Scaled-model price for a player's next round given one score (used by
 * Live Scores and the internal engine page). Returns null if the player's
 * price cannot change (fewer than two previous scores) or the round has no
 * estimate.
 */
export function projectNextRoundPrice(
  player: Player,
  score: number,
): NextRoundPriceProjection | null {
  const round = CURRENT_COMPLETED_ROUND + 1;
  const contexts = getScaledRoundContexts();
  const context = contexts.get(round);

  const previousScores = player.history
    .filter((h) => h.round <= CURRENT_COMPLETED_ROUND && h.games > 0)
    .map((h) => h.score as number);

  if (!context || previousScores.length < 2 || !Number.isFinite(score)) {
    return null;
  }

  const input = {
    context,
    playerId: player.id,
    oldPrice: player.price,
    previousScores,
  };

  const result = calculateScaledPlayerPrice({ ...input, score });
  const threeRoundAverage = result.threeRoundAverage as number;

  const nextContext = contexts.get(round + 1);

  return {
    round,
    oldPrice: player.price,
    previousScores: previousScores.slice(-2) as [number, number],
    score,
    threeRoundAverage,
    rawPrice:
      0.75 * player.price +
      0.25 * context.baseMagicNumber * threeRoundAverage,
    k: result.k,
    baseMagicNumber: context.baseMagicNumber,
    price: result.price,
    priceChange: result.priceChange,
    breakEven: calculateScaledBreakEven(input),
    nextBreakEven: nextContext
      ? calculateScaledBreakEven({
          context: nextContext,
          playerId: player.id,
          oldPrice: result.price,
          previousScores: [...previousScores, score],
        })
      : null,
  };
}
