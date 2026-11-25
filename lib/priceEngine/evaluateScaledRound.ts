import type { Player } from "@/types/player";
import { buildScaledRoundInputs } from "./buildScaledRoundInputs";
import {
  calculateScaledRoundPrices,
  type ScaledRoundResult,
} from "./calculateScaledRoundPrices";

export interface ScaledRoundEvaluation extends ScaledRoundResult {
  round: number;
  playersCompared: number;
  totalPriceError: number;
  averagePriceError: number;
  maxPriceError: number;
}

/**
 * Runs the scaled model for a completed round and compares it with the
 * published prices. Errors are measured over eligible players, the same set
 * the old solver (evaluateMagicNumber) compares.
 *
 * Returns null when the round has no eligible players to compare.
 */
export function evaluateScaledRound(
  players: Player[],
  round: number,
  baseMagicNumber: number,
): ScaledRoundEvaluation | null {
  const inputs = buildScaledRoundInputs(players, round);

  const result = calculateScaledRoundPrices({
    players: inputs.players,
    baseMagicNumber,
    anchorTotal: inputs.anchorTotal,
  });

  let playersCompared = 0;
  let totalPriceError = 0;
  let maxPriceError = 0;

  result.players.forEach((prediction, index) => {
    const actualPrice = inputs.players[index].actualPrice;

    if (prediction.category !== "eligible" || actualPrice === null) {
      return;
    }

    const error = Math.abs(prediction.predictedPrice - actualPrice);

    playersCompared += 1;
    totalPriceError += error;
    maxPriceError = Math.max(maxPriceError, error);
  });

  if (playersCompared === 0) {
    return null;
  }

  return {
    ...result,
    round,
    playersCompared,
    totalPriceError,
    averagePriceError: totalPriceError / playersCompared,
    maxPriceError,
  };
}
