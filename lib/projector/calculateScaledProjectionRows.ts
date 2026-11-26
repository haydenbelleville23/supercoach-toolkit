import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import {
  calculateScaledBreakEven,
  calculateScaledPlayerPrice,
} from "@/lib/priceEngine/calculateScaledPlayerPrice";
import type { ScaledRoundContext } from "@/lib/priceEngine/estimateScaledRoundContexts";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";
import type { Player } from "@/types/player";
import type { SeasonProjectionRow } from "@/types/projection";

/**
 * Scaled-model replacement for calculateProjectionRows, with the same
 * inputs and output shape, so the Price Projector UI is unchanged.
 *
 * Each future round's price uses the scaled model with that round's
 * estimated k (previous round's total as the anchor). The MN column shows
 * the effective magic number (baseMN x k). Breakevens use the same
 * function: the lowest score at which the price does not fall.
 */
export function calculateScaledProjectionRows(
  rowsToCalculate: SeasonProjectionRow[],
  player: Player,
  contexts: Map<number, ScaledRoundContext> = getScaledRoundContexts(),
): SeasonProjectionRow[] {
  let price = player.price;
  const scores = player.history
    .filter((h) => h.round <= CURRENT_COMPLETED_ROUND && h.games > 0)
    .map((h) => h.score as number);

  return rowsToCalculate.map((row) => {
    if (row.round < CURRENT_COMPLETED_ROUND) {
      return row;
    }

    if (row.round === CURRENT_COMPLETED_ROUND) {
      return {
        ...row,
        price: player.price,
        priceChange: null,
      };
    }

    const context = contexts.get(row.round);

    // Bye, a round left blank, or no estimate: the price holds.
    if (!row.played || row.score === null || !context) {
      return {
        ...row,
        breakEven: null,
        price,
        priceChange: null,
        threeRoundAverage: null,
      };
    }

    const breakEven = calculateScaledBreakEven({
      context,
      playerId: player.id,
      oldPrice: price,
      previousScores: scores,
    });

    const result = calculateScaledPlayerPrice({
      context,
      playerId: player.id,
      oldPrice: price,
      previousScores: scores,
      score: row.score,
    });

    price = result.price;
    scores.push(row.score);

    return {
      ...row,
      breakEven,
      price: result.price,
      priceChange: result.priceChange,
      threeRoundAverage: result.threeRoundAverage,
      magicNumber: Math.round(result.effectiveMagicNumber),
    };
  });
}
